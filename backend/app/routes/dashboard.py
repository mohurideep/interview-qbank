from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..db import get_db
from ..deps import get_current_user
from ..models import User, Question, Tag, QuestionTag

router = APIRouter(prefix="/v1/dashboard", tags=["dashboard"])


class WeakTag(BaseModel):
    name: str
    avg_mastery: float
    question_count: int


class DashboardStatsOut(BaseModel):
    total_questions: int
    due_now: int
    avg_mastery: float
    total_reviews: int
    weakest_tags: List[WeakTag]


@router.get("/stats", response_model=DashboardStatsOut)
def stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()

    total_questions = (
        db.query(func.count(Question.id))
        .filter(Question.user_id == current_user.id)
        .scalar()
        or 0
    )

    due_now = (
        db.query(func.count(Question.id))
        .filter(Question.user_id == current_user.id)
        .filter(Question.next_review_at <= now)
        .scalar()
        or 0
    )

    avg_mastery = (
        db.query(func.avg(Question.mastery_score))
        .filter(Question.user_id == current_user.id)
        .scalar()
    )
    avg_mastery = float(avg_mastery or 0.0)

    total_reviews = (
        db.query(func.coalesce(func.sum(Question.review_count), 0))
        .filter(Question.user_id == current_user.id)
        .scalar()
        or 0
    )
    total_reviews = int(total_reviews)

    # Weakest tags = lowest avg mastery across questions tagged with that tag
    rows = (
        db.query(
            Tag.name.label("name"),
            func.avg(Question.mastery_score).label("avg_mastery"),
            func.count(Question.id).label("question_count"),
        )
        .join(QuestionTag, QuestionTag.tag_id == Tag.id)
        .join(Question, Question.id == QuestionTag.question_id)
        .filter(Tag.user_id == current_user.id)
        .filter(Question.user_id == current_user.id)
        .group_by(Tag.name)
        .order_by(func.avg(Question.mastery_score).asc(), func.count(Question.id).desc())
        .limit(5)
        .all()
    )

    weakest_tags = [
        WeakTag(
            name=r.name,
            avg_mastery=float(r.avg_mastery or 0.0),
            question_count=int(r.question_count or 0),
        )
        for r in rows
    ]

    return DashboardStatsOut(
        total_questions=int(total_questions),
        due_now=int(due_now),
        avg_mastery=avg_mastery,
        total_reviews=total_reviews,
        weakest_tags=weakest_tags,
    )
