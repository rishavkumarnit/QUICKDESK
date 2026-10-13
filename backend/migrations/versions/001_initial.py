"""Initial QuickDesk schema."""
from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = None

def upgrade():
    op.create_table('users', sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(254), nullable=False, unique=True),
        sa.Column('name', sa.String(100), nullable=False), sa.Column('password_hash', sa.Text, nullable=False),
        sa.Column('role', sa.String(20), nullable=False), sa.CheckConstraint("role in ('employee','agent')"))
    op.create_table('login_sessions', sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_login_sessions_user_id', 'login_sessions', ['user_id'])
    op.create_table('tickets', sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('employee_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(200), nullable=False), sa.Column('description', sa.Text, nullable=False),
        sa.Column('attachment', sa.String(255)), sa.Column('status', sa.String(20), nullable=False),
        sa.Column('category', sa.String(20), nullable=False), sa.Column('priority', sa.String(20), nullable=False),
        sa.Column('ai_category', sa.String(20)), sa.Column('ai_priority', sa.String(20)),
        sa.Column('classification_status', sa.String(20), nullable=False), sa.Column('final_reply', sa.Text),
        sa.Column('replied_by', sa.String(36), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False), sa.Column('resolved_at', sa.DateTime(timezone=True)),
        sa.CheckConstraint("status in ('Open','Resolved')"),
        sa.CheckConstraint("category in ('IT','HR','Finance','Admin','Other')"),
        sa.CheckConstraint("priority in ('Low','Medium','High')"))
    for field in ['employee_id', 'status', 'category', 'priority']:
        op.create_index('ix_tickets_'+field, 'tickets', [field])
    op.create_table('drafts', sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('ticket_id', sa.String(36), sa.ForeignKey('tickets.id'), nullable=False),
        sa.Column('body', sa.Text, nullable=False), sa.Column('citations', sa.JSON, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_drafts_ticket_id', 'drafts', ['ticket_id'])
    op.create_table('audit_events', sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('ticket_id', sa.String(36), sa.ForeignKey('tickets.id'), nullable=False),
        sa.Column('actor_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('field', sa.String(20), nullable=False), sa.Column('old_value', sa.String(20), nullable=False),
        sa.Column('new_value', sa.String(20), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_audit_events_ticket_id', 'audit_events', ['ticket_id'])
    op.create_table('ticket_events', sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('employee_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('ticket_id', sa.String(36), sa.ForeignKey('tickets.id'), nullable=False),
        sa.Column('kind', sa.String(30), nullable=False), sa.Column('created_at', sa.DateTime(timezone=True), nullable=False))
    op.create_index('ix_ticket_events_employee_id', 'ticket_events', ['employee_id'])

def downgrade():
    for table in ['ticket_events', 'audit_events', 'drafts', 'tickets', 'login_sessions', 'users']:
        op.drop_table(table)
