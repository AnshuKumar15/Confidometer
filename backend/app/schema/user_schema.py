from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class UserCreate(BaseModel):
    email: EmailStr = Field(..., min_length=5, max_length=254, description="User email address")
    password: str = Field(..., min_length=8, max_length=128, description="User password (8-128 chars)")
    name: Optional[str] = Field(None, max_length=100, description="User display name")