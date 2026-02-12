import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from .. import crud
from ..schemas import QuestionCreate, QuestionUpdate, QuestionOut
from ..deps import get_current_user
from ..models import User

router = APIRouter(prefix="/v1/questions", tags=["questions"])


def _to_out(q) -> QuestionOut:
    return QuestionOut(
        id=q.id,
        question_text=q.question_text,
        answer_md=q.answer_md,
        difficulty=q.difficulty,
        source=q.source,
        is_flagged=q.is_flagged,
        tags=[t.name for t in q.tags],
        created_at=q.created_at,
        updated_at=q.updated_at,
        review_count=q.review_count,
        mastery_score=q.mastery_score,
        next_review_at=q.next_review_at,
    )


@router.post("", response_model=QuestionOut)
def create(
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = crud.create_question(db, current_user.id, payload)
    return _to_out(q)


@router.get("", response_model=list[QuestionOut])
def list_(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    search: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    flagged: bool | None = Query(default=None),
    due_only: bool | None = Query(default=False),
):
    items = crud.list_questions(db, current_user.id, search, tag, flagged)

    if due_only:
        now = datetime.utcnow()
        items = [q for q in items if (q.next_review_at is None) or (q.next_review_at <= now)]

    return [_to_out(q) for q in items]


@router.get("/{qid}", response_model=QuestionOut)
def get_one(
    qid: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = crud.get_question(db, current_user.id, qid)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return _to_out(q)


@router.patch("/{qid}", response_model=QuestionOut)
def patch(
    qid: uuid.UUID,
    payload: QuestionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = crud.get_question(db, current_user.id, qid)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    q = crud.update_question(db, q, current_user.id, payload)
    return _to_out(q)


@router.delete("/{qid}")
def delete(
    qid: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = crud.get_question(db, current_user.id, qid)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    db.delete(q)
    db.commit()
    return {"status": "deleted"}


@router.post("/{qid}/review")
def review(
    qid: uuid.UUID,
    rating: str = Query(..., description='One of: "forgot", "almost", "knew"'),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = crud.get_question(db, current_user.id, qid)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    q.review_count = (q.review_count or 0) + 1

    rating = rating.lower().strip()
    if rating == "forgot":
        q.mastery_score = float(q.mastery_score or 0.0) - 0.3
        interval_days = 1
    elif rating == "almost":
        q.mastery_score = float(q.mastery_score or 0.0) + 0.1
        interval_days = 3
    elif rating == "knew":
        q.mastery_score = float(q.mastery_score or 0.0) + 0.3
        interval_days = 7
    else:
        raise HTTPException(status_code=400, detail='Invalid rating. Use "forgot", "almost", or "knew".')

    q.mastery_score = max(0.0, min(5.0, q.mastery_score))

    q.next_review_at = datetime.utcnow() + timedelta(days=interval_days)
    q.updated_at = datetime.utcnow()

    db.commit()
    return {"status": "ok", "next_review_at": q.next_review_at, "mastery_score": q.mastery_score}
