from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Text, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

class Speech(Base):
    __tablename__ = "speeches"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    
    video_path = Column(String)
    status = Column(String, default="processing")
    progress = Column(Integer, default=0)

    # Interview context (saved from agent session)
    interview_type = Column(String, nullable=True)  # "technical", "hr", "dsa", "behavioural", "negotiation"
    role = Column(String, nullable=True)
    company_name = Column(String, nullable=True)
    conversation_history = Column(Text, nullable=True)  # JSON string

    # DSA / Coding round data
    dsa_code = Column(Text, nullable=True)  # Final code written by user
    dsa_question_details = Column(Text, nullable=True)  # JSON: [{number, title, difficulty, description}]

    # Raw analysis metrics
    confidence_score = Column(Float, nullable=True)
    filler_count = Column(Integer, nullable=True)
    eye_contact_percentage = Column(Float, nullable=True)
    gesture_frequency = Column(Float, nullable=True)
    voice_stability_score = Column(Float, nullable=True)

    # Granular sub-scores (0-100)
    eye_contact_score = Column(Float, nullable=True)
    technical_knowledge_score = Column(Float, nullable=True)
    fluency_score = Column(Float, nullable=True)
    use_of_words_score = Column(Float, nullable=True)
    filler_words_score = Column(Float, nullable=True)
    explanation_quality_score = Column(Float, nullable=True)

    # Coding-specific scores (0-100)
    code_quality_score = Column(Float, nullable=True)
    optimization_score = Column(Float, nullable=True)
    thinking_process_score = Column(Float, nullable=True)
    communication_score = Column(Float, nullable=True)

    # Negotiation simulation fields
    negotiation_score = Column(Float, nullable=True)

    # Stress simulation fields
    stress_mode = Column(Boolean, default=False)
    fidgeting_index = Column(Float, nullable=True)
    speech_rate_variance = Column(Float, nullable=True)
    stress_tolerance_score = Column(Float, nullable=True)

    # Feedback reports (JSON text)
    technical_feedback = Column(Text, nullable=True)
    non_technical_feedback = Column(Text, nullable=True)
    short_summary_feedback = Column(Text, nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User")