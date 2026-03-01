"""add studied_at to questions

Revision ID: 4b7a9d4e0a11
Revises: c9e2b4c7d1aa
Create Date: 2026-03-01 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4b7a9d4e0a11"
down_revision: Union[str, Sequence[str], None] = "c9e2b4c7d1aa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("questions", sa.Column("studied_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("questions", "studied_at")
