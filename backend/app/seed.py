"""Create or refresh local demo users from environment configuration."""
from sqlalchemy import select
from argon2.exceptions import VerificationError, InvalidHashError
from app.db import SessionLocal
from app.auth import hasher
from app.models import User
from app.config import settings

def main():
    if len(settings.seed_password) < 12:
        raise SystemExit('Set SEED_PASSWORD in backend/.env to at least 12 characters.')
    accounts = [
        ('agent@quickdesk.test', 'Alex Morgan', 'agent'),
        ('employee@quickdesk.test', 'Sam Patel', 'employee'),
        ('employee2@quickdesk.test', 'Jordan Lee', 'employee'),
    ]
    with SessionLocal.begin() as db:
        for email, name, role in accounts:
            user = db.scalar(select(User).where(User.email == email))
            if not user:
                db.add(User(email=email, name=name, role=role, password_hash=hasher.hash(settings.seed_password)))
                print('Created ' + email)
            else:
                user.name, user.role = name, role
                try:
                    password_matches = hasher.verify(user.password_hash, settings.seed_password)
                except (VerificationError, InvalidHashError):
                    password_matches = False
                if not password_matches:
                    user.password_hash = hasher.hash(settings.seed_password)
                    print('Updated password: ' + email)
                else:
                    print('Already exists: ' + email)

    print('\nDemo login credentials')
    for email, _, role in accounts:
        print(f'  {role.capitalize():8} {email}')
    print('  Password ' + settings.seed_password)
    print('\nThese credentials are for local assessment use only.')

if __name__ == '__main__':
    main()
