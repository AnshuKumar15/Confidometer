"use client";

import Link from "next/link";
import {
  ShieldCheck,
  Eye,
  Lock,
  FileText,
  Server,
  UserCheck,
  Trash2,
  Cookie,
  AlertCircle,
  Mail,
  ChevronRight,
  ArrowUp,
  Brain,
  Video,
  Database,
  Globe
} from "lucide-react";
import "./styles.css";

const TOC_ITEMS = [
  { id: "overview", label: "1. Overview & Scope", icon: ShieldCheck },
  { id: "information-collected", label: "2. Information We Collect", icon: Database },
  { id: "video-biometrics", label: "3. Video & Biometric Processing", icon: Video },
  { id: "how-we-use", label: "4. How We Use Your Data", icon: Brain },
  { id: "third-party", label: "5. Third-Party Services & AI", icon: Globe },
  { id: "storage-security", label: "6. Data Storage & Security", icon: Lock },
  { id: "retention", label: "7. Data Retention & Deletion", icon: Trash2 },
  { id: "user-rights", label: "8. Your Rights & Controls", icon: UserCheck },
  { id: "cookies", label: "9. Cookies & Storage", icon: Cookie },
  { id: "children", label: "10. Children's Privacy", icon: AlertCircle },
  { id: "contact", label: "11. Contact & Inquiries", icon: Mail }
];

export default function PrivacyPolicyPage() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="privacy-page">
      {/* ── Hero Header ── */}
      <section className="privacy-hero glass">
        <div className="privacy-badge-wrap">
          <ShieldCheck size={16} />
          <span>Privacy & Data Protection</span>
        </div>
        <h1>Privacy Policy</h1>
        <p className="privacy-hero-subtitle">
          At Confidometer, we are committed to transparent, secure, and respectful handling
          of your personal data, interview performance telemetry, and career profiles.
        </p>
        <div className="privacy-meta-info">
          <span className="privacy-meta-item">
            <strong>Effective Date:</strong> August 17, 2026
          </span>
          <span>•</span>
          <span className="privacy-meta-item">
            <strong>Last Updated:</strong> August 17, 2026
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
          <ShieldCheck size={20} className="highlight-pill-icon" />
          <h3>Privacy Principles at a Glance</h3>
        </div>
        <div className="privacy-highlights-grid">
          <div className="privacy-highlight-pill">
            <Video size={20} className="highlight-pill-icon" />
            <div className="highlight-pill-text">
              <strong>No Video Archiving</strong>
              <span>Raw camera recordings are analyzed ephemerally and not permanently retained.</span>
            </div>
          </div>
          <div className="privacy-highlight-pill">
            <Brain size={20} className="highlight-pill-icon" />
            <div className="highlight-pill-text">
              <strong>Actionable Analytics</strong>
              <span>Biometric telemetry (gaze, speech rate, filler words) is computed purely for self-improvement.</span>
            </div>
          </div>
          <div className="privacy-highlight-pill">
            <FileText size={20} className="highlight-pill-icon" />
            <div className="highlight-pill-text">
              <strong>Career Data Control</strong>
              <span>Resumes, preferences, and auto-applied jobs are stored securely until you delete them.</span>
            </div>
          </div>
          <div className="privacy-highlight-pill">
            <Lock size={20} className="highlight-pill-icon" />
            <div className="highlight-pill-text">
              <strong>Zero Data Selling</strong>
              <span>We never sell or monetize your personal information or resume records to data brokers.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Layout: Table of Contents + Policy Sections ── */}
      <div className="privacy-body-layout">
        {/* Sticky Table of Contents */}
        <aside className="privacy-toc-wrap glass">
          <div className="privacy-toc-title">
            <FileText size={16} />
            <span>Table of Contents</span>
          </div>
          <nav className="privacy-toc-nav" aria-label="Privacy Policy Sections">
            {TOC_ITEMS.map((item, index) => {
              const Icon = item.icon;
              return (
                <a key={item.id} href={`#${item.id}`} className="privacy-toc-link">
                  <span className="toc-num">{index + 1}.</span>
                  <span>{item.label.replace(/^\d+\.\s*/, "")}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        {/* Policy Content Sections */}
        <main className="privacy-sections-container">
          {/* Section 1: Overview */}
          <section id="overview" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <div className="privacy-section-icon">
                <ShieldCheck size={20} />
              </div>
              <h2>1. Overview & Scope</h2>
            </div>
            <div className="privacy-content-block">
              <p>
                Welcome to <strong>Confidometer</strong> (“Platform”, “we”, “our”, or “us”). This Privacy Policy describes how we collect, process, store, and safeguard your personal information when you access or use our web application, AI mock interview modules, coding assessment sandboxes, speech training tools, peer-to-peer interview lobbies, and autonomous career automation features (AutoApply).
              </p>
              <p>
                By creating an account, participating in mock interviews, submitting resumes, or using our automated job application services, you acknowledge that you have read and understood the data practices described in this Privacy Policy.
              </p>
              <div className="privacy-callout info">
                <AlertCircle size={18} className="callout-icon" />
                <div>
                  <strong>Note for Job Seekers:</strong> Confidometer is designed solely as an educational career acceleration and interview preparation platform. You maintain complete ownership of your career assets and application materials.
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Information Collected */}
          <section id="information-collected" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <div className="privacy-section-icon">
                <Database size={20} />
              </div>
              <h2>2. Information We Collect</h2>
            </div>
            <div className="privacy-content-block">
              <p>
                To provide multidimensional mock interview feedback and automated career features, we collect several categories of information:
              </p>

              <h3 className="privacy-subheading">A. Account & Profile Information</h3>
              <ul className="privacy-list">
                <li><strong>Credentials:</strong> Your name, email address, and cryptographically hashed passwords.</li>
                <li><strong>Gamification Telemetry:</strong> Daily practice streaks, milestone badges, and session timestamps.</li>
              </ul>

              <h3 className="privacy-subheading">B. Resume & Career Profile Data</h3>
              <ul className="privacy-list">
                <li><strong>Parsed Resumes:</strong> Extracted work experience, education history, technical skills, soft skills, certifications, projects, publications, and portfolio links (GitHub, LinkedIn, website).</li>
                <li><strong>Target Preferences:</strong> Preferred job titles, locations, remote/hybrid preferences, minimum salary expectations, currency, company size preferences, and excluded keywords/companies.</li>
                <li><strong>User-Configured Credentials:</strong> Optional third-party job search API keys provided at your sole discretion.</li>
              </ul>

              <h3 className="privacy-subheading">C. Mock Interview & Assessment Telemetry</h3>
              <ul className="privacy-list">
                <li><strong>Interview Configurations:</strong> Selected interview format (Technical, HR, Behavioural, DSA Coding, Negotiation, Speak Gym), role, and target company.</li>
                <li><strong>Transcripts & Dialogues:</strong> Real-time transcriptions of your responses and AI interviewer dialogue transcripts.</li>
                <li><strong>Coding Submissions:</strong> Code snippets written within the Monaco editor during technical and DSA rounds, along with sandbox execution results.</li>
                <li><strong>Structured Performance Scores:</strong> Confidence score, filler word counts, gaze stability index, gesture frequency, technical depth score, fluency rating, and executive summaries.</li>
              </ul>

              <h3 className="privacy-subheading">D. Autonomous Application (AutoApply) Data</h3>
              <ul className="privacy-list">
                <li><strong>Discovered Postings & Matches:</strong> Aggregated job listings, semantic match ratings, missing skill analyses, and submission statuses.</li>
                <li><strong>Tailored Assets:</strong> AI-generated cover letters, custom screening question answers, and submission activity logs.</li>
              </ul>

              <h3 className="privacy-subheading">E. Peer-to-Peer Interview Data</h3>
              <ul className="privacy-list">
                <li><strong>Lobby Requests:</strong> Scheduled peer session requests, target roles, and mutual feedback notes exchanged with verified peers.</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Video & Biometrics Processing */}
          <section id="video-biometrics" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <div className="privacy-section-icon">
                <Video size={20} />
              </div>
              <h2>3. Video & Biometric Processing</h2>
            </div>
            <div className="privacy-content-block">
              <p>
                Confidometer uses computer vision and audio signal processing to measure non-verbal cues (such as gaze stability, eye contact percentage, gesture dynamics, and speech pace). We handle this data with strict privacy safeguards:
              </p>

              <div className="privacy-callout success">
                <Eye size={18} className="callout-icon" />
                <div>
                  <strong>No Permanent Video Archival:</strong> Raw webcam video recordings and raw audio files uploaded during practice sessions are processed ephemerally solely to compute metric scores. We do not maintain a permanent video archive on our production databases.
                </div>
              </div>

              <ul className="privacy-list">
                <li><strong>Face & Landmark Telemetry:</strong> Landmark coordinates (e.g., eye gaze angles and facial orientation) are extracted in real-time or via isolated background workers to compute numeric indices. No facial biometric templates or facial recognition identities are created or stored.</li>
                <li><strong>Pose & Body Language Tracking:</strong> Landmark points for body posture and arm movement are analyzed exclusively to score composure, fidgeting, and hand gestures.</li>
                <li><strong>Speech & Acoustic Analysis:</strong> Audio streams are parsed to evaluate pitch variation, speaking cadence, and filler words.</li>
                <li><strong>Peer-to-Peer WebRTC Streams:</strong> Video and audio streams in Peer Mode travel directly between browser peers via encrypted WebRTC connections with STUN/ICE signaling.</li>
              </ul>
            </div>
          </section>

          {/* Section 4: How We Use Your Data */}
          <section id="how-we-use" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <div className="privacy-section-icon">
                <Brain size={20} />
              </div>
              <h2>4. How We Use Your Information</h2>
            </div>
            <div className="privacy-content-block">
              <p>We process your data strictly for the following operational and educational purposes:</p>
              <div className="privacy-table-wrap">
                <table className="privacy-table">
                  <thead>
                    <tr>
                      <th>Purpose</th>
                      <th>Data Utilized</th>
                      <th>Legal Basis / Context</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>AI Interview Simulation & Feedback</strong></td>
                      <td>Transcripts, speech telemetry, code solutions, role settings</td>
                      <td>Fulfillment of core service requested by user</td>
                    </tr>
                    <tr>
                      <td><strong>Biometric Non-Verbal Scoring</strong></td>
                      <td>Facial landmark coordinates, posture telemetry, audio cadence</td>
                      <td>Real-time performance diagnostic calculation</td>
                    </tr>
                    <tr>
                      <td><strong>Resume Matching & AutoApply</strong></td>
                      <td>Candidate profile, resume skills, job preference criteria</td>
                      <td>Automated job discovery and form submission execution</td>
                    </tr>
                    <tr>
                      <td><strong>Progress Analytics & Badges</strong></td>
                      <td>Session scores, historical trends, streak counters</td>
                      <td>Personalized progress tracking and gamification</td>
                    </tr>
                    <tr>
                      <td><strong>Platform Security & Authentication</strong></td>
                      <td>Email address, hashed password, security logs</td>
                      <td>Account security and fraud prevention</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Section 5: Third-Party Services */}
          <section id="third-party" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <div className="privacy-section-icon">
                <Globe size={20} />
              </div>
              <h2>5. Third-Party Services & AI Providers</h2>
            </div>
            <div className="privacy-content-block">
              <p>
                To provide dynamic question synthesis, speech transcription, voice output, and reliable cloud hosting, Confidometer integrates with vetted third-party cloud infrastructure and AI providers:
              </p>
              <ul className="privacy-list">
                <li><strong>AI Inference Engines:</strong> We transmit contextual prompts (such as interview questions, code snippets, resume excerpts, and conversation history) to third-party large language model (LLM) APIs to generate tailored responses, evaluations, and cover letters.</li>
                <li><strong>Speech-to-Text & Transcription:</strong> Audio data is processed through accelerated cloud speech recognition services and localized transcription engines to generate live and post-session transcripts.</li>
                <li><strong>Text-to-Speech (TTS) Synthesis:</strong> AI interviewer dialogues are synthesized into voice audio via cloud neural speech services.</li>
                <li><strong>Cloud Hosting & Database Storage:</strong> Our application servers, database instances, and edge content delivery networks operate on reputable cloud infrastructure providers with end-to-end transport encryption.</li>
              </ul>
              <div className="privacy-callout info">
                <Lock size={18} className="callout-icon" />
                <div>
                  <strong>Data Protection Standard:</strong> We do not authorize third-party AI providers to use your private resume data or session transcripts to train public, generalized foundation models without consent.
                </div>
              </div>
            </div>
          </section>

          {/* Section 6: Storage & Security */}
          <section id="storage-security" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <div className="privacy-section-icon">
                <Lock size={20} />
              </div>
              <h2>6. Data Storage & Security Measures</h2>
            </div>
            <div className="privacy-content-block">
              <p>
                We implement industry-standard technical and organizational security controls to protect your data against unauthorized access, alteration, disclosure, or destruction:
              </p>
              <ul className="privacy-list">
                <li><strong>Encryption in Transit:</strong> All web traffic, WebSocket feeds, and API transactions are encrypted using Transport Layer Security (TLS 1.2/1.3 / HTTPS / WSS).</li>
                <li><strong>Password Protection:</strong> User passwords are encrypted using secure cryptographic hashing (bcrypt/PBKDF2) prior to storage.</li>
                <li><strong>Scoped Database Access:</strong> Application data is isolated with strict relational database access permissions and authenticated session controls.</li>
                <li><strong>Client-Side Token Handling:</strong> Authentication tokens are managed with standard authorization headers and secure storage safeguards.</li>
              </ul>
            </div>
          </section>

          {/* Section 7: Retention & Deletion */}
          <section id="retention" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <div className="privacy-section-icon">
                <Trash2 size={20} />
              </div>
              <h2>7. Data Retention & Account Deletion</h2>
            </div>
            <div className="privacy-content-block">
              <p>
                We believe in data minimization and giving you full control over how long your records persist:
              </p>
              <ul className="privacy-list">
                <li><strong>Ephemeral Session Media:</strong> Video and audio streams captured for real-time interview evaluation are processed ephemerally and discarded once diagnostic metrics are calculated.</li>
                <li><strong>Analytical Records & History:</strong> Your diagnostic sub-scores, feedback summaries, resume profiles, and AutoApply application logs are retained in your account so you can monitor progress across historical sessions.</li>
                <li><strong>Account Deletion:</strong> Your historical scores, resume profiles, preferences, and account credentials remain associated with your profile until you request account deletion. Upon deletion, your personal data and associated records are permanently purged from active databases.</li>
              </ul>
            </div>
          </section>

          {/* Section 8: User Rights */}
          <section id="user-rights" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <div className="privacy-section-icon">
                <UserCheck size={20} />
              </div>
              <h2>8. Your Rights & Controls</h2>
            </div>
            <div className="privacy-content-block">
              <p>Depending on your jurisdiction, you may hold specific rights regarding your personal information, including:</p>
              <ul className="privacy-list">
                <li><strong>Right of Access:</strong> You can view all saved interview reports, scores, parsed resume profiles, and auto-applied jobs directly in your Dashboard and History pages.</li>
                <li><strong>Right to Rectification:</strong> You can update or replace your resume versions, target job preferences, and candidate information at any time.</li>
                <li><strong>Right to Erasure:</strong> You can delete specific interview history items or request a complete purge of your account data.</li>
                <li><strong>Right to Restrict or Object:</strong> You can disable AutoApply automation, pause daily application schedules, or practice without video permissions using standalone audio modes.</li>
              </ul>
            </div>
          </section>

          {/* Section 9: Cookies & Storage */}
          <section id="cookies" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <div className="privacy-section-icon">
                <Cookie size={20} />
              </div>
              <h2>9. Cookies & Local Storage</h2>
            </div>
            <div className="privacy-content-block">
              <p>
                Confidometer uses essential browser storage mechanisms (such as LocalStorage and session tokens) for core functionality:
              </p>
              <ul className="privacy-list">
                <li><strong>Authentication Tokens:</strong> Storing JWT session tokens to keep you securely signed in across page transitions.</li>
                <li><strong>Theme & UI Preferences:</strong> Remembering your Dark / Light theme selection across browser sessions.</li>
                <li><strong>Recent Client-Side History:</strong> Caching local quick-access session pointers to accelerate dashboard page loads.</li>
              </ul>
              <p>
                We do not utilize invasive cross-site advertising trackers or third-party tracking pixels.
              </p>
            </div>
          </section>

          {/* Section 10: Children's Privacy */}
          <section id="children" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <div className="privacy-section-icon">
                <AlertCircle size={20} />
              </div>
              <h2>10. Children's Privacy</h2>
            </div>
            <div className="privacy-content-block">
              <p>
                Confidometer is intended for career preparation, job seekers, and adult learners (typically aged 18 and older, or the minimum age of employment in your region). We do not knowingly collect personal information from individuals under the age of 13. If we become aware that an account belongs to a child under 13, we will promptly take steps to delete that account and associated data.
              </p>
            </div>
          </section>

          {/* Section 11: Contact & Updates */}
          <section id="contact" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <div className="privacy-section-icon">
                <Mail size={20} />
              </div>
              <h2>11. Contact & Policy Updates</h2>
            </div>
            <div className="privacy-content-block">
              <p>
                We may periodically update this Privacy Policy to reflect enhancements to our AI models, diagnostic capabilities, or legal requirements. When changes are made, we will update the “Last Updated” date at the top of this document. Continued use of the platform after updates constitutes acceptance of the revised terms.
              </p>
              <p>
                If you have questions, privacy inquiries, or wish to exercise your data protection rights, please contact our team:
              </p>
              <div className="privacy-contact-box">
                <div className="privacy-contact-details">
                  <h4>Confidometer Privacy Team</h4>
                  <p>Inquiries regarding privacy, data deletion, and AI transparency</p>
                </div>
                <a href="mailto:privacy@confidometer.com" className="privacy-contact-btn">
                  <Mail size={16} />
                  <span>Contact Privacy Team</span>
                </a>
              </div>
            </div>
          </section>

          {/* Back to top button */}
          <div className="privacy-back-top">
            <button type="button" onClick={scrollToTop} className="privacy-back-top-btn">
              <ArrowUp size={16} />
              <span>Back to Top</span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
