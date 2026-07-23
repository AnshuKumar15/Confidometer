"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight, Sparkles, Brain, Users, Terminal,
  MessageSquare, DollarSign, Mic, Eye, TrendingUp,
  BarChart3, Award, Zap, Target, Volume2, Video,
  Activity, Timer, Code2, Shield, Headphones, BookOpen, Box,
  Bot, User
} from "lucide-react";

/* ── Symmetrical waveform matching the screenshot size/style but wider ── */
function FeedbackWaveform() {
  return (
    <div className="lp-speak-wave-centered">
      {[...Array(40)].map((_, i) => {
        // Dynamic symmetric scaling for a centered look (steep gradient for big waves)
        const factor = i < 20 ? 0.2 + (i * 0.04) : 0.2 + ((39 - i) * 0.04);
        return (
          <motion.div
            key={i}
            className="lp-wave-bar"
            style={{ height: `${factor * 100}%` }}
            animate={{ scaleY: [0.8, 1.2, 0.8] }}
            transition={{
              duration: 0.5,
              repeat: Infinity,
              delay: i * 0.02,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </div>
  );
}

/* ── Interview type data ── */
const INTERVIEW_TYPES = [
  {
    id: "technical",
    label: "Technical",
    icon: <Brain size={24} />,
    description: "Resume-based technical questions with live AI follow-ups and optional coding tasks.",
    color: "#4d39a2",
  },
  {
    id: "hr",
    label: "HR Round",
    icon: <Users size={24} />,
    description: "Motivation, teamwork, culture fit — the soft skills that seal the deal.",
    color: "#0f766e",
  },
  {
    id: "dsa",
    label: "DSA Coding",
    icon: <Terminal size={24} />,
    description: "2 LeetCode problems with an integrated code editor, compiler, and 30-minute timer.",
    color: "#c2410c",
  },
  {
    id: "behavioural",
    label: "Behavioural",
    icon: <MessageSquare size={24} />,
    description: "STAR-method situational and leadership questions crafted from your resume.",
    color: "#1d4ed8",
  },
  {
    id: "negotiation",
    label: "Salary Negotiation",
    icon: <DollarSign size={24} />,
    description: "Practice negotiating offers, counteroffers, and benefits with an AI recruiter.",
    color: "#b45309",
  },
];

/* ── Metrics list ── */
const METRICS = [
  { icon: <Eye size={18} />, label: "Eye Contact" },
  { icon: <Mic size={18} />, label: "Vocal Stability" },
  { icon: <Volume2 size={18} />, label: "Filler Words" },
  { icon: <Activity size={18} />, label: "Gesture Frequency" },
  { icon: <Brain size={18} />, label: "Technical Knowledge" },
  { icon: <MessageSquare size={18} />, label: "Fluency" },
  { icon: <Target size={18} />, label: "Explanation Quality" },
  { icon: <Code2 size={18} />, label: "Code Quality" },
  { icon: <Zap size={18} />, label: "Optimization" },
  { icon: <TrendingUp size={18} />, label: "Thinking Process" },
  { icon: <Shield size={18} />, label: "Stress Tolerance" },
  { icon: <DollarSign size={18} />, label: "Negotiation Score" },
];

const MOCK_POOL = [
  {
    id: "nykaa",
    name: "NYKAA",
    logoType: "text-nykaa",
    title: "Sales Manager",
    description: "Master sales leadership skills and drive impactful growth.",
    skills: "Strategy | Leadership",
    duration: "20 min",
    difficulty: "Easy",
    color: "#e51b58",
    dotColor: "green"
  },
  {
    id: "zomato",
    name: "zomato",
    logoType: "badge-zomato",
    title: "Software Engineer",
    description: "Strengthen your technical expertise and problem-solving edge.",
    skills: "Coding | Debugging",
    duration: "25 min",
    difficulty: "Easy",
    color: "#cb202d",
    dotColor: "red"
  },
  {
    id: "meesho",
    name: "meesho",
    logoType: "text-meesho",
    title: "Product Designer II",
    description: "Practice real-world Product Design interview questions with AI feedback.",
    skills: "Prototyping | Research",
    duration: "20 min",
    difficulty: "Easy",
    color: "#ff4f81",
    dotColor: "green"
  },
  {
    id: "google",
    name: "Google",
    logoType: "svg-google",
    title: "Backend Engineer",
    description: "Prepare for scale, system design, and algorithmic coding challenges.",
    skills: "Go | Systems | Algorithms",
    duration: "45 min",
    difficulty: "Hard",
    color: "#4285F4",
    dotColor: "red"
  },
  {
    id: "meta",
    name: "Meta",
    logoType: "svg-meta",
    title: "Product Manager",
    description: "Master execution, product sense, and analytical strategy questions.",
    skills: "Execution | Strategy | Metrics",
    duration: "30 min",
    difficulty: "Medium",
    color: "#0081fb",
    dotColor: "green"
  },
  {
    id: "netflix",
    name: "Netflix",
    logoType: "svg-netflix",
    title: "Senior UI Engineer",
    description: "Tackle high performance rendering and real-world system integrations.",
    skills: "React | Performance | CSS",
    duration: "40 min",
    difficulty: "Hard",
    color: "#E50914",
    dotColor: "red"
  },
  {
    id: "spotify",
    name: "Spotify",
    logoType: "svg-spotify",
    title: "Frontend Architect",
    description: "Design accessible playback systems and interactive client features.",
    skills: "Accessibility | Web API | Architecture",
    duration: "35 min",
    difficulty: "Medium",
    color: "#1DB954",
    dotColor: "green"
  },
  {
    id: "microsoft",
    name: "Microsoft",
    logoType: "svg-microsoft",
    title: "Data Scientist",
    description: "Evaluate machine learning architectures and statistical inference models.",
    skills: "Python | ML | Stats",
    duration: "30 min",
    difficulty: "Medium",
    color: "#7FBA00",
    dotColor: "green"
  }
];

function RenderLogo({ logoType }) {
  if (logoType === "text-nykaa") {
    return (
      <div className="lp-logo-svg-wrap">
        <img src="/nykaa_logo.png" alt="Nykaa" style={{ height: "26px", width: "auto", objectFit: "contain" }} />
      </div>
    );
  }
  if (logoType === "badge-zomato") {
    return <span className="lp-logo-zomato">zomato</span>;
  }
  if (logoType === "text-meesho") {
    return (
      <div className="lp-logo-svg-wrap">
        <img src="/meesho_logo.png" alt="Meesho" style={{ height: "24px", width: "auto", objectFit: "contain" }} />
      </div>
    );
  }
  if (logoType === "svg-google") {
    return (
      <div className="lp-logo-svg-wrap">
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.86-4.53-6.16-4.53z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span className="lp-brand-label" style={{ color: "#5f6368" }}>Google</span>
      </div>
    );
  }
  if (logoType === "svg-meta") {
    return (
      <div className="lp-logo-svg-wrap">
        <img src="/meta_logo_official.png" alt="Meta" style={{ height: "24px", width: "auto", objectFit: "contain" }} />
      </div>
    );
  }
  if (logoType === "svg-netflix") {
    return (
      <div className="lp-logo-svg-wrap">
        <img src="/netflix_logo_official.png" alt="Netflix" style={{ height: "24px", width: "auto", objectFit: "contain" }} />
      </div>
    );
  }
  if (logoType === "svg-spotify") {
    return (
      <div className="lp-logo-svg-wrap">
        <img src="/spotify_logo_official.png" alt="Spotify" style={{ height: "26px", width: "auto", objectFit: "contain" }} />
      </div>
    );
  }
  if (logoType === "svg-microsoft") {
    return (
      <div className="lp-logo-svg-wrap">
        <svg viewBox="0 0 23 23" width="18" height="18">
          <rect x="0" y="0" width="10.5" height="10.5" fill="#F25022"/>
          <rect x="11.5" y="0" width="10.5" height="10.5" fill="#7FBA00"/>
          <rect x="0" y="11.5" width="10.5" height="10.5" fill="#00A4EF"/>
          <rect x="11.5" y="11.5" width="10.5" height="10.5" fill="#FFB900"/>
        </svg>
        <span className="lp-brand-label" style={{ color: "#5f6368" }}>Microsoft</span>
      </div>
    );
  }
  return null;
}

export default function LandingPage() {
  const [indices, setIndices] = useState([0, 1, 2]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndices((prev) => {
        const next0 = (prev[0] + 1) % MOCK_POOL.length;
        let next1 = (prev[1] + 1) % MOCK_POOL.length;
        let next2 = (prev[2] + 1) % MOCK_POOL.length;
        while (next1 === next0) {
          next1 = (next1 + 1) % MOCK_POOL.length;
        }
        while (next2 === next0 || next2 === next1) {
          next2 = (next2 + 1) % MOCK_POOL.length;
        }
        return [next0, next1, next2];
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.body.classList.add("light-theme-bg");
    return () => {
      document.body.classList.remove("light-theme-bg");
    };
  }, []);

  return (
    <div className="landing-page">
      <div className="lp-container">

        {/* ━━━━ SECTION 1: HERO ━━━━ */}
        <section className="lp-section lp-hero">
          <div className="lp-hero-content">
            <span className="lp-kicker">
              <Sparkles size={14} /> Meet Liza — Your AI Interview Coach
            </span>

            <h1 className="lp-hero-title">
              Mock interviews, <span className="lp-gradient-text">elevated by AI.</span>
            </h1>

            <p className="lp-hero-subtitle">
              Speak naturally while our AI analyzes your confidence, body language,
              and vocal stability — delivering instant feedback so you ace your next session.
            </p>

            <div className="lp-hero-actions">
              <Link href="/upload" className="button primary lp-btn-lg">
                Start AI Interview <ArrowRight size={18} />
              </Link>
              <Link href="/dashboard" className="button subtle lp-btn-lg">
                View Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* ━━━━ SECTION 2: STATS BANNER ━━━━ */}
        <section className="lp-section lp-stats-banner">
          <div className="lp-stat-item">
            <span className="lp-stat-number">12+</span>
            <span className="lp-stat-label">Metrics Analyzed</span>
          </div>
          <div className="lp-stat-divider" />
          <div className="lp-stat-item">
            <span className="lp-stat-number">5</span>
            <span className="lp-stat-label">Interview Types</span>
          </div>
          <div className="lp-stat-divider" />
          <div className="lp-stat-item">
            <span className="lp-stat-number">∞</span>
            <span className="lp-stat-label">Practice Sessions</span>
          </div>
          <div className="lp-stat-divider" />
          <div className="lp-stat-item">
            <span className="lp-stat-number">Real-Time</span>
            <span className="lp-stat-label">Vocal & Visual Analysis</span>
          </div>
        </section>

        {/* ━━━━ SECTION 3: AI INTERVIEW FEATURE (with image) ━━━━ */}
        <section className="lp-section">
          <div className="lp-feature lp-feature-normal">
            <div className="lp-feature-text">
              <span className="lp-feature-badge" style={{ color: "#16a085" }}>
                <Video size={16} /> AI Interview
              </span>
              <h2>Talk to Liza. Get real feedback.</h2>
              <p>
                Liza reads your resume, generates custom questions for your target company, and conducts a live interview. Adapts dynamically to your responses.
              </p>
              <Link href="/upload" className="lp-feature-link">
                Start an interview <ArrowRight size={16} />
              </Link>
            </div>

            <div className="lp-feature-visual">
              <div className="lp-visual-transcript-css">
                <div className="lp-transcript-header">
                  <span className="lp-transcript-dot" />
                  <span className="lp-transcript-title">REAL-TIME ANALYTICS</span>
                </div>
                <div className="lp-transcript-body">
                  {/* Liza's Question */}
                  <div className="lp-chat-row lp-chat-ai">
                    <span className="lp-chat-label">LIZA (AI RECRUITER)</span>
                    <p className="lp-chat-bubble">
                      "Tell me about a time you had to pivot a strategy based on unexpected user telemetry. What was your approach?"
                    </p>
                  </div>

                  {/* User's Answer Wave/Indicator */}
                  <div className="lp-chat-row lp-chat-user">
                    <span className="lp-chat-label">YOU (SPEAKING...)</span>
                    <div className="lp-user-recording-wave">
                      <span className="lp-wave-line" style={{ height: "12px" }} />
                      <span className="lp-wave-line" style={{ height: "24px" }} />
                      <span className="lp-wave-line" style={{ height: "36px" }} />
                      <span className="lp-wave-line" style={{ height: "28px" }} />
                      <span className="lp-wave-line" style={{ height: "18px" }} />
                      <span className="lp-wave-line" style={{ height: "32px" }} />
                      <span className="lp-wave-line" style={{ height: "10px" }} />
                    </div>
                  </div>
                </div>
                <div className="lp-transcript-telemetry">
                  <div className="lp-telemetry-pill">
                    <span className="lp-pill-label">Pace</span>
                    <span className="lp-pill-value">130 wpm</span>
                  </div>
                  <div className="lp-telemetry-pill">
                    <span className="lp-pill-label">Fillers</span>
                    <span className="lp-pill-value lp-success">None</span>
                  </div>
                  <div className="lp-telemetry-pill">
                    <span className="lp-pill-label">Sentiment</span>
                    <span className="lp-pill-value">Confident</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━ SECTION 4: COMPANY-SPECIFIC PRACTICE ROUNDS ━━━━ */}
        <section className="lp-section lp-company-section">
          <div className="lp-dotted-box">
            <div className="lp-section-header">
              <h2>We'll craft a mock interview experience that prepares you to step into future with confidence.</h2>
            </div>

            <div className="lp-company-grid">
              {indices.map((poolIdx) => {
                const card = MOCK_POOL[poolIdx];
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                    className="lp-company-card"
                    style={{ borderTop: `6px solid ${card.color}` }}
                  >
                    <div className="lp-card-logo-row">
                      <RenderLogo logoType={card.logoType} />
                    </div>
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                    <div className="lp-card-skills">Skills: {card.skills}</div>
                    <Link href="/upload" className="lp-card-practice-btn">
                      Start Practice now
                    </Link>
                    <div className="lp-card-footer-info">
                      <span className={`lp-footer-dot lp-dot-${card.dotColor}`} /> {card.duration} Interview : Difficulty - {card.difficulty}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <div className="lp-company-footer-action">
              <p>This isn't just practice; it's your first step toward your dream role.</p>
              <Link href="/upload" className="button primary lp-btn-lg">
                Let's Begin!
              </Link>
            </div>
          </div>
        </section>

        {/* ━━━━ SECTION 5: NARRATED AUDIO & TEXT FEEDBACK CHOICES (centered wave) ━━━━ */}
        <section className="lp-section">
          <div className="lp-feature lp-feature-reverse">
            <div className="lp-feature-text">
              <span className="lp-feature-badge" style={{ color: "#4d39a2" }}>
                <Headphones size={16} /> Personalized Feedback Choices
              </span>
              <h2>Listen or Read. Choose how you learn.</h2>
              <p>
                Download a detailed text report outlining suggestions, or listen to Liza speak your personalized feedback directly with realistic audio narration.
              </p>
              <Link href="/dashboard" className="lp-feature-link">
                Explore feedback dashboard <ArrowRight size={16} />
              </Link>
            </div>

            <div className="lp-feature-visual">
              <div className="lp-visual-feedback">
                <div className="lp-feedback-audio-header">
                  <Headphones size={18} className="lp-pulse-icon" />
                  <span>Audio Feedback Playback</span>
                </div>
                <FeedbackWaveform />
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━ SECTION 5: STRESS SIMULATION MODE (with image) ━━━━ */}
        <section className="lp-section">
          <div className="lp-feature lp-feature-normal">
            <div className="lp-feature-text">
              <span className="lp-feature-badge" style={{ color: "#c2410c" }}>
                <Shield size={16} /> Stress Mode
              </span>
              <h2>Train under pressure.</h2>
              <p>
                Toggle Stress Mode to face aggressive follow-up questions, quick response prompts, and background analytics tracking your fidgeting and speech pace variance.
              </p>
              <Link href="/upload" className="lp-feature-link">
                Test your composure <ArrowRight size={16} />
              </Link>
            </div>

            <div className="lp-feature-visual">
              <div className="lp-visual-stress">
                <div className="lp-stress-indicator">
                  <Shield size={18} className="lp-stress-pulse-icon" />
                  <span>Stress Mode Active</span>
                </div>
                <div className="lp-stress-meters">
                  <div className="lp-stress-meter-row">
                    <div className="lp-meter-header">
                      <span>Fidgeting Index</span>
                      <span className="lp-color-warning">Volatile</span>
                    </div>
                    <div className="lp-meter-bar-container">
                      <div className="lp-meter-bar lp-bg-warning" style={{ width: "78%" }} />
                    </div>
                  </div>

                  <div className="lp-stress-meter-row">
                    <div className="lp-meter-header">
                      <span>Speech Rate Variance</span>
                      <span className="lp-color-danger">Spike detected</span>
                    </div>
                    <div className="lp-meter-bar-container">
                      <div className="lp-meter-bar lp-bg-danger" style={{ width: "85%" }} />
                    </div>
                  </div>

                  <div className="lp-stress-meter-row">
                    <div className="lp-meter-header">
                      <span>Stress Tolerance Score</span>
                      <span className="lp-color-success">82%</span>
                    </div>
                    <div className="lp-meter-bar-container">
                      <div className="lp-meter-bar lp-bg-success" style={{ width: "82%" }} />
                    </div>
                  </div>
                </div>
                <div className="lp-stress-alert">
                  ⚠️ HIGH BIOMETRIC DEVIATION
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━ SECTION 6: 5 INTERVIEW TYPES ━━━━ */}
        <section className="lp-section lp-types-section">
          <div className="lp-section-header">
            <h2>Five ways to practice. One platform.</h2>
            <p>Select the round that fits where you need the most work.</p>
          </div>

          <div className="lp-types-flow">
            {INTERVIEW_TYPES.map((type) => (
              <div key={type.id} className="lp-type-item">
                <div
                  className="lp-type-icon"
                  style={{ color: type.color, borderColor: `${type.color}22` }}
                >
                  {type.icon}
                </div>
                <div className="lp-type-info">
                  <h3>{type.label}</h3>
                  <p>{type.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="lp-types-cta">
            <Link href="/upload" className="button primary lp-btn-lg">
              Try any round now <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {/* ━━━━ SECTION 7: GET SET SPEAK (with lever pull image) ━━━━ */}
        <section className="lp-section">
          <div className="lp-feature lp-feature-reverse">
            <div className="lp-feature-text">
              <span className="lp-feature-badge" style={{ color: "#b45309" }}>
                <Mic size={16} /> Get Set Speak
              </span>
              <h2>Spin. Speak. Master the Mic!</h2>
              <p>
                Pull the slot machine lever to spin for a random topic. Speak for 1 minute, record yourself, and instantly see pacing, eye contact, and filler count analysis.
              </p>
              <Link href="/speak" className="lp-feature-link">
                Spin the lever now <ArrowRight size={16} />
              </Link>
            </div>

            <div className="lp-feature-visual">
              <div className="lp-visual-speak">
                <div className="lp-speak-prompt-header">
                  <Sparkles size={16} className="lp-prompt-spark" />
                  <span>Slot Machine Reels</span>
                </div>
                <div className="lp-speak-prompt-body">
                  <div className="lp-slot-reels-mock">
                    <span className="lp-reel-pill" style={{ background: "rgba(217, 119, 6, 0.08)", color: "#b45309", border: "1px solid rgba(217, 119, 6, 0.15)" }}>🟡 Medium</span>
                    <span className="lp-reel-pill" style={{ background: "rgba(22, 160, 133, 0.08)", color: "#16a085", border: "1px solid rgba(22, 160, 133, 0.15)" }}>🔮 Random</span>
                  </div>
                  <div className="lp-slot-question-mock">
                    "Is 'deinfluencing' genuine or just another form of influencing?"
                  </div>
                </div>
                <div className="lp-speak-rec-indicator">
                  <span className="lp-rec-dot" />
                  <span>1 MIN TIMER READY</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━ SECTION 8: PEER-TO-PEER ━━━━ */}
        <section className="lp-section">
          <div className="lp-feature lp-feature-normal">
            <div className="lp-feature-text">
              <span className="lp-feature-badge" style={{ color: "#0f766e" }}>
                <Users size={16} /> Peer-to-Peer
              </span>
              <h2>Interview real people. Get real perspectives.</h2>
              <p>
                Match with other users for live mock interviews. Take turns as interviewer and candidate, with full visual and vocal AI telemetry.
              </p>
              <Link href="/peer" className="lp-feature-link">
                Find a peer <ArrowRight size={16} />
              </Link>
            </div>

            <div className="lp-feature-visual">
              <div className="lp-visual-peer">
                <div className="lp-peer-card">
                  <div className="lp-peer-avatar">A</div>
                  <div className="lp-peer-info">
                    <strong>Anshu</strong>
                    <span>Software Engineer • Google</span>
                  </div>
                  <span className="lp-peer-status lp-peer-live">● Live</span>
                </div>
                <div className="lp-peer-connector">⟷</div>
                <div className="lp-peer-card">
                  <div className="lp-peer-avatar">B</div>
                  <div className="lp-peer-info">
                    <strong>Bob</strong>
                    <span>Frontend Dev • Microsoft</span>
                  </div>
                  <span className="lp-peer-status lp-peer-waiting">● Matched</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ━━━━ SECTION 9: DASHBOARD & 12+ METRICS ━━━━ */}
        <section className="lp-section lp-metrics-section">
          <div className="lp-section-header">
            <h2>12+ metrics. Zero guesswork.</h2>
            <p>Every session is scored across detailed indicators so you know what to target next.</p>
          </div>

          <div className="lp-metrics-grid">
            {METRICS.map((m) => (
              <div key={m.label} className="lp-metric-chip">
                <span className="lp-metric-icon">{m.icon}</span>
                <span>{m.label}</span>
              </div>
            ))}
          </div>

          <div className="lp-metrics-extras">
            <div className="lp-extra-item">
              <BarChart3 size={22} />
              <div>
                <h4>Progress Tracking</h4>
                <p>Line charts showing performance trends over multiple practice sessions.</p>
              </div>
            </div>
            <div className="lp-extra-item">
              <Award size={22} />
              <div>
                <h4>Achievements & Badges</h4>
                <p>Earn milestone achievements for consistency, high ratings, and streak levels.</p>
              </div>
            </div>
            <div className="lp-extra-item">
              <Timer size={22} />
              <div>
                <h4>Daily Practice Streak</h4>
                <p>Build muscle memory. Maintain your daily streak of completed rounds.</p>
              </div>
            </div>
          </div>

          <div className="lp-types-cta">
            <Link href="/dashboard" className="button primary lp-btn-lg">
              See your dashboard <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {/* ━━━━ SECTION 10: VALUE PROPOSITIONS & BENEFITS ━━━━ */}
        <section className="lp-section lp-benefits-section">
          <div className="lp-benefits-stack">

            {/* Card 1 */}
            <div className="lp-benefit-card">
              <div className="lp-benefit-badge lp-benefit-badge-left lp-badge-blue">
                Boost your confidence
              </div>
              <div className="lp-benefit-badge lp-benefit-badge-right lp-badge-blue">
                Sharpen Your Answers
              </div>
              <div className="lp-benefit-icon-container">
                <BookOpen size={52} className="lp-benefit-icon" />
              </div>
              <h3>Handle Any Question With Ease</h3>
              <p>
                From tricky behavioral prompts to unexpected technical challenges, interviews are designed to test you under pressure. With AI simulations, you'll face diverse, role-specific questions and receive real-time feedback to sharpen your responses, so nothing catches you off guard.
              </p>
            </div>

            {/* Card 2 */}
            <div className="lp-benefit-card">
              <div className="lp-benefit-badge lp-benefit-badge-left lp-badge-green">
                Ready to Shine
              </div>
              <div className="lp-benefit-badge lp-benefit-badge-right lp-badge-green">
                Get Hired Faster
              </div>
              <div className="lp-benefit-icon-container">
                <Box size={52} className="lp-benefit-icon" />
              </div>
              <h3>Beat Interview Jitters</h3>
              <p>
                Nerves can derail your confidence, causing hesitation, rambling, or forgotten points. Our AI mock interviews replicate real scenarios, giving you unlimited safe practice to stay calm, collected, and ready to shine when it matters most.
              </p>
            </div>

            {/* Card 3 */}
            <div className="lp-benefit-card">
              <div className="lp-benefit-badge lp-benefit-badge-left lp-badge-purple">
                Instant Report
              </div>
              <div className="lp-benefit-badge lp-benefit-badge-right lp-badge-purple">
                Actionable Feedback
              </div>
              <div className="lp-benefit-icon-container">
                <TrendingUp size={52} className="lp-benefit-icon" />
              </div>
              <h3>Gain Clear, Actionable Feedback</h3>
              <p>
                Traditional prep often leaves you guessing where to improve. Our AI mock interviews highlight your strengths and pinpoint weaknesses with personalized feedback, helping you refine your delivery, strengthen your storytelling, and stand out to recruiters.
              </p>
            </div>

          </div>
        </section>

        {/* ━━━━ SECTION 11: FINAL CTA ━━━━ */}
        <section className="lp-section lp-final-cta">
          <h2>Ready to ace your next interview?</h2>
          <p>Start practicing today and measure your confidence progression.</p>
          <div className="lp-hero-actions">
            <Link href="/upload" className="button primary lp-btn-lg">
              Get Started <ArrowRight size={18} />
            </Link>
            <Link href="/speak" className="button subtle lp-btn-lg">
              Try Get Set Speak
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
}
