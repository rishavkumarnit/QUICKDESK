"""Create sample users once. Passwords come from env, never source control."""
from sqlalchemy import select
from app.db import SessionLocal
from app.auth import hasher
from app.models import User
from app.config import settings

def main():
    if len(settings.seed_password) < 12:
        raise SystemExit('Set SEED_PASSWORD in backend/.env to at least 12 characters.')
    with SessionLocal.begin() as db:
        for email, name, role in [('agent@quickdesk.test', 'Alex Morgan', 'agent'),
                                  ('employee@quickdesk.test', 'Sam Patel', 'employee'),
                                  ('employee2@quickdesk.test', 'Jordan Lee', 'employee')]:
            if not db.scalar(select(User).where(User.email == email)):
                db.add(User(email=email, name=name, role=role, password_hash=hasher.hash(settings.seed_password)))
                print('Created ' + email)
            else:
                print('Already exists: ' + email)

if __name__ == '__main__':
    main()
