import uuid
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..settings import settings
from ..auth import (
    hash_password,
    verify_password,
    create_token,
    decode_token,
)
from ..deps import get_current_user

router = APIRouter(prefix="/v1/auth", tags=["auth"])


# -----------------------------
# Schemas (kept local for simplicity)
# -----------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class MeOut(BaseModel):
    id: uuid.UUID
    email: EmailStr


# -----------------------------
# Cookie helpers
# -----------------------------
def _cookie_secure() -> bool:
    """
    For SameSite=None, browsers REQUIRE Secure=True (HTTPS).
    Locally you might be on http:// so you can keep secure False locally if needed.
    """
    return bool(getattr(settings, "COOKIE_SECURE", False))


def _cookie_samesite() -> str:
    """
    If FE and BE are on different domains (Vercel + Railway), you MUST use SameSite=None.
    Default to 'lax' for local/dev.
    """
    return str(getattr(settings, "COOKIE_SAMESITE", "lax")).lower()


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    samesite = _cookie_samesite()

    # If cross-site cookies are needed, enforce browser rules.
    # SameSite=None requires Secure=True.
    secure = _cookie_secure()
    if samesite == "none":
        secure = True

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=secure,
        samesite=samesite,  # ✅ none for Vercel<->Railway
        max_age=int(getattr(settings, "ACCESS_TOKEN_MINUTES", 15) * 60),
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite=samesite,  # ✅ none for Vercel<->Railway
        max_age=int(getattr(settings, "REFRESH_TOKEN_DAYS", 30) * 24 * 60 * 60),
        path="/v1/auth",  # restrict refresh cookie scope a bit
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/v1/auth")


def _issue_tokens(user: User) -> tuple[str, str]:
    access_minutes = int(getattr(settings, "ACCESS_TOKEN_MINUTES", 15))
    refresh_days = int(getattr(settings, "REFRESH_TOKEN_DAYS", 30))

    access = create_token(
        payload={"sub": str(user.id), "typ": "access"},
        secret=settings.JWT_SECRET,
        alg=settings.JWT_ALG,
        expires_delta=timedelta(minutes=access_minutes),
    )
    refresh = create_token(
        payload={"sub": str(user.id), "typ": "refresh"},
        secret=settings.JWT_SECRET,
        alg=settings.JWT_ALG,
        expires_delta=timedelta(days=refresh_days),
    )
    return access, refresh


# -----------------------------
# Routes
# -----------------------------
@router.post("/register", response_model=MeOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()

    if len(payload.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if len(payload.password.encode("utf-8")) > 72:
        raise HTTPException(status_code=400, detail="Password too long (max 72 bytes)")

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(email=email, password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)

    return MeOut(id=user.id, email=user.email)


@router.post("/login", response_model=MeOut)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access, refresh = _issue_tokens(user)
    _set_auth_cookies(response, access, refresh)

    return MeOut(id=user.id, email=user.email)


@router.post("/refresh")
def refresh(response: Response, db: Session = Depends(get_db), refresh_token: Optional[str] = None):
    raise HTTPException(status_code=500, detail="Use /refresh_v2. See auth.py for correct handler.")


@router.post("/refresh_v2")
def refresh_v2(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Missing refresh token")

    try:
        data = decode_token(token, settings.JWT_SECRET, settings.JWT_ALG)
        if data.get("typ") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token type")
        user_id = uuid.UUID(data["sub"])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    access, refresh = _issue_tokens(user)
    _set_auth_cookies(response, access, refresh)
    return {"status": "ok"}


@router.post("/logout")
def logout(response: Response):
    _clear_auth_cookies(response)
    return {"status": "ok"}


@router.get("/me", response_model=MeOut)
def me(current_user: User = Depends(get_current_user)):
    return MeOut(id=current_user.id, email=current_user.email)
