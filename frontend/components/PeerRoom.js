"use client";

import { useState, useRef, useEffect } from "react";
import { Camera, CameraOff, Mic, MicOff, PhoneOff, MessageSquare, Clock, FileText, Check } from "lucide-react";
import { API_BASE, uploadVideo } from "@/utils/api";

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

  // Refs for tracking changes inside callbacks/closures
  const myRoleRef = useRef(myRoleProp);

  // Media & WebRTC Readiness
  const [mediaReady, setMediaReady] = useState(false);

  // Media
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);

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
        setMediaReady(true);
      } catch (err) {
        console.error("Failed to access camera/mic:", err);
        // Set ready even on error so they can join the lobby (e.g. no webcam scenario)
        setMediaReady(true);
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
    if (!mediaReady) return;

    const wsBase = API_BASE.replace(/^http/, "ws");
    const ws = new WebSocket(
      `${wsBase}/meeting/ws?room_id=${encodeURIComponent(roomId || initialRoomId)}&role=${encodeURIComponent(myRoleProp)}&user_name=${encodeURIComponent(userName)}`
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
          timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);

          // Start recording local stream (audio/video for diagnostics check)
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

                  // Stream raw interviewee audio bytes to signaling server
                  if (myRoleRef.current === "interviewee" && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    e.data.arrayBuffer().then((buf) => {
                      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(buf);
                      }
                    });
                  }
                }
              };

              recorder.start(1000); // 1-second chunks for low-latency transcription
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

  function toggleCamera() {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  }

  // ── Render ──
  if (status === "connecting" || status === "waiting") {
    return (
      <div className="peer-room-lobby">
        <div className="peer-lobby-card glass">
          <Camera size={48} className="peer-lobby-icon pulse" />
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
          <video ref={localVideoRef} autoPlay playsInline muted className="peer-video" />
          <span className="peer-video-label">You ({userName})</span>
        </div>
        <div className="peer-video-container">
          <video ref={remoteVideoRef} autoPlay playsInline className="peer-video" />
          <span className="peer-video-label">{peerName || "Waiting for Peer Video..."}</span>
        </div>
      </div>

      {/* Interactive AI Guide & Transcription workspace */}
      {status === "matched" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
          {roomPhase === "warmup" ? (
            /* WARMUP PHASE */
            <div className="peer-question-panel glass" style={{ padding: "24px", borderRadius: "12px", border: "1px solid var(--line)", background: "rgba(15, 23, 42, 0.2)" }}>
              {myRole === "interviewer" ? (
                <>
                  <h3 style={{ color: "var(--teal)", margin: "0 0 16px 0", fontSize: "1.3rem", display: "flex", alignItems: "center", gap: "8px" }}>
                    👔 Interviewer Warmup & Guidelines
                  </h3>
                  
                  {targetDetails && (
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
                      <h4 style={{ margin: "0 0 10px 0", fontSize: "1rem", color: "var(--text)" }}>Practicing Candidate Details:</h4>
                      <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "0.92rem", color: "#e2e8f0", display: "flex", flexDirection: "column", gap: "6px" }}>
                        <li>Candidate Name: <strong>{peerName}</strong></li>
                        <li>Practicing Role: <strong>{targetDetails.targetRole.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</strong></li>
                        <li>Target Company: <strong>{targetDetails.targetCompany}</strong></li>
                        <li>Interview Type: <strong>{targetDetails.interviewType.toUpperCase()}</strong></li>
                        {targetDetails.resumeFilename && (
                          <li style={{ marginTop: "6px" }}>
                            <a 
                              href={`${API_BASE}/uploads/${targetDetails.resumeFilename}`} 
                              target="_blank" 
                              rel="noreferrer"
                              style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--cyan)", textDecoration: "underline", fontWeight: "600" }}
                            >
                              <FileText size={16} /> View/Download Candidate Resume
                            </a>
                          </li>
                        )}
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

