"""Opt-in live SSE test. Creates and resolves one clearly labeled demo ticket."""
import json
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor
from threading import Event
import httpx
from app.smoke import login

def watch(cookies, ready):
    found = []
    with httpx.Client(cookies=cookies, timeout=120) as client:
        with client.stream('GET', 'http://127.0.0.1:8000/api/events') as response:
            response.raise_for_status()
            for line in response.iter_lines():
                if line == 'event: ready':
                    ready.set()
                if line.startswith('data: ') and line != 'data: {}':
                    data = json.loads(line[6:])
                    found.append(data)
                    if len(found) == 2:
                        return found

def main():
    with closing(login('employee@quickdesk.test')) as employee, closing(login('agent@quickdesk.test')) as agent:
        with ThreadPoolExecutor(max_workers=2) as pool:
            employee_ready, agent_ready = Event(), Event()
            employee_events = pool.submit(watch, employee.cookies, employee_ready)
            agent_events = pool.submit(watch, agent.cookies, agent_ready)
            assert employee_ready.wait(15) and agent_ready.wait(15), 'Streams did not open'
            result = employee.post('/tickets', json={'title':'Demo: leave request process',
                'description':'I would like to request planned leave. Where should I submit the dates and who approves the request?'})
            result.raise_for_status()
            ticket_id = result.json()['id']
            result = agent.post('/tickets/'+ticket_id+'/reply', json={'body':'Please submit your planned dates and leave type through the HR portal, with a handover note. Your reporting manager reviews the request; submission does not mean it is approved.'})
            result.raise_for_status()
            for future in [employee_events, agent_events]:
                rows = future.result(timeout=20)
                assert [r['kind'] for r in rows] == ['created','resolved']
                assert all(r['ticket_id'] == ticket_id for r in rows)
        employee.post('/auth/logout').raise_for_status()
        agent.post('/auth/logout').raise_for_status()
    print('Live SSE passed: both employee and agent received created and resolved events without refreshing.')

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit(f'SSE smoke failed: {type(error).__name__}; credentials suppressed.')
