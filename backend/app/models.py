import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, DateTime, Boolean, ForeignKey, UniqueConstraint
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

    questions: Mapped[list[Question]] = relationship(
        secondary="question_tags",
        back_populates="tags",
        lazy="selectin",
    )

class QuestionTag(Base):
    __tablename__ = "question_tags"
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("questions.id"), primary_key=True)
    tag_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tags.id"), primary_key=True)
