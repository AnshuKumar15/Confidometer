from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schema.user_schema import UserCreate
from app.utils.security import hash_password, verify_password, create_access_token
from app.rate_limiter import limiter, RATE_AUTH


router = APIRouter()



# -------------------------
# REGISTER
# -------------------------

@router.post("/register")
@limiter.limit(RATE_AUTH)
def register(request: Request, user: UserCreate, db: Session = Depends(get_db)):

    existing_user = db.query(User).filter(User.email == user.email).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    new_user = User(
        email=user.email,
        name=user.name,
        hashed_password=hash_password(user.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User registered successfully"}


# -------------------------
# LOGIN (OAuth2 compatible)
# -------------------------

MAX_EMAIL_LENGTH = 254
MAX_PASSWORD_LENGTH = 128

@router.post("/login")
@limiter.limit(RATE_AUTH)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    # NOTE:
    # OAuth2PasswordRequestForm uses:
    # username -> we use it as email
    # password -> password

    if len(form_data.username) > MAX_EMAIL_LENGTH or len(form_data.password) > MAX_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email or password exceeds maximum allowed length"
        )

    db_user = db.query(User).filter(User.email == form_data.username).first()

    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email not found"
        )

    if not verify_password(form_data.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password"
        )

    access_token = create_access_token(
        {"sub": db_user.email}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "name": db_user.name,
            "email": db_user.email,
        }
    }