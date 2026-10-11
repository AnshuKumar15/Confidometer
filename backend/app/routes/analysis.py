from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.speech import Speech
from app.utils.security import get_current_user
from app.rate_limiter import limiter, RATE_STANDARD

router = APIRouter()



@router.get("/history")
@limiter.limit(RATE_STANDARD)
def get_user_history(
    request: Request,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return all completed speeches for the authenticated user, sorted by date desc."""
    speeches = (
        db.query(
            Speech.id,
            Speech.created_at,
            Speech.interview_type,
            Speech.role,
            Speech.company_name,
            Speech.confidence_score,
            Speech.eye_contact_percentage,
            Speech.voice_stability_score,
            Speech.gesture_frequency,
            Speech.filler_count,
            Speech.eye_contact_score,
            Speech.technical_knowledge_score,
            Speech.fluency_score,
            Speech.use_of_words_score,
            Speech.filler_words_score,
            Speech.explanation_quality_score,
            Speech.negotiation_score,
            Speech.code_quality_score,
            Speech.optimization_score,
            Speech.thinking_process_score,
            Speech.communication_score,
            Speech.sql_score,
        )
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
            "negotiation_score": s.negotiation_score,
            "code_quality_score": s.code_quality_score,
            "optimization_score": s.optimization_score,
            "thinking_process_score": s.thinking_process_score,
            "communication_score": s.communication_score,
            "sql_score": s.sql_score,
            "sql_queries": None,
            "sql_question_details": None,
        })

    return results


@router.get("/{speech_id}")
@limiter.limit(RATE_STANDARD)
def get_analysis(
    request: Request,
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

    # Zombie / Interrupted speech detection:
    # If the speech is still in "processing" and was created > 3 minutes ago,
    # the background task was killed by a previous server restart / OOM kill.
    if speech.status == "processing" and speech.created_at:
        import os
        from datetime import datetime, timezone
        created_utc = speech.created_at if speech.created_at.tzinfo else speech.created_at.replace(tzinfo=timezone.utc)
        age_seconds = (datetime.now(timezone.utc) - created_utc).total_seconds()
        if age_seconds > 180:
            video_path = str(speech.video_path or "")
            if os.path.exists(video_path) and os.path.getsize(video_path) > 100:
                print(f"[RECOVERY] Detected interrupted speech ID {speech_id} (age: {age_seconds:.0f}s). Restarting processor...")
                from app.services.processor import process_speech
                import threading
                speech.progress = max(speech.progress or 0, 10)
                speech.created_at = datetime.now(timezone.utc)
                db.commit()
                threading.Thread(target=process_speech, args=(speech.id,), daemon=True).start()
            else:
                print(f"[RECOVERY] Interrupted speech ID {speech_id} video missing or empty. Marking as failed.")
                speech.status = "failed"
                db.commit()

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
        # Negotiation
        "negotiation_score": speech.negotiation_score,
        # Stress simulation
        "stress_mode": speech.stress_mode,
        "stress_tolerance_score": speech.stress_tolerance_score,
        # Reports
        "technical_feedback": speech.technical_feedback,
        "non_technical_feedback": speech.non_technical_feedback,
        "short_summary_feedback": speech.short_summary_feedback,
        # DSA data
        "dsa_code": speech.dsa_code,
        "dsa_question_details": speech.dsa_question_details,
        # SQL assessment data
        "sql_queries": speech.sql_queries,
        "sql_question_details": speech.sql_question_details,
        "sql_score": speech.sql_score,
        # Context
        "role": speech.role,
        "company_name": speech.company_name,
    }