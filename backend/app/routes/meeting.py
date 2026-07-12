"""
WebSocket-based signaling server for Peer-to-Peer Mock Interviews.

Handles:
- Lobby matchmaking (pairs candidates by target role)
- WebRTC signaling (SDP offer/answer, ICE candidate exchange)
- Session lifecycle (interview phase → feedback phase → disconnect)
"""
import json
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, WebSocket, Depends, Query
from starlette.websockets import WebSocketDisconnect

router = APIRouter()

# ── In-memory state ──
# Waiting lobby: { role_key: WebSocket }
waiting_lobby: dict[str, dict] = {}

# Active peer rooms: { room_id: { "interviewer": {...}, "interviewee": {...}, "phase": str, "created_at": str } }
active_rooms: dict[str, dict] = {}

# WebSocket → room mapping for cleanup
ws_to_room: dict[int, str] = {}


def _role_key(role: str) -> str:
    """Normalize role string for lobby matching."""
    return role.strip().lower().replace(" ", "_")


@router.websocket("/ws")
async def peer_signaling(
    websocket: WebSocket,
    role: str = Query("software_engineer"),
    user_name: str = Query("Anonymous"),
):
    """
    WebSocket endpoint for peer-to-peer interview signaling.
    
    Query params:
      - role: The interview role to match on (e.g., "software_engineer")
      - user_name: Display name of the connecting user
    
    Message protocol (JSON):
      Client → Server:
        { "type": "offer", "sdp": "..." }
        { "type": "answer", "sdp": "..." }
        { "type": "ice_candidate", "candidate": {...} }
        { "type": "end_interview" }        → Transitions room to feedback phase
        { "type": "leave" }                → Disconnects from the room
      
      Server → Client:
        { "type": "waiting" }              → Placed in lobby
        { "type": "matched", "room_id": "...", "role": "interviewer"|"interviewee", "peer_name": "..." }
        { "type": "offer", "sdp": "..." }
        { "type": "answer", "sdp": "..." }
        { "type": "ice_candidate", "candidate": {...} }
        { "type": "phase_change", "phase": "feedback" }
        { "type": "peer_left" }
    """
    await websocket.accept()
    ws_id = id(websocket)
    key = _role_key(role)

    try:
        # ── Matchmaking ──
        if key in waiting_lobby:
            # Match found! Pair with the waiting peer
            peer_info = waiting_lobby.pop(key)
            peer_ws: WebSocket = peer_info["ws"]
            peer_name: str = peer_info["name"]

            room_id = str(uuid.uuid4())[:8]

            # Randomly assign roles: first joiner = interviewer, second = interviewee
            active_rooms[room_id] = {
                "interviewer": {"ws": peer_ws, "name": peer_name, "ws_id": id(peer_ws)},
                "interviewee": {"ws": websocket, "name": user_name, "ws_id": ws_id},
                "phase": "interview",  # "interview" or "feedback"
                "created_at": datetime.utcnow().isoformat(),
            }
            ws_to_room[id(peer_ws)] = room_id
            ws_to_room[ws_id] = room_id

            # Notify both peers
            await peer_ws.send_json({
                "type": "matched",
                "room_id": room_id,
                "role": "interviewer",
                "peer_name": user_name,
            })
            await websocket.send_json({
                "type": "matched",
                "room_id": room_id,
                "role": "interviewee",
                "peer_name": peer_name,
            })

        else:
            # No match yet — add to lobby
            waiting_lobby[key] = {"ws": websocket, "name": user_name}
            await websocket.send_json({"type": "waiting"})

        # ── Message loop ──
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            room_id = ws_to_room.get(ws_id)
            if not room_id or room_id not in active_rooms:
                # Not in a room yet (still waiting), ignore signaling messages
                continue

            room = active_rooms[room_id]

            # Determine peer WebSocket
            if room["interviewer"]["ws_id"] == ws_id:
                peer_ws = room["interviewee"]["ws"]
            else:
                peer_ws = room["interviewer"]["ws"]

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
                # Transition to feedback phase — keep connection alive
                room["phase"] = "feedback"
                await peer_ws.send_json({"type": "phase_change", "phase": "feedback"})
                await websocket.send_json({"type": "phase_change", "phase": "feedback"})

            elif msg_type == "leave":
                await peer_ws.send_json({"type": "peer_left"})
                break

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[MEETING WS] Error: {e}")
    finally:
        # Cleanup
        # Remove from lobby if still waiting
        for lk, lv in list(waiting_lobby.items()):
            if id(lv["ws"]) == ws_id:
                del waiting_lobby[lk]
                break

        # Notify peer and clean up room
        room_id = ws_to_room.pop(ws_id, None)
        if room_id and room_id in active_rooms:
            room = active_rooms[room_id]
            # Notify peer
            for role_key in ("interviewer", "interviewee"):
                peer = room.get(role_key, {})
                if peer.get("ws_id") != ws_id:
                    try:
                        await peer["ws"].send_json({"type": "peer_left"})
                    except Exception:
                        pass
                    ws_to_room.pop(peer.get("ws_id", -1), None)
            del active_rooms[room_id]
