from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON, Integer, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db import Base

def now():
    return datetime.now(timezone.utc)

def uid():
    return str(uuid4())

class User(Base):
    __tablename__ = 'users'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(20))
    __table_args__ = (CheckConstraint("role in ('employee','agent')"),)

class LoginSession(Base):
    __tablename__ = 'login_sessions'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    user_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

class Ticket(Base):
    __tablename__ = 'tickets'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    employee_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    attachment: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default='Open', index=True)
    category: Mapped[str] = mapped_column(String(20), default='Other', index=True)
    priority: Mapped[str] = mapped_column(String(20), default='Medium', index=True)
    ai_category: Mapped[str | None] = mapped_column(String(20))
    ai_priority: Mapped[str | None] = mapped_column(String(20))
    classification_status: Mapped[str] = mapped_column(String(20), default='failed')
    final_reply: Mapped[str | None] = mapped_column(Text)
    replied_by: Mapped[str | None] = mapped_column(ForeignKey('users.id'))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint("status in ('Open','Resolved')"),
        CheckConstraint("category in ('IT','HR','Finance','Admin','Other')"),
        CheckConstraint("priority in ('Low','Medium','High')"),
    )

class Draft(Base):
    __tablename__ = 'drafts'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    ticket_id: Mapped[str] = mapped_column(ForeignKey('tickets.id'), index=True)
    body: Mapped[str] = mapped_column(Text)
    citations: Mapped[list] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Audit(Base):
    __tablename__ = 'audit_events'
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    ticket_id: Mapped[str] = mapped_column(ForeignKey('tickets.id'), index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey('users.id'))
    field: Mapped[str] = mapped_column(String(20))
    old_value: Mapped[str] = mapped_column(String(20))
    new_value: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Event(Base):
    __tablename__ = 'ticket_events'
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    employee_id: Mapped[str] = mapped_column(ForeignKey('users.id'), index=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey('tickets.id'))
    kind: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
