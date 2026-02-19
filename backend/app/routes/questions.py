import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..settings import settings
from .. import crud
from ..schemas import QuestionCreate, QuestionUpdate, QuestionOut

router = APIRouter(prefix="/v1/questions", tags=["questions"])


def _user_id() -> uuid.UUID:
    """
    Single-user mode: all data belongs to DEFAULT_USER_ID.
    Set in .env:
      DEFAULT_USER_ID=00000000-0000-0000-0000-000000000001
    """
    return uuid.UUID(settings.DEFAULT_USER_ID)


def _to_out(q) -> QuestionOut:
    return QuestionOut(
        id=q.id,
        parent_id=q.parent_id,
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


def _ensure_valid_parent(
    db: Session,
    user_id: uuid.UUID,
    parent_id: uuid.UUID | None,
    child_id: uuid.UUID | None = None,
) -> None:
    if parent_id is None:
        return

    if child_id is not None and parent_id == child_id:
        raise HTTPException(status_code=400, detail="A question cannot be its own parent")

    parent = crud.get_question(db, user_id, parent_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent question not found")

    if child_id is None:
        return

    ancestor = parent
    while ancestor.parent_id is not None:
        if ancestor.parent_id == child_id:
            raise HTTPException(status_code=400, detail="Parent relationship would create a cycle")
        ancestor = crud.get_question(db, user_id, ancestor.parent_id)
        if not ancestor:
            break


@router.post("", response_model=QuestionOut)
def create(payload: QuestionCreate, db: Session = Depends(get_db)):
    user_id = _user_id()
    _ensure_valid_parent(db, user_id, payload.parent_id)
    try:
        q = crud.create_question(db, user_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_out(q)


@router.get("", response_model=list[QuestionOut])
def list_(
    db: Session = Depends(get_db),
    search: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    tags: str | None = Query(default=None),
    source: str | None = Query(default=None),
    flagged: bool | None = Query(default=None),
    due_only: bool | None = Query(default=False),
):
    tag_filter = tags if tags is not None else tag
    items = crud.list_questions(db, _user_id(), search, tag_filter, source, flagged)

    if due_only:
        now = datetime.utcnow()
        items = [q for q in items if (q.next_review_at is None) or (q.next_review_at <= now)]

    return [_to_out(q) for q in items]


@router.get("/suggestions", response_model=list[str])
def suggestions(
    db: Session = Depends(get_db),
    field: str = Query(..., description='One of: "source", "tag"'),
    q: str = Query(default=""),
    limit: int = Query(default=8, ge=1, le=30),
):
    field = field.strip().lower()
    if field == "source":
        return crud.list_source_suggestions(db, _user_id(), q, limit)
    if field == "tag":
        return crud.list_tag_suggestions(db, _user_id(), q, limit)
    raise HTTPException(status_code=400, detail='Invalid field. Use "source" or "tag".')


@router.get("/{qid}", response_model=QuestionOut)
def get_one(qid: uuid.UUID, db: Session = Depends(get_db)):
    q = crud.get_question(db, _user_id(), qid)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return _to_out(q)


@router.patch("/{qid}", response_model=QuestionOut)
def patch(qid: uuid.UUID, payload: QuestionUpdate, db: Session = Depends(get_db)):
    user_id = _user_id()
    q = crud.get_question(db, user_id, qid)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")

    if "parent_id" in payload.model_fields_set:
        _ensure_valid_parent(db, user_id, payload.parent_id, child_id=qid)

    try:
        q = crud.update_question(db, q, user_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_out(q)


@router.delete("/{qid}")
def delete(qid: uuid.UUID, db: Session = Depends(get_db)):
    q = crud.get_question(db, _user_id(), qid)
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
):
    q = crud.get_question(db, _user_id(), qid)
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
