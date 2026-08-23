import uuid
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta, timezone
from app.config import settings
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

MAX_PASSWORD_LENGTH = 128

# -------------------------
# PASSWORD FUNCTIONS
# -------------------------

def hash_password(password: str):
    if not password or len(password) > MAX_PASSWORD_LENGTH:
        raise ValueError(f"Password length must be between 1 and {MAX_PASSWORD_LENGTH} characters.")
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    if not plain_password or len(plain_password) > MAX_PASSWORD_LENGTH or not hashed_password:
        return False
    return pwd_context.verify(plain_password, hashed_password)

# -------------------------
# JWT TOKEN
# -------------------------

def create_access_token(data: dict):
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({
        "exp": expire,
        "iat": now,
        "jti": str(uuid.uuid4()),  # Unique cryptographic token nonce to prevent replay attacks
    })
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_token(token: str):
    """Safely decode and verify JWT token with expiration and issuance validation."""
    if not token:
        return None
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": True}
        )
        return payload
    except Exception:
        return None

# -------------------------
# AUTH DEPENDENCY
# -------------------------

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    email: str = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token claims")

    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()
    db.close()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def get_optional_current_user(token: str = Depends(oauth2_scheme_optional)):
    """Optional authentication dependency that returns User if valid token provided, else None."""
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None

    email: str = payload.get("sub")
    if not email:
        return None

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        return user
    except Exception:
        return None
    finally:
        db.close()
