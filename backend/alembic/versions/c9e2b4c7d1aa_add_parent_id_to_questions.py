"""add parent_id to questions

Revision ID: c9e2b4c7d1aa
Revises: 151fe0186fb1
Create Date: 2026-02-16 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c9e2b4c7d1aa"
down_revision: Union[str, Sequence[str], None] = "151fe0186fb1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("questions", sa.Column("parent_id", sa.Uuid(), nullable=True))
    op.create_index(op.f("ix_questions_parent_id"), "questions", ["parent_id"], unique=False)
    op.create_foreign_key(
        "fk_questions_parent_id_questions",
        "questions",
        "questions",
        ["parent_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_questions_parent_id_questions", "questions", type_="foreignkey")
    op.drop_index(op.f("ix_questions_parent_id"), table_name="questions")
    op.drop_column("questions", "parent_id")
