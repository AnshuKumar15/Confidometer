import os
import json
from fastapi import APIRouter, UploadFile, File, Depends, Form
from typing import Optional
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.speech import Speech
from app.utils.security import get_current_user
from fastapi import BackgroundTasks
from app.services.processor import process_speech

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/")
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_path = os.path.join(UPLOAD_DIR, file.filename)

    contents = await file.read()

    with open(file_path, "wb") as f:
        f.write(contents)

    speech = Speech(
        user_id=current_user.id,
        video_path=file_path,
        status="processing"
    )

    # If an agent session was active, persist interview context on the Speech record
    if session_id:
        try:
            from app.routes.agent import active_sessions
            session = active_sessions.get(session_id)
            if session:
                speech.role = session.get("role")  # type: ignore
                speech.company_name = session.get("company_name")  # type: ignore
                speech.interview_type = session.get("interview_type")  # type: ignore
                speech.conversation_history = json.dumps(session.get("history", []))  # type: ignore

                # Persist DSA/coding round data
                dsa_state = session.get("dsa_state")
                if dsa_state:
                    # Combine all code submissions into a single field
                    code_submissions = dsa_state.get("code_submissions", [])
                    if code_submissions:
                        code_parts = []
                        for sub in code_submissions:
                            qi = sub.get("question_index", 0)
                            questions = dsa_state.get("questions", [])
                            q_title = questions[qi].get("title", f"Q{qi+1}") if qi < len(questions) else f"Q{qi+1}"
                            code_parts.append(f"// === {q_title} ===\n{sub.get('code', '')}")
                        speech.dsa_code = "\n\n".join(code_parts)  # type: ignore
                    speech.dsa_question_details = json.dumps(dsa_state.get("questions", []))  # type: ignore
        except Exception as e:
            print(f"[WARN] Could not attach session context: {e}")

    db.add(speech)
    db.commit()
    db.refresh(speech)

    # 🔥 Trigger background processing
    background_tasks.add_task(process_speech, speech.id)

    return {
        "message": "Video uploaded successfully",
        "speech_id": speech.id,
        "status": "processing"
    }