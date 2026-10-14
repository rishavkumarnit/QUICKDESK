"""Reusable authentication and authorization dependencies."""

import secrets

import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import COOKIE
from app.db.models import LoginSession, User
from app.db.session import get_db


def origin_check(request: Request):
    origin = request.headers.get("origin")
    if origin and origin not in settings.allowed_origins:
        raise HTTPException(403, "Untrusted origin")


def decode(request: Request):
    try:
        return jwt.decode(
            request.cookies.get(COOKIE, ""),
            settings.jwt_secret,
            algorithms=["HS256"],
            issuer="quickdesk",
            audience="quickdesk-web",
            options={"require": ["exp", "sub", "jti", "csrf", "iat"]},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Please sign in")


def current_user(request: Request, db: Session = Depends(get_db)):
    payload = decode(request)
    session = db.get(LoginSession, payload["jti"])
    user = db.get(User, payload["sub"])
    if not session or not user or session.user_id != user.id:
        raise HTTPException(401, "Please sign in")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        origin_check(request)
        if not secrets.compare_digest(
            request.headers.get("x-csrf-token", ""), payload["csrf"]
        ):
            raise HTTPException(403, "Invalid CSRF token")
    request.state.auth = payload
    return user


def agent(user: User = Depends(current_user)):
    if user.role != "agent":
        raise HTTPException(403, "Agent access required")
    return user


def public_user(user: User) -> dict:
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.role}
