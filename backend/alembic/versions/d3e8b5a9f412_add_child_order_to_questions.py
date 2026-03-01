"""add child_order to questions

Revision ID: d3e8b5a9f412
Revises: a2c4f6e81d30
Create Date: 2026-03-01 01:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d3e8b5a9f412"
down_revision: Union[str, Sequence[str], None] = "a2c4f6e81d30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "questions",
        sa.Column("child_order", sa.Integer(), nullable=False, server_default="0"),
    )

    op.execute(
        """
        WITH ranked AS (
            SELECT
                id,
                ROW_NUMBER() OVER (
                    PARTITION BY parent_id
                    ORDER BY created_at ASC, updated_at ASC, id ASC
                ) - 1 AS rn
            FROM questions
            WHERE parent_id IS NOT NULL
        )
        UPDATE questions q
        SET child_order = ranked.rn
        FROM ranked
        WHERE q.id = ranked.id
        """
    )

    op.alter_column("questions", "child_order", server_default=None)


def downgrade() -> None:
    op.drop_column("questions", "child_order")
