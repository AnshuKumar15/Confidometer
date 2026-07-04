from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from app.utils.resume import extract_text_from_resume
from app.services.llm import generate_interview_question, generate_dsa_question
from app.utils.security import get_current_user
from starlette.background import BackgroundTask
import os
import uuid
import json
import edge_tts
import tempfile

router = APIRouter()

# Temporary in-memory session storage
# format: { session_id: { "resume_text": str, "role": str, "user_name": str,
#            "interview_type": str, "company_name": str, "experience_level": str,
#            "job_description": str, "history": [...],
#            "dsa_state": { "current_q": int, "questions": [...], "code_submissions": [...] } } }
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
    interview_type: str = Form("technical"),
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

        # Normalize interview type
        interview_type = interview_type.lower().strip()
        if interview_type not in ("technical", "hr", "dsa", "behavioural"):
            interview_type = "technical"

        # Create session
        session_id = str(uuid.uuid4())
        active_sessions[session_id] = {
            "resume_text": resume_text,
            "role": role,
            "user_name": user_name,
            "company_name": company_name,
            "experience_level": experience_level,
            "job_description": job_description,
            "interview_type": interview_type,
            "history": [],
            "dsa_state": None,
        }

        response_payload = {
            "session_id": session_id,
            "interview_type": interview_type,
        }

        if interview_type == "dsa":
            # ── DSA Round: generate both Easy and Medium questions upfront ──
            q1 = generate_dsa_question(
                company_name=company_name,
                role=role,
                difficulty="Easy",
                experience_level=experience_level,
            )
            q2 = generate_dsa_question(
                company_name=company_name,
                role=role,
                difficulty="Medium",
                experience_level=experience_level,
                previous_questions=[q1],
            )

            dsa_state = {
                "questions": [q1, q2],
                "code_submissions": [],
            }
            active_sessions[session_id]["dsa_state"] = dsa_state

            # Build Liza greeting for DSA round
            company_part = f" at {company_name}" if company_name else ""
            first_question = (
                f"Hello {user_name}! I'm Liza, your interview agent. "
                f"Welcome to the DSA coding round for the {role} position{company_part}. "
                f"You have been assigned 2 LeetCode problems — one Easy and one Medium — which you can solve side-by-side in any order within 30 minutes total. "
                f"Take a moment to read through them, and feel free to think out loud as you code. Good luck!"
            )
            active_sessions[session_id]["history"].append({
                "role": "model",
                "text": first_question
            })

            response_payload["first_question"] = first_question
            response_payload["dsa_questions"] = [q1, q2]

        else:
            # ── Non-DSA rounds: standard greeting ──
            first_question = generate_interview_question(
                resume_text, role, [],
                user_name=user_name,
                company_name=company_name,
                experience_level=experience_level,
                job_description=job_description,
                interview_type=interview_type,
            )
            active_sessions[session_id]["history"].append({
                "role": "model",
                "text": first_question
            })
            response_payload["first_question"] = first_question

        return response_payload

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate interview: {str(e)}")


@router.post("/respond")
async def respond_to_agent(
    session_id: str = Form(...),
    message: str = Form(...),
    code: str = Form(None),
    question_index: int = Form(0),
):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = active_sessions[session_id]
    interview_type = session.get("interview_type", "technical")
    
    # Append user response to history
    user_entry = {"role": "user", "text": message}
    if code:
        user_entry["code"] = code
        user_entry["question_index"] = question_index
    session["history"].append(user_entry)

    user_name = session.get("user_name", "Anshu")
    response_payload = {}

    if interview_type == "dsa" and code:
        # ── DSA code submission flow ──
        dsa_state = session.get("dsa_state", {})
        questions = dsa_state.get("questions", [])

        # Save/update the code submission for the specified question_index
        dsa_state.setdefault("code_submissions", [])
        dsa_state["code_submissions"] = [
            sub for sub in dsa_state["code_submissions"] if sub["question_index"] != question_index
        ]
        dsa_state["code_submissions"].append({
            "question_index": question_index,
            "code": code,
        })

        # Ask the user to explain their code for the submitted question index
        next_question = generate_interview_question(
            session["resume_text"],
            session["role"],
            session["history"],
            user_name=user_name,
            company_name=session.get("company_name", ""),
            experience_level=session.get("experience_level", ""),
            job_description=session.get("job_description", ""),
            interview_type="dsa",
            dsa_context={
                "action": "explain",
                "current_question": questions[question_index] if question_index < len(questions) else None,
                "submitted_code": code,
            }
        )

        session["history"].append({"role": "model", "text": next_question})
        response_payload["next_question"] = next_question

    else:
        # ── Standard conversational flow (all round types) ──
        next_question = generate_interview_question(
            session["resume_text"],
            session["role"],
            session["history"],
            user_name=user_name,
            company_name=session.get("company_name", ""),
            experience_level=session.get("experience_level", ""),
            job_description=session.get("job_description", ""),
            interview_type=interview_type,
        )

        session["history"].append({"role": "model", "text": next_question})
        response_payload["next_question"] = next_question

    return response_payload


@router.post("/tts")
async def text_to_speech(
    text: str = Form(...)
):
    """Convert text to speech using Microsoft Edge neural TTS voice."""

    VOICE = "en-US-JennyNeural"  # Warmer, more human-sounding female voice

    try:
        communicate = edge_tts.Communicate(
            text,
            VOICE,
            rate="+10%",    # Faster pacing — feels conversational, not robotic
            pitch="+3Hz",   # Slightly warmer/livelier tone
        )
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


@router.post("/run")
async def run_code(
    code: str = Form(...),
    language: str = Form(...),
    question_number: int = Form(...),
    question_title: str = Form(...),
    description: str = Form(...),
):
    from app.services.llm import evaluate_code_with_llm
    try:
        result = evaluate_code_with_llm(
            code=code,
            language=language,
            question_number=question_number,
            question_title=question_title,
            description=description
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

