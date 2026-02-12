"""add review fields

Revision ID: 9c2bf10681b9
Revises: f78f4d5de7b7
Create Date: 2026-02-12 09:49:35.893945

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9c2bf10681b9"
down_revision: Union[str, Sequence[str], None] = "f78f4d5de7b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Keep FK behavior stable (CASCADE) for join table
    op.drop_constraint(op.f("question_tags_tag_id_fkey"), "question_tags", type_="foreignkey")
    op.drop_constraint(op.f("question_tags_question_id_fkey"), "question_tags", type_="foreignkey")

    op.create_foreign_key(
        op.f("question_tags_question_id_fkey"),
        "question_tags",
        "questions",
        ["question_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        op.f("question_tags_tag_id_fkey"),
        "question_tags",
        "tags",
        ["tag_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # Add NOT NULL columns safely (existing rows need defaults)
    op.add_column(
        "questions",
        sa.Column("review_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "questions",
        sa.Column("mastery_score", sa.Float(), nullable=False, server_default="0"),
    )
    op.add_column(
        "questions",
        sa.Column("next_review_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
    )

    # Optional cleanup: remove server defaults so app controls values
    op.alter_column("questions", "review_count", server_default=None)
    op.alter_column("questions", "mastery_score", server_default=None)
    op.alter_column("questions", "next_review_at", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("questions", "next_review_at")
    op.drop_column("questions", "mastery_score")
    op.drop_column("questions", "review_count")

    op.drop_constraint(op.f("question_tags_tag_id_fkey"), "question_tags", type_="foreignkey")
    op.drop_constraint(op.f("question_tags_question_id_fkey"), "question_tags", type_="foreignkey")

    op.create_foreign_key(
        op.f("question_tags_question_id_fkey"),
        "question_tags",
        "questions",
        ["question_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        op.f("question_tags_tag_id_fkey"),
        "question_tags",
        "tags",
        ["tag_id"],
        ["id"],
        ondelete="CASCADE",
    )
