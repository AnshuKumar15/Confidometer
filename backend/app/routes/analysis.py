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


@router.get("/history")
def get_user_history(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return all completed speeches for the authenticated user, sorted by date desc."""
    speeches = (
        db.query(Speech)
        .filter(Speech.user_id == current_user.id, Speech.status == "completed")
        .order_by(Speech.created_at.desc())
        .all()
    )

    results = []
    for s in speeches:
        results.append({
            "speech_id": s.id,
            "created_at": str(s.created_at) if s.created_at else None,
            "interview_type": s.interview_type,
            "role": s.role,
            "company_name": s.company_name,
            "confidence_score": s.confidence_score,
            "eye_contact": s.eye_contact_percentage,
            "voice_stability": s.voice_stability_score,
            "gesture_frequency": s.gesture_frequency,
            "filler_count": s.filler_count,
            "eye_contact_score": s.eye_contact_score,
            "technical_knowledge_score": s.technical_knowledge_score,
            "fluency_score": s.fluency_score,
            "use_of_words_score": s.use_of_words_score,
            "filler_words_score": s.filler_words_score,
            "explanation_quality_score": s.explanation_quality_score,
        })

    return results


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
        "progress": speech.progress or 0,
        "interview_type": speech.interview_type,
        "confidence_score": speech.confidence_score,
        "filler_count": speech.filler_count,
        "eye_contact": speech.eye_contact_percentage,
        "gesture_frequency": speech.gesture_frequency,
        "voice_stability": speech.voice_stability_score,
        # Sub-scores
        "eye_contact_score": speech.eye_contact_score,
        "technical_knowledge_score": speech.technical_knowledge_score,
        "fluency_score": speech.fluency_score,
        "use_of_words_score": speech.use_of_words_score,
        "filler_words_score": speech.filler_words_score,
        "explanation_quality_score": speech.explanation_quality_score,
        # Coding scores
        "code_quality_score": speech.code_quality_score,
        "optimization_score": speech.optimization_score,
        "thinking_process_score": speech.thinking_process_score,
        "communication_score": speech.communication_score,
        # Reports
        "technical_feedback": speech.technical_feedback,
        "non_technical_feedback": speech.non_technical_feedback,
        "short_summary_feedback": speech.short_summary_feedback,
        # DSA data
        "dsa_code": speech.dsa_code,
        "dsa_question_details": speech.dsa_question_details,
        # Context
        "role": speech.role,
        "company_name": speech.company_name,
    }