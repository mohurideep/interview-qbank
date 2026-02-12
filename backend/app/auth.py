from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(p: str) -> str:
    return pwd_ctx.hash(p)

def verify_password(p: str, h: str) -> bool:
    return pwd_ctx.verify(p, h)

def create_token(payload: dict, secret: str, alg: str, expires_delta: timedelta) -> str:
    data = payload.copy()
    data["exp"] = datetime.utcnow() + expires_delta
    return jwt.encode(data, secret, algorithm=alg)

def decode_token(token: str, secret: str, alg: str) -> dict:
    try:
        return jwt.decode(token, secret, algorithms=[alg])
    except JWTError as e:
        raise ValueError("Invalid token") from e
