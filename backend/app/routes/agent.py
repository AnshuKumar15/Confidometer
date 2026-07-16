from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from app.utils.resume import extract_text_from_resume
from app.services.llm import generate_interview_question, generate_dsa_question
from app.utils.security import get_current_user
from app.utils.audio import transcribe_chunk
from app.services.stt import SmartTranscriber, _extract_confidence
from starlette.background import BackgroundTask
import os
import uuid
import json
import asyncio
import edge_tts
import tempfile

router = APIRouter()

# Temporary in-memory session storage
# format: { session_id: { "resume_text": str, "role": str, "user_name": str,
#            "interview_type": str, "company_name": str, "experience_level": str,
#            "job_description": str, "history": [...],
#            "dsa_state": { "current_q": int, "questions": [...], "code_submissions": [...] } } }
active_sessions = {}

import collections
import asyncio
import re

def clean_text_for_tts(text: str) -> str:
    if not text:
        return text
    # 1. Add space between numbers and letters (e.g. "18lakh" -> "18 lakh")
    text = re.sub(r'(\d+)([a-zA-Z]+)', r'\1 \2', text)
    text = re.sub(r'([a-zA-Z]+)(\d+)', r'\1 \2', text)
    
    # 2. Match Indian grouping: XX,XX,XXX (Lakhs)
    # e.g. 18,00,000 or 1,50,00,000
    def repl_indian_lakh(match):
        num_str = match.group(0).replace(",", "")
        num = int(num_str)
        lakhs = num / 100000.0
        val = int(lakhs) if lakhs.is_integer() else round(lakhs, 2)
        return f"{val} lakh"
        
    text = re.sub(r'\b\d{1,2},\d{2},\d{3}\b', repl_indian_lakh, text)
    
    # 3. Match Indian grouping: X,XX,XX,XXX or XX,XX,XX,XXX (Crores)
    # e.g. 1,50,00,000 or 15,00,00,000
    def repl_indian_crore(match):
        num_str = match.group(0).replace(",", "")
        num = int(num_str)
        crores = num / 10000000.0
        val = int(crores) if crores.is_integer() else round(crores, 2)
        return f"{val} crore"
        
    text = re.sub(r'\b\d{1,2},\d{2},\d{2},\d{3}\b', repl_indian_crore, text)

    # 4. If there's a plain 5-9 digit number explicitly followed by Indian currency words, convert it
    def repl_large_plain_num(match):
        num_str = match.group(1)
        suffix = match.group(2)
        num = int(num_str)
        if num >= 10000000:
            crores = num / 10000000.0
            val = int(crores) if crores.is_integer() else round(crores, 2)
            return f"{val} crore {suffix}"
        else:
            lakhs = num / 100000.0
            val = int(lakhs) if lakhs.is_integer() else round(lakhs, 2)
            return f"{val} lakh {suffix}"

    text = re.sub(r'\b(\d{5,9})\b\s*(inr|rupees|rupee|rs)\b', repl_large_plain_num, text, flags=re.IGNORECASE)
    
    return text


# Global LRU-like cache of recently synthesized/synthesizing text to speech audio.
# Keys are the exact text string. Values are either a completed `bytes` object or an active `asyncio.Task`.
_tts_cache = collections.OrderedDict()
_tts_cache_lock = asyncio.Lock()
MAX_TTS_CACHE_SIZE = 30

async def _add_to_tts_cache(text: str, audio_bytes: bytes):
    async with _tts_cache_lock:
        if text in _tts_cache:
            _tts_cache.pop(text)
        _tts_cache[text] = audio_bytes
        if len(_tts_cache) > MAX_TTS_CACHE_SIZE:
            _tts_cache.popitem(last=False)

def prefetch_tts(text: str):
    """Starts a background task to pre-generate and cache TTS audio for the given text."""
    if not text:
        return
    text = clean_text_for_tts(text)
    try:
        # Run the pre-generation in the background on the event loop
        asyncio.create_task(_run_prefetch_tts(text))
    except Exception as e:
        print(f"[TTS PREFETCH START ERROR] {e}")

async def _run_prefetch_tts(text: str):
    async with _tts_cache_lock:
        if text in _tts_cache:
            return

    async def task_impl():
        VOICE = "en-US-JennyNeural"
        try:
            communicate = edge_tts.Communicate(
                text,
                VOICE,
                rate="+10%",    # Faster pacing — feels conversational, not robotic
                pitch="+3Hz",   # Slightly warmer/livelier tone
            )
            audio_data = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.extend(chunk["data"])
            
            completed_bytes = bytes(audio_data)
            async with _tts_cache_lock:
                _tts_cache[text] = completed_bytes
            return completed_bytes
        except Exception as e:
            print(f"[TTS PREFETCH ERROR] {e}")
            async with _tts_cache_lock:
                _tts_cache.pop(text, None)
            return None

    task = asyncio.create_task(task_impl())
    async with _tts_cache_lock:
        _tts_cache[text] = task
        if len(_tts_cache) > MAX_TTS_CACHE_SIZE:
            _tts_cache.popitem(last=False)


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
    duration: int = Form(10),
    stress_mode: bool = Form(False),
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
        if interview_type not in ("technical", "hr", "dsa", "behavioural", "negotiation"):
            interview_type = "technical"

        # Stress mode only applies to non-DSA rounds
        if interview_type == "dsa":
            stress_mode = False

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
            "duration": duration,
            "stress_mode": stress_mode,
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
                stress_mode=stress_mode,
            )
            active_sessions[session_id]["history"].append({
                "role": "model",
                "text": first_question
            })
            response_payload["first_question"] = first_question

        prefetch_tts(first_question)
        return response_payload

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initiate interview: {str(e)}")


@router.post("/respond")
async def respond_to_agent(
    session_id: str = Form(...),
    message: str = Form(...),
    code: str = Form(None),
    question_index: int = Form(0),
    elapsed_seconds: int = Form(0),
):
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = active_sessions[session_id]
    interview_type = session.get("interview_type", "technical")
    duration = session.get("duration", 10)
    is_time_up = elapsed_seconds >= (duration * 60)
    
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
        response_payload["is_complete"] = False

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
            is_time_up=is_time_up,
            stress_mode=session.get("stress_mode", False),
        )

        session["history"].append({"role": "model", "text": next_question})
        response_payload["next_question"] = next_question
        
        is_complete = is_time_up
        # Detect if model wrapped up in its text output
        if is_time_up or "interview is complete" in next_question.lower() or "concludes our" in next_question.lower() or "conclude our" in next_question.lower() or "complete." in next_question.lower():
            is_complete = True
            
        response_payload["is_complete"] = is_complete

    if "next_question" in response_payload:
        prefetch_tts(response_payload["next_question"])
    return response_payload


@router.get("/tts")
async def text_to_speech_get(text: str = Query(...)):
    """Convert text to speech using Microsoft Edge neural TTS voice, streaming the response via GET."""
    return await _stream_tts(text)


@router.post("/tts")
async def text_to_speech_post(text: str = Form(...)):
    """Convert text to speech using Microsoft Edge neural TTS voice, streaming the response via POST."""
    return await _stream_tts(text)


async def _stream_tts(text: str):
    from fastapi.responses import StreamingResponse
    text = clean_text_for_tts(text)
    
    # Check if we have cached or prefetching item
    cached_item = None
    async with _tts_cache_lock:
        if text in _tts_cache:
            cached_item = _tts_cache[text]
            
    if cached_item is not None:
        if isinstance(cached_item, bytes):
            print(f"[TTS CACHE] Serving completed audio for text: {text[:30]}...")
            async def cached_bytes_generator():
                yield cached_item
            return StreamingResponse(cached_bytes_generator(), media_type="audio/mpeg")
            
        elif isinstance(cached_item, asyncio.Task):
            print(f"[TTS CACHE] Awaiting in-progress prefetch for text: {text[:30]}...")
            try:
                audio_bytes = await cached_item
                if audio_bytes:
                    async def cached_bytes_generator():
                        yield audio_bytes
                    return StreamingResponse(cached_bytes_generator(), media_type="audio/mpeg")
            except Exception as e:
                print(f"[TTS CACHE ERROR] Awaiting prefetch task failed: {e}")
    
    # Fallback to live stream if not in cache or if prefetching failed
    print(f"[TTS CACHE] Miss, live streaming for text: {text[:30]}...")
    VOICE = "en-US-JennyNeural"
    try:
        communicate = edge_tts.Communicate(
            text,
            VOICE,
            rate="+10%",
            pitch="+3Hz",
        )
        
        async def audio_generator_and_cache():
            audio_data = bytearray()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.extend(chunk["data"])
                    yield chunk["data"]
            # After streaming completes, cache it
            await _add_to_tts_cache(text, bytes(audio_data))

        return StreamingResponse(audio_generator_and_cache(), media_type="audio/mpeg")
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


# ── In-memory store for active STT sessions (session_id → SmartTranscriber) ──
_stt_sessions: dict[str, SmartTranscriber] = {}


@router.websocket("/ws/stt")
async def websocket_stt(websocket: WebSocket, session_id: str = Query("")):
    """
    WebSocket endpoint for real-time Speech-to-Text using Whisper.

    Protocol:
    - Client sends binary audio chunks (webm blobs) via WebSocket
    - Server transcribes each chunk with Whisper
    - Server applies smart self-correction (detects repeated/corrected phrases)
    - Server sends back JSON: { text, corrections, full_transcript }
    """
    await websocket.accept()
    print(f"[STT-WS] Client connected (session: {session_id or 'none'})")

    # Get or create SmartTranscriber for this session
    if session_id and session_id not in _stt_sessions:
        _stt_sessions[session_id] = SmartTranscriber()
    transcriber = _stt_sessions.get(session_id, SmartTranscriber())

    try:
        while True:
            # Receive audio chunk as binary
            data = await websocket.receive_bytes()

            if not data or len(data) < 100:
                # Too small to be useful audio — skip
                continue

            # Transcribe the chunk in a thread to avoid blocking the event loop
            loop = asyncio.get_event_loop()
            whisper_result = await loop.run_in_executor(
                None, transcribe_chunk, data
            )

            chunk_text = whisper_result.get("text", "").strip()

            if not chunk_text:
                # No speech detected in this chunk
                await websocket.send_json({
                    "type": "interim",
                    "text": "",
                    "corrections": [],
                    "full_transcript": transcriber.get_full_transcript(),
                })
                continue

            # Extract confidence from Whisper result
            confidence = _extract_confidence(whisper_result)

            # Add to smart transcriber (may trigger corrections)
            result = transcriber.add_segment(chunk_text, confidence)

            print(f"[STT-WS] Chunk: '{chunk_text}' (conf={confidence:.2f}), "
                  f"corrections={len(result['corrections'])}")

            # Send result back to client
            await websocket.send_json({
                "type": "result",
                "text": result["text"],
                "corrections": result["corrections"],
                "full_transcript": result["full_transcript"],
            })

    except WebSocketDisconnect:
        print(f"[STT-WS] Client disconnected (session: {session_id or 'none'})")
    except Exception as e:
        print(f"[STT-WS] Error: {e}")
        try:
            await websocket.close(code=1011, reason=str(e))
        except Exception:
            pass
    finally:
        # Clean up the transcriber if session ended
        if session_id and session_id in _stt_sessions:
            del _stt_sessions[session_id]


@router.post("/stt/reset")
async def reset_stt_session(session_id: str = Form(...)):
    """Reset the STT transcriber for a session (e.g., when starting a new question)."""
    if session_id in _stt_sessions:
        _stt_sessions[session_id].reset()
    return {"status": "ok"}

