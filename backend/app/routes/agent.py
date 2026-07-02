from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from app.utils.resume import extract_text_from_resume
from app.services.llm import generate_interview_question
from app.utils.security import get_current_user
from starlette.background import BackgroundTask
import os
import uuid
import edge_tts
import tempfile

router = APIRouter()

# Temporary in-memory session storage
# format: { session_id: { "resume_text": str, "role": str, "user_name": str, "history": [ { "role": "user"|"model", "text": str } ] } }
active_sessions = {}

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/initiate")
async def initiate_interview(
    role: str = Form(...),
    resume: UploadFile = File(...),
    company_name: str = Form(""),
    experience_level: str = Form(""),
    job_description: str = Form(""),
    current_user = Depends(get_current_user)
):
    try:
        # Save resume temporarily to extract text
        temp_path = os.path.join(UPLOAD_DIR, f"temp_{uuid.uuid4()}_{resume.filename}")
        with open(temp_path, "wb") as f:
            f.write(await resume.read())

        # Extract text
        resume_text = extract_text_from_resume(temp_path)
        
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

        user_name = current_user.name if (hasattr(current_user, "name") and current_user.name) else "Anshu"

        # Create session
        session_id = str(uuid.uuid4())
        active_sessions[session_id] = {
            "resume_text": resume_text,
            "role": role,
            "user_name": user_name,
            "company_name": company_name,
            "experience_level": experience_level,
            "job_description": job_description,
            "history": []
        }

        # Generate first question
        first_question = generate_interview_question(
            resume_text, role, [],
            user_name=user_name,
            company_name=company_name,
            experience_level=experience_level,
            job_description=job_description
        )
        active_sessions[session_id]["history"].append({
            "role": "model",
            "text": first_question
        })

        return {
            "session_id": session_id,
            "first_question": first_question
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate interview: {str(e)}")


@router.post("/respond")
async def respond_to_agent(
    session_id: str = Form(...),
    message: str = Form(...)
):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = active_sessions[session_id]
    
    # Append user response to history
    session["history"].append({
        "role": "user",
        "text": message
    })

    user_name = session.get("user_name", "Anshu")

    # Generate next question
    next_question = generate_interview_question(
        session["resume_text"],
        session["role"],
        session["history"],
        user_name=user_name,
        company_name=session.get("company_name", ""),
        experience_level=session.get("experience_level", ""),
        job_description=session.get("job_description", "")
    )

    # Append model question to history
    session["history"].append({
        "role": "model",
        "text": next_question
    })

    return {
        "next_question": next_question
    }


@router.post("/tts")
async def text_to_speech(
    text: str = Form(...)
):
    """Convert text to speech using Microsoft Edge neural TTS voice."""

    VOICE = "en-US-AriaNeural"  # Warm, professional female voice

    try:
        communicate = edge_tts.Communicate(text, VOICE)
        # Write to a temp file
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3", dir=UPLOAD_DIR)
        tmp_path = tmp.name
        tmp.close()

        await communicate.save(tmp_path)

        from fastapi.responses import FileResponse
        return FileResponse(
            tmp_path,
            media_type="audio/mpeg",
            filename="liza_speech.mp3",
            background=BackgroundTask(lambda: os.remove(tmp_path) if os.path.exists(tmp_path) else None)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {str(e)}")
