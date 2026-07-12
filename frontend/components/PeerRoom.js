"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Mic, MicOff, PhoneOff, MessageSquare, Send, Users, Clock } from "lucide-react";
import { API_BASE } from "@/utils/api";

/**
 * PeerRoom — WebRTC-powered peer-to-peer mock interview room.
 *
 * Props:
 *  - role: string — The interview role for lobby matching
 *  - userName: string — Current user's display name
 *  - onLeave: () => void — Callback when user leaves the room
 */
export default function PeerRoom({ role = "software_engineer", userName = "Anonymous", onLeave }) {
  // Connection state
  const [status, setStatus] = useState("connecting"); // connecting | waiting | matched | feedback | disconnected
  const [myRole, setMyRole] = useState(""); // "interviewer" or "interviewee"
  const [peerName, setPeerName] = useState("");
  const [roomId, setRoomId] = useState("");

  // Media
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);

  // Chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isMuted, setIsMuted] = useState(false);

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  // Recording
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // ── Setup local media ──
  useEffect(() => {
    async function setupMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to access camera/mic:", err);
      }
    }
    setupMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ── WebSocket + WebRTC setup ──
  useEffect(() => {
    const wsBase = API_BASE.replace(/^http/, "ws");
    const ws = new WebSocket(
      `${wsBase}/meeting/ws?role=${encodeURIComponent(role)}&user_name=${encodeURIComponent(userName)}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("waiting");
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "waiting":
          setStatus("waiting");
          break;

        case "matched":
          setStatus("matched");
          setMyRole(data.role);
          setPeerName(data.peer_name);
          setRoomId(data.room_id);

          // Start timer
          timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);

          // Start recording local stream
          if (localStreamRef.current) {
            try {
              const recorder = new MediaRecorder(localStreamRef.current, {
                mimeType: "video/webm;codecs=vp9,opus",
              });
              recorder.ondataavailable = (e) => {
                if (e.data?.size > 0) recordedChunksRef.current.push(e.data);
              };
              recorder.start(1000);
              recorderRef.current = recorder;
            } catch (e) {
              console.warn("MediaRecorder failed:", e);
            }
          }

          // Create peer connection (interviewer creates offer)
          await setupPeerConnection(data.role === "interviewer");
          break;

        case "offer":
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription({ type: "offer", sdp: data.sdp })
            );
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "answer", sdp: answer.sdp }));
          }
          break;

        case "answer":
          if (pcRef.current) {
            await pcRef.current.setRemoteDescription(
              new RTCSessionDescription({ type: "answer", sdp: data.sdp })
            );
          }
          break;

        case "ice_candidate":
          if (pcRef.current && data.candidate) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
              console.warn("ICE candidate error:", e);
            }
          }
          break;

        case "phase_change":
          if (data.phase === "feedback") {
            setStatus("feedback");
          }
          break;

        case "peer_left":
          setStatus("disconnected");
          if (timerRef.current) clearInterval(timerRef.current);
          break;
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setStatus("disconnected");
    };

    ws.onclose = () => {
      if (status !== "disconnected") setStatus("disconnected");
    };

    return () => {
      ws.close();
      if (timerRef.current) clearInterval(timerRef.current);
      if (pcRef.current) pcRef.current.close();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, userName]);

  async function setupPeerConnection(isInitiator) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "ice_candidate", candidate: event.candidate.toJSON() })
        );
      }
    };

    // If interviewer, create offer
    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
    }
  }

  function handleEndInterview() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end_interview" }));
    }
    setStatus("feedback");
  }

  function handleLeave() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "leave" }));
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (pcRef.current) pcRef.current.close();
    setStatus("disconnected");
    onLeave?.();
  }

  function toggleMute() {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }

  // ── Render ──
  if (status === "connecting" || status === "waiting") {
    return (
      <div className="peer-room-lobby">
        <div className="peer-lobby-card glass">
          <Users size={48} className="peer-lobby-icon pulse" />
          <h2>Looking for a peer...</h2>
          <p>Waiting for another candidate to join the <strong>{role.replace(/_/g, " ")}</strong> interview lobby.</p>
          <div className="peer-lobby-spinner" />
          <button className="button" onClick={onLeave}>Cancel</button>
        </div>
      </div>
    );
  }

  if (status === "disconnected") {
    return (
      <div className="peer-room-lobby">
        <div className="peer-lobby-card glass">
          <PhoneOff size={48} style={{ color: "#e17055" }} />
          <h2>Session Ended</h2>
          <p>The peer interview session has ended.</p>
          <button className="button primary" onClick={onLeave}>Back to Setup</button>
        </div>
      </div>
    );
  }

  return (
    <div className="peer-room">
      {/* Header */}
      <div className="peer-room-header glass">
        <div className="peer-room-info">
          <span className={`peer-role-badge ${myRole}`}>
            {myRole === "interviewer" ? "👔 Interviewer" : "🎯 Interviewee"}
          </span>
          <span className="peer-room-id">Room: {roomId}</span>
        </div>
        <div className="peer-room-timer">
          <Clock size={14} />
          <span>{formatTime(elapsed)}</span>
        </div>
        {status === "feedback" && (
          <span className="peer-feedback-badge">💬 Feedback Session</span>
        )}
      </div>

      {/* Video Grid */}
      <div className="peer-video-grid">
        <div className="peer-video-container">
          <video ref={localVideoRef} autoPlay playsInline muted className="peer-video" />
          <span className="peer-video-label">You ({userName})</span>
        </div>
        <div className="peer-video-container">
          <video ref={remoteVideoRef} autoPlay playsInline className="peer-video" />
          <span className="peer-video-label">{peerName}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="peer-controls">
        <button className={`peer-control-btn ${isMuted ? "active-danger" : ""}`} onClick={toggleMute}>
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {status === "matched" && (
          <button className="peer-control-btn end-btn" onClick={handleEndInterview}>
            <MessageSquare size={20} />
            <span>End Interview → Feedback</span>
          </button>
        )}

        <button className="peer-control-btn danger" onClick={handleLeave}>
          <PhoneOff size={20} />
          <span>Leave</span>
        </button>
      </div>

      {status === "feedback" && (
        <div className="peer-feedback-banner glass">
          <h3>💬 Live Q&A & Feedback Session</h3>
          <p>
            The interview recording has stopped. You are still connected — discuss performance,
            share feedback, and ask questions directly.
          </p>
        </div>
      )}
    </div>
  );
}
