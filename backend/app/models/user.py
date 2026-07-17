from sqlalchemy import Column, Integer, String, DateTime, Text, Date
from datetime import datetime, timezone
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    name = Column(String, nullable=True)
    hashed_password = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Gamification fields
    streak_count = Column(Integer, default=0)
    last_active_date = Column(Date, nullable=True)
    badges_unlocked = Column(Text, default="[]")  # JSON list of badge strings