import uuid
from datetime import datetime

from sqlalchemy import (
    String,
    Text,
    Integer,
    DateTime,
    Boolean,
    ForeignKey,
    UniqueConstraint,
    Float,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(index=True)

    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    answer_md: Mapped[str] = mapped_column(Text, nullable=False, default="")

    difficulty: Mapped[int] = mapped_column(Integer, default=3)
    source: Mapped[str] = mapped_column(String(300), default="")
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    mastery_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    next_review_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    tags: Mapped[list["Tag"]] = relationship(
        secondary="question_tags",
        back_populates="questions",
        lazy="selectin",
    )


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_user_tag_name"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(index=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    questions: Mapped[list["Question"]] = relationship(
        secondary="question_tags",
        back_populates="tags",
        lazy="selectin",
    )


class QuestionTag(Base):
    __tablename__ = "question_tags"

    question_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("questions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    )
