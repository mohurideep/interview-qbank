import uuid
from datetime import datetime
from pydantic import BaseModel, Field
from typing import List

class QuestionCreate(BaseModel):
    question_text: str = Field(min_length=3)
    answer_md: str = ""
    difficulty: int = Field(default=3, ge=1, le=5)
    source: str = ""
    tags: List[str] = []

class QuestionUpdate(BaseModel):
    question_text: str | None = Field(default=None, min_length=3)
    answer_md: str | None = None
    difficulty: int | None = Field(default=None, ge=1, le=5)
    source: str | None = None
    is_flagged: bool | None = None
    tags: List[str] | None = None

class QuestionOut(BaseModel):
    id: uuid.UUID
    question_text: str
    answer_md: str
    difficulty: int
    source: str
    is_flagged: bool
    tags: List[str]
    created_at: datetime
    updated_at: datetime
