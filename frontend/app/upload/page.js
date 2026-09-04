"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import AutocompleteInput, { COMPANY_SUGGESTIONS, ROLE_SUGGESTIONS } from "@/components/AutocompleteInput";
import { initiateInterview, respondToAgent, uploadVideo, fetchTTSAudio, runCode, transcribeSpeech } from "@/utils/api";
import { isAuthed } from "@/utils/auth";
import { useTheme } from "@/components/ThemeProvider";
import { useToast } from "@/components/Toast";
import {
  Camera, Mic, Play, Square, FileText, CheckCircle,
  Building2, Briefcase, Clock, Brain, MessageSquare,
  Users, Terminal, Send, Timer, AlertTriangle, DollarSign, Zap,
  Volume2, Bot, User, Activity, Sparkles, X, CornerDownLeft,
  Eye, EyeOff, Maximize2, Minimize2, GripVertical
} from "lucide-react";

// Dynamically import Monaco Editor (SSR-incompatible)
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ── Interview Type Definitions ──
const INTERVIEW_TYPES = [
  {
    id: "technical",
    label: "Technical",
    icon: <Brain size={22} />,
    description: "Resume-based technical questions with optional coding tasks",
    color: "#6c5ce7",
  },
  {
    id: "hr",
    label: "HR Round",
    icon: <Users size={22} />,
    description: "Motivation, teamwork, culture fit, and soft skills",
    color: "#00b894",
  },
  {
    id: "dsa",
    label: "DSA Coding",
    icon: <Terminal size={22} />,
    description: "2 LeetCode problems (1 Easy + 1 Medium) · 30 min timer",
    color: "#e17055",
  },
  {
    id: "behavioural",
    label: "Behavioural",
    icon: <MessageSquare size={22} />,
    description: "STAR-method situational and leadership questions",
    color: "#0984e3",
  },
  {
    id: "negotiation",
    label: "Negotiation",
    icon: <DollarSign size={22} />,
    description: "Practice salary & offer negotiation with AI recruiter",
    color: "#fdcb6e",
  },
];

// ── Language Options for Editor ──
const LANGUAGES = [
  { id: "python", label: "Python", monacoId: "python" },
  { id: "javascript", label: "JavaScript", monacoId: "javascript" },
  { id: "cpp", label: "C++", monacoId: "cpp" },
  { id: "java", label: "Java", monacoId: "java" },
];

// ── DSA Timer: 30 minutes in seconds ──
const DSA_TIMER_TOTAL = 30 * 60;

export default function UploadPage() {
  const { theme } = useTheme();
  const router = useRouter();
  const toast = useToast();

  // Check if returning from guest login
  useEffect(() => {
    if (typeof window !== "undefined" && isAuthed()) {
      const pending = sessionStorage.getItem("confidometer_pending_action");
      if (pending === "start_ai_interview") {
        sessionStorage.removeItem("confidometer_pending_action");
        toast.info("Welcome back! Your interview setup has been restored. Grant permissions to begin.");
      }
    }
  }, [toast]);
  
  // Setup States
  const [resumeFile, setResumeFile] = useState(null);
  const [role, setRole] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [showJD, setShowJD] = useState(false);
  const [interviewType, setInterviewType] = useState("technical");
  const [duration, setDuration] = useState(10);
  const [isComplete, setIsComplete] = useState(false);
  const isCompleteRef = useRef(false);
  const [mediaStream, setMediaStream] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stressMode, setStressMode] = useState(false);

  // Interview States
  const [isInterviewing, setIsInterviewing] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [sessionId, _setSessionId] = useState("");
  const sessionIdRef = useRef("");
  function setSessionId(id) {
    sessionIdRef.current = id;
    _setSessionId(id);
  }
  const [messages, setMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [isRecordingResponse, setIsRecordingResponse] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [hideCamera, setHideCamera] = useState(false);

  function requestFinishInterview() {
    if (isComplete) {
      handleFinishInterview();
    } else {
      setShowFinishConfirm(true);
    }
  }
  
  // MediaRecorder for full interview analysis
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const recordedChunks = useRef([]);
  const speechCancelledRef = useRef(false);
  const isSubmittingResponseRef = useRef(false);
  const responseInputRef = useRef(null);

  // Live Interview Timer State
  const [interviewDuration, setInterviewDuration] = useState(0);

  // ── DSA / Editor State ──
  const [showEditor, setShowEditor] = useState(false);
  const [editorLanguage, setEditorLanguage] = useState("python");
  const [dsaQuestions, setDsaQuestions] = useState(null); // array of Easy, Medium Leetcode problems
  const [dsaQuestion, setDsaQuestion] = useState(null); // sandbox code question details
  const [activeQIndex, setActiveQIndex] = useState(0); // 0 or 1
  const [codeDrafts, setCodeDrafts] = useState({ 0: "", 1: "" });
  const [dsaTimeLeft, setDsaTimeLeft] = useState(DSA_TIMER_TOTAL);
  const [dsaComplete, setDsaComplete] = useState(false);
  const dsaTimerRef = useRef(null);

  const [isRunningCode, setIsRunningCode] = useState(false);
  const [runResults, setRunResults] = useState(null);
  const [showConsole, setShowConsole] = useState(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState(0);
  const [splitWidth, setSplitWidth] = useState(45); // default 45% description
  const workspaceRef = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e) => {
    if (!workspaceRef.current) return;
    const rect = workspaceRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    let percentage = (offsetX / rect.width) * 100;
    
    // Bounds check (e.g. 15% to 85%)
    if (percentage < 15) percentage = 15;
    if (percentage > 85) percentage = 85;
    
    setSplitWidth(percentage);
  };

  const handleMouseUp = () => {
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  // ── Main Layout Split (30% Agent / 70% Editor) & Moveable Divider ──
  const [mainSplitRatio, setMainSplitRatio] = useState(30);
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const mainSplitContainerRef = useRef(null);
  const isDraggingMainSplit = useRef(false);

  const handleMainMouseDown = (e) => {
    e.preventDefault();
    isDraggingMainSplit.current = true;
    document.addEventListener("mousemove", handleMainMouseMove);
    document.addEventListener("mouseup", handleMainMouseUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  };

  const handleMainMouseMove = (e) => {
    if (!isDraggingMainSplit.current || !mainSplitContainerRef.current) return;
    const rect = mainSplitContainerRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    let percentage = (offsetX / rect.width) * 100;

    // If dragged almost completely to the left (< 8%), snap to fullscreen editor
    if (percentage < 8) {
      setIsEditorFullscreen(true);
      setMainSplitRatio(0);
      return;
    }

    setIsEditorFullscreen(false);
    if (percentage < 15) percentage = 15;
    if (percentage > 70) percentage = 70;
    setMainSplitRatio(percentage);
    window.dispatchEvent(new Event("resize"));
  };

  const handleMainMouseUp = () => {
    isDraggingMainSplit.current = false;
    document.removeEventListener("mousemove", handleMainMouseMove);
    document.removeEventListener("mouseup", handleMainMouseUp);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    window.dispatchEvent(new Event("resize"));
  };

  const toggleEditorFullscreen = () => {
    setIsEditorFullscreen((prev) => {
      const next = !prev;
      if (!next && (mainSplitRatio === 0 || mainSplitRatio < 15)) {
        setMainSplitRatio(30);
      }
      setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 50);
      return next;
    });
  };

  // ── Floating Rectangular Camera Draggable Handler ──
  const [camPos, setCamPos] = useState(null); // null = default bottom-right
  const isDraggingCam = useRef(false);
  const camDragStart = useRef({ mouseX: 0, mouseY: 0, initialX: 0, initialY: 0 });

  const handleCamMouseDown = (e) => {
    e.preventDefault();
    isDraggingCam.current = true;
    const camEl = e.currentTarget.classList.contains("split-floating-cam")
      ? e.currentTarget
      : e.currentTarget.closest(".split-floating-cam");
    if (!camEl) return;
    const rect = camEl.getBoundingClientRect();
    camDragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: rect.left,
      initialY: rect.top,
    };
    document.addEventListener("mousemove", handleCamMouseMove);
    document.addEventListener("mouseup", handleCamMouseUp);
    document.body.style.userSelect = "none";
  };

  const handleCamMouseMove = (e) => {
    if (!isDraggingCam.current) return;
    const deltaX = e.clientX - camDragStart.current.mouseX;
    const deltaY = e.clientY - camDragStart.current.mouseY;
    let newX = camDragStart.current.initialX + deltaX;
    let newY = camDragStart.current.initialY + deltaY;

    // Viewport bounds clamping
    const pad = 10;
    const maxX = window.innerWidth - 340 - pad;
    const maxY = window.innerHeight - 200 - pad;
    newX = Math.max(pad, Math.min(newX, maxX));
    newY = Math.max(pad, Math.min(newY, maxY));

    setCamPos({ x: newX, y: newY });
  };

  const handleCamMouseUp = () => {
    isDraggingCam.current = false;
    document.removeEventListener("mousemove", handleCamMouseMove);
    document.removeEventListener("mouseup", handleCamMouseUp);
    document.body.style.userSelect = "";
  };


  // ── Hide navbar completely after starting the interview ──
  useEffect(() => {
    if (isInterviewing) {
      document.body.classList.add("interview-active");
    } else {
      document.body.classList.remove("interview-active");
    }
    return () => {
      document.body.classList.remove("interview-active");
    };
  }, [isInterviewing]);

  // ── DSA 30-minute countdown timer ──
  useEffect(() => {
    if (isInterviewing && interviewType === "dsa" && !dsaComplete) {
      setDsaTimeLeft(DSA_TIMER_TOTAL);
      dsaTimerRef.current = setInterval(() => {
        setDsaTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(dsaTimerRef.current);
            // Time's up — auto-finish
            handleFinishInterview();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (dsaTimerRef.current) clearInterval(dsaTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInterviewing, interviewType, dsaComplete]);

  // ── Regular interview timer ──
  useEffect(() => {
    let timerId;
    if (isInterviewing) {
      setInterviewDuration(0);
      timerId = setInterval(() => {
        setInterviewDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [isInterviewing]);

  // ── Auto-submit / conclude interview when selected duration expires ──
  const autoFinishedRef = useRef(false);
  useEffect(() => {
    if (!isInterviewing) {
      autoFinishedRef.current = false;
      return;
    }
    if (interviewType === "dsa") return; // DSA has its own dedicated 30-min countdown

    const targetSeconds = duration * 60;
    if (interviewDuration >= targetSeconds) {
      // 1. If interview is already marked complete by AI, finish immediately
      if (isCompleteRef.current && !isSpeaking && !autoFinishedRef.current) {
        autoFinishedRef.current = true;
        handleFinishInterview();
        return;
      }

      // 2. If user has pending speech transcript at time expiry, submit it to trigger closing response
      if (
        !isSubmittingResponseRef.current &&
        !isAiThinking &&
        !isSpeaking &&
        !autoFinishedRef.current
      ) {
        const pendingText = (interimTranscript || lastTranscribedTextRef.current || "").trim();
        if (pendingText) {
          submitResponse(pendingText);
        } else if (interviewDuration >= targetSeconds + 10) {
          // If 10s past duration and candidate is idle, automatically submit and conclude
          autoFinishedRef.current = true;
          handleFinishInterview();
        }
      }
    }
  }, [interviewDuration, isInterviewing, duration, interviewType, isSpeaking, isAiThinking, interimTranscript]);

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  const interviewStartTimeRef = useRef(null);

  function getElapsedSeconds() {
    if (!interviewStartTimeRef.current) return interviewDuration || 0;
    return Math.max(0, Math.floor((Date.now() - interviewStartTimeRef.current) / 1000));
  }

  function getElapsedTimestamp() {
    return formatDuration(getElapsedSeconds());
  }

  // DOM Refs
  const videoRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Load saved state from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedRole = sessionStorage.getItem("confidometer_setup_role");
      const savedCompany = sessionStorage.getItem("confidometer_setup_company");
      const savedExp = sessionStorage.getItem("confidometer_setup_experience");
      const savedJD = sessionStorage.getItem("confidometer_setup_jd");
      const savedShowJD = sessionStorage.getItem("confidometer_setup_show_jd");
      const savedType = sessionStorage.getItem("confidometer_setup_interview_type");
      const savedDuration = sessionStorage.getItem("confidometer_setup_duration");
      const savedStress = sessionStorage.getItem("confidometer_setup_stress_mode");
      
      if (savedRole) setRole(savedRole);
      if (savedCompany) setCompanyName(savedCompany);
      if (savedExp) setExperienceLevel(savedExp);
      if (savedJD) setJobDescription(savedJD);
      if (savedShowJD === "true") setShowJD(true);
      if (savedType) setInterviewType(savedType);
      if (savedDuration) setDuration(Number(savedDuration));
      if (savedStress === "true") setStressMode(true);

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
      sessionStorage.setItem("confidometer_setup_interview_type", interviewType);
      sessionStorage.setItem("confidometer_setup_duration", duration.toString());
      sessionStorage.setItem("confidometer_setup_stress_mode", stressMode ? "true" : "false");
    }
  }, [role, companyName, experienceLevel, jobDescription, showJD, interviewType, duration, stressMode]);

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

  // Auto-grow textarea height to fit content, up to a max limit
  useEffect(() => {
    if (responseInputRef.current) {
      responseInputRef.current.style.height = "auto";
      const scrollHeight = responseInputRef.current.scrollHeight;
      // Cap at 120px height and enable scrollbar if it exceeds
      if (scrollHeight > 120) {
        responseInputRef.current.style.height = "120px";
        responseInputRef.current.style.overflowY = "auto";
      } else {
        responseInputRef.current.style.height = `${scrollHeight}px`;
        responseInputRef.current.style.overflowY = "hidden";
      }
    }
  }, [interimTranscript]);

  // 1. Request permissions and show preview
  async function requestPermissions() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
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
    if (videoRef.current && mediaStream && videoRef.current.srcObject !== mediaStream) {
      videoRef.current.srcObject = mediaStream;
    }
  }, [mediaStream, isInterviewing, hideCamera, showEditor, isEditorFullscreen]);

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
    if (speechCancelledRef.current) {
      setIsSpeaking(false);
      return;
    }
    try {
      const audioUrl = await fetchTTSAudio(text);
      if (speechCancelledRef.current) {
        if (audioUrl && audioUrl.startsWith("blob:")) {
          URL.revokeObjectURL(audioUrl);
        }
        setIsSpeaking(false);
        return;
      }
      // Stop any currently playing audio before starting new one
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        if (audioUrl && audioUrl.startsWith("blob:")) {
          URL.revokeObjectURL(audioUrl);
        }
        // If interview concluded, auto-finish and proceed to analysis
        if (isCompleteRef.current) {
          handleFinishInterview();
        } else if (!speechCancelledRef.current) {
          // Auto-trigger recording after AI finishes asking
          startListening();
        }
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        if (audioUrl && audioUrl.startsWith("blob:")) {
          URL.revokeObjectURL(audioUrl);
        }
        if (isCompleteRef.current) {
          handleFinishInterview();
        } else if (!speechCancelledRef.current) {
          startListening();
        }
      };
      await audio.play();
    } catch (err) {
      console.warn("Edge TTS failed, falling back to browser speech:", err);
      // Fallback to browser SpeechSynthesis
      if (typeof window !== "undefined" && window.speechSynthesis) {
        if (speechCancelledRef.current) {
          setIsSpeaking(false);
          return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => {
          setIsSpeaking(false);
          if (isCompleteRef.current) {
            handleFinishInterview();
          } else if (!speechCancelledRef.current) {
            startListening();
          }
        };
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
        if (isCompleteRef.current) {
          handleFinishInterview();
        } else if (!speechCancelledRef.current) {
          startListening();
        }
      }
    }
  }

  // 3. Groq Whisper STT setup with Voice Activity Detection (VAD)
  const sttMediaRecorderRef = useRef(null);
  const sttChunksRef = useRef([]);
  const vadAudioContextRef = useRef(null);
  const vadIntervalRef = useRef(null);
  const interimIntervalRef = useRef(null);
  const hasSpokenRef = useRef(false);
  const isTranscribingRef = useRef(false);
  const isGroqActiveRef = useRef(false);
  const lastTranscribedTextRef = useRef("");
  const isUserEditingRef = useRef(false);
  const typingTimeoutRef = useRef(null);

  function startGroqSTT() {
    if (!mediaStream) {
      console.warn("[STT] No media stream available for Groq STT");
      return;
    }

    stopGroqSTT();

    isGroqActiveRef.current = true;
    sttChunksRef.current = [];
    hasSpokenRef.current = false;
    isTranscribingRef.current = false;
    isUserEditingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    lastTranscribedTextRef.current = "";
    setInterimTranscript("");
    setIsRecordingResponse(true);
    setIsUserSpeaking(false);

    try {
      const audioTracks = mediaStream.getAudioTracks();
      if (!audioTracks.length) {
        console.warn("[STT] No audio tracks in media stream");
        return;
      }

      const audioStream = new MediaStream(audioTracks);

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const recorder = new MediaRecorder(audioStream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 64000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          sttChunksRef.current.push(e.data);
        }
      };

      recorder.start(1000);
      sttMediaRecorderRef.current = recorder;

      // Web Audio API VAD (Voice Activity Detection)
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          const source = audioCtx.createMediaStreamSource(audioStream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
          vadAudioContextRef.current = audioCtx;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          let silenceStart = null;
          let speechFrames = 0;

          vadIntervalRef.current = setInterval(() => {
            if (!analyser) return;
            analyser.getByteFrequencyData(dataArray);

            // Voice frequency band: 100Hz - 3400Hz (bins 1 to 38 for fftSize=512 at 48kHz)
            let voiceSum = 0;
            const voiceBins = Math.min(38, dataArray.length);
            for (let i = 1; i < voiceBins; i++) {
              voiceSum += dataArray[i];
            }
            const voiceAvg = voiceSum / (voiceBins - 1);

            // Responsive vocal threshold: voiceAvg > 14 reliably detects spoken audio
            const isSpeechEnergy = voiceAvg > 14;

            if (isSpeechEnergy) {
              speechFrames++;
              if (speechFrames >= 2) {
                hasSpokenRef.current = true;
                silenceStart = null;
                setIsUserSpeaking(true);
              }
            } else {
              speechFrames = 0;
              setIsUserSpeaking(false);

              // Auto-submit after 3 seconds of silence after the candidate has spoken
              // (Only when the user is not actively typing/editing text in the textarea)
              if (hasSpokenRef.current && !isUserEditingRef.current) {
                if (!silenceStart) {
                  silenceStart = Date.now();
                } else if (Date.now() - silenceStart >= 3000) {
                  silenceStart = null;
                  finalizeAndSubmitGroqSTT();
                }
              }
            }
          }, 150);
        }
      } catch (vadErr) {
        console.warn("[STT] VAD initialization failed:", vadErr);
      }

      // Interim transcription with Groq every 3 seconds while speaking
      interimIntervalRef.current = setInterval(async () => {
        if (!isGroqActiveRef.current || !hasSpokenRef.current || isTranscribingRef.current || sttChunksRef.current.length === 0) {
          return;
        }

        // If the user is currently typing or editing the text box, do NOT overwrite their text!
        if (isUserEditingRef.current) {
          return;
        }

        try {
          isTranscribingRef.current = true;
          const currentBlob = new Blob(sttChunksRef.current, { type: mimeType || "audio/webm" });
          if (currentBlob.size > 1500) {
            const data = await transcribeSpeech(currentBlob);
            // Only update if session is STILL active and user didn't start typing
            if (isGroqActiveRef.current && !isUserEditingRef.current && data?.text?.trim()) {
              lastTranscribedTextRef.current = data.text.trim();
              setInterimTranscript(data.text.trim());
            }
          }
        } catch (err) {
          console.warn("[STT] Interim Groq transcription error:", err);
        } finally {
          isTranscribingRef.current = false;
        }
      }, 3000);

      console.log(`[STT] Groq Whisper STT session active (whisper-large-v3-turbo, ${mimeType})`);
    } catch (e) {
      console.error("[STT] Failed to start Groq STT:", e);
      setIsRecordingResponse(false);
    }
  }

  function stopGroqSTT() {
    isGroqActiveRef.current = false;
    lastTranscribedTextRef.current = "";
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    if (interimIntervalRef.current) {
      clearInterval(interimIntervalRef.current);
      interimIntervalRef.current = null;
    }
    if (vadAudioContextRef.current) {
      try {
        vadAudioContextRef.current.close();
      } catch (e) {}
      vadAudioContextRef.current = null;
    }
    if (sttMediaRecorderRef.current) {
      try {
        if (sttMediaRecorderRef.current.state !== "inactive") {
          sttMediaRecorderRef.current.stop();
        }
      } catch (e) {}
      sttMediaRecorderRef.current = null;
    }
    setIsRecordingResponse(false);
    setIsUserSpeaking(false);
  }

  async function finalizeAndSubmitGroqSTT(explicitText = null) {
    if (isSubmittingResponseRef.current) return;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    let textToSubmit = (explicitText !== null ? explicitText : (interimTranscript || lastTranscribedTextRef.current || "")).trim();

    const chunks = [...sttChunksRef.current];
    const candidateHasSpoken = hasSpokenRef.current;
    const userWasEditing = isUserEditingRef.current;
    stopGroqSTT();

    // If candidate spoke and we recorded chunks, and user was not typing manual edits:
    if (!userWasEditing && !textToSubmit && chunks.length > 0 && candidateHasSpoken) {
      try {
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        const finalBlob = new Blob(chunks, { type: mimeType });
        if (finalBlob.size > 1500) {
          const res = await transcribeSpeech(finalBlob);
          if (res?.text?.trim()) {
            textToSubmit = res.text.trim();
          }
        }
      } catch (err) {
        console.warn("[STT] Final Groq transcription error:", err);
      }
    }

    if (textToSubmit && textToSubmit.length >= 2) {
      isUserEditingRef.current = false;
      lastTranscribedTextRef.current = "";
      setInterimTranscript("");
      submitResponse(textToSubmit);
    } else {
      // If no valid text detected, restart listening so user can speak or type
      isUserEditingRef.current = false;
      startGroqSTT();
    }
  }

  function startListening() {
    console.log("[STT] Starting Groq Whisper STT (whisper-large-v3-turbo)");
    startGroqSTT();
  }

  function stopListening() {
    stopGroqSTT();
    setInterimTranscript("");
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

    if (!isAuthed()) {
      sessionStorage.setItem("confidometer_pending_action", "start_ai_interview");
      router.push("/login?next=/upload");
      return;
    }

    if (!permissionGranted || !mediaStream) {
      setError("Please grant camera/microphone permissions first.");
      return;
    }

    speechCancelledRef.current = false;
    isSubmittingResponseRef.current = false;
    setLoading(true);
    setError("");

    try {
      // Initialize interview session on backend
      const data = await initiateInterview(resumeFile, role, companyName, experienceLevel, jobDescription, interviewType, duration, stressMode);
      
      // Clear saved setup state upon successful start
      sessionStorage.removeItem("confidometer_setup_role");
      sessionStorage.removeItem("confidometer_setup_company");
      sessionStorage.removeItem("confidometer_setup_experience");
      sessionStorage.removeItem("confidometer_setup_jd");
      sessionStorage.removeItem("confidometer_setup_show_jd");
      sessionStorage.removeItem("confidometer_setup_interview_type");
      sessionStorage.removeItem("confidometer_setup_duration");
      sessionStorage.removeItem("confidometer_setup_resume_base64");
      sessionStorage.removeItem("confidometer_setup_resume_name");
      sessionStorage.removeItem("confidometer_setup_resume_type");

      setIsComplete(false);
      isCompleteRef.current = false;

      interviewStartTimeRef.current = Date.now();
      setSessionId(data.session_id);
      setCurrentQuestion(data.first_question);
      setMessages([{ role: "model", text: data.first_question, timestamp: getElapsedTimestamp() }]);
      setIsInterviewing(true);

      // DSA: load both questions and pre-populate draft codes
      if (interviewType === "dsa" && data.dsa_questions) {
        setDsaQuestions(data.dsa_questions);
        setActiveQIndex(0);
        setShowEditor(true);
        
        const q1 = data.dsa_questions[0];
        const q2 = data.dsa_questions[1];
        setCodeDrafts({
          0: q1?.boilerplate?.[editorLanguage] || q1?.boilerplate?.["python"] || "",
          1: q2?.boilerplate?.[editorLanguage] || q2?.boilerplate?.["python"] || "",
        });
      }

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
  async function submitResponse(transcriptText, code = null, qIdx = 0) {
    if (!transcriptText.trim() && !code) return;
    if (isSubmittingResponseRef.current) {
      console.log("[STT] Response submission already in progress, ignoring duplicate.");
      return;
    }

    if (isCompleteRef.current) {
      handleFinishInterview();
      return;
    }

    isSubmittingResponseRef.current = true;
    setIsAiThinking(true);
    setInterimTranscript("");
    lastTranscribedTextRef.current = "";
    const currentStamp = getElapsedTimestamp();
    const userMsg = { role: "user", text: transcriptText, timestamp: currentStamp };
    if (code) userMsg.code = code;

    // Add user answer to chat log
    setMessages((prev) => [...prev, userMsg]);
    stopListening();

    try {
      const elapsedSecs = getElapsedSeconds();
      const data = await respondToAgent(sessionIdRef.current, transcriptText, code, qIdx, elapsedSecs);
      const nextQ = data.next_question;
      
      setCurrentQuestion(nextQ);
      setMessages((prev) => [...prev, { role: "model", text: nextQ, timestamp: getElapsedTimestamp() }]);

      if (data.is_complete) {
        setIsComplete(true);
        isCompleteRef.current = true;
      }

      if (data.dsa_complete) {
        setDsaComplete(true);
      }

      if (data.requires_editor) {
        setShowEditor(true);
      }
      
      // Speak next question
      await speak(nextQ);
    } catch (err) {
      setError("Failed to reach interview agent: " + err.message);
    } finally {
      isSubmittingResponseRef.current = false;
      setIsAiThinking(false);
    }
  }

  // ── Submit Code to Liza ──
  async function handleSubmitCode() {
    const code = codeDrafts[activeQIndex]?.trim();
    if (!code) return;

    const activeQ = dsaQuestions ? dsaQuestions[activeQIndex] : null;
    const qTitle = activeQ ? activeQ.title : "the problem";
    const message = `I've written my solution for LeetCode ${activeQ?.number}: ${qTitle}. Here's my code.`;
    await submitResponse(message, code, activeQIndex);
  }

  // ── Run Code dynamic evaluation ──
  async function handleRunCode() {
    const activeQ = dsaQuestions ? dsaQuestions[activeQIndex] : dsaQuestion;
    if (!activeQ) return;
    const code = codeDrafts[activeQIndex]?.trim();
    if (!code) return;

    setIsRunningCode(true);
    setRunResults(null);
    setShowConsole(true);
    setActiveConsoleTab(0);

    try {
      const result = await runCode(
        code,
        editorLanguage,
        activeQ.number,
        activeQ.title,
        activeQ.description
      );
      setRunResults(result);
    } catch (err) {
      setRunResults({
        status: "compile_error",
        compile_message: err.message || "Failed to execute code.",
        results: [],
        stdout: ""
      });
    } finally {
      setIsRunningCode(false);
    }
  }

  // 6. Complete Interview & Upload video for analysis
  async function handleFinishInterview() {
    // Stop DSA timer
    if (dsaTimerRef.current) {
      clearInterval(dsaTimerRef.current);
      dsaTimerRef.current = null;
    }

    speechCancelledRef.current = true;

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
        const data = await uploadVideo(interviewFile, sessionIdRef.current);
        router.push(`/processing?speechId=${data.speech_id}`);
      } catch (err) {
        setError("Failed to upload interview recording for analysis: " + err.message);
        setLoading(false);
      }
    }, 1500);
  }



  // ── Language change handler ──
  function handleLanguageChange(langId) {
    setEditorLanguage(langId);
    const activeQ = dsaQuestions ? dsaQuestions[activeQIndex] : dsaQuestion;
    if (activeQ?.boilerplate) {
      const bp = activeQ.boilerplate[langId];
      if (bp) {
        setCodeDrafts((prev) => ({
          ...prev,
          [activeQIndex]: bp
        }));
      }
    }
  }

  // ── Determine if we're in a split-screen (editor) mode ──
  const isDsaRound = interviewType === "dsa";
  const showSplitScreen = isInterviewing && showEditor;
  const activeQuestion = isDsaRound && dsaQuestions ? dsaQuestions[activeQIndex] : dsaQuestion;

  // ── DSA Timer urgency class ──
  const timerUrgency = dsaTimeLeft <= 120 ? "timer-critical" : dsaTimeLeft <= 300 ? "timer-warning" : "";

  return (
    <div className={`upload-page ${isInterviewing ? "interview-active-mode" : ""}`}>
      {!isInterviewing && (
        <section className="section-head">
          <h1>Confidometer AI Interview Agent</h1>
          <p>
            Upload your resume, specify your target role, and get interviewed live by Liza. Speak naturally while we analyze your gestures, eye contact, and confidence.
          </p>
        </section>
      )}

      {error && <p className="error-text centered">{error}</p>}

      {!isInterviewing ? (
        /* ═══════════════ SETUP MODE ═══════════════ */
        <div className="live-setup-container">
          <div className="setup-main glass">
            <h2>1. Configure Session</h2>
            
            {/* ── Interview Type Selector ── */}
            <div className="interview-type-selector">
              <span className="label-text">Interview Type</span>
              <div className="type-cards-grid">
                {INTERVIEW_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className={`type-card ${interviewType === type.id ? "active" : ""}`}
                    onClick={() => setInterviewType(type.id)}
                    style={{ "--type-color": type.color }}
                    disabled={loading}
                  >
                    <div className="type-card-icon">{type.icon}</div>
                    <div className="type-card-info">
                      <strong>{type.label}</strong>
                      <span>{type.description}</span>
                    </div>
                  </button>
                ))}
              </div>

              {interviewType === "dsa" && (
                <div className="dsa-info-banner glass">
                  <AlertTriangle size={16} />
                  <span>
                    <strong>DSA Coding Round:</strong> You will solve <strong>1 Easy</strong> and <strong>1 Medium</strong> LeetCode problem in <strong>30 minutes</strong>.
                    The workspace supports side-by-side problem reading and code runner checks. Difficulty scales based on your chosen company.
                  </span>
                </div>
              )}

              {interviewType !== "dsa" && (
                <button
                  type="button"
                  className={`stress-mode-toggle ${stressMode ? "active" : ""}`}
                  onClick={() => setStressMode(!stressMode)}
                  disabled={loading}
                >
                  <Zap size={18} className={stressMode ? "stress-icon-active" : ""} />
                  <div className="stress-toggle-info">
                    <strong>Stress Mode {stressMode ? "ON" : "OFF"}</strong>
                    <span>{stressMode ? "Liza will interrupt & challenge you under pressure" : "Enable to simulate high-pressure interview conditions"}</span>
                  </div>
                  <div className={`stress-toggle-switch ${stressMode ? "on" : ""}`}>
                    <div className="stress-toggle-knob" />
                  </div>
                </button>
              )}
            </div>

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

                {interviewType !== "dsa" && (
                  <label>
                    Interview Duration
                    <select
                      value={duration}
                      onChange={(e) => setDuration(Number(e.target.value))}
                      disabled={loading}
                    >
                      <option value={5}>5 Minutes</option>
                      <option value={10}>10 Minutes</option>
                      <option value={20}>20 Minutes</option>
                      <option value={30}>30 Minutes</option>
                    </select>
                  </label>
                )}


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
                    className={`button ${permissionGranted ? "primary" : "subtle"}`}
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

            {interviewType !== "dsa" && (
              <div className="jd-outer-section glass">
                <div className="jd-header">
                  <h3>Job Description</h3>
                  <span className="jd-info-tag">Optional · Paste job details to customize interview questions</span>
                </div>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here (e.g. key responsibilities, tech stack, requirements)..."
                  disabled={loading}
                  rows={4}
                  className="jd-textarea"
                />
              </div>
            )}

            <button
              type="button"
              className="button primary start-btn"
              onClick={handleStartInterview}
              disabled={loading || !permissionGranted || !resumeFile || !role.trim()}
            >
              <Play size={16} />
              {loading ? "Initializing..." : `Start ${INTERVIEW_TYPES.find(t => t.id === interviewType)?.label || ""} Interview`}
            </button>
          </div>


        </div>
      ) : (
        <>
          {/* ━━━━ LIVE INTERVIEW HUD TOP BAR (Appears during active interview) ━━━━ */}
          <div className="interview-hud-bar glass">
            <div className="hud-left">
              <div className="hud-role-pill">
                <Briefcase size={14} className="hud-icon" />
                <span>{role || "Candidate"}</span>
                {companyName && (
                  <>
                    <span className="hud-pill-sep">@</span>
                    <strong>{companyName}</strong>
                  </>
                )}
              </div>
              <div
                className="hud-type-badge"
                style={{
                  "--type-color": INTERVIEW_TYPES.find((t) => t.id === interviewType)?.color || "#2dd4bf"
                }}
              >
                {INTERVIEW_TYPES.find((t) => t.id === interviewType)?.icon}
                <span>{INTERVIEW_TYPES.find((t) => t.id === interviewType)?.label || "Technical"}</span>
              </div>
              {stressMode && (
                <div className="hud-stress-badge">
                  <Zap size={13} />
                  <span>Stress Mode</span>
                </div>
              )}
            </div>

            <div className="hud-right">
              <div className="hud-stat-item">
                <span className="hud-stat-label">Questions</span>
                <span className="hud-stat-value">
                  {messages.filter((m) => m.role === "model").length} {isComplete ? "(Done)" : "Asked"}
                </span>
              </div>

              <div className="hud-stat-divider" />

              <div className="hud-stat-item">
                <span className="hud-stat-label">Elapsed Time</span>
                <div className={`hud-timer-wrap ${!isDsaRound && duration && interviewDuration >= (duration * 60 - 60) ? "hud-timer-wrap-warning" : ""}`}>
                  <Clock size={14} className="hud-timer-icon" />
                  <span className="hud-timer-val">{formatDuration(interviewDuration)}</span>
                  {!isDsaRound && duration && (
                    <span className="hud-timer-target">/ {duration}:00</span>
                  )}
                  {!isDsaRound && duration && interviewDuration >= (duration * 60 - 60) && (
                    <span className="hud-timer-warning-tag">Wrapping Up</span>
                  )}
                </div>
              </div>

              <div className="hud-stat-divider" />

              <button
                type="button"
                className={`hud-cam-toggle-btn ${hideCamera ? "cam-off" : "cam-on"}`}
                onClick={() => setHideCamera((prev) => !prev)}
                title={hideCamera ? "Show video preview" : "Hide video preview"}
              >
                {hideCamera ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{hideCamera ? "Show Video" : "Hide Video"}</span>
              </button>

              <button
                type="button"
                className="button subtle hud-finish-btn"
                onClick={requestFinishInterview}
                disabled={loading}
                title="Conclude and evaluate interview"
              >
                <Square size={13} />
                <span>End Session</span>
              </button>
            </div>
          </div>

          {showSplitScreen ? (
            /* ═══════════════ SPLIT-SCREEN MODE (DSA / Coding Side-by-Side) ═══════════════ */
            <div className="interview-split-container" ref={mainSplitContainerRef}>
              {/* ── Left Panel: Liza Dialogue (Agent, default 30%) ── */}
              <div
                className="split-left-panel"
                style={{
                  width: isEditorFullscreen ? "0%" : `${mainSplitRatio}%`,
                  display: isEditorFullscreen ? "none" : "flex",
                }}
              >
                <div className="split-chat-box glass">
                  <div className="chat-aside-header">
                    <div className="chat-header-title">
                      <MessageSquare size={16} />
                      <h3>Liza Chat</h3>
                    </div>
                    <div className="chat-status-pill">
                      <span className={`chat-status-dot ${isSpeaking ? "speaking" : isAiThinking ? "thinking" : isRecordingResponse ? (isUserSpeaking ? "listening speaking" : "listening") : "idle"}`} />
                      <span>{isSpeaking ? "AI Talking" : isAiThinking ? "AI Thinking" : isRecordingResponse ? (isUserSpeaking ? "Listening (Speaking...)" : "Listening...") : "Ready"}</span>
                    </div>
                  </div>
                  <div className="messages-log">
                    {messages.map((msg, idx) => (
                      <div key={idx} className={`chat-bubble ${msg.role}`}>
                        <div className="chat-bubble-header">
                          <div className="bubble-avatar">
                            {msg.role === "model" ? <Bot size={13} /> : <User size={13} />}
                          </div>
                          <span className="role-tag">{msg.role === "model" ? "Liza" : "You"}</span>
                          {msg.timestamp && <span className="bubble-timestamp">{msg.timestamp}</span>}
                        </div>
                        <p>{msg.text}</p>
                        {msg.code && (
                          <pre className="chat-code-block"><code>{msg.code}</code></pre>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {!isSpeaking && !isAiThinking && !isComplete && (
                    <div className="live-input-area">
                      <input
                        type="text"
                        className="response-text-input"
                        value={interimTranscript}
                        onChange={(e) => {
                          setInterimTranscript(e.target.value);
                          lastTranscribedTextRef.current = e.target.value;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            finalizeAndSubmitGroqSTT(interimTranscript);
                          }
                        }}
                        placeholder={isRecordingResponse ? "Listening... Speak or type solution discussion..." : "Listening paused. Click 'Speak' or type here..."}
                      />
                    </div>
                  )}

                  <div className="controls-row">
                    <button
                      className="button subtle finish-btn"
                      onClick={requestFinishInterview}
                      disabled={loading}
                      style={{ flex: 1 }}
                    >
                      <Square size={14} />
                      {loading ? "Saving..." : "Finish & Analyze"}
                    </button>

                    {!isSpeaking && !isAiThinking && !isComplete && !isRecordingResponse && (
                      <button
                        type="button"
                        className="button primary start-listening-btn pulse-shimmer"
                        onClick={startListening}
                        disabled={loading}
                        style={{ flex: 1 }}
                      >
                        <Mic size={14} />
                        <span>Speak</span>
                      </button>
                    )}

                    {!isSpeaking && !isAiThinking && !isComplete && (isRecordingResponse || interimTranscript.trim()) && (
                      <button
                        type="button"
                        className="button primary submit-btn pulse-shimmer"
                        onClick={() => {
                          finalizeAndSubmitGroqSTT(interimTranscript);
                        }}
                        disabled={loading || !interimTranscript.trim()}
                        style={{ flex: 1 }}
                      >
                        <Send size={14} />
                        <span>Submit Answer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Moveable Divider between Agent & Editor ── */}
              {!isEditorFullscreen && (
                <div
                  className="main-split-resizer"
                  onMouseDown={handleMainMouseDown}
                  title="Drag to resize Agent & Editor"
                >
                  <div className="resizer-handle-dots" />
                </div>
              )}

              {/* ── Right Panel: Workspace Side-by-Side (Editor, default 70%) ── */}
              <div
                className="split-right-panel glass"
                style={{
                  width: isEditorFullscreen ? "100%" : `${100 - mainSplitRatio}%`,
                }}
              >
                {/* Header: Question switcher tabs, Fullscreen Toggle & Language Selector */}
                <div className="dsa-workspace-header">
                  {isDsaRound && dsaQuestions && (
                    <div className="dsa-questions-tabs">
                      {isEditorFullscreen && (
                        <button
                          type="button"
                          className="dsa-restore-chat-tab-btn"
                          onClick={toggleEditorFullscreen}
                          title="Show Liza Chat (Exit Fullscreen)"
                        >
                          <MessageSquare size={13} />
                          <span>Liza Chat</span>
                        </button>
                      )}
                      {dsaQuestions.map((q, idx) => (
                        <button
                          key={idx}
                          className={`dsa-q-tab-btn ${activeQIndex === idx ? "active" : ""}`}
                          onClick={() => setActiveQIndex(idx)}
                        >
                          <Terminal size={14} />
                          Question {idx + 1}: {q.difficulty}
                        </button>
                      ))}
                    </div>
                  )}

                  {!isDsaRound && (
                    <div className="dsa-questions-tabs">
                      {isEditorFullscreen && (
                        <button
                          type="button"
                          className="dsa-restore-chat-tab-btn"
                          onClick={toggleEditorFullscreen}
                          title="Show Liza Chat (Exit Fullscreen)"
                        >
                          <MessageSquare size={13} />
                          <span>Liza Chat</span>
                        </button>
                      )}
                      <span className="dsa-active-title">Coding Sandbox</span>
                    </div>
                  )}

                  <div className="workspace-header-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button
                      type="button"
                      className={`editor-fullscreen-toggle-btn ${isEditorFullscreen ? "active" : ""}`}
                      onClick={toggleEditorFullscreen}
                      title={isEditorFullscreen ? "Exit Fullscreen (Split Screen)" : "Expand Editor to Fullscreen"}
                    >
                      {isEditorFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                      <span>{isEditorFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
                    </button>

                    <div className="editor-lang-selector">
                      <select
                        value={editorLanguage}
                        onChange={(e) => handleLanguageChange(e.target.value)}
                      >
                        {LANGUAGES.map((lang) => (
                          <option key={lang.id} value={lang.id}>{lang.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Draggable Split Workspace */}
                <div className="dsa-side-by-side-workspace" ref={workspaceRef}>
                  {/* Left Column: Problem statement description */}
                  <div className="dsa-problem-description-side" style={{ width: `${splitWidth}%` }}>
                    {activeQuestion ? (
                      <>
                        <div className="dsa-q-meta-info">
                          <span className="dsa-q-number">LeetCode {activeQuestion.number}.</span>
                          <span className="dsa-q-title">{activeQuestion.title}</span>
                          <span className={`dsa-difficulty-tag ${(activeQuestion.difficulty || "").toLowerCase()}`}>
                            {activeQuestion.difficulty}
                          </span>
                        </div>
                        <div className="dsa-description-panel-content">
                          <div
                            className="dsa-description-content"
                            dangerouslySetInnerHTML={{
                              __html: (activeQuestion.description || "")
                                .replace(/&/g, "&amp;")
                                .replace(/</g, "&lt;")
                                .replace(/>/g, "&gt;")
                                .replace(/"/g, "&quot;")
                                .replace(/'/g, "&#039;")
                                .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
                                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                                .replace(/`([^`]+)`/g, "<code>$1</code>")
                                .replace(/\n/g, "<br/>")
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="muted centered" style={{ marginTop: "40px" }}>
                        No problem loaded. Use the editor to code.
                      </p>
                    )}
                  </div>

                  {/* Draggable Divider Split Bar */}
                  <div
                    className="dsa-workspace-resizer"
                    onMouseDown={handleMouseDown}
                  >
                    <div className="resizer-handle-dots" />
                  </div>

                  {/* Right Column: Code editor */}
                  <div className="dsa-code-editor-side" style={{ width: `${100 - splitWidth}%` }}>
                    <div className="monaco-editor-container">
                      <MonacoEditor
                        height="100%"
                        language={LANGUAGES.find(l => l.id === editorLanguage)?.monacoId || "python"}
                        theme={theme === "dark" ? "vs-dark" : "light"}
                        value={codeDrafts[activeQIndex] || ""}
                        onChange={(value) => {
                          setCodeDrafts((prev) => ({
                            ...prev,
                            [activeQIndex]: value || ""
                          }));
                        }}
                        options={{
                          fontSize: 15,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          wordWrap: "on",
                          padding: { top: 12 },
                          automaticLayout: true,
                        }}
                      />
                    </div>

                    {/* LeetCode-style Console Drawer */}
                    {showConsole && (
                      <div className="console-drawer glass">
                        <div className="console-drawer-header">
                          <span>Console</span>
                          <button className="close-console-btn" onClick={() => setShowConsole(false)}>×</button>
                        </div>

                        <div className="console-drawer-body">
                          {isRunningCode ? (
                            <div className="console-loading">
                              <div className="console-spinner"></div>
                              <span>Executing code against test cases...</span>
                            </div>
                          ) : runResults ? (
                            <div className="console-results">
                              {/* Execution Status Badge */}
                              <div className="console-status-row">
                                <span className={`console-status-badge ${runResults.status}`}>
                                  {runResults.status === "success" ? "Accepted" : runResults.status === "failed" ? "Wrong Answer" : "Compile Error"}
                                </span>
                              </div>

                              {/* Compile Error Message */}
                              {runResults.status === "compile_error" && (
                                <pre className="console-compile-message">
                                  {runResults.compile_message}
                                </pre>
                              )}

                              {/* Testcase Result Tabs */}
                              {runResults.results && runResults.results.length > 0 && (
                                <div className="console-testcases-tabs">
                                  <div className="testcase-tab-buttons">
                                    {runResults.results.map((r, i) => (
                                      <button
                                        key={i}
                                        className={`testcase-tab-btn ${activeConsoleTab === i ? "active" : ""} ${r.passed ? "passed" : "failed"}`}
                                        onClick={() => setActiveConsoleTab(i)}
                                      >
                                        Case {i + 1}
                                      </button>
                                    ))}
                                  </div>

                                  {/* Active Tab details */}
                                  {runResults.results[activeConsoleTab] && (
                                    <div className="testcase-tab-detail">
                                      <div className="io-row">
                                        <span className="io-label">Input</span>
                                        <pre className="io-code"><code>{runResults.results[activeConsoleTab].input}</code></pre>
                                      </div>
                                      <div className="io-row">
                                        <span className="io-label">Expected</span>
                                        <pre className="io-code"><code>{runResults.results[activeConsoleTab].expected}</code></pre>
                                      </div>
                                      <div className="io-row">
                                        <span className="io-label">Actual</span>
                                        <pre className={`io-code ${runResults.results[activeConsoleTab].passed ? "passed" : "failed"}`}>
                                          <code>{runResults.results[activeConsoleTab].actual}</code>
                                        </pre>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Standard Output (Stdout) */}
                              {runResults.stdout && (
                                <div className="console-stdout-section">
                                  <span className="io-label">Stdout</span>
                                  <pre className="console-stdout">{runResults.stdout}</pre>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {/* Editor Action Bar (Run + Submit) */}
                    <div className="editor-action-bar">
                      <button
                        className="button subtle run-code-btn"
                        onClick={handleRunCode}
                        disabled={loading || isRunningCode || !(codeDrafts[activeQIndex]?.trim())}
                      >
                        <Play size={14} />
                        Run Code
                      </button>
                      <button
                        className="button primary submit-code-btn"
                        onClick={handleSubmitCode}
                        disabled={loading || !(codeDrafts[activeQIndex]?.trim())}
                      >
                        <Send size={14} />
                        Submit Code to Liza
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Compact Rectangular Floating Camera in Bottom-Right ── */}
              {!hideCamera ? (
                <div
                  className="split-floating-cam glass"
                  style={
                    camPos
                      ? {
                          top: `${camPos.y}px`,
                          left: `${camPos.x}px`,
                          bottom: "auto",
                          right: "auto",
                        }
                      : undefined
                  }
                  onMouseDown={handleCamMouseDown}
                  title="Drag to reposition camera preview"
                >
                  <div className="floating-cam-video-wrap">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="floating-webcam-video"
                    />
                  </div>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ display: "none" }}
                />
              )}
            </div>
          ) : (
            /* ═══════════════ STANDARD INTERVIEW MODE (no editor) ═══════════════ */
            <div className={`interview-live-container ${hideCamera ? "cam-hidden" : ""}`}>
              {hideCamera ? (
                <div className="cam-collapsed-bar standard glass">
                  <div className="cam-collapsed-left">
                    <span className="cam-rec-dot" />
                    <span className="cam-collapsed-label">Camera Tracking Active (Preview Hidden)</span>
                  </div>
                  <button
                    type="button"
                    className="cam-toggle-btn"
                    onClick={() => setHideCamera(false)}
                    title="Show live video preview"
                  >
                    <Eye size={13} />
                    <span>Show Video</span>
                  </button>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ display: "none" }}
                  />
                </div>
              ) : (
                <div className="live-stream-box glass">
                  <div className="cam-overlay-top">
                    <div className="cam-feed-badge">
                      <span className="cam-rec-dot" />
                      <span>Live Feed</span>
                    </div>
                    <button
                      type="button"
                      className="cam-hide-btn"
                      onClick={() => setHideCamera(true)}
                      title="Hide video preview"
                    >
                      <EyeOff size={12} />
                      <span>Hide Video</span>
                    </button>
                  </div>

                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="live-interview-webcam"
                  />
                </div>
              )}

              <div className="interview-chat-aside glass">
                <div className="chat-aside-header">
                  <div className="chat-header-title">
                    <MessageSquare size={16} />
                    <h3>Interview Dialogue</h3>
                  </div>
                  <div className="chat-status-pill">
                    <span className={`chat-status-dot ${isSpeaking ? "speaking" : isAiThinking ? "thinking" : isRecordingResponse ? (isUserSpeaking ? "listening speaking" : "listening") : "idle"}`} />
                    <span>{isSpeaking ? "AI Talking" : isAiThinking ? "AI Thinking" : isRecordingResponse ? (isUserSpeaking ? "Listening (Speaking...)" : "Listening...") : "Ready"}</span>
                  </div>
                </div>

                <div className="messages-log">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`chat-bubble ${msg.role}`}>
                      <div className="chat-bubble-header">
                        <div className="bubble-avatar">
                          {msg.role === "model" ? <Bot size={13} /> : <User size={13} />}
                        </div>
                        <span className="role-tag">{msg.role === "model" ? "Liza (Interviewer)" : "You (Candidate)"}</span>
                        {msg.timestamp && <span className="bubble-timestamp">{msg.timestamp}</span>}
                      </div>
                      <p>{msg.text}</p>
                      {msg.code && (
                        <pre className="chat-code-block"><code>{msg.code}</code></pre>
                      )}
                    </div>
                  ))}

                  {/* Liza Thinking indicator */}
                  {isSpeaking === false && isSubmittingResponseRef.current && (
                    <div className="chat-bubble model thinking">
                      <div className="chat-bubble-header">
                        <div className="bubble-avatar"><Bot size={13} /></div>
                        <span className="role-tag">Liza is thinking...</span>
                      </div>
                      <div className="typing-bouncing-dots">
                        <span className="t-dot" />
                        <span className="t-dot" />
                        <span className="t-dot" />
                      </div>
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

                {!isSpeaking && !isAiThinking && !isComplete && (
                  <div className="live-input-area">
                    <div className="input-field-wrapper">
                      <textarea
                        ref={responseInputRef}
                        className="response-text-input"
                        value={interimTranscript}
                        onFocus={() => {
                          // Allow the user to make changes by typing without speech overwriting
                          isUserEditingRef.current = true;
                          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                        }}
                        onChange={(e) => {
                          const val = e.target.value;
                          isUserEditingRef.current = true;
                          setInterimTranscript(val);
                          lastTranscribedTextRef.current = val;

                          // Auto-submit 3 seconds after user stops typing (if text is present)
                          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                          if (val.trim().length >= 2) {
                            typingTimeoutRef.current = setTimeout(() => {
                              finalizeAndSubmitGroqSTT(val);
                            }, 3000);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                            finalizeAndSubmitGroqSTT(interimTranscript);
                          }
                        }}
                        placeholder={
                          isRecordingResponse 
                            ? "Listening... Speak or type your response here." 
                            : "Listening paused. Click 'Speak' or type your response here..."
                        }
                        rows={2}
                      />
                      <div className="input-hint-row">
                        <span>Press <strong>Enter ↵</strong> to submit answer</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="controls-row">
                  <button
                    type="button"
                    className="button subtle finish-btn"
                    onClick={requestFinishInterview}
                    disabled={loading}
                    style={{ flex: 1 }}
                  >
                    <Square size={16} />
                    <span>{loading ? "Saving Session..." : "Finish & Analyze"}</span>
                  </button>

                  {!isSpeaking && !isAiThinking && !isComplete && !isRecordingResponse && (
                    <button
                      type="button"
                      className="button primary start-listening-btn pulse-shimmer"
                      onClick={startListening}
                      disabled={loading}
                      style={{ flex: 1 }}
                    >
                      <Mic size={16} />
                      <span>Speak</span>
                    </button>
                  )}

                  {!isSpeaking && !isAiThinking && !isComplete && (isRecordingResponse || interimTranscript.trim()) && (
                    <button
                      type="button"
                      className="button primary submit-btn pulse-shimmer"
                      onClick={() => {
                        finalizeAndSubmitGroqSTT(interimTranscript);
                      }}
                      disabled={loading || !interimTranscript.trim()}
                      style={{ flex: 1 }}
                    >
                      <Send size={16} />
                      <span>Submit Answer</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ━━━━ CONFIRMATION MODAL BEFORE FINISHING ━━━━ */}
          {showFinishConfirm && (
            <div className="modal-backdrop glass-blur" onClick={() => setShowFinishConfirm(false)}>
              <div className="modal-content glass" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div className="modal-icon-wrap warning">
                    <AlertTriangle size={24} />
                  </div>
                  <div className="modal-text-group">
                    <h3>End Interview Session?</h3>
                    <p className="muted">
                      Are you sure you want to finish now? Your interview recording and answers will be saved and sent for comprehensive confidence and telemetry evaluation.
                    </p>
                  </div>
                </div>

                <div className="modal-stats-preview">
                  <div className="preview-stat">
                    <span className="stat-label">Elapsed Time</span>
                    <span className="stat-val">{formatDuration(interviewDuration)}</span>
                  </div>
                  <div className="preview-stat">
                    <span className="stat-label">Questions Completed</span>
                    <span className="stat-val">{messages.filter((m) => m.role === "model").length}</span>
                  </div>
                  <div className="preview-stat">
                    <span className="stat-label">Interview Track</span>
                    <span className="stat-val">{role || "Candidate"} ({INTERVIEW_TYPES.find((t) => t.id === interviewType)?.label})</span>
                  </div>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="button subtle modal-cancel-btn"
                    onClick={() => setShowFinishConfirm(false)}
                  >
                    Resume Interview
                  </button>
                  <button
                    type="button"
                    className="button primary danger-glow modal-confirm-btn"
                    onClick={() => {
                      setShowFinishConfirm(false);
                      handleFinishInterview();
                    }}
                    disabled={loading}
                  >
                    <Square size={15} />
                    <span>{loading ? "Finalizing..." : "Yes, Finish & Analyze"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
