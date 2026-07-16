"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Play, Pause, RotateCcw, Video, Mic, VideoOff, 
  Sparkles, Check, Globe, HelpCircle, ArrowRight 
} from "lucide-react";
import "./styles.css";

// ── TOPIC DATA SET ──
const TOPICS = {
  Finance: {
    Easy: [
      "Explain why saving money is important.",
      "What is a bank and how does it work?",
      "Why is budgeting useful for college students?"
    ],
    Medium: [
      "Should high schools teach personal finance?",
      "What is inflation and how does it affect our daily life?",
      "What is compound interest and why is it powerful?"
    ],
    Hard: [
      "How does cryptocurrency differ from fiat money, and what are its risks?",
      "Explain quantitative easing to a non-economist.",
      "Discuss the pros and cons of universal basic income."
    ]
  },
  Tech: {
    Easy: [
      "How has the internet changed the way we learn?",
      "Explain what an app is.",
      "What is your favorite piece of technology and why?"
    ],
    Medium: [
      "Is the gap between Gen Z and Gen Alpha already huge?",
      "What is cloud computing and why do companies use it?",
      "Explain the difference between artificial intelligence and machine learning."
    ],
    Hard: [
      "How does blockchain achieve decentralization without a trusted authority?",
      "Discuss the ethical implications of facial recognition technology.",
      "Will quantum computing replace classical computers in our lifetime?"
    ]
  },
  General: {
    Easy: [
      "Describe your favorite season and why you love it.",
      "Is reading books better than watching movies?",
      "What is the most important lesson you've learned in life?"
    ],
    Medium: [
      "Why is work-life balance critical for long-term success?",
      "Should public transportation be free for everyone?",
      "How does social media affect public opinion?"
    ],
    Hard: [
      "Should space exploration be prioritized over solving climate change on Earth?",
      "Discuss how globalization has impacted local cultures around the world.",
      "Is artificial intelligence a threat to human creativity?"
    ]
  },
  "Roast A Popular Thing": {
    Easy: [
      "Roast group chats that could have been an email.",
      "Roast slow walkers in busy hallways.",
      "Roast standard alarm clock ringtones."
    ],
    Medium: [
      "Roast sourdough culture.",
      "Roast the concept of New Year's resolutions.",
      "Roast typing 'haha' when you didn't even smile."
    ],
    Hard: [
      "Roast influencers who do 'day in the life' videos of doing absolutely nothing.",
      "Roast corporate jargon like 'synergy' and 'circle back'.",
      "Roast people who write 'happy birthday' on LinkedIn."
    ]
  },
  "One-Minute Pitch": {
    Easy: [
      "Pitch a coffee shop that only sells cold brew.",
      "Pitch a library that lets you loud-talk in designated zones.",
      "Pitch a pillow that always stays cool."
    ],
    Medium: [
      "Pitch a luxury cruise that never leaves the dock.",
      "Pitch an app that finds the quietest table in a restaurant.",
      "Pitch a pet rock that responds to your emotional state."
    ],
    Hard: [
      "Pitch a subscription service for socks that self-destruct after three washes.",
      "Pitch a theme park dedicated entirely to waiting in fast, fun lines.",
      "Pitch a clock that ticks backwards to relieve stress."
    ]
  },
  "Defend The Worst Take": {
    Easy: [
      "Defend why pineapple on pizza is the absolute pinnacle of culinary art.",
      "Defend why doing chores is actually a great weekend activity.",
      "Defend why rainy days are superior to sunny days."
    ],
    Medium: [
      "Defend why traffic jams are actually great for meditation.",
      "Defend why dropping your phone face down is a sign of good luck.",
      "Defend why stubbing your toe is character building."
    ],
    Hard: [
      "Defend why pineapple should replace currency globally.",
      "Defend why sleeping on the floor makes you a better strategist.",
      "Defend why computers should be turned off for two months every year."
    ]
  },
  "Explain It Like You're 5": {
    Easy: [
      "Explain why the sky is blue.",
      "Explain why leaves change color in the autumn.",
      "Explain how a telephone works."
    ],
    Medium: [
      "Explain what a volcano is using baking soda.",
      "Explain how rain clouds are made.",
      "Explain how magnets stick together."
    ],
    Hard: [
      "Explain how the stock market works using cookies.",
      "Explain what coding is using building blocks.",
      "Explain what gravity is to a kid who wants to float."
    ]
  },
  "Conspiracy Corner": {
    Easy: [
      "Convince me that birds are not real.",
      "Argue that sleep is a conspiracy invented by mattress companies.",
      "Convince me that Mondays are shorter than other days.",
      "Argue that custom handshakes are currency in secret clubs."
    ],
    Medium: [
      "Argue that the moon is made of Swiss cheese and the government is hiding it.",
      "Convince me that mirrors are portals to parallel universes.",
      "Argue that shadows have their own secret lives."
    ],
    Hard: [
      "Argue that cats are actually alien observers sent to report on human behavior.",
      "Convince me that trees are whispering to each other about our haircuts.",
      "Argue that socks lost in the laundry are building their own civilization."
    ]
  },
  "Hot Takes": {
    Easy: [
      "Hot take: physical books are overrated compared to e-readers.",
      "Hot take: breakfast food is better at dinner time.",
      "Hot take: dogs are actually planning to run for office."
    ],
    Medium: [
      "Hot take: remote work is bad for your social skills.",
      "Hot take: tea is vastly superior to coffee in every scenario.",
      "Hot take: the movie is always better than the book."
    ],
    Hard: [
      "Hot take: college degrees will be completely obsolete in 10 years.",
      "Hot take: professional sports will eventually be replaced by video game leagues.",
      "Hot take: cooking is a waste of time in the era of food delivery."
    ]
  },
  Millennial: {
    Easy: [
      "Explain why avocado toast is worth the mortgage.",
      "Defend your collection of plants that you treat like children.",
      "Explain why you prefer texting over calling."
    ],
    Medium: [
      "Explain why you have 47 open tabs and refuse to close any of them.",
      "Defend the emotional attachment to the year 1999.",
      "Explain why finding a parking spot close to the entrance is a massive win."
    ],
    Hard: [
      "Defend your choice of a reusable water bottle that is too big for any cup holder.",
      "Explain the dread of an unscheduled phone call.",
      "Defend having a multi-step skincare routine that takes 40 minutes."
    ]
  }
};

const LANGUAGES = ["US EN", "UK EN", "IN EN"];
const DIFFICULTIES = ["Random", "Easy", "Medium", "Hard"];
const CATEGORIES = [
  "Random",
  "General",
  "Tech",
  "Finance",
  "Roast A Popular Thing",
  "One-Minute Pitch",
  "Defend The Worst Take",
  "Explain It Like You're 5",
  "Conspiracy Corner",
  "Hot Takes",
  "Millennial"
];

// Helper to pick a random item
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Generate a clean mechanical slot machine click dynamically using Web Audio API
const playClickSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "triangle";

    const now = ctx.currentTime;

    osc.frequency.setValueAtTime(1000, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

    gain.gain.setValueAtTime(0.18, now); 
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.start(now);
    osc.stop(now + 0.05);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 80);
  } catch (err) {
    console.warn("Failed to play mechanical click sound:", err);
  }
};

// Generate a bright major-triad Game Show chime chord dynamically using Web Audio API
const playTadaSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playNote = (freq, start, duration, volume) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.start(start);
      osc.stop(start + duration + 0.05);
    };

    // "Ta" - single note (C5 - 523.25Hz) 
    playNote(523.25, now, 0.08, 0.12);

    // "Da!" - Chord major triad starting 100ms later (E5 - 659.25Hz, G5 - 783.99Hz, C6 - 1046.50Hz)
    playNote(659.25, now + 0.1, 0.35, 0.10);
    playNote(783.99, now + 0.1, 0.35, 0.10);
    playNote(1046.50, now + 0.1, 0.35, 0.08);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 600);
  } catch (err) {
    console.warn("Failed to play tada sound:", err);
  }
};

// Generate a retro 8-bit "ta ta taaan" square wave sound (Super Mario style)
// Stretched by 1 / 0.85 (~1.176x) delay. Volumes increased and final note sustained longer.
const playTaTaTaaanSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playNote = (freq, start, duration, volume) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Square wave generates the iconic 8-bit NES synthesizer buzz
      osc.type = "square"; 
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.start(start);
      osc.stop(start + duration + 0.05);
    };

    // "ta" - E5 (659.25 Hz) at 0ms (volumes increased for louder playback)
    playNote(659.25, now, 0.08, 0.09);

    // "ta" - E5 (659.25 Hz) at 120ms
    playNote(659.25, now + 0.12, 0.08, 0.09);

    // "taaan" - G5 (783.99 Hz) at 240ms (increased volume and duration from 0.38s to 0.65s for sustain)
    playNote(783.99, now + 0.24, 0.65, 0.11);

    // Extended close timer to 1.1s so the longer final note is not clipped
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1100);
  } catch (err) {
    console.warn("Failed to play ta-ta-taaan sound:", err);
  }
};

// Generate a premium, sparkling crystal arpeggio start signal dynamically using Web Audio API
const playStartChimeSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playNote = (freq, start, duration, volume) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine"; 
      osc.frequency.setValueAtTime(freq, start);

      // Volume envelope: soft fade-in, long exponential fade-out
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.start(start);
      osc.stop(start + duration + 0.05);
    };

    // Ascending C-Major 9th arpeggio
    playNote(523.25, now, 0.45, 0.08);         // C5
    playNote(659.25, now + 0.06, 0.45, 0.07);  // E5
    playNote(783.99, now + 0.12, 0.45, 0.06);  // G5
    playNote(1174.66, now + 0.18, 0.65, 0.05); // D6 (high sparkling 9th, sustains longer)

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1000);
  } catch (err) {
    console.warn("Failed to play start chime sound:", err);
  }
};

// Helper function to return visual emojis for each Category matching the screenshots
const getCategoryEmoji = (cat) => {
  if (cat === "Random") return "🎯";
  if (cat === "General") return "💬";
  if (cat === "Tech") return "💻";
  if (cat === "Finance") return "💰";
  if (cat === "Roast A Popular Thing") return "🔥";
  if (cat === "One-Minute Pitch") return "💡";
  if (cat === "Defend The Worst Take") return "🤡";
  if (cat === "Explain It Like You're 5") return "👶";
  if (cat === "Conspiracy Corner") return "🛸";
  if (cat === "Hot Takes") return "🌶️";
  if (cat === "Millennial") return "🥑";
  return "🎯";
};

export default function SpeakPage() {
  // Page state: 'setup' or 'active'
  const [mode, setMode] = useState("setup");

  // Selection states
  const [language, setLanguage] = useState("US EN");
  const [difficulty, setDifficulty] = useState("Medium");
  const [category, setCategory] = useState("Random");

  // Dropdown open states
  const [langOpen, setLangOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);

  // Spinner states
  const [selectedTopic, setSelectedTopic] = useState(
    "Is \"deinfluencing\" genuine or just another form of influencing?"
  );
  const [spinning, setSpinning] = useState(false);
  const [ribbonTopics, setRibbonTopics] = useState([]);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [visibleActiveIndex, setVisibleActiveIndex] = useState(1);

  // Slot machine pull lever state
  const [leverPulled, setLeverPulled] = useState(false);

  // Timer states
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [totalTime, setTotalTime] = useState(60);

  // Client-side recorded video state
  const [recordingBlobUrl, setRecordingBlobUrl] = useState(null);

  // Media capture stream & Web Audio API visualizer refs
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);

  // Ref flag to ignore next onstop trigger (used for discarding recordings on reset)
  const ignoreNextRecordRef = useRef(false);

  // Media Recorder refs
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // Initialize slot ribbon topics
  useEffect(() => {
    // Collect all topics to populate default list
    const all = [];
    Object.keys(TOPICS).forEach((c) => {
      Object.keys(TOPICS[c]).forEach((d) => {
        all.push(...TOPICS[c][d]);
      });
    });
    // Shuffle and pick 15
    const shuffled = [...all].sort(() => 0.5 - Math.random()).slice(0, 15);
    // Insert target topics at index 0, 1, 2 matching the screenshot
    shuffled[0] = "Roast the concept of \"disruption\" in tech.";
    shuffled[1] = "Is \"deinfluencing\" genuine or just another form of influencing?";
    shuffled[2] = "Roast the entire concept of \"adulting\" books and classes.";
    setRibbonTopics(shuffled);
    setScrollOffset(0);
    setVisibleActiveIndex(1);
    setSelectedTopic("Is \"deinfluencing\" genuine or just another form of influencing?");
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setLangOpen(false);
      setDiffOpen(false);
      setCatOpen(false);
    };
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  // Reactively connect stream object to the DOM video ref after mounting
  useEffect(() => {
    if (videoRef.current && stream && !recordingBlobUrl) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, recordingBlobUrl]);

  // Disable body scrollbars in active practice mode to lock screen layout and prevent scrolling
  useEffect(() => {
    if (mode === "active") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mode]);

  // Timer Countdown loop
  useEffect(() => {
    let intervalId;
    if (mode === "active" && isPlaying && timeLeft > 0) {
      intervalId = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleStopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [mode, isPlaying, timeLeft]);

  // Stop camera stream tracks and clear objects
  const stopMediaStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  // Perform Slot Spin Animation (JS scroll loop to scale middle item dynamically)
  const handleSpin = () => {
    if (spinning) return;
    setSpinning(true);
    setLeverPulled(true);

    // Release lever after 350ms
    setTimeout(() => {
      setLeverPulled(false);
    }, 350);

    // 1. Resolve filtered list of topics for the target
    let finalPool = [];
    const catKeys = category === "Random" ? Object.keys(TOPICS) : [category];
    const diffKeys = difficulty === "Random" ? ["Easy", "Medium", "Hard"] : [difficulty];

    catKeys.forEach((c) => {
      diffKeys.forEach((d) => {
        if (TOPICS[c] && TOPICS[c][d]) {
          finalPool.push(...TOPICS[c][d]);
        }
      });
    });

    if (finalPool.length === 0) {
      finalPool = ["Is the gap between Gen Z and Gen Alpha already huge?"];
    }

    const landedTopic = pickRandom(finalPool);

    // 2. Collect all topics globally to show rich variety in the reel
    const allTopics = [];
    Object.keys(TOPICS).forEach((c) => {
      Object.keys(TOPICS[c]).forEach((d) => {
        allTopics.push(...TOPICS[c][d]);
      });
    });

    // Exclude the landed topic from the global reel pool to prevent duplicates adjacent to target
    const globalPoolWithoutTarget = allTopics.filter((t) => t !== landedTopic);

    // 3. Create a set of 20 topics to spin through, with target at index 15
    const spinPool = [];
    for (let i = 0; i < 20; i++) {
      if (i === 15) {
        spinPool.push(landedTopic);
      } else {
        // Pick unique topics for adjacent slots
        let nextTopic = pickRandom(globalPoolWithoutTarget);
        // Make sure adjacent items (i-1) are not the same
        while (spinPool.length > 0 && spinPool[spinPool.length - 1] === nextTopic) {
          nextTopic = pickRandom(globalPoolWithoutTarget);
        }
        spinPool.push(nextTopic);
      }
    }

    setRibbonTopics(spinPool);

    // JS animation loop driving offset with a strong ease-out quintic deceleration curve
    const duration = 2200; 
    const start = Date.now();
    let lastIndex = 1;
    
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / duration, 1);
      
      // Quintic ease-out deceleration curve for natural slowing down physics
      const eased = 1 - Math.pow(1 - t, 4.5); 
      const currentFloatIndex = 1 + eased * 14;
      
      // Calculate offset: translation is based on currentFloatIndex
      const offset = (currentFloatIndex - 1) * 80;
      setScrollOffset(offset);
      
      // Active index is the closest rounded item
      const currentIdx = Math.round(currentFloatIndex);
      setVisibleActiveIndex(currentIdx);
      
      // If the index has transitioned, play the mechanical click audio tick
      if (currentIdx !== lastIndex) {
        playClickSound();
        lastIndex = currentIdx;
      }
      
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        setSelectedTopic(landedTopic);
        setSpinning(false);
        setScrollOffset(1120); // (15 - 1) * 80 = 1120px
        setVisibleActiveIndex(15);
        playTadaSound(); // Trigger game show polyphonic chime!
      }
    };
    requestAnimationFrame(tick);
  };

  // Start active mode without launching countdown/camera yet
  const handleStartTimer = () => {
    setMode("active");
    setTimeLeft(totalTime);
    setIsPlaying(false);
    if (recordingBlobUrl) {
      URL.revokeObjectURL(recordingBlobUrl);
      setRecordingBlobUrl(null);
    }
  };

  // Triggered when user plays/pauses speaking countdown
  const handlePlayPause = async () => {
    if (isPlaying) {
      // Pause countdown
      setIsPlaying(false);
      
      // Pause MediaRecorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.pause();
      }
    } else {
      // If the timer is set to 0, prevent starting
      if (timeLeft <= 0) {
        return;
      }

      // Play countdown
      setIsPlaying(true);
      playStartChimeSound(); // Trigger the premium ascending bell arpeggio!

      // 1. Ensure stream is active
      let activeStream = stream;
      if (!activeStream) {
        try {
          activeStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: true
          });
          setStream(activeStream);

          // Initialize Web Audio API visualizer
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) {
            const audioContext = new AudioCtx();
            const source = audioContext.createMediaStreamSource(activeStream);
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);

            audioContextRef.current = audioContext;
            analyserRef.current = analyser;
          }
        } catch (err) {
          console.warn("Failed to gain device access:", err);
          setIsPlaying(false);
          return;
        }
      }

      // 2. Start or Resume MediaRecorder
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
        // Initialize fresh MediaRecorder
        recordedChunksRef.current = [];
        const options = { mimeType: "video/webm" };
        let recorder;
        try {
          recorder = new MediaRecorder(activeStream, options);
        } catch (e) {
          recorder = new MediaRecorder(activeStream);
        }

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          if (ignoreNextRecordRef.current) {
            ignoreNextRecordRef.current = false;
            return; // Discard
          }
          const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
          const url = URL.createObjectURL(blob);
          setRecordingBlobUrl(url);
        };

        mediaRecorderRef.current = recorder;
        recorder.start();
      } else if (mediaRecorderRef.current.state === "paused") {
        mediaRecorderRef.current.resume();
      }
    }
  };

  // Stop recording, trigger blob creation, and stop live stream
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    stopMediaStream();
    setIsPlaying(false);
  };

  // Increase/Decrease timer, preserving elapsed speaking progress if adjusted mid-recording
  const adjustTimer = (seconds) => {
    if (timeLeft === totalTime) {
      const nextVal = Math.max(0, Math.min(600, totalTime + seconds));
      setTotalTime(nextVal);
      setTimeLeft(nextVal);
    } else {
      const nextTotal = Math.max(0, Math.min(600, totalTime + seconds));
      const diff = nextTotal - totalTime;
      setTotalTime(nextTotal);
      setTimeLeft((prev) => Math.max(0, Math.min(nextTotal, prev + diff)));
    }
  };

  // Reset the active practice timer and clear previous recording - stays on the same topic practice view!
  // Keeps the camera stream active so they are immediately ready to start fresh
  const handleTimerReset = () => {
    if (recordingBlobUrl) {
      URL.revokeObjectURL(recordingBlobUrl);
      setRecordingBlobUrl(null);
    }
    // Stop recording and tell onstop to ignore creating the review blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      ignoreNextRecordRef.current = true;
      mediaRecorderRef.current.stop();
    }
    recordedChunksRef.current = [];
    setIsPlaying(false);
    setTimeLeft(totalTime);
  };

  // Reset/Return to spinner - completely revokes and dumps the video from memory
  const handleReset = () => {
    if (recordingBlobUrl) {
      URL.revokeObjectURL(recordingBlobUrl);
      setRecordingBlobUrl(null);
    }
    stopMediaStream();
    setIsPlaying(false);
    setMode("setup");
    setScrollOffset(0);
    setVisibleActiveIndex(1);
  };

  // Cleanup object URLs on unmount to prevent leaks
  useEffect(() => {
    return () => {
      if (recordingBlobUrl) {
        URL.revokeObjectURL(recordingBlobUrl);
      }
    };
  }, [recordingBlobUrl]);

  // Circle timer path definitions (increased radius for larger radial)
  const radius = 105;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = totalTime > 0 
    ? circumference - (timeLeft / totalTime) * circumference 
    : 0;

  // Retrieve emojis for current difficulty
  const getDiffEmoji = (d) => {
    if (d === "Easy") return "🟢";
    if (d === "Medium") return "🟡";
    if (d === "Hard") return "🔴";
    return "🟣";
  };

  return (
    <div className="speak-cream-band">
      <div className="speak-page-wrapper">

        {/* Top right "Baby steps to the Mic" written signature */}
        <div className="speak-header-badge">
          Baby steps to the Mic
        </div>

        {mode === "setup" ? (
          /* ═══════════════ SPIN MODE (SETUP) ═══════════════ */
          <div className="speak-grid-layout">
            
            {/* Left Column Instructions */}
            <div className="speak-sidebar-card">
              <div className="speak-brand-logo-section">
                <h1 className="speak-brand-title">
                  Get Set<br />
                  Speak
                </h1>
                <div className="speak-steps-list">
                  <div className="speak-step-item">
                    <span className="speak-step-text">1) Get random topic</span>
                  </div>
                  <div className="speak-step-item">
                    <span className="speak-step-text">2) Set 1 min timer</span>
                  </div>
                  <div className="speak-step-item">
                    <span className="speak-step-text">3) Record & speak !!</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column Slot machine container */}
            <div className="speak-play-card">
              
              {/* Inner container to center everything relative to the viewport */}
              <div className="speak-play-inner">
                
                {/* Custom dropdown headers matching the screenshot pills exactly */}
                <div className="speak-selectors-header">
                  
                  {/* Language Pill dropdown */}
                  <div className="speak-selector-pill" onClick={(e) => { e.stopPropagation(); setLangOpen(!langOpen); setDiffOpen(false); setCatOpen(false); }}>
                    <button type="button" className="speak-pill-btn">
                      <span>{language} ▾</span>
                    </button>
                    {langOpen && (
                      <div className="speak-dropdown-panel">
                        {LANGUAGES.map((lang) => (
                          <button 
                            key={lang} 
                            type="button" 
                            className={`speak-dropdown-item ${language === lang ? "active" : ""}`}
                            onClick={() => setLanguage(lang)}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Difficulty Pill dropdown */}
                  <div className="speak-selector-pill" onClick={(e) => { e.stopPropagation(); setDiffOpen(!diffOpen); setLangOpen(false); setCatOpen(false); }}>
                    <button type="button" className="speak-pill-btn">
                      <span>{getDiffEmoji(difficulty)} {difficulty} ▾</span>
                    </button>
                    {diffOpen && (
                      <div className="speak-dropdown-panel">
                        {DIFFICULTIES.map((diff) => (
                          <button 
                            key={diff} 
                            type="button" 
                            className={`speak-dropdown-item ${difficulty === diff ? "active" : ""}`}
                            onClick={() => setDifficulty(diff)}
                          >
                            <span>{getDiffEmoji(diff)} {diff}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Category Pill dropdown */}
                  <div className="speak-selector-pill" onClick={(e) => { e.stopPropagation(); setCatOpen(!catOpen); setLangOpen(false); setDiffOpen(false); }}>
                    <button type="button" className="speak-pill-btn">
                      <span>{getCategoryEmoji(category)} {category} ▾</span>
                    </button>
                    {catOpen && (
                      <div className="speak-dropdown-panel">
                        {CATEGORIES.map((cat) => (
                          <button 
                            key={cat} 
                            type="button" 
                            className={`speak-dropdown-item ${category === cat ? "active" : ""}`}
                            onClick={() => setCategory(cat)}
                          >
                            <span>{getCategoryEmoji(cat)} {cat}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* Vertical scrolling slot picker viewport */}
                <div className="speak-slot-viewport">
                  <div className="speak-slot-highlight-bar" />
                  <div 
                    className={`speak-slot-ribbon ${spinning ? "spinning" : ""}`}
                    style={{
                      transform: `translate3d(0, -${scrollOffset}px, 0)`
                    }}
                  >
                    {ribbonTopics.map((topic, i) => (
                      <div 
                        key={i} 
                        className={`speak-slot-item ${i === visibleActiveIndex ? "active" : ""}`}
                      >
                        {topic}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Spin / Trigger buttons centered at bottom of viewport */}
                <div className="speak-action-row">
                  <button 
                    type="button" 
                    className="speak-btn-spin"
                    onClick={handleSpin}
                    disabled={spinning}
                  >
                    {spinning ? "Spinning..." : "Spin!"}
                  </button>

                  <button 
                    type="button" 
                    className="speak-btn-timer"
                    onClick={handleStartTimer}
                    disabled={spinning}
                  >
                    Start Timer →
                  </button>
                </div>

              </div>

              {/* Pull Lever spinner handle on the right of the centered column */}
              <div className="speak-lever-container">
                <span className="speak-lever-lbl">pull lever<br />↓</span>
                <div className="speak-lever-track" />
                <button 
                  type="button" 
                  className="speak-lever-handle" 
                  style={{
                    top: leverPulled ? "90px" : "15px"
                  }}
                  onClick={handleSpin}
                  disabled={spinning}
                  title="Pull lever to spin"
                >
                  <span className="stripe" />
                  <span className="stripe" />
                  <span className="stripe" />
                </button>
                <div className="speak-lever-dot" />
              </div>

            </div>

          </div>
        ) : (
          /* ═══════════════ TIMER & PRACTICE MODE (ACTIVE) ═══════════════ */
          <div className="speak-active-wrapper">
            
            {/* Left Column: Webcam preview or playback video player */}
            <div className="speak-camera-card">
              <div className="speak-camera-viewport">
                {recordingBlobUrl ? (
                  /* Show recorded video player controls */
                  <video 
                    src={recordingBlobUrl}
                    controls
                    className="speak-camera-stream"
                  />
                ) : stream ? (
                  /* Show live stream preview */
                  <video 
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="speak-camera-stream"
                  />
                ) : (
                  /* Show start placeholder before play is pressed */
                  <div className="speak-camera-placeholder">
                    <Video size={48} className="placeholder-icon" />
                    <span>Camera ready. Click Play below to start speaking.</span>
                  </div>
                )}
                
                {/* Overlay live indicator badge */}
                {!recordingBlobUrl && stream && (
                  <div className="speak-camera-overlay">
                    <div className="speak-mic-badge">
                      <span className="speak-red-dot" />
                      <Mic size={14} />
                      <span>Recording Live</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Timer progress bar or recording review actions */}
            <div className="speak-timer-panel">
              
              {recordingBlobUrl ? (
                /* Post-recording actions panel */
                <div className="speak-recorded-actions">
                  <h3>Review Practice</h3>
                  <p>Your video is saved temporarily. You can watch/download it below, or return to the spinner to try another topic.</p>
                  
                  <div className="speak-recorded-buttons">
                    <a 
                      href={recordingBlobUrl} 
                      download={`practice-speak-${Math.floor(Date.now() / 1000)}.webm`}
                      className="speak-btn-finish"
                      style={{ textDecoration: "none", textAlign: "center", display: "block" }}
                    >
                      Download Video
                    </a>
                    
                    <button 
                      type="button" 
                      className="speak-btn-timer" 
                      onClick={handleReset}
                      style={{ width: "100%", background: "#ffffff" }}
                    >
                      ← Spin Another Topic
                    </button>
                  </div>
                </div>
              ) : (
                /* Circular SVG Timer and Play/Pause controller bar */
                <>
                  <div className="speak-active-topic-heading">
                    <span className="speak-active-topic-lbl">Topic:</span>
                    <p className="speak-active-topic-text">"{selectedTopic}"</p>
                  </div>

                  <div className="speak-timer-radial-box">
                    <svg className="speak-timer-svg" width="240" height="240" viewBox="0 0 240 240">
                      <circle 
                        className="speak-timer-ring-bg"
                        cx="120" 
                        cy="120" 
                        r={radius} 
                        strokeWidth={strokeWidth}
                        fill="transparent"
                      />
                      <circle 
                        className="speak-timer-ring-fill"
                        cx="120" 
                        cy="120" 
                        r={radius} 
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                      />
                    </svg>
                    <div className="speak-timer-text-display">
                      <span className="speak-timer-value">
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                      </span>
                      
                      {/* Plus/Minus adjustments disappear after user starts speaking, reappear when paused */}
                      {!isPlaying && (
                        <div className="speak-timer-adjust-row">
                          <button type="button" className="speak-adjust-btn" onClick={() => adjustTimer(-30)}>-0:30</button>
                          <button type="button" className="speak-adjust-btn" onClick={() => adjustTimer(30)}>+0:30</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stop, Start, play/pause controller bar */}
                  <div className="speak-control-row">
                    <button 
                      type="button" 
                      className="speak-btn-circle reset"
                      onClick={handleTimerReset}
                      title="Reset Timer"
                    >
                      <RotateCcw size={20} />
                    </button>

                    <button 
                      type="button" 
                      className="speak-btn-circle play"
                      onClick={handlePlayPause}
                      title={isPlaying ? "Pause" : "Play"}
                      style={{ opacity: timeLeft <= 0 ? 0.5 : 1, cursor: timeLeft <= 0 ? "not-allowed" : "pointer" }}
                    >
                      {isPlaying ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: "4px" }} />}
                    </button>
                  </div>
                </>
              )}

            </div>

          </div>
        )}
      </div>
    </div>
  );
}
