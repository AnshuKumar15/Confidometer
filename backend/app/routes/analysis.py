from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.speech import Speech
from app.utils.security import get_current_user

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/{speech_id}")
def get_analysis(
    speech_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    speech = db.query(Speech).filter(
        Speech.id == speech_id,
        Speech.user_id == current_user.id
    ).first()

    if not speech:
        return {"message": "Speech not found"}

    return {
        "status": speech.status,
        "confidence_score": speech.confidence_score,
        "filler_count": speech.filler_count,
        "eye_contact": speech.eye_contact_percentage,
        "gesture_frequency": speech.gesture_frequency,
        "voice_stability": speech.voice_stability_score
    }