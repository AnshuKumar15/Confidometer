"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import UploadBox from "@/components/UploadBox";
import AutocompleteInput, { COMPANY_SUGGESTIONS, ROLE_SUGGESTIONS } from "@/components/AutocompleteInput";
import { initiateInterview, respondToAgent, uploadVideo, fetchTTSAudio } from "@/utils/api";
import { Camera, Mic, Play, Square, Volume2, Upload, FileText, CheckCircle, Building2, Briefcase, ChevronDown } from "lucide-react";

export default function UploadPage() {
  const router = useRouter();
  
  // Setup States
  const [resumeFile, setResumeFile] = useState(null);
  const [role, setRole] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [showJD, setShowJD] = useState(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Interview States
  const [isInterviewing, setIsInterviewing] = useState(false);
  const [sessionId, _setSessionId] = useState("");
  const sessionIdRef = useRef("");
  function setSessionId(id) {
    sessionIdRef.current = id;
    _setSessionId(id);
  }
  const [messages, setMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isRecordingResponse, setIsRecordingResponse] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // MediaRecorder for full interview analysis
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const recordedChunks = useRef([]);

  // DOM Refs
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Load saved state from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRole = sessionStorage.getItem("confidometer_setup_role");
      const savedCompany = sessionStorage.getItem("confidometer_setup_company");
      const savedExp = sessionStorage.getItem("confidometer_setup_experience");
      const savedJD = sessionStorage.getItem("confidometer_setup_jd");
      const savedShowJD = sessionStorage.getItem("confidometer_setup_show_jd");
      
      if (savedRole) setRole(savedRole);
      if (savedCompany) setCompanyName(savedCompany);
      if (savedExp) setExperienceLevel(savedExp);
      if (savedJD) setJobDescription(savedJD);
      if (savedShowJD === "true") setShowJD(true);

      const resumeBase64 = sessionStorage.getItem("confidometer_setup_resume_base64");
      const resumeName = sessionStorage.getItem("confidometer_setup_resume_name");
      const resumeType = sessionStorage.getItem("confidometer_setup_resume_type");
      
      if (resumeBase64 && resumeName && resumeType) {
        fetch(resumeBase64)
          .then((res) => res.blob())
          .then((blob) => {
            const file = new File([blob], resumeName, { type: resumeType });
            setResumeFile(file);
          })
          .catch((err) => console.warn("Failed to restore saved resume file:", err));
      }
    }
  }, []);

  // Save text fields to sessionStorage on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("confidometer_setup_role", role);
      sessionStorage.setItem("confidometer_setup_company", companyName);
      sessionStorage.setItem("confidometer_setup_experience", experienceLevel);
      sessionStorage.setItem("confidometer_setup_jd", jobDescription);
      sessionStorage.setItem("confidometer_setup_show_jd", showJD ? "true" : "false");
    }
  }, [role, companyName, experienceLevel, jobDescription, showJD]);

  // Save resume file to sessionStorage on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (resumeFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            sessionStorage.setItem("confidometer_setup_resume_base64", e.target.result);
            sessionStorage.setItem("confidometer_setup_resume_name", resumeFile.name);
            sessionStorage.setItem("confidometer_setup_resume_type", resumeFile.type);
          }
        };
        reader.readAsDataURL(resumeFile);
      } else {
        sessionStorage.removeItem("confidometer_setup_resume_base64");
        sessionStorage.removeItem("confidometer_setup_resume_name");
        sessionStorage.removeItem("confidometer_setup_resume_type");
      }
    }
  }, [resumeFile]);

  // Auto scroll messages container to bottom on updates
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, interimTranscript, error]);

  // 1. Request permissions and show preview
  async function requestPermissions() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true
      });
      setMediaStream(stream);
      setPermissionGranted(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("Please grant camera and microphone permissions to start the live interview.");
    }
  }

  // Handle webcam video elements on state update
  useEffect(() => {
    if (videoRef.current && mediaStream && !videoRef.current.srcObject) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream, isInterviewing]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [mediaStream]);

  // 2. Play text via Edge TTS (high-quality neural voice)
  const audioRef = useRef(null);

  async function speak(text) {
    setIsSpeaking(true);
    try {
      const audioUrl = await fetchTTSAudio(text);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        // Auto-trigger recording after AI finishes asking
        startListening();
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        startListening();
      };
      await audio.play();
    } catch (err) {
      console.warn("Edge TTS failed, falling back to browser speech:", err);
      // Fallback to browser SpeechSynthesis
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => {
          setIsSpeaking(false);
          startListening();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
        startListening();
      }
    }
  }

  // 3. Browser Speech Recognition setup
  const accumulatedTranscriptRef = useRef("");
  const silenceTimerRef = useRef(null);
  const SILENCE_TIMEOUT_MS = 3000; // 3 seconds of silence before auto-submit

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Web Speech API is not supported in this browser. Please type your responses or use Chrome.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    // Reset accumulated transcript
    accumulatedTranscriptRef.current = "";
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecordingResponse(true);
      setInterimTranscript("");
    };

    recognition.onresult = (event) => {
      let newFinal = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          newFinal += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      if (newFinal) {
        accumulatedTranscriptRef.current += " " + newFinal;
        // Show accumulated text as interim so user sees what they've said
        setInterimTranscript(accumulatedTranscriptRef.current.trim());
      } else if (interim) {
        setInterimTranscript(
          (accumulatedTranscriptRef.current + " " + interim).trim()
        );
      }

      // Reset silence timer on any speech activity
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

      // Start silence timer — submit after SILENCE_TIMEOUT_MS of no new speech
      silenceTimerRef.current = setTimeout(() => {
        const fullText = accumulatedTranscriptRef.current.trim();
        if (fullText) {
          accumulatedTranscriptRef.current = "";
          setInterimTranscript("");
          submitResponse(fullText);
        }
      }, SILENCE_TIMEOUT_MS);
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      // On no-speech or network errors, submit whatever we have
      if (event.error === "no-speech" || event.error === "network") {
        const fullText = accumulatedTranscriptRef.current.trim();
        if (fullText) {
          accumulatedTranscriptRef.current = "";
          setInterimTranscript("");
          submitResponse(fullText);
          return;
        }
      }
      setIsRecordingResponse(false);
    };

    recognition.onend = () => {
      // If recognition ends (e.g. browser auto-stops), submit accumulated text
      const fullText = accumulatedTranscriptRef.current.trim();
      if (fullText) {
        accumulatedTranscriptRef.current = "";
        setInterimTranscript("");
        submitResponse(fullText);
      }
      setIsRecordingResponse(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    accumulatedTranscriptRef.current = "";
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }

  // 4. Start the Interview Session
  async function handleStartInterview() {
    if (!resumeFile) {
      setError("Please upload your resume to start.");
      return;
    }
    if (!role.trim()) {
      setError("Please specify the role you are interviewing for.");
      return;
    }
    if (!permissionGranted || !mediaStream) {
      setError("Please grant camera/microphone permissions first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Initialize interview session on backend
      const data = await initiateInterview(resumeFile, role, companyName, experienceLevel, jobDescription);
      
      // Clear saved setup state upon successful start
      sessionStorage.removeItem("confidometer_setup_role");
      sessionStorage.removeItem("confidometer_setup_company");
      sessionStorage.removeItem("confidometer_setup_experience");
      sessionStorage.removeItem("confidometer_setup_jd");
      sessionStorage.removeItem("confidometer_setup_show_jd");
      sessionStorage.removeItem("confidometer_setup_resume_base64");
      sessionStorage.removeItem("confidometer_setup_resume_name");
      sessionStorage.removeItem("confidometer_setup_resume_type");

      setSessionId(data.session_id);
      setCurrentQuestion(data.first_question);
      setMessages([{ role: "model", text: data.first_question }]);
      setIsInterviewing(true);

      // Start full video recording for later analysis
      recordedChunks.current = [];
      const options = { mimeType: "video/webm;codecs=vp9,opus" };
      let recorder;
      try {
        recorder = new MediaRecorder(mediaStream, options);
      } catch (e) {
        recorder = new MediaRecorder(mediaStream);
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      recorder.start(1000); // chunk every second
      setMediaRecorder(recorder);

      // Speak first question
      setTimeout(() => {
        speak(data.first_question);
      }, 500);

    } catch (err) {
      setError(err.message || "Failed to start interview");
    } finally {
      setLoading(false);
    }
  }

  // 5. Submit candidate answer and get next question
  async function submitResponse(transcriptText) {
    if (!transcriptText.trim()) return;

    // Add user answer to chat log
    setMessages((prev) => [...prev, { role: "user", text: transcriptText }]);
    stopListening();

    try {
      const data = await respondToAgent(sessionIdRef.current, transcriptText);
      const nextQ = data.next_question;
      
      setCurrentQuestion(nextQ);
      setMessages((prev) => [...prev, { role: "model", text: nextQ }]);
      
      // Speak next question
      speak(nextQ);
    } catch (err) {
      setError("Failed to reach interview agent: " + err.message);
    }
  }

  // 6. Complete Interview & Upload video for analysis
  async function handleFinishInterview() {
    // Stop Edge TTS audio playback (primary TTS)
    if (audioRef.current) {
      audioRef.current.onended = null;  // prevent triggering startListening
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    // Stop browser SpeechSynthesis fallback
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    stopListening();
    
    setLoading(true);
    setError("");

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }

    // Stop camera streams
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
    }

    // Delay briefly to compile chunks
    setTimeout(async () => {
      try {
        const videoBlob = new Blob(recordedChunks.current, { type: "video/webm" });
        const interviewFile = new File([videoBlob], `live_interview_${Date.now()}.webm`, {
          type: "video/webm"
        });

        // Upload compiled interview video
        const data = await uploadVideo(interviewFile);
        router.push(`/processing?speechId=${data.speech_id}`);
      } catch (err) {
        setError("Failed to upload interview recording for analysis: " + err.message);
        setLoading(false);
      }
    }, 1500);
  }

  // Handle traditional file upload bypass
  async function handleDirectUpload(file) {
    setError("");
    setLoading(true);
    try {
      const data = await uploadVideo(file);
      router.push(`/processing?speechId=${data.speech_id}`);
    } catch (err) {
      setError(err.message || "Upload failed");
      setLoading(false);
    }
  }

  return (
    <div className="upload-page">
      <section className="section-head">
        <h1>{isInterviewing ? "Live AI Interview Agent (Liza)" : "Confidometer AI Interview Agent"}</h1>
        <p>
          {isInterviewing
            ? "Look directly into the camera. Talk naturally as Liza conducts the interview."
            : "Upload your resume, specify your target role, and get interviewed live by Liza. Speak naturally while we analyze your gestures, eye contact, and confidence."}
        </p>
      </section>

      {error && <p className="error-text centered">{error}</p>}

      {!isInterviewing ? (
        /* SETUP MODE */
        <div className="live-setup-container">
          <div className="setup-main glass">
            <h2>1. Configure Session</h2>
            
            <div className="setup-grid">
              <div className="form-fields">
                <AutocompleteInput
                  label="Target Role"
                  value={role}
                  onChange={setRole}
                  suggestions={ROLE_SUGGESTIONS}
                  placeholder="e.g. Software Engineer, Product Manager"
                  disabled={loading}
                  icon={<Briefcase size={16} />}
                />

                <AutocompleteInput
                  label="Company Name"
                  value={companyName}
                  onChange={setCompanyName}
                  suggestions={COMPANY_SUGGESTIONS}
                  placeholder="e.g. Google, Amazon, Flipkart"
                  disabled={loading}
                  icon={<Building2 size={16} />}
                />

                <label>
                  Experience Level
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    disabled={loading}
                  >
                    <option value="">Select experience level</option>
                    <option value="Fresher">Fresher (0 years)</option>
                    <option value="1 year">1 year</option>
                    <option value="2 years">2 years</option>
                    <option value="3 years">3 years</option>
                    <option value="4 years">4 years</option>
                    <option value="5 years">5 years</option>
                    <option value="6 years">6 years</option>
                    <option value="7 years">7 years</option>
                    <option value="8+ years">8+ years</option>
                  </select>
                </label>

                <div className="jd-section">
                  <button
                    type="button"
                    className="jd-toggle"
                    onClick={() => setShowJD(!showJD)}
                  >
                    <span className={`jd-chevron ${showJD ? "open" : ""}`}>
                      <ChevronDown size={14} />
                    </span>
                    Add Job Description
                    <span className="jd-optional-tag">Optional</span>
                  </button>
                  {showJD && (
                    <div className="jd-content">
                      <textarea
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the job description here to tailor interview questions..."
                        disabled={loading}
                        rows={4}
                      />
                    </div>
                  )}
                </div>

                <div className="resume-selector-zone">
                  <span className="label-text">Upload Resume (PDF/TXT)</span>
                  <label className="resume-drag-box">
                    <input
                      type="file"
                      accept=".pdf,.txt"
                      className="hidden-input"
                      onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                      disabled={loading}
                    />
                    <FileText size={24} />
                    <span>{resumeFile ? resumeFile.name : "Choose resume file"}</span>
                    {resumeFile && <CheckCircle size={16} className="valid-icon" />}
                  </label>
                </div>

                <div className="media-permit-row">
                  <button
                    type="button"
                    className={`button ${permissionGranted ? "primary" : ""}`}
                    onClick={requestPermissions}
                    disabled={loading}
                  >
                    <Camera size={16} />
                    <Mic size={16} />
                    {permissionGranted ? "Camera & Mic Active" : "Grant Device Permissions"}
                  </button>
                </div>
              </div>

              <div className="webcam-preview-container">
                {permissionGranted ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="webcam-preview"
                  />
                ) : (
                  <div className="webcam-placeholder">
                    <Camera size={32} />
                    <span>Live Preview Stream</span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              className="button primary start-btn"
              onClick={handleStartInterview}
              disabled={loading || !permissionGranted || !resumeFile || !role.trim()}
            >
              <Play size={16} />
              {loading ? "Initializing..." : "Start Live Interview"}
            </button>
          </div>

          <div className="setup-aside">
            <h4 style={{ margin: "0 0 10px", color: "var(--muted)", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "1px" }}>
              Already recorded?
            </h4>
            <UploadBox onSubmit={handleDirectUpload} isLoading={loading} compact={true} />
          </div>
        </div>
      ) : (
        /* INTERVIEWING MODE */
        <div className="interview-live-container">
          <div className="live-stream-box glass">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="live-interview-webcam"
            />
            
            <div className="speaking-indicator-ring">
              {isSpeaking ? (
                <div className="badge model-badge">
                  <Volume2 size={14} className="pulse" />
                  AI Interrogating
                </div>
              ) : isRecordingResponse ? (
                <div className="badge user-badge">
                  <span className="recording-dot pulse"></span>
                  Listening to you...
                </div>
              ) : null}
            </div>
          </div>

          <div className="interview-chat-aside glass">
            <h3>Interview Dialogue</h3>
            <div className="messages-log">
              {messages.map((msg, idx) => (
                <div key={idx} className={`chat-bubble ${msg.role}`}>
                  <span className="role-tag">{msg.role === "model" ? "Interviewer" : "You"}</span>
                  <p>{msg.text}</p>
                </div>
              ))}
              {interimTranscript && (
                <div className="chat-bubble user interim">
                  <span className="role-tag">Hearing...</span>
                  <p>{interimTranscript}</p>
                </div>
              )}
              {error && (
                <div className="chat-bubble system-error">
                  <span className="role-tag" style={{ color: "var(--danger)", fontWeight: "bold" }}>System Error</span>
                  <p style={{ color: "var(--danger)" }}>{error}</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="controls-row">
              <button
                className="button subtle finish-btn"
                onClick={handleFinishInterview}
                disabled={loading}
              >
                <Square size={16} />
                {loading ? "Saving Session..." : "Finish & Analyze"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
