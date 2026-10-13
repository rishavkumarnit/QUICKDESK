import secrets
from datetime import timedelta
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import Depends, HTTPException, Request, Response, APIRouter
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.config import settings
from app.db import get_db
from app.models import User, LoginSession, now
from app.schemas import Login

router = APIRouter(prefix='/api/auth', tags=['auth'])
hasher = PasswordHasher()
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))
COOKIE = 'quickdesk_session'

def origin_check(request: Request):
    origin = request.headers.get('origin')
    if origin and origin not in settings.allowed_origins:
        raise HTTPException(403, 'Untrusted origin')

def decode(request: Request):
    try:
        return jwt.decode(request.cookies.get(COOKIE, ''), settings.jwt_secret,
                          algorithms=['HS256'], issuer='quickdesk', audience='quickdesk-web',
                          options={'require': ['exp', 'sub', 'jti', 'csrf', 'iat']})
    except jwt.InvalidTokenError:
        raise HTTPException(401, 'Please sign in')

def current_user(request: Request, db: Session = Depends(get_db)):
    payload = decode(request)
    session = db.get(LoginSession, payload['jti'])
    user = db.get(User, payload['sub'])
    if not session or not user or session.user_id != user.id:
        raise HTTPException(401, 'Please sign in')
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        origin_check(request)
        if not secrets.compare_digest(request.headers.get('x-csrf-token', ''), payload['csrf']):
            raise HTTPException(403, 'Invalid CSRF token')
    request.state.auth = payload
    return user

def agent(user: User = Depends(current_user)):
    if user.role != 'agent':
        raise HTTPException(403, 'Agent access required')
    return user

def public_user(user):
    return {'id': user.id, 'email': user.email, 'name': user.name, 'role': user.role}

@router.post('/login')
def login(data: Login, request: Request, response: Response, db: Session = Depends(get_db)):
    origin_check(request)
    if len(settings.jwt_secret) < 32:
        raise HTTPException(503, 'Authentication is not configured')
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    try:
        hasher.verify(user.password_hash if user else DUMMY_HASH, data.password)
    except (VerificationError, InvalidHashError):
        raise HTTPException(401, 'Invalid email or password')
    if not user:
        raise HTTPException(401, 'Invalid email or password')
    expires = now() + timedelta(hours=8)
    session = LoginSession(user_id=user.id, expires_at=expires)
    db.add(session)
    db.flush()
    csrf = secrets.token_urlsafe(32)
    token = jwt.encode({'sub': user.id, 'jti': session.id, 'csrf': csrf,
                        'iat': now(), 'exp': expires, 'iss': 'quickdesk',
                        'aud': 'quickdesk-web'}, settings.jwt_secret, algorithm='HS256')
    db.commit()
    response.set_cookie(COOKIE, token, httponly=True, secure=settings.app_env == 'production',
                        samesite='strict', max_age=8*3600, path='/api')
    return {'user': public_user(user), 'csrf': csrf}

@router.get('/me')
def me(request: Request, user: User = Depends(current_user)):
    return {'user': public_user(user), 'csrf': request.state.auth['csrf']}

@router.post('/logout')
def logout(request: Request, response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    session = db.get(LoginSession, request.state.auth['jti'])
    if session:
        db.delete(session)
        db.commit()
    response.delete_cookie(COOKIE, path='/api')
    return {'ok': True}
