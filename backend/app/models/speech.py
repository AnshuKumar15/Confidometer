from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Speech(Base):
    __tablename__ = "speeches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    video_path = Column(String)
    status = Column(String, default="processing")

    confidence_score = Column(Float, nullable=True)
    filler_count = Column(Integer, nullable=True)
    eye_contact_percentage = Column(Float, nullable=True)
    gesture_frequency = Column(Float, nullable=True)
    voice_stability_score = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")