import os
os.environ['DATABASE_URL'] = 'sqlite://'
os.environ['JWT_SECRET'] = 'test-only-secret-that-is-longer-than-32-characters'
os.environ['APP_ENV'] = 'test'

import unittest
from unittest.mock import patch, MagicMock
from datetime import timedelta
from pydantic import ValidationError
from sqlalchemy import create_engine, select
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, get_db
from app.models import User, Draft, Ticket, LoginSession, now
from app.auth import hasher, COOKIE
from app.schemas import Classification, GroundedReply
from app import ai
from app import knowledge
from app import seed
from app.events import event_batch
from langchain_core.documents import Document
from langchain_core.embeddings import DeterministicFakeEmbedding

class CoreTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
        Base.metadata.create_all(self.engine)
        self.sessions = sessionmaker(self.engine, expire_on_commit=False)
        def database():
            with self.sessions() as db:
                yield db
        app.dependency_overrides[get_db] = database
        with self.sessions.begin() as db:
            for name, role in [('agent','agent'), ('employee','employee'), ('other','employee')]:
                db.add(User(id=name, email=name+'@test.local', name=name, role=role, password_hash=hasher.hash('test-password-123')))
        self.agent = self.login('agent')
        self.employee = self.login('employee')
        self.other = self.login('other')
        self.classifier = patch(
            'app.ai.classify',
            return_value=Classification(category='IT', priority='Medium', confidence=0.84),
        )
        self.classifier.start()

    def login(self, name):
        c = TestClient(app)
        response = c.post('/api/auth/login', json={'email':name+'@test.local', 'password':'test-password-123'})
        self.assertEqual(response.status_code, 200)
        c.headers['X-CSRF-Token'] = response.json()['csrf']
        return c

    def tearDown(self):
        self.classifier.stop()
        app.dependency_overrides.clear()
        for c in [self.agent, self.employee, self.other]: c.close()
        self.engine.dispose()

    def ticket(self):
        r = self.employee.post('/api/tickets', json={'title':'VPN broken', 'description':'My VPN stopped working after changing my password.'})
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()['id']

    def test_auth_csrf_and_logout_revocation(self):
        with TestClient(app) as stranger:
            self.assertEqual(stranger.get('/api/tickets').status_code, 401)
            self.assertEqual(stranger.post('/api/auth/login', json={'email':'agent@test.local', 'password':'wrong'}).status_code, 401)
            self.assertEqual(stranger.post('/api/auth/login', headers={'Origin':'https://evil.example'}, json={'email':'agent@test.local','password':'test-password-123'}).status_code, 403)
        self.employee.headers.pop('X-CSRF-Token')
        self.assertEqual(self.employee.post('/api/tickets', json={'title':'VPN broken','description':'A valid description here'}).status_code, 403)
        self.employee.headers['X-CSRF-Token'] = self.employee.get('/api/auth/me').json()['csrf']
        old_token = self.employee.cookies.get(COOKIE)
        self.assertEqual(self.employee.post('/api/auth/logout').status_code, 200)
        self.employee.cookies.set(COOKIE, old_token)
        self.assertEqual(self.employee.get('/api/auth/me').status_code, 401)

    def test_ownership_and_agent_permissions(self):
        identity = self.ticket()
        self.assertEqual(self.other.get('/api/tickets/'+identity).status_code, 404)
        self.assertEqual(self.other.get('/api/tickets').json()['total'], 0)
        self.assertEqual(self.employee.get('/api/metrics').status_code, 403)
        self.assertEqual(self.employee.patch('/api/tickets/'+identity, json={'category':'HR','priority':'Low'}).status_code, 403)
        self.assertEqual(self.employee.post('/api/tickets/'+identity+'/drafts').status_code, 403)
        self.assertEqual(self.employee.post('/api/tickets/'+identity+'/reply', json={'body':'not allowed'}).status_code, 403)
        self.assertEqual(self.agent.get('/api/tickets').json()['total'], 1)

    def test_override_audit_draft_preservation_and_resolve(self):
        identity = self.ticket()
        with patch('app.ai.draft_reply', return_value=('Original AI draft', [{'source':'vpn.md','title':'VPN','excerpt':'Help'}])):
            self.assertEqual(self.agent.post('/api/tickets/'+identity+'/drafts').status_code, 201)
        result = self.agent.patch('/api/tickets/'+identity, json={'category':'HR','priority':'High'}).json()
        self.assertEqual(result['ai_category'], 'IT')
        self.assertEqual(result['ai_confidence'], 0.84)
        self.assertEqual(len(result['audit']), 2)
        self.assertEqual(result['audit'][0]['actor'], 'agent')
        self.agent.patch('/api/tickets/'+identity, json={'category':'HR','priority':'High'})
        self.assertEqual(len(self.agent.get('/api/tickets/'+identity).json()['audit']), 2)
        result = self.agent.post('/api/tickets/'+identity+'/reply', json={'body':'Edited final answer'}).json()
        self.assertEqual(result['status'], 'Resolved')
        self.assertEqual(result['drafts'][0]['body'], 'Original AI draft')
        self.assertEqual(result['final_reply'], 'Edited final answer')
        self.assertEqual(self.agent.post('/api/tickets/'+identity+'/reply', json={'body':'Overwrite'}).status_code, 409)
        self.assertEqual(self.agent.patch('/api/tickets/'+identity, json={'category':'IT','priority':'Low'}).status_code, 409)
        employee_view = self.employee.get('/api/tickets/'+identity).json()
        self.assertNotIn('drafts', employee_view)
        self.assertEqual(employee_view['final_reply'], 'Edited final answer')
        metrics = self.agent.get('/api/metrics').json()
        self.assertEqual(metrics['category_override_percentage'], 100)
        self.assertEqual(metrics['statuses']['Resolved'], 1)
        self.assertIsNotNone(metrics['median_resolution_hours'])

    def test_filters_and_input_validation(self):
        identity = self.ticket()
        self.assertEqual(self.agent.get('/api/tickets?search=vPn&category=IT&status=Open&priority=Medium').json()['total'], 1)
        self.assertEqual(self.agent.get('/api/tickets?search=%25').json()['total'], 0)
        self.assertEqual(self.agent.patch('/api/tickets/'+identity, json={'category':'Invalid','priority':'Low'}).status_code, 422)
        self.assertEqual(self.employee.post('/api/tickets', json={'title':'abc', 'description':'          '}).status_code, 422)
        self.assertEqual(self.agent.post('/api/tickets/'+identity+'/reply', json={'body':'    '}).status_code, 422)

    def test_seed_prints_working_demo_credentials(self):
        password = 'reviewer-demo-password'
        with (
            patch('app.seed.SessionLocal', self.sessions),
            patch.object(seed.settings, 'seed_password', password),
            patch('builtins.print') as output,
        ):
            seed.main()
            seed.main()
        with self.sessions() as db:
            account = db.scalar(select(User).where(User.email == 'agent@quickdesk.test'))
            self.assertTrue(hasher.verify(account.password_hash, password))
        rendered = '\n'.join(' '.join(map(str, call.args)) for call in output.call_args_list)
        self.assertIn('agent@quickdesk.test', rendered)
        self.assertIn('Password ' + password, rendered)

    def test_ai_failure_preserves_manual_workflow(self):
        with patch('app.ai.classify', side_effect=ValueError('invalid model enum')):
            identity = self.ticket()
        result = self.agent.get('/api/tickets/'+identity).json()
        self.assertEqual(result['classification_status'], 'failed')
        self.assertIsNone(result['ai_category'])
        self.assertIsNone(result['ai_confidence'])
        with patch('app.ai.draft_reply', side_effect=TimeoutError()):
            self.assertEqual(self.agent.post('/api/tickets/'+identity+'/drafts').status_code, 503)
        self.assertEqual(self.agent.post('/api/tickets/'+identity+'/reply', json={'body':'Manual help'}).status_code, 200)
        self.assertEqual(self.agent.get('/api/metrics').json()['classified_tickets'], 0)

    def test_event_authorization_and_logout(self):
        self.ticket()
        with self.sessions() as db:
            session_ids = {s.user_id:s.id for s in db.scalars(select(LoginSession))}
        with patch('app.events.SessionLocal', self.sessions):
            self.assertEqual(len(event_batch('employee','employee',session_ids['employee'],0)),1)
            self.assertEqual(event_batch('other','employee',session_ids['other'],0),[])
            self.assertEqual(len(event_batch('agent','agent',session_ids['agent'],0)),1)
            self.assertIsNone(event_batch('agent','agent','revoked',0))

class RagTests(unittest.TestCase):
    def test_classification_confidence_is_bounded(self):
        self.assertEqual(
            Classification(category='IT', priority='High', confidence=0.9).confidence,
            0.9,
        )
        with self.assertRaises(ValidationError):
            Classification(category='IT', priority='High', confidence=1.1)

    def test_markdown_articles_are_loaded_for_startup_ingestion(self):
        documents = knowledge.load_documents()
        self.assertGreaterEqual(len(documents), 5)
        self.assertTrue(all(doc.metadata['source'].endswith('.md') for doc in documents))
        self.assertNotIn('README.md', {doc.metadata['source'] for doc in documents})

    def test_in_memory_index_is_built_from_articles(self):
        with patch('app.knowledge._embeddings', return_value=DeterministicFakeEmbedding(size=32)):
            count = knowledge.initialize_knowledge_base()
        self.assertEqual(count, len(knowledge.load_documents()))
        self.assertEqual(knowledge.knowledge_status(), {'ready': True, 'chunks': count})
        results = knowledge.get_vector_store().similarity_search_with_score('VPN access', k=3)
        self.assertEqual(len(results), 3)
        self.assertTrue(all(result.metadata['source'].endswith('.md') for result, _ in results))

    def test_no_relevant_context_does_not_generate(self):
        with patch('app.ai.get_vector_store') as store, patch('app.ai.llm') as model:
            store.return_value.similarity_search_with_score.return_value = []
            self.assertEqual(ai.draft_reply('Unknown', 'Unrelated question'), (ai.NO_GUIDANCE, []))
            model.assert_not_called()

    def test_citations_must_be_retrieved(self):
        doc = Document(page_content='Sign in again', metadata={'source':'vpn.md','title':'VPN'})
        with patch('app.ai.get_vector_store') as store, patch('app.ai.llm') as model:
            store.return_value.similarity_search_with_score.return_value = [(doc,.9)]
            model.return_value.with_structured_output.return_value.invoke.return_value = GroundedReply(supported=True,reply='Advice',sources=['invented.md'])
            with self.assertRaises(ValueError): ai.draft_reply('VPN', 'VPN issue')
            model.return_value.with_structured_output.return_value.invoke.return_value = GroundedReply(supported=False,reply='Not supported',sources=[])
            self.assertEqual(ai.draft_reply('VPN', 'VPN issue'), (ai.NO_GUIDANCE, []))

if __name__ == '__main__':
    unittest.main()
