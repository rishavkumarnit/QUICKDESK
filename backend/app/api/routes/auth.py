import secrets
from datetime import timedelta
import jwt
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import Depends, HTTPException, Request, Response, APIRouter
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.dependencies import current_user, origin_check, public_user
from app.core.config import settings
from app.core.security import COOKIE, DUMMY_HASH, hasher
from app.db.session import get_db
from app.db.models import User, LoginSession, now
from app.schemas.auth import Login

router = APIRouter(prefix='/api/auth', tags=['auth'])

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
