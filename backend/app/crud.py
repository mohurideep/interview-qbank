import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select
from . import models
from .schemas import QuestionCreate, QuestionUpdate

def _get_or_create_tags(db: Session, user_id: uuid.UUID, names: list[str]) -> list[models.Tag]:
    cleaned = []
    seen = set()
    for n in names:
        n = n.strip().lower()
        if not n or n in seen:
            continue
        seen.add(n)
        cleaned.append(n)

    if not cleaned:
        return []

    existing = db.execute(
        select(models.Tag).where(models.Tag.user_id == user_id, models.Tag.name.in_(cleaned))
    ).scalars().all()
    existing_by_name = {t.name: t for t in existing}

    result = []
    for name in cleaned:
        tag = existing_by_name.get(name)
        if not tag:
            tag = models.Tag(user_id=user_id, name=name)
            db.add(tag)
        result.append(tag)
    return result

def create_question(db: Session, user_id: uuid.UUID, payload: QuestionCreate) -> models.Question:
    q = models.Question(
        user_id=user_id,
        question_text=payload.question_text,
        answer_md=payload.answer_md,
        difficulty=payload.difficulty,
        source=payload.source,
        updated_at=datetime.utcnow(),
    )
    q.tags = _get_or_create_tags(db, user_id, payload.tags)
    db.add(q)
    db.commit()
    db.refresh(q)
    return q

def update_question(db: Session, q: models.Question, user_id: uuid.UUID, payload: QuestionUpdate) -> models.Question:
    if payload.question_text is not None:
        q.question_text = payload.question_text
    if payload.answer_md is not None:
        q.answer_md = payload.answer_md
    if payload.difficulty is not None:
        q.difficulty = payload.difficulty
    if payload.source is not None:
        q.source = payload.source
    if payload.is_flagged is not None:
        q.is_flagged = payload.is_flagged
    if payload.tags is not None:
        q.tags = _get_or_create_tags(db, user_id, payload.tags)

    q.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(q)
    return q

def list_questions(db: Session, user_id: uuid.UUID, search: str | None, tag: str | None, flagged: bool | None):
    stmt = select(models.Question).where(models.Question.user_id == user_id)

    if flagged is not None:
        stmt = stmt.where(models.Question.is_flagged == flagged)

    if search:
        s = f"%{search.strip().lower()}%"
        stmt = stmt.where(models.Question.question_text.ilike(s) | models.Question.answer_md.ilike(s))

    if tag:
        t = tag.strip().lower()
        stmt = stmt.join(models.Question.tags).where(models.Tag.name == t)

    stmt = stmt.order_by(models.Question.updated_at.desc())
    return db.execute(stmt).scalars().all()

def get_question(db: Session, user_id: uuid.UUID, qid: uuid.UUID) -> models.Question | None:
    stmt = select(models.Question).where(models.Question.user_id == user_id, models.Question.id == qid)
    return db.execute(stmt).scalars().first()
