import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..db import get_db
from ..settings import settings
from .. import crud
from ..schemas import QuestionCreate, QuestionUpdate, QuestionOut

router = APIRouter(prefix="/v1/questions", tags=["questions"])

def _user_id() -> uuid.UUID:
    return uuid.UUID(settings.DEFAULT_USER_ID)

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
    )

@router.post("", response_model=QuestionOut)
def create(payload: QuestionCreate, db: Session = Depends(get_db)):
    q = crud.create_question(db, _user_id(), payload)
    return _to_out(q)

@router.get("", response_model=list[QuestionOut])
def list_(
    db: Session = Depends(get_db),
    search: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    flagged: bool | None = Query(default=None),
):
    items = crud.list_questions(db, _user_id(), search, tag, flagged)
    return [_to_out(q) for q in items]

@router.get("/{qid}", response_model=QuestionOut)
def get_one(qid: uuid.UUID, db: Session = Depends(get_db)):
    q = crud.get_question(db, _user_id(), qid)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return _to_out(q)

@router.patch("/{qid}", response_model=QuestionOut)
def patch(qid: uuid.UUID, payload: QuestionUpdate, db: Session = Depends(get_db)):
    q = crud.get_question(db, _user_id(), qid)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    q = crud.update_question(db, q, _user_id(), payload)
    return _to_out(q)

@router.delete("/{qid}")
def delete(qid: uuid.UUID, db: Session = Depends(get_db)):
    q = crud.get_question(db, _user_id(), qid)
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    db.delete(q)
    db.commit()
    return {"status": "deleted"}
