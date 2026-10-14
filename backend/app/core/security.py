"""Password hashing and authentication cookie constants."""

import secrets

from argon2 import PasswordHasher


hasher = PasswordHasher()
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))
COOKIE = "quickdesk_session"
