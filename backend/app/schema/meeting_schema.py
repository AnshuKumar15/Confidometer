from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserDetail(BaseModel):
    id: int
    email: str
    name: Optional[str] = None

    class Config:
        from_attributes = True

class MeetingRequestCreate(BaseModel):
    role: str
    interview_type: str
    company_name: str
    job_description: Optional[str] = None
    scheduled_at: Optional[datetime] = None  # None for Immediate/Now

class MeetingRequestResponse(BaseModel):
    id: int
    user_id: int
    role: str
    interview_type: str
    company_name: str
    resume_filename: Optional[str] = None
    job_description: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    status: str
    interviewer_id: Optional[int] = None
    room_id: Optional[str] = None
    created_at: datetime
    
    # Nested user info
    user: Optional[UserDetail] = None
    interviewer: Optional[UserDetail] = None

    class Config:
        from_attributes = True
