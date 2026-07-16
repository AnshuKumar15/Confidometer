import json
import uuid
import asyncio
import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, WebSocket, Depends, Query, UploadFile, File, Form, HTTPException
from starlette.websockets import WebSocketDisconnect
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.meeting_request import PeerInterviewRequest
from app.schema.meeting_schema import MeetingRequestResponse
from app.utils.security import get_current_user
from app.utils.resume import extract_text_from_resume
from app.services.llm import generate_interview_question
from app.utils.audio import transcribe_chunk, _whisper_lock
from app.services.stt import SmartTranscriber, _extract_confidence

router = APIRouter()

# ── Database Dependency ──
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ── In-memory active room state ──
# Active peer rooms: { room_id: { "role_name": str, "company_name": str, "interview_type": str, "resume_text": str, "job_description": str, "resume_filename": str, "interviewer": {...}, "interviewee": {...}, "phase": str, "history": [...], "transcriber": SmartTranscriber, "created_at": str } }
active_rooms: dict[str, dict] = {}

# WebSocket → room mapping for cleanup
ws_to_room: dict[int, str] = {}


# -----------------------------------------------------------------------------
# HTTP ENDPOINTS FOR P2P MATCH LOBBY
# -----------------------------------------------------------------------------

@router.post("/request", response_model=MeetingRequestResponse)
async def create_meeting_request(
    role: str = Form(...),
    interview_type: str = Form(...),
    company_name: str = Form(...),
    job_description: Optional[str] = Form(None),
    scheduled_at: Optional[str] = Form(None),
    resume: UploadFile = File(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Post an interview request (immediate or scheduled)."""
    # Parse scheduled_at if present
    sched_time = None
    if scheduled_at:
        try:
            # Parse ISO 8601 string
            sched_time = datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid scheduled_at datetime format")

    # Save resume file
    os.makedirs("uploads", exist_ok=True)
    temp_filename = f"meeting_resume_{uuid.uuid4()}_{resume.filename}"
    file_path = os.path.join("uploads", temp_filename)
    with open(file_path, "wb") as f:
        f.write(await resume.read())

    # Extract text from resume
    try:
        resume_text = extract_text_from_resume(file_path)
    except Exception as e:
        resume_text = ""
        print(f"[MEETING] Resume extraction failed: {e}")

    req = PeerInterviewRequest(
        user_id=current_user.id,
        role=role,
        interview_type=interview_type,
        company_name=company_name,
        resume_text=resume_text,
        resume_filename=temp_filename,
        job_description=job_description,
        scheduled_at=sched_time,
        status="pending"
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@router.get("/requests/pending", response_model=list[MeetingRequestResponse])
def get_pending_requests(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Browse pending P2P requests posted by other users."""
    return db.query(PeerInterviewRequest).filter(
        PeerInterviewRequest.status == "pending",
        PeerInterviewRequest.user_id != current_user.id
    ).order_by(PeerInterviewRequest.created_at.desc()).all()


@router.get("/requests/my", response_model=list[MeetingRequestResponse])
def get_my_requests(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieve interview requests created or accepted by the logged in user."""
    return db.query(PeerInterviewRequest).filter(
        (PeerInterviewRequest.user_id == current_user.id) |
        (PeerInterviewRequest.interviewer_id == current_user.id)
    ).order_by(PeerInterviewRequest.created_at.desc()).all()


@router.post("/request/{request_id}/accept", response_model=MeetingRequestResponse)
def accept_meeting_request(
    request_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept an interview request."""
    req = db.query(PeerInterviewRequest).filter(PeerInterviewRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is already accepted or cancelled")
    if req.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot accept your own request")

    req.interviewer_id = current_user.id
    req.status = "accepted"

    # If it is an immediate request, generate the WebRTC Room ID
    if req.scheduled_at is None:
        req.room_id = str(uuid.uuid4())[:8]

    db.commit()
    db.refresh(req)
    return req


@router.get("/request/{request_id}/status", response_model=MeetingRequestResponse)
def get_meeting_request_status(
    request_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Poll meeting request status."""
    req = db.query(PeerInterviewRequest).filter(PeerInterviewRequest.id == request_id).first()
    if not req:
      raise HTTPException(status_code=404, detail="Request not found")
    return req


@router.delete("/request/{request_id}")
def delete_meeting_request(
    request_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete or cancel a pending interview request."""
    req = db.query(PeerInterviewRequest).filter(PeerInterviewRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not authorized to delete this request")
    
    db.delete(req)
    db.commit()
    return {"message": "Request deleted successfully"}



# -----------------------------------------------------------------------------
# WEBSOCKET SIGNALING & REAL-TIME INTERVIEW FLOW
# -----------------------------------------------------------------------------

@router.websocket("/ws")
async def peer_signaling(
    websocket: WebSocket,
    room_id: str = Query(...),
    role: str = Query(...),
    user_name: str = Query("Anonymous")
):
    """WebSocket signaling endpoint grouping peers by room_id with predefined roles."""
    await websocket.accept()
    ws_id = id(websocket)

    # Initialize room state if not exists
    if room_id not in active_rooms:
        active_rooms[room_id] = {
            "role_name": "Software Engineer",
            "company_name": "Peer Mock Interview",
            "interview_type": "technical",
            "resume_text": "",
            "resume_filename": "",
            "job_description": "",
            "interviewer": None,
            "interviewee": None,
            "phase": "warmup",
            "history": [],
            "transcriber": SmartTranscriber(),
            "created_at": datetime.utcnow().isoformat()
        }

        # Query database to retrieve matched request context
        db = SessionLocal()
        try:
            req = db.query(PeerInterviewRequest).filter(PeerInterviewRequest.room_id == room_id).first()
            if not req:
                # Support custom room IDs from scheduled meetings if needed
                req = db.query(PeerInterviewRequest).filter(
                    (PeerInterviewRequest.status == "accepted") & 
                    ((PeerInterviewRequest.room_id == room_id) | (PeerInterviewRequest.id == int(room_id) if room_id.isdigit() else False))
                ).first()

            if req:
                # Ensure the scheduled room ID matches if it was not set previously
                if req.room_id is None:
                    req.room_id = room_id
                    db.commit()

                active_rooms[room_id]["role_name"] = req.role.replace("_", " ").title()
                active_rooms[room_id]["company_name"] = req.company_name
                active_rooms[room_id]["interview_type"] = req.interview_type
                active_rooms[room_id]["resume_text"] = req.resume_text or ""
                active_rooms[room_id]["resume_filename"] = req.resume_filename or ""
                active_rooms[room_id]["job_description"] = req.job_description or ""
        except Exception as e:
            print(f"[MEETING] Error fetching request details for WebSocket: {e}")
        finally:
            db.close()

    room = active_rooms[room_id]

    # Assign socket based on the specified role
    if role == "interviewer":
        room["interviewer"] = {"ws": websocket, "name": user_name, "ws_id": ws_id}
    elif role == "interviewee":
        room["interviewee"] = {"ws": websocket, "name": user_name, "ws_id": ws_id}
    else:
        await websocket.close(code=1008, reason="Invalid role parameter")
        return

    ws_to_room[ws_id] = room_id
    print(f"[MEETING] User {user_name} joined room {room_id} as {role}")

    try:
        # Check if both peers are now present
        if room["interviewer"] and room["interviewee"]:
            # Notify Interviewer of the match and send candidate details
            await room["interviewer"]["ws"].send_json({
                "type": "matched",
                "room_id": room_id,
                "role": "interviewer",
                "peer_name": room["interviewee"]["name"],
                "phase": "warmup",
                "target_role": room["role_name"],
                "target_company": room["company_name"],
                "interview_type": room["interview_type"],
                "job_description": room["job_description"],
                "resume_filename": room["resume_filename"]
            })

            # Notify Interviewee of the match
            await room["interviewee"]["ws"].send_json({
                "type": "matched",
                "room_id": room_id,
                "role": "interviewee",
                "peer_name": room["interviewer"]["name"],
                "phase": "warmup"
            })

        # Combined JSON / Binary Message loop
        while True:
            message = await websocket.receive()
            room_id = ws_to_room.get(ws_id)
            if not room_id or room_id not in active_rooms:
                continue

            room = active_rooms[room_id]

            if not room["interviewer"] or not room["interviewee"]:
                # Both peers must be present to interact
                continue

            # Determine peer details
            if room["interviewer"]["ws_id"] == ws_id:
                peer_ws = room["interviewee"]["ws"]
                is_interviewer = True
            else:
                peer_ws = room["interviewer"]["ws"]
                is_interviewer = False

            # 1. Handle binary audio chunks from interviewee
            if "bytes" in message:
                if is_interviewer:
                    continue  # Interviewer audio is WebRTC direct only

                audio_bytes = message["bytes"]
                if not audio_bytes or len(audio_bytes) < 100:
                    continue

                # Transcribe chunk with synchronization lock
                loop = asyncio.get_event_loop()
                whisper_result = await loop.run_in_executor(
                    None, transcribe_chunk, audio_bytes
                )
                chunk_text = whisper_result.get("text", "").strip()

                if chunk_text:
                    confidence = _extract_confidence(whisper_result)
                    transcriber: SmartTranscriber = room["transcriber"]
                    result = transcriber.add_segment(chunk_text, confidence)
                    full_tx = result["full_transcript"]

                    update_msg = {
                        "type": "live_transcript",
                        "text": result["text"],
                        "full_transcript": full_tx,
                    }
                    try:
                        await websocket.send_json(update_msg)
                    except Exception:
                        pass
                    try:
                        await peer_ws.send_json(update_msg)
                    except Exception:
                        pass

            # 2. Handle text/JSON signaling messages
            elif "text" in message:
                try:
                    data = json.loads(message["text"])
                except Exception:
                    continue

                msg_type = data.get("type", "")

                if msg_type == "offer":
                    await peer_ws.send_json({"type": "offer", "sdp": data.get("sdp", "")})

                elif msg_type == "answer":
                    await peer_ws.send_json({"type": "answer", "sdp": data.get("sdp", "")})

                elif msg_type == "ice_candidate":
                    await peer_ws.send_json({
                        "type": "ice_candidate",
                        "candidate": data.get("candidate"),
                    })

                elif msg_type == "end_interview":
                    room["phase"] = "feedback"
                    await peer_ws.send_json({"type": "phase_change", "phase": "feedback"})
                    await websocket.send_json({"type": "phase_change", "phase": "feedback"})

                elif msg_type == "leave":
                    await peer_ws.send_json({"type": "peer_left"})
                    break

                # ── Start Formal Interview Questions ──
                elif msg_type == "start_questions":
                    if not is_interviewer:
                        continue

                    try:
                        print(f"[MEETING] Pre-generating question 1 for matched peer room {room_id}...")
                        q1 = generate_interview_question(
                            resume_text=room.get("resume_text", ""),
                            role=room.get("role_name", "Software Engineer"),
                            conversation_history=[],
                            user_name=room["interviewee"]["name"],
                            company_name=room.get("company_name", "Peer Mock Interview"),
                            experience_level="Mid Level",
                            interview_type=room.get("interview_type", "technical"),
                            is_peer=True
                        )
                    except Exception as e:
                        print(f"[MEETING] Fallback on question 1 generation: {e}")
                        q1 = "To begin, can you describe your experience with some of the primary technologies listed on your resume, and explain how you've applied them in your projects?"

                    room["phase"] = "interview"
                    room["history"].append({"role": "model", "text": q1})

                    # Notify both peers
                    start_msg = {
                        "type": "phase_change",
                        "phase": "interview",
                        "question": q1
                    }
                    await room["interviewer"]["ws"].send_json(start_msg)
                    await room["interviewee"]["ws"].send_json(start_msg)

                # ── Generate dynamic follow-up question ──
                elif msg_type == "request_next_question":
                    if not is_interviewer:
                        continue

                    # Retrieve transcript of candidate's response
                    transcriber: SmartTranscriber = room["transcriber"]
                    candidate_response = transcriber.get_full_transcript().strip()
                    if not candidate_response:
                        candidate_response = "[The candidate completed speaking without audio transcription.]"

                    # Add response to history
                    room["history"].append({"role": "user", "text": candidate_response})

                    # Reset transcriber for the next question block
                    transcriber.reset()

                    role_name = room["role_name"]
                    interviewee_name = room["interviewee"]["name"]

                    try:
                        print(f"[MEETING] Generating follow-up question for {interviewee_name}...")
                        next_q = generate_interview_question(
                            resume_text=room.get("resume_text", ""),
                            role=role_name,
                            conversation_history=room["history"],
                            user_name=interviewee_name,
                            company_name=room.get("company_name", "Peer Mock Interview"),
                            experience_level="Mid Level",
                            interview_type=room.get("interview_type", "technical"),
                            is_peer=True
                        )
                    except Exception as e:
                        print(f"[MEETING] Fallback on question generation: {e}")
                        next_q = "Could you talk about another key system architectural or technical concept you are familiar with from your work?"

                    # Update history
                    room["history"].append({"role": "model", "text": next_q})

                    # Send next question to Interviewer
                    await websocket.send_json({
                        "type": "next_question",
                        "question": next_q,
                    })
                    # Notify Interviewee
                    await peer_ws.send_json({
                        "type": "next_question_ready"
                    })

    except WebSocketDisconnect:
        print(f"[MEETING WS] User disconnected (role: {role}, name: {user_name})")
    except Exception as e:
        print(f"[MEETING WS] Error: {e}")
    finally:
        # Cleanup WebSocket in active room
        room_id = ws_to_room.pop(ws_id, None)
        if room_id and room_id in active_rooms:
            room = active_rooms[room_id]
            # Notify peer
            for role_key in ("interviewer", "interviewee"):
                peer = room.get(role_key)
                if peer and peer.get("ws_id") != ws_id:
                    try:
                        await peer["ws"].send_json({"type": "peer_left"})
                    except Exception:
                        pass
                    ws_to_room.pop(peer.get("ws_id", -1), None)
            del active_rooms[room_id]
