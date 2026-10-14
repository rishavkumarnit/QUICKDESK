"""Add model-reported classification confidence."""
from alembic import op
import sqlalchemy as sa

revision = '002'
down_revision = '001'


def upgrade():
    op.add_column('tickets', sa.Column('ai_confidence', sa.Float(), nullable=True))
    op.create_check_constraint(
        'ck_tickets_ai_confidence_range',
        'tickets',
        'ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)',
    )


def downgrade():
    op.drop_constraint('ck_tickets_ai_confidence_range', 'tickets', type_='check')
    op.drop_column('tickets', 'ai_confidence')
