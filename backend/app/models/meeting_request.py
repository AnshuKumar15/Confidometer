from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class PeerInterviewRequest(Base):
    __tablename__ = "peer_interview_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    role = Column(String, index=True)
    interview_type = Column(String)  # "technical", "hr", "behavioural", "negotiation"
    company_name = Column(String)
    
    resume_text = Column(Text, nullable=True)
    resume_filename = Column(String, nullable=True)
    job_description = Column(Text, nullable=True)
    
    scheduled_at = Column(DateTime, nullable=True)  # Null means "Now / Immediate"
    status = Column(String, default="pending")  # "pending", "accepted", "completed", "cancelled"
    
    interviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    room_id = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id])
    interviewer = relationship("User", foreign_keys=[interviewer_id])
