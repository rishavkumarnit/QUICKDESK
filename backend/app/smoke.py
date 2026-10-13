"""Opt-in live demo: creates one resolved sample ticket using configured services."""
import httpx
from app.config import settings

def login(email):
    client = httpx.Client(base_url='http://127.0.0.1:8000/api', timeout=120)
    result = client.post('/auth/login', json={'email': email, 'password': settings.seed_password})
    result.raise_for_status()
    client.headers['X-CSRF-Token'] = result.json()['csrf']
    return client

def main():
    with login('employee@quickdesk.test') as employee, login('agent@quickdesk.test') as agent:
        result = employee.post('/tickets', json={'title':'Demo: VPN stopped after password reset',
            'description':'I changed my company password this morning. Normal internet works but the company VPN now rejects my login. How can I reconnect?',
            'attachment':'vpn-error-example.png'})
        result.raise_for_status()
        ticket = result.json()
        assert ticket['classification_status'] == 'complete', 'Classification failed'
        print('Live classification: ' + ticket['category'] + ' / ' + ticket['priority'])
        path = '/tickets/' + ticket['id']
        result = agent.post(path + '/drafts')
        result.raise_for_status()
        draft = result.json()['drafts'][0]
        assert draft['citations'], 'No supporting citations were retrieved'
        assert any(c['source'] == 'vpn-troubleshooting.md' for c in draft['citations'])
        print('Live RAG: grounded draft with ' + str(len(draft['citations'])) + ' source(s)')
        priority = 'High' if ticket['priority'] != 'High' else 'Medium'
        result = agent.patch(path, json={'category':ticket['category'], 'priority':priority})
        result.raise_for_status()
        assert result.json()['audit'], 'Override was not audited'
        result = agent.post(path + '/reply', json={'body':draft['body'] + '\n\nIf the issue persists, reply through a new support request with the exact error message.'})
        result.raise_for_status()
        final = employee.get(path).json()
        assert final['status'] == 'Resolved' and final['final_reply']
        assert agent.get(path).json()['drafts'][0]['body'] == draft['body']
        assert agent.get('/metrics').status_code == 200
        employee.post('/auth/logout').raise_for_status()
        agent.post('/auth/logout').raise_for_status()
        print('Live workflow passed: override, audit, final reply, draft preservation, employee visibility, metrics.')
        print('Demo ticket ID: ' + ticket['id'])

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit(f'Live smoke failed: {type(error).__name__}. Inspect the app; credentials suppressed.')
