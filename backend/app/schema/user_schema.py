from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str