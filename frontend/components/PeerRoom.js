"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, CameraOff, Mic, MicOff, PhoneOff, MessageSquare, Clock, FileText, Check } from "lucide-react";
import { getApiBase, getWsBase, uploadVideo } from "@/utils/api";
import { getToken } from "@/utils/auth";

// Multi-region STUN + Free OpenRelay TURN servers for production NAT traversal
const ICE_CONFIG = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"] },
    { urls: ["stun:stun.cloudflare.com:3478", "stun:global.stun.twilio.com:3478"] },
    { urls: "stun:openrelay.metered.ca:80" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
};

/**
 * PeerRoom — WebRTC-powered peer-to-peer mock interview room with dynamic AI interview guides.
 */
export default function PeerRoom({ 
  role = "software_engineer", 
  userName = "Anonymous", 
  roomId: initialRoomId = "",
  myRoleProp = "",
  onLeave 
}) {
  // Connection state
  const [status, setStatus] = useState("connecting"); // connecting | waiting | matched | feedback | disconnected
  const [myRole, setMyRole] = useState(myRoleProp); // "interviewer" or "interviewee"
  const [peerName, setPeerName] = useState("");
  const [roomId, setRoomId] = useState(initialRoomId);
  const [roomPhase, setRoomPhase] = useState("warmup"); // warmup | interview | feedback
  const [targetDetails, setTargetDetails] = useState(null);

  // AI Guide & Transcription state
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [uploadStatus, setUploadStatus] = useState(""); // "" | "uploading" | "success" | "error"
  const [speechId, setSpeechId] = useState(null);

  // Stream presence states
  const [hasRemoteStream, setHasRemoteStream] = useState(false);

  // Refs for tracking changes inside callbacks/closures
  const myRoleRef = useRef(myRoleProp);

  // Media & WebRTC Readiness
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaError, setMediaError] = useState("");

  // Media
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const iceCandidatesQueue = useRef([]);

  // Chat/Audio toggles
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

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

  const addTracksToPeerConnection = (stream, pc) => {
    if (!stream || !pc) return;
    try {
      const senders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        const existingSender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (existingSender) {
          existingSender.replaceTrack(track).catch(() => {});
        } else {
          pc.addTrack(track, stream);
        }
      });
    } catch (e) {
      console.warn("[WebRTC] Error adding tracks to active connection:", e);
    }
  };

  // ── Setup local media ──
  const setupMedia = async () => {
    setMediaError("");
    if (localStreamRef.current && localStreamRef.current.active) {
      if (localVideoRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
      setMediaReady(true);
      return;
    }

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: true,
        });
      } catch (constraintErr) {
        console.warn("[Media] Retrying with basic constraints:", constraintErr);
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      if (pcRef.current) {
        addTracksToPeerConnection(stream, pcRef.current);
      }

      setMediaReady(true);
      setMediaError("");
    } catch (err) {
      console.error("Failed to access camera/mic:", err);
      let msg = "Camera/Mic access failed.";
      if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        msg = "Camera is in use by another application or browser tab.";
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        msg = "Camera permission was denied in browser settings.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        msg = "No webcam or microphone found.";
      }
      setMediaError(msg);
      setMediaReady(true);
    }
  };

  useEffect(() => {
    setupMedia();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      remoteStreamRef.current = null;
    };
  }, []);

  // ── Synchronize stream attachment when video elements mount or status changes ──
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [status, mediaReady, isCameraOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [status, mediaReady, peerName, hasRemoteStream]);

  const drainIceCandidates = async (pc) => {
    while (iceCandidatesQueue.current.length > 0) {
      const candidate = iceCandidatesQueue.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("[WebRTC] Error adding buffered ICE candidate:", err);
      }
    }
  };

  async function setupPeerConnection(isInitiator) {
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }
    iceCandidatesQueue.current = [];

    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStreamRef.current);
        } catch (err) {
          console.warn("[WebRTC] Error adding local track:", err);
        }
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log("[WebRTC] ontrack received track:", event.track.kind);
      let stream = event.streams && event.streams[0];
      if (!stream) {
        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
        }
        remoteStreamRef.current.addTrack(event.track);
        stream = remoteStreamRef.current;
      } else {
        remoteStreamRef.current = stream;
      }

      setHasRemoteStream(true);

      if (remoteVideoRef.current) {
        if (remoteVideoRef.current.srcObject !== stream) {
          remoteVideoRef.current.srcObject = stream;
        }
        remoteVideoRef.current.play().catch((e) => console.warn("[WebRTC] Remote video play error:", e));
      }

      event.track.onunmute = () => {
        setHasRemoteStream(true);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.play().catch(() => {});
        }
      };
    };

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ type: "ice_candidate", candidate: event.candidate.toJSON() })
        );
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("[WebRTC] ICE Connection State:", pc.iceConnectionState);
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setHasRemoteStream(true);
        if (remoteVideoRef.current && remoteStreamRef.current) {
          remoteVideoRef.current.play().catch(() => {});
        }
      }
    };

    // If interviewer, create and dispatch offer
    if (isInitiator) {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "offer", sdp: offer.sdp }));
        }
      } catch (err) {
        console.error("[WebRTC] Create offer error:", err);
      }
    }

    return pc;
  }

  // ── WebSocket + WebRTC setup ──
  useEffect(() => {
    if (!mediaReady) return;

    const wsBase = getWsBase();
    const token = getToken() || "";
    const ws = new WebSocket(
      `${wsBase}/meeting/ws?room_id=${encodeURIComponent(roomId || initialRoomId)}&role=${encodeURIComponent(myRoleProp)}&user_name=${encodeURIComponent(userName)}&token=${encodeURIComponent(token)}`
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
          setMyRole(data.role || myRoleProp);
          myRoleRef.current = data.role || myRoleProp;
          setPeerName(data.peer_name);
          setRoomId(data.room_id || initialRoomId);
          setRoomPhase(data.phase || "warmup");
          setCurrentQuestion(data.question || "");

          if ((data.role || myRoleProp) === "interviewer") {
            setTargetDetails({
              targetRole: data.target_role,
              targetCompany: data.target_company,
              interviewType: data.interview_type,
              jobDescription: data.job_description,
              resumeFilename: data.resume_filename
            });
          }

          // Start timer
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);

          // Start recording local stream
          if (localStreamRef.current) {
            try {
              const preferredMime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
                ? "video/webm;codecs=vp9,opus"
                : "video/webm";

              const recorder = new MediaRecorder(localStreamRef.current, {
                mimeType: preferredMime,
              });

              recorder.ondataavailable = (e) => {
                if (e.data?.size > 0) {
                  recordedChunksRef.current.push(e.data);

                  if (myRoleRef.current === "interviewee" && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    e.data.arrayBuffer().then((buf) => {
                      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(buf);
                      }
                    });
                  }
                }
              };

              recorder.start(1000);
              recorderRef.current = recorder;
            } catch (e) {
              console.warn("MediaRecorder failed:", e);
            }
          }

          // Initialize WebRTC (Interviewer sends initial offer)
          await setupPeerConnection(data.role === "interviewer");
          break;

        case "offer":
          let pcOffer = pcRef.current;
          if (!pcOffer) {
            pcOffer = await setupPeerConnection(false);
          }
          try {
            await pcOffer.setRemoteDescription(
              new RTCSessionDescription({ type: "offer", sdp: data.sdp })
            );
            await drainIceCandidates(pcOffer);
            const answer = await pcOffer.createAnswer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await pcOffer.setLocalDescription(answer);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: "answer", sdp: answer.sdp }));
            }
          } catch (e) {
            console.error("[WebRTC] Offer handling error:", e);
          }
          break;

        case "answer":
          if (pcRef.current) {
            try {
              await pcRef.current.setRemoteDescription(
                new RTCSessionDescription({ type: "answer", sdp: data.sdp })
              );
              await drainIceCandidates(pcRef.current);
            } catch (e) {
              console.error("[WebRTC] Answer handling error:", e);
            }
          }
          break;

        case "ice_candidate":
          if (data.candidate) {
            if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
              try {
                await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
              } catch (e) {
                console.warn("[WebRTC] ICE candidate error:", e);
              }
            } else {
              iceCandidatesQueue.current.push(data.candidate);
            }
          }
          break;

        case "live_transcript":
          setLiveTranscript(data.full_transcript || "");
          break;

        case "next_question":
          setCurrentQuestion(data.question || "");
          setLiveTranscript("");
          break;

        case "next_question_ready":
          setLiveTranscript("");
          break;

        case "phase_change":
          setRoomPhase(data.phase);
          if (data.phase === "interview") {
            setCurrentQuestion(data.question || "");
          } else if (data.phase === "feedback") {
            setStatus("feedback");
            if (recorderRef.current && recorderRef.current.state !== "inactive") {
              recorderRef.current.stop();
            }
          }
          break;

        case "peer_left":
          setStatus("disconnected");
          setHasRemoteStream(false);
          if (timerRef.current) clearInterval(timerRef.current);
          break;
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setStatus("disconnected");
      setHasRemoteStream(false);
    };

    ws.onclose = () => {
      if (status !== "disconnected") {
        setStatus("disconnected");
        setHasRemoteStream(false);
      }
    };

    return () => {
      ws.close();
      if (timerRef.current) clearInterval(timerRef.current);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, userName, mediaReady, initialRoomId, myRoleProp]);

  // ── Auto-upload interviewee recording when entering feedback phase ──
  useEffect(() => {
    if (status === "feedback" && myRole === "interviewee" && recordedChunksRef.current.length > 0) {
      async function uploadRecording() {
        setUploadStatus("uploading");
        try {
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const file = new File([blob], `peer-recording-${Date.now()}.webm`, { type: "video/webm" });
          
          const res = await uploadVideo(file, roomId);
          if (res && res.speech_id) {
            setSpeechId(res.speech_id);
            setUploadStatus("success");
          } else {
            throw new Error("Invalid upload response from server");
          }
        } catch (err) {
          console.error("Failed to upload recording for diagnostics:", err);
          setUploadStatus("error");
        }
      }
      uploadRecording();
    }
  }, [status, myRole, roomId]);

  function handleEndInterview() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "end_interview" }));
    }
    setStatus("feedback");
  }

  function requestNextQuestion() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "request_next_question" }));
    }
  }

  function handleStartQuestions() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "start_questions" }));
    }
  }

  function handleLeave() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "leave" }));
    }
    setHasRemoteStream(false);
    onLeave();
  }

  function toggleMute() {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsMuted(!isMuted);
    }
  }

  function toggleCamera() {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = !t.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  }

  if (status === "connecting" || status === "waiting") {
    return (
      <div className="peer-room-lobby">
        <div className="peer-lobby-card glass">
          <div className="peer-lobby-spinner" />
          <h2>Waiting for Peer...</h2>
          <p>
            {status === "connecting"
              ? "Establishing secure signaling connection..."
              : `You are in room #${roomId || initialRoomId}. Waiting for the other participant to join.`}
          </p>
          <div className="peer-lobby-info">
            <span className="peer-role-badge">{myRole === "interviewer" ? "Interviewer" : "Candidate"}</span>
            <span className="peer-name-tag">{userName}</span>
          </div>
          <button className="button subtle" onClick={handleLeave} style={{ marginTop: "16px" }}>
            Cancel & Exit
          </button>
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
          <span className="peer-room-id">Room ID: {roomId}</span>
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
          <video 
            ref={(el) => {
              localVideoRef.current = el;
              if (el && localStreamRef.current && el.srcObject !== localStreamRef.current) {
                el.srcObject = localStreamRef.current;
                el.play().catch(() => {});
              }
            }} 
            autoPlay 
            playsInline 
            muted 
            className="peer-video peer-video-local" 
          />
          {mediaError && (
            <div className="peer-video-off-overlay">
              <CameraOff size={36} style={{ color: "#f87171" }} />
              <span style={{ fontSize: "0.85rem", color: "#fca5a5", textAlign: "center", padding: "0 14px", lineHeight: "1.4" }}>
                {mediaError}
              </span>
              <button 
                type="button" 
                className="button primary" 
                style={{ fontSize: "0.8rem", padding: "6px 14px", marginTop: "6px" }}
                onClick={() => setupMedia()}
              >
                Enable Camera
              </button>
            </div>
          )}
          {isCameraOff && !mediaError && (
            <div className="peer-video-off-overlay">
              <CameraOff size={36} style={{ opacity: 0.6 }} />
              <span>Camera Off</span>
            </div>
          )}
          <span className="peer-video-label">You ({userName})</span>
        </div>
        <div className="peer-video-container">
          <video 
            ref={(el) => {
              remoteVideoRef.current = el;
              if (el && remoteStreamRef.current && el.srcObject !== remoteStreamRef.current) {
                el.srcObject = remoteStreamRef.current;
                el.play().catch(() => {});
              }
            }} 
            autoPlay 
            playsInline 
            className="peer-video peer-video-remote" 
          />
          {!hasRemoteStream && (
            <div className="peer-video-off-overlay" style={{ background: "rgba(10, 15, 29, 0.75)" }}>
              <div className="peer-lobby-spinner" style={{ width: "32px", height: "32px", borderWidth: "2px" }} />
              <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Connecting to {peerName || "peer"}...</span>
            </div>
          )}
          <span className="peer-video-label">{peerName || "Waiting for Peer Video..."}</span>
        </div>
      </div>

      {/* Interactive AI Guide & Transcription workspace */}
      {status === "matched" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
          {roomPhase === "warmup" ? (
            /* WARMUP PHASE */
            <div className="peer-guide-panel glass" style={{ padding: "24px", borderRadius: "12px", border: "1px solid var(--line)", background: "rgba(15, 23, 42, 0.3)" }}>
              {myRole === "interviewer" ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <h3 style={{ margin: 0, color: "var(--teal)", display: "flex", alignItems: "center", gap: "8px" }}>
                      📋 Interviewer Warmup & Target Profile
                    </h3>
                    <span className="badge" style={{ background: "rgba(0,184,148,0.15)", color: "var(--teal)" }}>
                      Warmup Phase
                    </span>
                  </div>

                  {targetDetails && (
                    <div className="target-details-card glass" style={{ padding: "16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)", marginBottom: "20px" }}>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.9rem" }}>
                        <li><span style={{ color: "var(--muted)" }}>Candidate Name:</span> <strong>{peerName}</strong></li>
                        <li><span style={{ color: "var(--muted)" }}>Target Role:</span> <strong>{targetDetails.targetRole || "Software Engineer"}</strong></li>
                        <li><span style={{ color: "var(--muted)" }}>Target Company:</span> <strong>{targetDetails.targetCompany || "Tech"}</strong></li>
                        <li><span style={{ color: "var(--muted)" }}>Interview Type:</span> <strong style={{ textTransform: "capitalize" }}>{targetDetails.interviewType || "Technical"}</strong></li>
                      </ul>
                      {targetDetails.jobDescription && (
                        <div style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "10px" }}>
                          <strong>Job Description:</strong>
                          <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--muted)", maxHeight: "80px", overflowY: "auto" }}>
                            {targetDetails.jobDescription}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ fontSize: "0.95rem", lineHeight: "1.6", color: "#94a3b8", marginBottom: "20px" }}>
                    <p style={{ margin: "0 0 10px 0" }}>
                      Introduce yourself and greet the candidate naturally. Ask them to introduce themselves and run through their background. 
                    </p>
                    <p style={{ margin: 0, fontWeight: "600", color: "#e2e8f0" }}>
                      💡 Once you are ready to transition to the formal AI-assisted questions, click the button below:
                    </p>
                  </div>

                  <button 
                    onClick={handleStartQuestions} 
                    className="button primary" 
                    style={{ padding: "10px 20px" }}
                  >
                    Start Formal Interview Questions
                  </button>
                </>
              ) : (
                <>
                  <h3 style={{ color: "var(--cyan)", margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "8px" }}>
                    🎯 Warmup Phase
                  </h3>
                  <p style={{ fontSize: "1.05rem", lineHeight: "1.6", color: "#e2e8f0" }}>
                    Welcome! Say hello to your interviewer, <strong>{peerName}</strong>. Introduce yourself and share your experience when they ask.
                  </p>
                  <p style={{ color: "var(--muted)", fontSize: "0.9rem", margin: "10px 0 0 0" }}>
                    The interviewer will transition the session to formal interview questions when ready.
                  </p>
                </>
              )}
            </div>
          ) : (
            /* FORMAL INTERVIEW PHASE */
            <>
              {/* Question / Guide Panel */}
              <div className="peer-question-panel glass" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--line)", background: "rgba(15, 23, 42, 0.2)" }}>
                {myRole === "interviewer" ? (
                  <>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--teal)", margin: "0 0 10px 0" }}>
                      🎯 Active Interview Question to Ask:
                    </h3>
                    <p style={{ fontSize: "1.1rem", lineHeight: "1.6", margin: "10px 0 20px 0", color: "#e2e8f0" }}>
                      {currentQuestion || "Generating question..."}
                    </p>
                    <button 
                      onClick={requestNextQuestion} 
                      className="button primary" 
                      disabled={!currentQuestion}
                    >
                      Generate Follow-up Question
                    </button>
                  </>
                ) : (
                  <>
                    <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--cyan)", margin: "0 0 10px 0" }}>
                      🎙️ Verbal response active:
                    </h3>
                    <p style={{ color: "var(--muted)", margin: "10px 0" }}>
                      Listen carefully to the interviewer's prompt and explain your thoughts verbally. Your voice is being transcribed.
                    </p>
                  </>
                )}
              </div>

              {/* Live Speech-to-Text display */}
              <div className="peer-transcript-panel glass" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--line)", background: "rgba(15, 23, 42, 0.2)" }}>
                <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 10px 0" }}>
                  📝 Live Transcription:
                </h3>
                <p style={{ fontStyle: "italic", margin: "10px 0", minHeight: "36px", color: "#94a3b8" }}>
                  {liveTranscript || <span style={{ color: "rgba(255,255,255,0.2)" }}>Speech transcription appears here in real time...</span>}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Post-Interview Diagnostics (Feedback status) */}
      {status === "feedback" && (
        <div className="peer-analysis-panel glass" style={{ padding: "24px", borderRadius: "12px", border: "1px solid var(--line)", background: "rgba(15, 23, 42, 0.3)", textAlign: "center" }}>
          {myRole === "interviewee" ? (
            <>
              <h3 style={{ margin: "0 0 8px 0" }}>📊 Peer Diagnostics & Analysis</h3>
              <p style={{ color: "var(--muted)", margin: "0 0 20px 0" }}>
                We are processing your interview recording to calculate soft skill fluency and posture metrics.
              </p>
              
              {uploadStatus === "uploading" && (
                <div>
                  <div className="peer-lobby-spinner" style={{ margin: "16px auto" }} />
                  <p style={{ fontSize: "0.92rem", color: "var(--muted)" }}>Saving and uploading interview audio/video tracks...</p>
                </div>
              )}

              {uploadStatus === "success" && (
                <div>
                  <p style={{ color: "var(--teal)", fontWeight: "600", marginBottom: "16px" }}>
                    ✓ Interview uploaded successfully! Background diagnostics pipeline started.
                  </p>
                  <button 
                    onClick={() => window.location.href = `/processing?speech_id=${speechId}`} 
                    className="button primary"
                  >
                    View Diagnostic Report
                  </button>
                </div>
              )}

              {uploadStatus === "error" && (
                <div>
                  <p style={{ color: "#e17055", marginBottom: "12px" }}>
                    ⚠ Upload failed.
                  </p>
                  <button 
                    onClick={async () => {
                      setUploadStatus("uploading");
                      try {
                        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
                        const file = new File([blob], `peer-recording-${Date.now()}.webm`, { type: "video/webm" });
                        const res = await uploadVideo(file, roomId);
                        if (res && res.speech_id) {
                          setSpeechId(res.speech_id);
                          setUploadStatus("success");
                        } else {
                          throw new Error("Invalid response");
                        }
                      } catch (err) {
                        setUploadStatus("error");
                      }
                    }} 
                    className="button"
                  >
                    Retry Upload
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <h3 style={{ margin: "0 0 8px 0" }}>👔 Discuss Performance</h3>
              <p style={{ color: "#94a3b8", margin: "0 0 16px 0" }}>
                The interview is concluded. The candidate is uploading their webcam feed to run background diagnostics checks.
              </p>
              <p style={{ color: "var(--muted)", fontStyle: "italic" }}>
                You can remain connected to give them verbal feedback, discuss questions, or exit whenever you're ready.
              </p>
            </>
          )}
        </div>
      )}

      {/* Controls */}
      <div className="peer-controls">
        <button className={`peer-control-btn ${isMuted ? "active-danger" : ""}`} onClick={toggleMute}>
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <button className={`peer-control-btn ${isCameraOff ? "active-danger" : ""}`} onClick={toggleCamera}>
          {isCameraOff ? <CameraOff size={20} /> : <Camera size={20} />}
        </button>

        {status === "matched" && (
          <button className="peer-control-btn end-btn" onClick={handleEndInterview}>
            <MessageSquare size={20} />
            <span>End Interview → Feedback</span>
          </button>
        )}

        <button className="peer-control-btn danger" onClick={handleLeave}>
          <PhoneOff size={20} />
          <span>Leave Session</span>
        </button>
      </div>

      {status === "feedback" && (
        <div className="peer-feedback-banner glass">
          <h3>💬 Discuss & Share Feedback</h3>
          <p>
            You are still connected over WebRTC. Share helpful tips, ask questions, and wrap up the session before leaving.
          </p>
        </div>
      )}
    </div>
  );
}
