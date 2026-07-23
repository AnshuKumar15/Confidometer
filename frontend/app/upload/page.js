"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import AutocompleteInput, { COMPANY_SUGGESTIONS, ROLE_SUGGESTIONS } from "@/components/AutocompleteInput";
import { initiateInterview, respondToAgent, uploadVideo, fetchTTSAudio, runCode, createSTTWebSocket } from "@/utils/api";
import { isAuthed } from "@/utils/auth";
import {
  Camera, Mic, Play, Square, FileText, CheckCircle,
  Building2, Briefcase, Clock, Brain, MessageSquare,
  Users, Terminal, Send, Timer, AlertTriangle, DollarSign, Zap,
  Volume2
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
  const router = useRouter();

  // Auth check on mount & theme class
  useEffect(() => {
    document.body.classList.add("light-theme-bg");
    if (!isAuthed()) {
      router.push("/login?next=/upload");
    }
    return () => {
      document.body.classList.remove("light-theme-bg");
    };
  }, [router]);
  
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

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  // DOM Refs
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Server-side STT refs (WebSocket + audio capture)
  const sttWsRef = useRef(null);        // WebSocket connection to backend Whisper STT
  const sttRecorderRef = useRef(null);   // MediaRecorder capturing audio chunks for STT
  const sttUsingServerRef = useRef(false); // true when using server-side STT (vs browser fallback)

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
        // Auto-trigger recording after AI finishes asking
        if (!speechCancelledRef.current) {
          startListening();
        }
      };
      audio.onerror = () => {
        setIsSpeaking(false);
        if (audioUrl && audioUrl.startsWith("blob:")) {
          URL.revokeObjectURL(audioUrl);
        }
        if (!speechCancelledRef.current) {
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
          if (!speechCancelledRef.current) {
            startListening();
          }
        };
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
        if (!speechCancelledRef.current) {
          startListening();
        }
      }
    }
  }

  // 3. Speech Recognition setup — Server-side Whisper STT with browser fallback
  const accumulatedTranscriptRef = useRef("");
  const silenceTimerRef = useRef(null);
  const SILENCE_TIMEOUT_MS = 4000; // 4 seconds of silence before auto-submit (slightly longer to accommodate server latency)
  const STT_CHUNK_INTERVAL_MS = 3000; // send audio chunks to server every 3 seconds

  // ── Server-side STT via WebSocket + Whisper ──
  function startServerSTT() {
    // Need a media stream to capture audio
    if (!mediaStream) {
      console.warn("[STT] No media stream available, falling back to browser STT");
      startBrowserSTT();
      return;
    }

    accumulatedTranscriptRef.current = "";
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Open WebSocket to backend Whisper STT
    const ws = createSTTWebSocket(
      sessionIdRef.current,
      // onResult
      (data) => {
        const text = data.text || "";
        const corrections = data.corrections || [];
        const fullTranscript = data.full_transcript || "";

        if (data.type === "result" && text) {
          // If there were corrections, use the server's full_transcript
          // (it already has corrections applied)
          if (corrections.length > 0) {
            console.log("[STT] Self-correction applied:", corrections);
            accumulatedTranscriptRef.current = fullTranscript;
          } else {
            // No corrections — the server's full_transcript includes the new segment
            accumulatedTranscriptRef.current = fullTranscript;
          }
          setInterimTranscript(accumulatedTranscriptRef.current.trim());
        }

        // Reset silence timer on any speech activity
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }

        // Start silence timer — submit after silence
        if (accumulatedTranscriptRef.current.trim()) {
          silenceTimerRef.current = setTimeout(() => {
            const fullText = accumulatedTranscriptRef.current.trim();
            if (fullText) {
              accumulatedTranscriptRef.current = "";
              setInterimTranscript("");
              submitResponse(fullText);
            }
          }, SILENCE_TIMEOUT_MS);
        }
      },
      // onError
      (errMsg) => {
        console.warn("[STT] WebSocket error, falling back to browser STT:", errMsg);
        cleanupServerSTT();
        startBrowserSTT();
      },
      // onOpen
      () => {
        console.log("[STT] Server-side Whisper STT connected");
        sttUsingServerRef.current = true;
        setIsRecordingResponse(true);
        setInterimTranscript("");
        startAudioCapture();
      },
      // onClose
      () => {
        console.log("[STT] Server STT WebSocket closed");
        // If we didn't intentionally close, submit what we have
        if (sttUsingServerRef.current) {
          const fullText = accumulatedTranscriptRef.current.trim();
          if (fullText) {
            accumulatedTranscriptRef.current = "";
            setInterimTranscript("");
            submitResponse(fullText);
          }
          sttUsingServerRef.current = false;
          setIsRecordingResponse(false);
        }
      }
    );

    sttWsRef.current = ws;
  }

  function startAudioCapture() {
    // Use the existing media stream's audio tracks to capture audio chunks
    if (!mediaStream) return;

    try {
      // Create an audio-only stream from the existing media stream
      const audioTracks = mediaStream.getAudioTracks();
      if (!audioTracks.length) {
        console.warn("[STT] No audio tracks in media stream");
        return;
      }

      const audioStream = new MediaStream(audioTracks);

      // Use a separate MediaRecorder for STT chunks
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      if (!mimeType) {
        console.warn("[STT] No supported audio MIME type for MediaRecorder");
        return;
      }

      const recorder = new MediaRecorder(audioStream, {
        mimeType,
        audioBitsPerSecond: 64000, // lower bitrate is fine for speech
      });

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0 && sttWsRef.current) {
          sttWsRef.current.send(event.data);
        }
      };

      recorder.onerror = (e) => {
        console.warn("[STT] MediaRecorder error:", e);
      };

      // Request data every STT_CHUNK_INTERVAL_MS
      recorder.start(STT_CHUNK_INTERVAL_MS);
      sttRecorderRef.current = recorder;

      console.log(`[STT] Audio capture started (${mimeType}, chunks every ${STT_CHUNK_INTERVAL_MS}ms)`);
    } catch (e) {
      console.warn("[STT] Failed to start audio capture:", e);
    }
  }

  function cleanupServerSTT() {
    // Stop the audio capture recorder
    if (sttRecorderRef.current) {
      try {
        if (sttRecorderRef.current.state !== "inactive") {
          sttRecorderRef.current.stop();
        }
      } catch (e) { /* ignore */ }
      sttRecorderRef.current = null;
    }

    // Close the WebSocket
    if (sttWsRef.current) {
      sttWsRef.current.close();
      sttWsRef.current = null;
    }

    sttUsingServerRef.current = false;
  }

  // ── Browser Speech Recognition fallback ──
  function startBrowserSTT() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not available. Please type your responses or use Chrome.");
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

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
        setInterimTranscript(accumulatedTranscriptRef.current.trim());
      } else if (interim) {
        setInterimTranscript(
          (accumulatedTranscriptRef.current + " " + interim).trim()
        );
      }

      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }

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

  function startListening() {
    // Default to browser Speech Recognition for zero-latency local development experience
    const SpeechRecognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (SpeechRecognition) {
      console.log("[STT] Using browser Speech Recognition for zero-latency");
      startBrowserSTT();
    } else {
      console.log("[STT] Browser Speech Recognition not supported, falling back to server Whisper STT");
      try {
        startServerSTT();
      } catch (e) {
        console.warn("[STT] Server STT failed to start:", e);
      }
    }
  }

  function stopListening() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    accumulatedTranscriptRef.current = "";

    // Stop server-side STT if active
    if (sttUsingServerRef.current) {
      cleanupServerSTT();
    }

    // Stop browser STT if active
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

      setSessionId(data.session_id);
      setCurrentQuestion(data.first_question);
      setMessages([{ role: "model", text: data.first_question }]);
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
    const userMsg = { role: "user", text: transcriptText };
    if (code) userMsg.code = code;

    // Add user answer to chat log
    setMessages((prev) => [...prev, userMsg]);
    stopListening();

    try {
      const data = await respondToAgent(sessionIdRef.current, transcriptText, code, qIdx, interviewDuration);
      const nextQ = data.next_question;
      
      setCurrentQuestion(nextQ);
      setMessages((prev) => [...prev, { role: "model", text: nextQ }]);

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
      ) : showSplitScreen ? (
        /* ═══════════════ SPLIT-SCREEN MODE (DSA / Coding Side-by-Side) ═══════════════ */
        <div className="interview-split-container">
          {/* ── Left Panel: Camera + Liza Dialogue (width: 35%) ── */}
          <div className="split-left-panel">
            <div className="split-cam-box glass">
              {/* Timer badge */}
              {isDsaRound ? (
                <div className={`live-timer-badge dsa-timer ${timerUrgency}`}>
                  <Timer size={14} />
                  <span>{formatDuration(dsaTimeLeft)}</span>
                </div>
              ) : (
                <div className="live-timer-badge">
                  <Clock size={14} />
                  <span>{formatDuration(interviewDuration)}</span>
                </div>
              )}

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="split-webcam"
              />
              
              <div className="speaking-indicator-ring">
                {isSpeaking ? (
                  <div className="badge model-badge">
                    <Volume2 size={14} className="pulse" />
                    AI Speaking
                  </div>
                ) : isRecordingResponse ? (
                  <div className="badge user-badge">
                    <span className="recording-dot pulse"></span>
                    Listening...
                  </div>
                ) : null}
              </div>
            </div>

            <div className="split-chat-box glass">
              <h3>
                <MessageSquare size={16} />
                Liza Chat
              </h3>
              <div className="messages-log">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`chat-bubble ${msg.role}`}>
                    <span className="role-tag">{msg.role === "model" ? "Liza" : "You"}</span>
                    <p>{msg.text}</p>
                    {msg.code && (
                      <pre className="chat-code-block"><code>{msg.code}</code></pre>
                    )}
                  </div>
                ))}
                {interimTranscript && !isRecordingResponse && (
                  <div className="chat-bubble user interim">
                    <span className="role-tag">Hearing...</span>
                    <p>{interimTranscript}</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {isRecordingResponse && (
                <div className="live-input-area" style={{ display: "flex", gap: "8px", margin: "8px 0" }}>
                  <input
                    type="text"
                    className="response-text-input"
                    value={interimTranscript}
                    onChange={(e) => {
                      setInterimTranscript(e.target.value);
                      accumulatedTranscriptRef.current = e.target.value;
                      if (silenceTimerRef.current) {
                        clearTimeout(silenceTimerRef.current);
                        silenceTimerRef.current = null;
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && interimTranscript.trim()) {
                        const text = interimTranscript.trim();
                        accumulatedTranscriptRef.current = "";
                        setInterimTranscript("");
                        submitResponse(text);
                      }
                    }}
                    placeholder="Speak or type..."
                    style={{
                      flex: 1,
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid var(--line)",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      color: "var(--text)",
                      fontSize: "0.85rem"
                    }}
                  />
                </div>
              )}

              <div className="controls-row" style={{ display: "flex", gap: "8px", width: "100%" }}>
                <button
                  className="button subtle finish-btn"
                  onClick={handleFinishInterview}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  <Square size={14} />
                  {loading ? "Saving..." : "Finish & Analyze"}
                </button>
              </div>
            </div>
          </div>

          {/* ── Right Panel: Workspace Side-by-Side (width: 65%) ── */}
          <div className="split-right-panel glass">
            {/* Header: Question switcher tabs & Language Selector */}
            <div className="dsa-workspace-header">
              {isDsaRound && dsaQuestions && (
                <div className="dsa-questions-tabs">
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
                  <span className="dsa-active-title">Coding Sandbox</span>
                </div>
              )}

              <div className="workspace-header-actions" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
                            .replace(/\n/g, "<br/>")
                            .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
                            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                            .replace(/`([^`]+)`/g, "<code>$1</code>")
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
                    theme="vs-dark"
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
        </div>
      ) : (
        /* ═══════════════ STANDARD INTERVIEW MODE (no editor) ═══════════════ */
        <div className="interview-live-container">
          <div className="live-stream-box glass">
            {/* Live timer badge */}
            <div className="live-timer-badge">
              <Clock size={14} />
              <span>{formatDuration(interviewDuration)}</span>
            </div>

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
              {interimTranscript && !isRecordingResponse && (
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

            {isRecordingResponse && (
              <div className="live-input-area" style={{ display: "flex", gap: "10px", margin: "10px 0" }}>
                <textarea
                  ref={responseInputRef}
                  className="response-text-input"
                  value={interimTranscript}
                  onChange={(e) => {
                    setInterimTranscript(e.target.value);
                    accumulatedTranscriptRef.current = e.target.value;
                    if (silenceTimerRef.current) {
                      clearTimeout(silenceTimerRef.current);
                      silenceTimerRef.current = null;
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (interimTranscript.trim()) {
                        const text = interimTranscript.trim();
                        accumulatedTranscriptRef.current = "";
                        setInterimTranscript("");
                        submitResponse(text);
                      }
                    }
                  }}
                  placeholder={isComplete ? "Interview complete! Type 'thank you' and press Enter to finish." : "Speaking... you can also type or edit here."}
                  style={{
                    flex: 1,
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    color: "var(--text)",
                    fontSize: "0.95rem",
                    resize: "none",
                    minHeight: "50px",
                    fontFamily: "inherit"
                  }}
                />
              </div>
            )}

            <div className="controls-row" style={{ display: "flex", gap: "12px", width: "100%" }}>
              <button
                className="button subtle finish-btn"
                onClick={handleFinishInterview}
                disabled={loading}
                style={{ flex: 1 }}
              >
                <Square size={16} />
                {loading ? "Saving Session..." : "Finish & Analyze"}
              </button>


              {isRecordingResponse && (
                <button
                  className="button primary submit-btn"
                  onClick={() => {
                    const text = interimTranscript.trim();
                    if (text) {
                      accumulatedTranscriptRef.current = "";
                      setInterimTranscript("");
                      submitResponse(text);
                    }
                  }}
                  disabled={loading}
                  style={{ flex: 1 }}
                >
                  <CheckCircle size={16} />
                  {isComplete ? "Conclude & Analyze" : "Submit Answer"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
