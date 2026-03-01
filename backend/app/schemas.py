import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class QuestionCreate(BaseModel):
    question_text: str = Field(min_length=3)
    answer_md: str = ""
    difficulty: int = Field(default=3, ge=1, le=5)
    source: str = ""
    tags: List[str] = []

    # Follow-up support
    parent_id: Optional[uuid.UUID] = None


class QuestionUpdate(BaseModel):
    question_text: str | None = Field(default=None, min_length=3)
    answer_md: str | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)
    source: str | None = None
    is_flagged: bool | None = None
    tags: List[str] | None = None

    # Follow-up support (allow moving a question under a parent, or detaching it)
    parent_id: uuid.UUID | None = None
    studied_at: datetime | None = None


class QuestionOut(BaseModel):
    id: uuid.UUID
    question_text: str
    answer_md: str
    child_order: int
    difficulty: int
    source: str
    is_flagged: bool
    tags: List[str]
    created_at: datetime
    updated_at: datetime
    review_count: int
    mastery_score: float
    next_review_at: datetime
    studied_at: datetime | None = None
    studied_count: int = 0
    studied_history: List[datetime] = Field(default_factory=list)

    # Follow-up support
    parent_id: uuid.UUID | None = None


class ReorderChildrenIn(BaseModel):
    parent_id: uuid.UUID
    ordered_child_ids: List[uuid.UUID] = Field(default_factory=list)
