"use client";

import Link from "next/link";
import {
  HelpCircle,
  Brain,
  Video,
  Terminal,
  Lock,
  Activity,
  Users,
  Sparkles,
  ShieldCheck,
  FileText,
  ChevronRight,
  ArrowUp,
  Headphones,
  Zap,
  Globe,
  Mail,
  CheckCircle2
} from "lucide-react";
import "../privacy-policy/styles.css";

const TOC_ITEMS = [
  { id: "overview", label: "1. What is Confidometer & How It Works", icon: HelpCircle },
  { id: "hardware", label: "2. Camera, Microphone & Device Requirements", icon: Video },
  { id: "rounds", label: "3. Practice Rounds & Interview Types", icon: Brain },
  { id: "dsa", label: "4. DSA Coding Round & Integrated Editor", icon: Terminal },
  { id: "stress", label: "5. Stress Simulation Mode", icon: ShieldCheck },
  { id: "telemetry", label: "6. Real-Time Telemetry & Scoring", icon: Activity },
  { id: "peer", label: "7. Peer-to-Peer Mock Interviews", icon: Users },
  { id: "feedback", label: "8. Audio Narration & Feedback Reports", icon: Headphones },
  { id: "security", label: "9. Video Security & Resume Privacy", icon: Lock },
  { id: "applybuddy", label: "10. ApplyBuddy & Automated Job Tracking", icon: Zap }
];

export default function FAQPage() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="privacy-page">
      {/* ── Hero Header ── */}
      <section className="privacy-hero glass">
        <div className="privacy-badge-wrap">
          <HelpCircle size={16} />
          <span>Knowledge Base & Support</span>
        </div>
        <h1>Frequently Asked Questions</h1>
        <p className="privacy-hero-subtitle">
          Everything you need to know about preparing with Confidometer, mastering AI mock interviews, 
          and tracking your confidence progression.
        </p>
        <div className="privacy-meta-info">
          <span className="privacy-meta-item">
            <strong>Platform:</strong> Confidometer AI Prep
          </span>
          <span>•</span>
          <span className="privacy-meta-item">
            <strong>Last Updated:</strong> August 2026
          </span>
          <span>•</span>
          <span className="privacy-meta-item">
            <strong>Entity:</strong> Confidometer Team
          </span>
        </div>
      </section>

      {/* ── Key Highlights Callout ── */}
      <section className="privacy-highlights-card glass">
        <div className="privacy-highlights-header">
          <Sparkles size={20} className="highlight-pill-icon" />
          <h3>Confidometer at a Glance</h3>
        </div>
        <div className="privacy-highlights-grid">
          <div className="privacy-highlight-pill">
            <Brain size={20} className="highlight-pill-icon" />
            <div className="highlight-pill-text">
              <strong>5 Interview Rounds</strong>
              <span>Technical, HR, DSA Coding, Behavioural, and Salary Negotiation tailored to your resume.</span>
            </div>
          </div>
          <div className="privacy-highlight-pill">
            <Activity size={20} className="highlight-pill-icon" />
            <div className="highlight-pill-text">
              <strong>Real-Time Telemetry</strong>
              <span>Live tracking of eye contact, speech rate variance, fidgeting gestures, and filler words.</span>
            </div>
          </div>
          <div className="privacy-highlight-pill">
            <Lock size={20} className="highlight-pill-icon" />
            <div className="highlight-pill-text">
              <strong>Ephemeral Video Processing</strong>
              <span>Raw webcam video is analyzed client-side and never permanently archived or sold.</span>
            </div>
          </div>
          <div className="privacy-highlight-pill">
            <Zap size={20} className="highlight-pill-icon" />
            <div className="highlight-pill-text">
              <strong>Automated Feedback</strong>
              <span>Download comprehensive written diagnostic reports or listen to realistic audio narration.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Layout: Table of Contents + FAQ Content ── */}
      <div className="privacy-layout-grid">
        {/* Sticky Table of Contents Sidebar */}
        <aside className="privacy-toc-sidebar">
          <div className="privacy-toc-card glass">
            <h4 className="privacy-toc-title">Quick Navigation</h4>
            <nav className="privacy-toc-nav" aria-label="FAQ Navigation">
              {TOC_ITEMS.map((item) => {
                const IconComponent = item.icon;
                return (
                  <a key={item.id} href={`#${item.id}`} className="privacy-toc-link">
                    <IconComponent size={16} className="toc-icon" />
                    <span>{item.label}</span>
                    <ChevronRight size={14} className="toc-chevron" />
                  </a>
                );
              })}
            </nav>
            <div className="privacy-toc-footer">
              <Link href="/privacy-policy" className="button ghost" style={{ width: "100%", justifyContent: "center", fontSize: "0.85rem", marginBottom: "8px" }}>
                Privacy Policy
              </Link>
              <Link href="/terms-of-use" className="button ghost" style={{ width: "100%", justifyContent: "center", fontSize: "0.85rem" }}>
                Terms of Use
              </Link>
            </div>
          </div>
        </aside>

        {/* FAQ Body Sections */}
        <main className="privacy-content-body">
          
          {/* Section 1: Overview */}
          <section id="overview" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <HelpCircle size={24} className="section-icon" />
              <h2>1. What is Confidometer and how does it work?</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                Confidometer is an advanced AI-powered interview preparation platform designed to help candidates 
                build unshakable composure, master technical problem-solving, and ace high-stakes job interviews.
              </p>
              <p>
                When you begin a session:
              </p>
              <ul>
                <li>
                  <strong>Resume Parsing:</strong> Our platform parses your uploaded resume in-memory to extract your past technical projects, core competencies, and career progression.
                </li>
                <li>
                  <strong>Target Role Customization:</strong> You specify your target role, seniority level, and target company (e.g., Google, Netflix, Zomato, Meesho, Nykaa).
                </li>
                <li>
                  <strong>Live AI Simulation:</strong> Liza, our AI recruiter, conducts a conversational interview, dynamically adapting her follow-up questions to your responses.
                </li>
                <li>
                  <strong>Multi-Modal Analytics:</strong> While you speak, background engines analyze your vocal tone, pause duration, filler word density, and facial stability in real time.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 2: Hardware */}
          <section id="hardware" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Video size={24} className="section-icon" />
              <h2>2. Do I need a camera and microphone to practice?</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                For the full immersive experience, a standard webcam and microphone are highly recommended. These enable our 
                real-time visual and biometric telemetry features:
              </p>
              <ul>
                <li><strong>Eye Contact Consistency:</strong> Measures whether you look toward the interviewer or frequently look away.</li>
                <li><strong>Head Stability & Gestures:</strong> Detects nervous fidgeting, rapid head tilts, and hand mannerisms.</li>
                <li><strong>Vocal Stability & Speech Rate:</strong> Measures words-per-minute pacing and sudden vocal volume fluctuations.</li>
              </ul>
              <p>
                <strong>Alternative Modes:</strong> If you are in a quiet environment or lack a webcam, you can toggle audio-only mode 
                or practice in text response mode.
              </p>
            </div>
          </section>

          {/* Section 3: Practice Rounds */}
          <section id="rounds" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Brain size={24} className="section-icon" />
              <h2>3. What interview rounds and practice types are supported?</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                Confidometer supports five core interview rounds, covering the entire end-to-end hiring cycle:
              </p>
              <div className="privacy-sub-grid">
                <div className="privacy-sub-card">
                  <h4>Technical Round</h4>
                  <p>In-depth architecture, system design, and role-specific technology questions dynamically derived from your resume.</p>
                </div>
                <div className="privacy-sub-card">
                  <h4>HR & Culture Fit</h4>
                  <p>Evaluates career motivations, conflict resolution, teamwork dynamics, and cross-functional leadership.</p>
                </div>
                <div className="privacy-sub-card">
                  <h4>DSA Coding</h4>
                  <p>LeetCode-style algorithms with live in-browser compiler, code execution sandbox, and automated test cases.</p>
                </div>
                <div className="privacy-sub-card">
                  <h4>STAR Behavioural</h4>
                  <p>Structured Situation, Task, Action, Result questions to refine your storytelling and personal impact metrics.</p>
                </div>
                <div className="privacy-sub-card">
                  <h4>Salary Negotiation</h4>
                  <p>Simulates offer discussions, competing offer leverage, and total compensation negotiation tactics.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: DSA Coding */}
          <section id="dsa" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Terminal size={24} className="section-icon" />
              <h2>4. How does the DSA Coding round work?</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                The DSA Coding round places you in an authentic technical interview environment equipped with:
              </p>
              <ul>
                <li><strong>2 Curated Problems:</strong> One Easy and one Medium algorithm problem tailored to top tech company standards.</li>
                <li><strong>Integrated Code Editor:</strong> Monaco-based code editor with syntax highlighting, indentation, and keybindings.</li>
                <li><strong>Multi-Language Sandbox:</strong> Execute code in Python, JavaScript, C++, or Java directly within your browser.</li>
                <li><strong>Automated Test Suites:</strong> Run sample test cases and edge cases with instantaneous execution output and runtime error diagnostics.</li>
                <li><strong>30-Minute Countdown:</strong> Simulates authentic time pressure so you learn to pace problem breakdown, implementation, and dry running.</li>
              </ul>
            </div>
          </section>

          {/* Section 5: Stress Mode */}
          <section id="stress" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <ShieldCheck size={24} className="section-icon" />
              <h2>5. What is Stress Simulation Mode?</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                Stress Mode is designed for advanced preparation, specifically targeting composure breakdown under high pressure.
              </p>
              <p>
                When Stress Mode is toggled:
              </p>
              <ul>
                <li>Liza introduces deliberate interruptions, rapid follow-ups, and skeptical pushback against your technical claims.</li>
                <li>Strict countdown timers enforce quick, concise thinking without room for rambling.</li>
                <li>The analytics engine tracks your fidgeting index, vocal tremors, and speech pace variance to generate a Stress Tolerance Score.</li>
              </ul>
            </div>
          </section>

          {/* Section 6: Telemetry & Scoring */}
          <section id="telemetry" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Activity size={24} className="section-icon" />
              <h2>6. How does real-time telemetry and scoring work?</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                Confidometer computes 12+ quantitative confidence metrics using client-side sensor fusion:
              </p>
              <ul>
                <li><strong>Gaze Stability & Eye Contact:</strong> Percentage of interview time spent looking directly at the camera.</li>
                <li><strong>Vocal Stability:</strong> Pitch stability, audio volume consistency, and elimination of vocal fry or wavering.</li>
                <li><strong>Filler Word Counter:</strong> Tracks "um", "ah", "like", "you know", and repetitive speech crutches.</li>
                <li><strong>Speech Velocity (WPM):</strong> Identifies rushed responses (over 160 WPM) or sluggish delivery (under 100 WPM).</li>
                <li><strong>Content Coherence:</strong> Evaluates structure, STAR methodology adherence, and technical depth.</li>
              </ul>
            </div>
          </section>

          {/* Section 7: Peer Mock */}
          <section id="peer" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Users size={24} className="section-icon" />
              <h2>7. Can I practice mock interviews with real peers?</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                Yes! Our <strong>Peer Mock</strong> feature enables real human-to-human interview simulations:
              </p>
              <ul>
                <li><strong>Role Matching:</strong> Connects you with peers preparing for identical or complementary roles (e.g., Frontend, Backend, Product Management).</li>
                <li><strong>Dual Perspective:</strong> You alternate turns between Interviewer (with AI-generated rubrics and answer keys) and Interviewee.</li>
                <li><strong>Mutual Telemetry:</strong> Both participants receive automated objective telemetry and mutual candidate feedback scores.</li>
              </ul>
            </div>
          </section>

          {/* Section 8: Audio & Reports */}
          <section id="feedback" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Headphones size={24} className="section-icon" />
              <h2>8. How do feedback reports and audio narration work?</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                Immediately after each session, you receive two personalized review options:
              </p>
              <ul>
                <li>
                  <strong>Comprehensive Written Diagnostics:</strong> A downloadable report breaking down question-by-question performance, 
                  highlighting exact timestamps of filler words, and providing sample improved answers.
                </li>
                <li>
                  <strong>Realistic Audio Narration:</strong> Listen to Liza narrate a spoken summary of your strengths and tactical areas for improvement, 
                  allowing you to review your feedback hands-free.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 9: Security */}
          <section id="security" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Lock size={24} className="section-icon" />
              <h2>9. Is my resume and video data stored securely?</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                Yes, privacy and confidentiality are foundational to Confidometer:
              </p>
              <ul>
                <li><strong>No Permanent Video Recordings:</strong> Video chunks are analyzed in real time in your browser memory and discarded immediately.</li>
                <li><strong>In-Memory Resume Parsing:</strong> Resumes are processed strictly for tailoring questions and are never shared with employers without your consent.</li>
                <li><strong>Zero Data Monetization:</strong> We do not sell your personal information, contact details, or performance scores to data brokers.</li>
              </ul>
              <p>
                For complete technical details, please review our <Link href="/privacy-policy" style={{ color: "var(--teal, #16a085)", fontWeight: 600 }}>Privacy Policy</Link>.
              </p>
            </div>
          </section>

          {/* Section 10: ApplyBuddy */}
          <section id="applybuddy" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Zap size={24} className="section-icon" />
              <h2>10. What is ApplyBuddy and automated job tracking?</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                ApplyBuddy is our integrated career acceleration tool designed to eliminate manual job application fatigue:
              </p>
              <ul>
                <li><strong>Job Matcher:</strong> Continuously monitors target job boards for roles matching your resume skills and salary criteria.</li>
                <li><strong>Automated Form Completion:</strong> Automatically fills repetitive application fields using your pre-verified candidate profile.</li>
                <li><strong>Status Dashboard:</strong> Tracks applications through Submitted, Under Review, Interviewing, and Offered stages.</li>
              </ul>
              <p>
                For terms regarding automated tools, see our <Link href="/terms-of-use" style={{ color: "var(--teal, #16a085)", fontWeight: 600 }}>Terms of Use</Link>.
              </p>
              
              <div className="contact-box" style={{ marginTop: "32px" }}>
                <h4>Still Have Questions?</h4>
                <p>We're here to help you get the most out of your interview preparation:</p>
                <div className="contact-details">
                  <span className="contact-item">
                    <Mail size={16} /> <strong>Email:</strong> support@confidometer.online
                  </span>
                  <span className="contact-item">
                    <Globe size={16} /> <strong>Website:</strong> https://www.confidometer.online
                  </span>
                </div>
              </div>
            </div>
          </section>

        </main>
      </div>

      {/* ── Floating Scroll-to-Top Button ── */}
      <button 
        type="button" 
        onClick={scrollToTop} 
        className="privacy-scroll-top-btn glass"
        title="Scroll to top"
        aria-label="Scroll to top of FAQ"
      >
        <ArrowUp size={18} />
      </button>
    </div>
  );
}
