import uuid
from fastapi import Depends
from sqlalchemy.orm import Session

from .db import get_db
from .settings import settings
from .models import User


def get_current_user(
    db: Session = Depends(get_db),
) -> User:
    """
    Single-user mode (NO auth):
    Always returns the DEFAULT_USER_ID user.
    Auto-creates the user row if missing.
    """
    user_id = uuid.UUID(settings.DEFAULT_USER_ID)

    user = db.query(User).filter(User.id == user_id).first()
    if user:
        return user

    # Auto-create a placeholder user
    user = User(id=user_id, email="local@qbank", password_hash="")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
