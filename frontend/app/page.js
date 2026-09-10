"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Sparkles, Brain, Users, Terminal,
  MessageSquare, DollarSign, Mic, Eye, TrendingUp,
  BarChart3, Award, Zap, Target, Volume2,
  Activity, Timer, Code2, Shield, BookOpen, Box,
  Bot, User, CheckCircle2, XCircle, Play, Check,
  ChevronDown, Video, FileText, Compass,
  ArrowUpRight, HelpCircle, Lock, Gauge
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

/* ── Interview type data ── */
const INTERVIEW_TYPES = [
  {
    id: "technical",
    label: "Technical Deep-Dive",
    badge: "Engineering & Architecture",
    icon: <Brain size={24} />,
    description: "Resume-specific system design and engineering questions with dynamic AI follow-ups that test real depth.",
    color: "#4d39a2",
    tag: "High Impact"
  },
  {
    id: "hr",
    label: "HR & Culture Fit",
    badge: "People & Values",
    icon: <Users size={24} />,
    description: "Motivation, team chemistry, conflict resolution, and leadership principles — the soft skills that seal offers.",
    color: "#0f766e",
    tag: "Essential"
  },
  {
    id: "dsa",
    label: "DSA Coding Challenge",
    badge: "Algorithms & Logic",
    icon: <Terminal size={24} />,
    description: "LeetCode-style problems with live compiler, test cases, and real-time explanation quality evaluation.",
    color: "#c2410c",
    tag: "Live IDE"
  },
  {
    id: "behavioural",
    label: "Behavioural (STAR)",
    badge: "Situational Storytelling",
    icon: <MessageSquare size={24} />,
    description: "STAR framework prompts crafted from your actual past projects. Learn how to tell compelling stories under pressure.",
    color: "#1d4ed8",
    tag: "STAR Method"
  },
  {
    id: "negotiation",
    label: "Salary & Offer Negotiation",
    badge: "Compensation Strategy",
    icon: <DollarSign size={24} />,
    description: "Practice counteroffering base pay, stock grants, and benefits against an AI recruiter trained on tech market rates.",
    color: "#b45309",
    tag: "High ROI"
  },
];

/* ── 12 Scientific Metrics ── */
const METRICS = [
  { icon: <Eye size={18} />, label: "Eye Contact", desc: "Measures camera gaze lock vs. downward nervous drift" },
  { icon: <Mic size={18} />, label: "Vocal Stability", desc: "Tracks vocal tremors, pitch jitter, and tone authority" },
  { icon: <Volume2 size={18} />, label: "Filler Words", desc: "Detects 'um', 'uh', 'like', 'you know' in real-time" },
  { icon: <Activity size={18} />, label: "Gesture Frequency", desc: "Analyzes natural hand movement & body posture" },
  { icon: <Brain size={18} />, label: "Technical Depth", desc: "Evaluates accuracy and completeness of your domain answers" },
  { icon: <MessageSquare size={18} />, label: "Fluency & Cadence", desc: "Monitors words-per-minute against optimal 130–150 WPM" },
  { icon: <Target size={18} />, label: "Explanation Quality", desc: "Scores logical structure, clarity, and conciseness" },
  { icon: <Code2 size={18} />, label: "Code Quality", desc: "Analyzes clean syntax, naming, and modular thinking" },
  { icon: <Zap size={18} />, label: "Optimization", desc: "Checks big-O space and time complexity trade-offs" },
  { icon: <TrendingUp size={18} />, label: "Thinking Process", desc: "Measures how well you articulate thought steps aloud" },
  { icon: <Shield size={18} />, label: "Stress Tolerance", desc: "Evaluates composure when hit with difficult follow-ups" },
  { icon: <DollarSign size={18} />, label: "Negotiation Power", desc: "Assesses value anchoring, leverage, and tone balance" },
];

/* ── Company Mock Pool ── */
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

/* ── FAQs ── */
const FAQS = [
  {
    q: "Is Confidometer really free to practice?",
    a: "Yes! You can take full AI mock interviews, practice 60-second impromptu drills in Get Set Speak, and run peer-to-peer sessions completely free without entering a credit card."
  },
  {
    q: "How does the real-time AI scoring analyze my video & voice?",
    a: "Confidometer runs lightweight computer vision and acoustic audio telemetry directly in your browser. It tracks facial landmark gaze lock (eye contact), pitch frequency variations (vocal stability), speech cadence (words per minute), and speech-to-text transcript semantics to give you scientific, objective feedback."
  },
  {
    q: "Do I need to install any software or browser extensions?",
    a: "No downloads or plugins required. Confidometer runs 100% inside your standard modern browser (Chrome, Edge, Safari, Brave) with standard webcam and microphone access."
  },
  {
    q: "Can I practice if I'm not a software engineer?",
    a: "Absolutely. Confidometer supports Product Management, Design, HR, Sales Leadership, Marketing, Data Science, and General Behavioral interview rounds. You can also upload your resume for any role to generate customized questions."
  },
  {
    q: "Is my resume and practice recording kept private?",
    a: "Your privacy is paramount. Your resume is parsed securely only for generating your mock questions, and your practice sessions are confidential. We never share your recordings, scores, or resume with employers or third parties."
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

function ScrollReveal({
  children,
  delay = 0,
  y = 28,
  duration = 0.55,
  className = "",
  style = {},
  ...props
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
      style={style}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const [indices, setIndices] = useState([0, 1, 2]);
  const [openFaq, setOpenFaq] = useState(0);

  // Rotating company cards
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

  return (
    <div className="landing-page">
      <div className="lp-container">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 1: HERO ("This is what I want")
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="lp-hero-section">
          <div className="lp-hero-header">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="lp-hero-kicker"
            >
              <span className="lp-kicker-pulse" />
              <Sparkles size={14} className="lp-kicker-sparkle" />
              <span>Meet Liza — Your Real-Time AI Interview Coach</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.1 }}
              className="lp-hero-headline"
            >
              Stop Practicing in Your Head. <br />
              <span className="lp-gradient-text">Start Practicing Out Loud.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.2 }}
              className="lp-hero-subtext"
            >
              Confidometer’s AI interviewer watches your eyes, listens to your vocal tone, and flags filler words in real time — giving you the reps you need to walk into any interview calm, articulate, and ready to get hired.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.3 }}
              className="lp-hero-cta-group"
            >
              <Link href="/upload" className="lp-btn-cta-primary">
                <span>Start Your Free Mock Interview</span>
                <ArrowRight size={18} />
              </Link>
              <a href="#how-it-works" className="lp-btn-cta-secondary">
                <Play size={15} fill="currentColor" />
                <span>See How It Works</span>
              </a>
            </motion.div>

            <div className="lp-hero-reassurance">
              <span>⚡ 100% Free mock practice</span>
              <span className="lp-reassure-dot">•</span>
              <span>Zero mentor scheduling</span>
            </div>
          </div>

        </section>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 2: PRODUCT CAPABILITIES & TRUST BANNER
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="lp-stats-impact-banner">
          <ScrollReveal className="lp-impact-stats-grid" y={22} duration={0.6}>
            <div className="lp-impact-stat">
              <span className="lp-impact-number">12+</span>
              <span className="lp-impact-label">Real-Time Metrics</span>
              <span className="lp-impact-sub">From eye contact to vocal pitch stability</span>
            </div>
            <div className="lp-impact-stat">
              <span className="lp-impact-number">5</span>
              <span className="lp-impact-label">Interview Formats</span>
              <span className="lp-impact-sub">Tech, HR, LeetCode DSA, STAR & Salary</span>
            </div>
            <div className="lp-impact-stat">
              <span className="lp-impact-number">∞</span>
              <span className="lp-impact-label">Practice Sessions</span>
              <span className="lp-impact-sub">Unlimited private reps anytime, 24/7</span>
            </div>
            <div className="lp-impact-stat">
              <span className="lp-impact-number">Live</span>
              <span className="lp-impact-label">Vocal & Visual AI</span>
              <span className="lp-impact-sub">Direct in-browser zero latency analysis</span>
            </div>
          </ScrollReveal>

          <ScrollReveal className="lp-companies-trust-strip" delay={0.12} y={18}>
            <span className="lp-trust-caption">Practice rounds tailored for top tech & product companies:</span>
            <div className="lp-trust-logos">
              <span className="lp-trust-logo">Google</span>
              <span className="lp-trust-logo">Meta</span>
              <span className="lp-trust-logo">Netflix</span>
              <span className="lp-trust-logo">Microsoft</span>
              <span className="lp-trust-logo">Spotify</span>
              <span className="lp-trust-logo">Zomato</span>
              <span className="lp-trust-logo">Meesho</span>
              <span className="lp-trust-logo">Razorpay</span>
            </div>
          </ScrollReveal>
        </section>
        <section className="lp-section lp-pain-solution-section">
          <ScrollReveal className="lp-section-header">
            <div className="lp-pill-badge lp-badge-amber">The Hidden Reason 80% Stumble in Interviews</div>
            <h2>You practice silently in your head. <br />But you interview out loud under pressure.</h2>
            <p>
              When you rehearse answers in your thoughts, your brain forgives stumbles, skips detail gaps, and ignores filler words. In real interviews, cold pressure causes hesitation and panic.
            </p>
          </ScrollReveal>

          <div className="lp-comparison-grid">
            {/* The Flawed Way */}
            <ScrollReveal className="lp-compare-card lp-card-pain" delay={0.08} y={30}>
              <div className="lp-compare-header">
                <div className="lp-compare-icon-wrap lp-pain-icon">
                  <XCircle size={24} />
                </div>
                <div>
                  <h3>The Solo Prep Trap</h3>
                  <span>Practicing in silence or asking polite friends</span>
                </div>
              </div>

              <ul className="lp-compare-list">
                <li>
                  <XCircle size={18} className="lp-x-icon" />
                  <div>
                    <strong>Silent rehearsal creates false confidence:</strong>
                    <p>Your mind doesn't stutter in your head. When forced to speak aloud, sentences wander and you lose track of your point.</p>
                  </div>
                </li>
                <li>
                  <XCircle size={18} className="lp-x-icon" />
                  <div>
                    <strong>Friends & family give polite, vague feedback:</strong>
                    <p>"You sounded great!" won't tell you that you said "um" 28 times and stared down at your desk during key technical explanations.</p>
                  </div>
                </li>
                <li>
                  <XCircle size={18} className="lp-x-icon" />
                  <div>
                    <strong>Zero objective telemetry:</strong>
                    <p>You have no idea whether your speech pacing accelerated to 180 WPM or your vocal tone lost authority under cross-examination.</p>
                  </div>
                </li>
                <li>
                  <XCircle size={18} className="lp-x-icon" />
                  <div>
                    <strong>One single mistake burns a dream offer:</strong>
                    <p>Fumbling an early question can cost you a $30,000–$80,000 compensation package before the 30-minute mark.</p>
                  </div>
                </li>
              </ul>
            </ScrollReveal>

            {/* The Confidometer Way */}
            <ScrollReveal className="lp-compare-card lp-card-solution" delay={0.2} y={30}>
              <div className="lp-compare-header">
                <div className="lp-compare-icon-wrap lp-solution-icon">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3>The Confidometer Advantage</h3>
                  <span>Scientific, real-time AI telemetry & unlimited safe reps</span>
                </div>
              </div>

              <ul className="lp-compare-list">
                <li>
                  <CheckCircle2 size={18} className="lp-check-icon" />
                  <div>
                    <strong>Speak out loud to an adaptive AI interviewer:</strong>
                    <p>Liza listens, interrupts when needed, and asks probing follow-up questions just like a seasoned hiring bar-raiser.</p>
                  </div>
                </li>
                <li>
                  <CheckCircle2 size={18} className="lp-check-icon" />
                  <div>
                    <strong>12+ cold, objective telemetry metrics:</strong>
                    <p>Instant precision feedback on eye contact %, vocal stability, pitch tremors, filler frequency, and answer completeness.</p>
                  </div>
                </li>
                <li>
                  <CheckCircle2 size={18} className="lp-check-icon" />
                  <div>
                    <strong>Instant transcripts & coaching suggestions:</strong>
                    <p>See the exact sentences where your answer lost clarity, with AI suggestions on how to reframe your points cleanly.</p>
                  </div>
                </li>
                <li>
                  <CheckCircle2 size={18} className="lp-check-icon" />
                  <div>
                    <strong>Desensitize the anxiety with unlimited practice:</strong>
                    <p>Practice in complete privacy at 2 AM. By interview day, answering difficult questions feels like second nature.</p>
                  </div>
                </li>
              </ul>
            </ScrollReveal>
          </div>
        </section>


        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 4: HOW IT WORKS ("This looks easy")
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section id="how-it-works" className="lp-section lp-how-section">
          <ScrollReveal className="lp-section-header">
            <div className="lp-pill-badge lp-badge-teal">Simple 3-Step Process</div>
            <h2>From nervous to interview-ready in under 5 minutes.</h2>
            <p>No mentor scheduling. No awkwardness. Zero setup friction.</p>
          </ScrollReveal>

          <div className="lp-steps-grid">
            {/* Step 1 */}
            <ScrollReveal className="lp-step-card" delay={0.08} y={30}>
              <div className="lp-step-number">01</div>
              <div className="lp-step-icon-box">
                <FileText size={26} />
              </div>
              <h3>Upload Resume or Select Role</h3>
              <p>
                Drop your resume PDF or choose from curated job profiles at top companies. Confidometer’s AI extracts your exact skills and generates role-specific interview challenges.
              </p>
              <div className="lp-step-footer-pill">
                <span>Tailored questions generated in 5s</span>
              </div>
            </ScrollReveal>

            {/* Step 2 */}
            <ScrollReveal className="lp-step-card" delay={0.18} y={30}>
              <div className="lp-step-number">02</div>
              <div className="lp-step-icon-box">
                <Video size={26} />
              </div>
              <h3>Speak Naturally to Liza on Camera</h3>
              <p>
                Turn on your camera and mic. Liza asks real interview questions, reacts dynamically to your answers, and monitors your eye contact, pacing, and vocal tremors in real time.
              </p>
              <div className="lp-step-footer-pill">
                <span>Real-time HUD visual guidance</span>
              </div>
            </ScrollReveal>

            {/* Step 3 */}
            <ScrollReveal className="lp-step-card" delay={0.28} y={30}>
              <div className="lp-step-number">03</div>
              <div className="lp-step-icon-box">
                <Award size={26} />
              </div>
              <h3>Get Your 12-Metric Scorecard</h3>
              <p>
                Instantly review your session scorecard: filler word breakdown, eye contact stability %, vocal cadence score, full transcript, and actionable coaching tips to ace your next round.
              </p>
              <div className="lp-step-footer-pill">
                <span>Detailed improvement roadmap</span>
              </div>
            </ScrollReveal>
          </div>

          <ScrollReveal className="lp-how-cta" delay={0.32}>
            <Link href="/upload" className="button primary lp-btn-lg">
              <span>Try Your First Round Free</span>
              <ArrowRight size={18} />
            </Link>
          </ScrollReveal>
        </section>


        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 5: FEATURE SPOTLIGHT 1 — AI MOCK INTERVIEWS ("This can solve it")
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="lp-section">
          <div className="lp-feature lp-feature-normal">
            <ScrollReveal className="lp-feature-text" delay={0.08} y={26}>
              <span className="lp-feature-badge" style={{ color: "#16a085" }}>
                <Bot size={16} /> Flagship AI Mock Interview
              </span>
              <h2>Face realistic interview pressure. Zero judgment.</h2>
              <p>
                Simulate full 20 to 45-minute interviews with Liza. Pick between Technical, HR, Behavioral STAR, LeetCode DSA, or Salary Negotiation. Liza probes your answers dynamically with realistic follow-up questions just like a senior hiring manager.
              </p>
              
              <div className="lp-feature-bullets">
                <div className="lp-f-bullet">
                  <CheckCircle2 size={16} className="lp-green" />
                  <span><strong>Dynamic Follow-ups:</strong> If your answer is vague, Liza pushes deeper on trade-offs and specifics.</span>
                </div>
                <div className="lp-f-bullet">
                  <CheckCircle2 size={16} className="lp-green" />
                  <span><strong>Live Visual & Vocal HUD:</strong> Real-time on-screen indicators keep your eye contact locked and pacing steady.</span>
                </div>
                <div className="lp-f-bullet">
                  <CheckCircle2 size={16} className="lp-green" />
                  <span><strong>Instant Re-Write Suggestions:</strong> See how to re-structure your answer using proven frameworks.</span>
                </div>
              </div>

              <Link href="/upload" className="lp-feature-link">
                Start AI Mock Interview <ArrowRight size={16} />
              </Link>
            </ScrollReveal>

            <ScrollReveal className="lp-feature-visual" delay={0.18} y={26}>
              <div className="lp-visual-ai-interview">
                <div className="lp-vai-header">
                  <div className="lp-vai-tag">
                    <span className="lp-vai-dot" /> LIVE SESSION
                  </div>
                  <span className="lp-vai-type">Technical • Senior Role</span>
                </div>
                <div className="lp-vai-body">
                  <div className="lp-vai-msg lp-vai-ai">
                    <Bot size={16} className="lp-vai-icon" />
                    <div>
                      <div className="lp-vai-sender">Liza</div>
                      <p>"How did you ensure data consistency across distributed microservices during high peak load?"</p>
                    </div>
                  </div>
                  <div className="lp-vai-msg lp-vai-user">
                    <User size={16} className="lp-vai-icon" />
                    <div>
                      <div className="lp-vai-sender">You (Candidate)</div>
                      <p>"We implemented an outbox pattern with transactional messaging via Kafka, which allowed us to maintain eventual consistency..."</p>
                    </div>
                  </div>
                  <div className="lp-vai-metrics-row">
                    <div className="lp-v-metric">
                      <span>Eye Contact</span>
                      <strong>92%</strong>
                    </div>
                    <div className="lp-v-metric">
                      <span>Pacing</span>
                      <strong>134 WPM</strong>
                    </div>
                    <div className="lp-v-metric">
                      <span>Fillers</span>
                      <strong style={{ color: "#16a085" }}>0</strong>
                    </div>
                    <div className="lp-v-metric">
                      <span>Clarity</span>
                      <strong>9.4/10</strong>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>


        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 6: FEATURE SPOTLIGHT 2 — GET SET SPEAK ("This can solve it")
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="lp-section">
          <div className="lp-feature lp-feature-reverse">
            <ScrollReveal className="lp-feature-text" delay={0.16} y={26}>
              <span className="lp-feature-badge" style={{ color: "#b45309" }}>
                <Mic size={16} /> Get Set Speak — Impromptu Drills
              </span>
              <h2>Spin. Speak. Master thinking on your feet.</h2>
              <p>
                Can you articulate a coherent argument when hit with an unexpected curveball question? Pull the slot machine lever to spin for random topics, speak for 60 seconds against the clock, and get scored instantly on filler words and vocal confidence.
              </p>
              
              <div className="lp-feature-bullets">
                <div className="lp-f-bullet">
                  <CheckCircle2 size={16} className="lp-amber-text" />
                  <span><strong>Slot Machine Topic Generator:</strong> Hundreds of curated tech, behavioral, and creative prompts.</span>
                </div>
                <div className="lp-f-bullet">
                  <CheckCircle2 size={16} className="lp-amber-text" />
                  <span><strong>60-Second Pressure Clock:</strong> Trains your brain to structure thoughts quickly under time constraints.</span>
                </div>
                <div className="lp-f-bullet">
                  <CheckCircle2 size={16} className="lp-amber-text" />
                  <span><strong>Filler Word Eliminator:</strong> Identifies hesitation patterns so you speak with crisp executive presence.</span>
                </div>
              </div>

              <Link href="/speak" className="lp-feature-link" style={{ color: "#b45309" }}>
                Spin the lever now <ArrowRight size={16} />
              </Link>
            </ScrollReveal>

            <ScrollReveal className="lp-feature-visual" delay={0.08} y={26}>
              <div className="lp-visual-speak">
                <div className="lp-speak-prompt-header">
                  <Sparkles size={16} className="lp-prompt-spark" />
                  <span>Slot Machine Topic Reels</span>
                </div>
                <div className="lp-speak-prompt-body">
                  <div className="lp-slot-reels-mock">
                    <span className="lp-reel-pill" style={{ background: "rgba(217, 119, 6, 0.1)", color: "#b45309", border: "1px solid rgba(217, 119, 6, 0.25)" }}>🟡 Medium Difficulty</span>
                    <span className="lp-reel-pill" style={{ background: "rgba(22, 160, 133, 0.1)", color: "#16a085", border: "1px solid rgba(22, 160, 133, 0.25)" }}>🔮 Product Strategy</span>
                  </div>
                  <div className="lp-slot-question-mock">
                    "Should companies prioritize feature velocity or technical debt reduction during hyper-growth? Defend your stance."
                  </div>
                </div>
                <div className="lp-speak-rec-indicator">
                  <span className="lp-rec-dot" />
                  <span>1 MINUTE TIMER READY • CAMERA ACTIVE</span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>


        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 7: FEATURE SPOTLIGHT 3 — PEER-TO-PEER MOCK ("This can solve it")
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="lp-section">
          <div className="lp-feature lp-feature-normal">
            <ScrollReveal className="lp-feature-text" delay={0.08} y={26}>
              <span className="lp-feature-badge" style={{ color: "#0f766e" }}>
                <Users size={16} /> Peer-to-Peer Mock Interviews
              </span>
              <h2>Ready for humans? Match with fellow candidates.</h2>
              <p>
                Pair up 1-on-1 with candidates targeting top engineering and product roles. Take turns acting as interviewer and candidate, supported by structured rubrics and automated AI telemetry running in the background for both participants.
              </p>
              
              <div className="lp-feature-bullets">
                <div className="lp-f-bullet">
                  <CheckCircle2 size={16} className="lp-teal-text" />
                  <span><strong>Curated Peer Matching:</strong> Connect with candidates targeting similar roles and seniority.</span>
                </div>
                <div className="lp-f-bullet">
                  <CheckCircle2 size={16} className="lp-teal-text" />
                  <span><strong>Structured Rubrics:</strong> Built-in question banks and evaluation criteria keep rounds rigorous.</span>
                </div>
                <div className="lp-f-bullet">
                  <CheckCircle2 size={16} className="lp-teal-text" />
                  <span><strong>Automated Joint Telemetry:</strong> Both peers receive objective vocal and visual analysis after the call.</span>
                </div>
              </div>

              <Link href="/peer" className="lp-feature-link">
                Find a practice peer <ArrowRight size={16} />
              </Link>
            </ScrollReveal>

            <ScrollReveal className="lp-feature-visual" delay={0.18} y={26}>
              <div className="lp-visual-peer">
                <div className="lp-peer-card">
                  <div className="lp-peer-avatar">A</div>
                  <div className="lp-peer-info">
                    <strong>Anshu</strong>
                    <span>Software Engineer • Google Prep</span>
                  </div>
                  <span className="lp-peer-status lp-peer-live">● Live Call</span>
                </div>
                <div className="lp-peer-connector">⟷</div>
                <div className="lp-peer-card">
                  <div className="lp-peer-avatar">B</div>
                  <div className="lp-peer-info">
                    <strong>Bob</strong>
                    <span>Frontend Architect • Microsoft Prep</span>
                  </div>
                  <span className="lp-peer-status lp-peer-waiting">● Matched</span>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </section>


        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 8: 5 SPECIALIZED INTERVIEW FORMATS
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="lp-section lp-types-section">
          <ScrollReveal className="lp-section-header">
            <div className="lp-pill-badge lp-badge-teal">Comprehensive Coverage</div>
            <h2>Five ways to practice. One powerful platform.</h2>
            <p>Every stage of the modern hiring loop requires a distinct skill set. Master them all.</p>
          </ScrollReveal>

          <div className="lp-types-grid-new">
            {INTERVIEW_TYPES.map((type, idx) => (
              <ScrollReveal
                key={type.id}
                className="lp-type-card-new"
                delay={idx * 0.08}
                style={{ borderTop: `4px solid ${type.color}` }}
              >
                <div className="lp-type-card-top">
                  <div className="lp-type-icon-box" style={{ color: type.color, background: `${type.color}14` }}>
                    {type.icon}
                  </div>
                  <span className="lp-type-tag" style={{ color: type.color, background: `${type.color}10` }}>
                    {type.tag}
                  </span>
                </div>
                <div className="lp-type-card-badge">{type.badge}</div>
                <h3>{type.label}</h3>
                <p>{type.description}</p>
                <Link href="/upload" className="lp-type-card-action">
                  <span>Practice this format</span>
                  <ArrowRight size={14} />
                </Link>
              </ScrollReveal>
            ))}
          </div>
        </section>


        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 9: 12+ METRICS TELEMETRY GRID ("This is thorough")
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="lp-section lp-metrics-section">
          <ScrollReveal className="lp-section-header">
            <div className="lp-pill-badge lp-badge-teal">Scientific Telemetry</div>
            <h2>12+ metrics. Zero guesswork.</h2>
            <p>We measure what human interviewers notice instinctively but never explain to you in rejection emails.</p>
          </ScrollReveal>

          <ScrollReveal delay={0.1} className="lp-metrics-detailed-grid">
            {METRICS.map((m) => (
              <div key={m.label} className="lp-metric-card-box">
                <div className="lp-metric-box-icon">{m.icon}</div>
                <div className="lp-metric-box-content">
                  <h4>{m.label}</h4>
                  <p>{m.desc}</p>
                </div>
              </div>
            ))}
          </ScrollReveal>

          <ScrollReveal delay={0.16} className="lp-metrics-extras">
            <div className="lp-extra-item">
              <BarChart3 size={24} />
              <div>
                <h4>Longitudinal Progress Tracking</h4>
                <p>Visual trendlines showing your eye contact stability, filler reduction, and answer scores improving session-by-session.</p>
                <div className="lp-extra-cta-wrap">
                  <Link href="/dashboard" className="button primary lp-btn-telemetry">
                    <span>Explore Your Telemetry Dashboard</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
            <div className="lp-extra-item">
              <Award size={24} />
              <div>
                <h4>Skill Milestones & Badges</h4>
                <p>Earn calibrated milestone badges for consistency, sub-1% filler rate, and master-level STAR storytelling.</p>
              </div>
            </div>
            <div className="lp-extra-item">
              <Timer size={24} />
              <div>
                <h4>Daily Practice Streak</h4>
                <p>Build unshakeable muscle memory. Complete just 10 minutes a day to keep your streak alive and stay interview-sharp.</p>
              </div>
            </div>
          </ScrollReveal>
        </section>


        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 10: COMPANY-SPECIFIC PRACTICE ROUNDS ("This is relevant to me")
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="lp-section lp-company-section">
          <ScrollReveal className="lp-dotted-box">
            <div className="lp-section-header">
              <h2>We'll craft a mock interview experience that prepares you to step into future with confidence.</h2>
              <p style={{ marginTop: "8px" }}>Targeting top engineering & product teams? Practice with interview formats modeled after their real hiring standards.</p>
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
          </ScrollReveal>
        </section>


        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 11: FREQUENTLY ASKED QUESTIONS (FAQ)
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="lp-section lp-faq-section">
          <ScrollReveal className="lp-section-header">
            <div className="lp-pill-badge lp-badge-teal">Common Questions</div>
            <h2>Everything you need to know before starting.</h2>
            <p>Have questions? We have answers. No hidden fees, no complicated downloads.</p>
          </ScrollReveal>

          <ScrollReveal delay={0.1} className="lp-faq-accordion">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className={`lp-faq-item ${isOpen ? "lp-faq-item-open" : ""}`}
                  onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                >
                  <div className="lp-faq-question">
                    <span>{faq.q}</span>
                    <ChevronDown size={20} className={`lp-faq-chevron ${isOpen ? "lp-chevron-rotated" : ""}`} />
                  </div>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="lp-faq-answer"
                      >
                        <p>{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </ScrollReveal>
        </section>


        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 13: FINAL CONVERSION CTA ("I want to try it")
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <section className="lp-section lp-final-cta-section">
          <ScrollReveal className="lp-final-cta-card" y={32} duration={0.65}>
            <span className="lp-pill-badge lp-badge-amber">Ready to Take Control?</span>
            <h2>Your next interview is closer than you think.</h2>
            <p>
              Stop guessing how you come across to recruiters. Get cold telemetry, eliminate filler words, and walk in with unshakeable confidence.
            </p>

            <div className="lp-final-cta-buttons">
              <Link href="/upload" className="lp-btn-cta-primary lp-btn-glow">
                <span>Start Your Free Mock Interview</span>
                <ArrowRight size={18} />
              </Link>
              <Link href="/speak" className="lp-btn-cta-secondary">
                <span>Try Get Set Speak Drills</span>
              </Link>
            </div>

            <div className="lp-final-micro-trust">
              <span>✓ 100% Free mock practice</span>
              <span className="lp-reassure-dot">•</span>
              <span>✓ Ready in under 60 seconds</span>
            </div>
          </ScrollReveal>
        </section>


        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            SECTION 14: COMPREHENSIVE FOOTER
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <footer className="lp-footer-v2">
          <div className="lp-footer-grid">
            {/* Col 1: Brand & Mission */}
            <div className="lp-footer-col lp-footer-col-brand">
              <BrandLogo size={32} showText={true} />
              <p className="lp-footer-tagline">
                The real-time AI interview coaching platform that analyzes your vocal delivery, eye contact, and answer structure to build unshakeable confidence.
              </p>
              <div className="lp-footer-social-strip">
                <span className="lp-badge-social">AI-Powered</span>
                <span className="lp-badge-social">Real-Time Telemetry</span>
                <span className="lp-badge-social">Browser Native</span>
              </div>
            </div>

            {/* Col 2: Practice Modes */}
            <div className="lp-footer-col">
              <h4>Practice Modes</h4>
              <ul>
                <li><Link href="/upload">AI Mock Interview</Link></li>
                <li><Link href="/upload">DSA Coding Challenge</Link></li>
                <li><Link href="/speak">Get Set Speak (Impromptu)</Link></li>
                <li><Link href="/peer">Peer-to-Peer Mock</Link></li>
                <li><Link href="/upload">Salary Negotiation</Link></li>
              </ul>
            </div>

            {/* Col 3: Platform Tools */}
            <div className="lp-footer-col">
              <h4>Platform & Telemetry</h4>
              <ul>
                <li><Link href="/dashboard">Confidence Dashboard</Link></li>
                <li><Link href="/history">Session History</Link></li>
                <li><Link href="/autoapply">ApplyBuddy Engine</Link></li>
                <li><a href="#how-it-works">How It Works</a></li>
                <li><Link href="/dashboard">12+ Telemetry Metrics</Link></li>
              </ul>
            </div>

            {/* Col 4: Trust & Support */}
            <div className="lp-footer-col">
              <h4>Trust & Legal</h4>
              <ul>
                <li><Link href="/privacy-policy">Privacy Policy</Link></li>
                <li><Link href="/terms-of-use">Terms of Use</Link></li>
                <li><Link href="/faq">FAQ & Help Center</Link></li>
                <li><a href="mailto:support@confidometer.online">Contact Support</a></li>
              </ul>
            </div>
          </div>

          <div className="lp-footer-bottom-bar">
            <div className="lp-footer-bottom-copy">
              © {new Date().getFullYear()} Confidometer. All rights reserved.
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
