"use client";

import Link from "next/link";
import {
  FileText,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
  Scale,
  Brain,
  Zap,
  Lock,
  Globe,
  Mail,
  ChevronRight,
  ArrowUp
} from "lucide-react";
import "../privacy-policy/styles.css";

const TOC_ITEMS = [
  { id: "acceptance", label: "1. Acceptance of Terms", icon: Scale },
  { id: "eligibility", label: "2. Eligibility & Account Creation", icon: UserCheck },
  { id: "services-description", label: "3. Description of Services", icon: Brain },
  { id: "user-conduct", label: "4. Acceptable Use & Conduct", icon: ShieldCheck },
  { id: "applybuddy-terms", label: "5. ApplyBuddy & Automated Tools", icon: Zap },
  { id: "intellectual-property", label: "6. Intellectual Property & License", icon: FileText },
  { id: "disclaimers", label: "7. Disclaimers & No Guarantee", icon: AlertTriangle },
  { id: "limitation-liability", label: "8. Limitation of Liability", icon: Lock },
  { id: "termination", label: "9. Suspension & Termination", icon: Globe },
  { id: "governing-law", label: "10. Governing Law & Contact", icon: Mail }
];

export default function TermsOfUsePage() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="privacy-page">
      {/* ── Hero Header ── */}
      <section className="privacy-hero glass">
        <div className="privacy-badge-wrap">
          <Scale size={16} />
          <span>Legal Agreement</span>
        </div>
        <h1>Terms of Use</h1>
        <p className="privacy-hero-subtitle">
          Please review these Terms of Use carefully before using Confidometer. By accessing
          or using any of our interview preparation, analytics, or automated job tools, you agree
          to be bound by these terms.
        </p>
        <div className="privacy-meta-info">
          <span className="privacy-meta-item">
            <strong>Effective Date:</strong> August 20, 2026
          </span>
          <span>•</span>
          <span className="privacy-meta-item">
            <strong>Last Updated:</strong> August 20, 2026
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
          <h3>Terms Highlights at a Glance</h3>
        </div>
        <div className="privacy-highlights-grid">
          <div className="privacy-highlight-pill">
            <Brain size={20} className="highlight-pill-icon" />
            <div className="highlight-pill-text">
              <strong>Practice & Guidance Tool</strong>
              <span>Confidometer provides AI simulation and telemetry for educational preparation and self-coaching.</span>
            </div>
          </div>
          <div className="privacy-highlight-pill">
            <UserCheck size={20} className="highlight-pill-icon" />
            <div className="highlight-pill-text">
              <strong>Account Responsibility</strong>
              <span>You are responsible for maintaining the confidentiality and integrity of your account credentials.</span>
            </div>
          </div>
          <div className="privacy-highlight-pill">
            <Zap size={20} className="highlight-pill-icon" />
            <div className="highlight-pill-text">
              <strong>Ethical ApplyBuddy Use</strong>
              <span>Job applications automated through ApplyBuddy remain your personal responsibility.</span>
            </div>
          </div>
          <div className="privacy-highlight-pill">
            <Lock size={20} className="highlight-pill-icon" />
            <div className="highlight-pill-text">
              <strong>Privacy Protection</strong>
              <span>Your interview telemetry and personal data are governed strictly by our Privacy Policy.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Main Layout: Table of Contents + Policy Content ── */}
      <div className="privacy-layout-grid">
        {/* Sticky Table of Contents Sidebar */}
        <aside className="privacy-toc-sidebar">
          <div className="privacy-toc-card glass">
            <h4 className="privacy-toc-title">Table of Contents</h4>
            <nav className="privacy-toc-nav">
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
                View Privacy Policy
              </Link>
              <Link href="/faq" className="button ghost" style={{ width: "100%", justifyContent: "center", fontSize: "0.85rem" }}>
                View FAQ
              </Link>
            </div>
          </div>
        </aside>

        {/* Policy Body Sections */}
        <main className="privacy-content-body">
          
          {/* Section 1: Acceptance */}
          <section id="acceptance" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Scale size={24} className="section-icon" />
              <h2>1. Acceptance of Terms</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                By creating an account, visiting, browsing, or utilizing the web application and services provided by 
                <strong> Confidometer</strong> (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;), you signify your explicit agreement 
                to comply with and be legally bound by these Terms of Use, our Privacy Policy, and any applicable operating rules.
              </p>
              <p>
                If you do not agree to these terms in their entirety, you must immediately discontinue use of the Confidometer platform.
              </p>
            </div>
          </section>

          {/* Section 2: Eligibility */}
          <section id="eligibility" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <UserCheck size={24} className="section-icon" />
              <h2>2. Eligibility & Account Creation</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                You must be at least 16 years of age or the age of legal majority in your jurisdiction to create an account or use our platform.
              </p>
              <ul>
                <li><strong>Accurate Information:</strong> You agree to provide accurate, current, and complete registration details.</li>
                <li><strong>Account Security:</strong> You are solely responsible for safeguarding your password and for any activities or actions under your account.</li>
                <li><strong>Unauthorized Access:</strong> You agree to notify us immediately if you suspect unauthorized access or security breaches.</li>
              </ul>
            </div>
          </section>

          {/* Section 3: Services Description */}
          <section id="services-description" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Brain size={24} className="section-icon" />
              <h2>3. Description of Services</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                Confidometer provides candidates and interviewees with state-of-the-art interactive preparation tools:
              </p>
              <div className="data-type-grid">
                <div className="data-type-card">
                  <h4>🤖 AI Mock Interviews</h4>
                  <p>Real-time conversational interview simulations featuring facial expression analysis, gaze tracking, speech rate, and contextual feedback.</p>
                </div>
                <div className="data-type-card">
                  <h4>👥 Peer-to-Peer Mock</h4>
                  <p>Live WebRTC collaborative matching allowing candidates to practice conducting and taking peer technical/behavioral interviews.</p>
                </div>
                <div className="data-type-card">
                  <h4>⚡ Get Set Speak</h4>
                  <p>Impromptu 1-minute speech training topics with immediate timer practice and video playback feedback.</p>
                </div>
                <div className="data-type-card">
                  <h4>💼 ApplyBuddy</h4>
                  <p>Automated job matching, resume tailoring, and streamlined application tracking across major hiring platforms.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Acceptable Use */}
          <section id="user-conduct" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <ShieldCheck size={24} className="section-icon" />
              <h2>4. Acceptable Use & Conduct</h2>
            </div>
            <div className="privacy-section-content">
              <p>When using Confidometer, you agree NOT to:</p>
              <ul>
                <li>Harass, intimidate, or exhibit abusive behavior towards peer interview partners during live video rooms.</li>
                <li>Transmit any content that contains malware, viruses, or disruptive automated scripts.</li>
                <li>Attempt to reverse-engineer, decompile, scrape, or extract source code or proprietary AI models from our platform.</li>
                <li>Impersonate any person, entity, or employer during interview practice or job applications.</li>
                <li>Use the platform for any illegal purpose or in violation of local, state, national, or international regulations.</li>
              </ul>
            </div>
          </section>

          {/* Section 5: ApplyBuddy Terms */}
          <section id="applybuddy-terms" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Zap size={24} className="section-icon" />
              <h2>5. ApplyBuddy & Automated Tools</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                The ApplyBuddy feature automates job tracking, resume tailoring, and application submissions. By configuring your credentials and preferences in ApplyBuddy:
              </p>
              <ul>
                <li>You acknowledge that you are directing ApplyBuddy to act on your behalf to find and submit applications to third-party portals.</li>
                <li>You are solely responsible for verifying the accuracy and integrity of submitted resumes and job questionnaires.</li>
                <li>We do not guarantee hiring outcomes, callback rates, or the hiring policies of target employers.</li>
              </ul>
            </div>
          </section>

          {/* Section 6: Intellectual Property */}
          <section id="intellectual-property" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <FileText size={24} className="section-icon" />
              <h2>6. Intellectual Property & License</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                All visual interfaces, design assets, algorithms, codebases, audio effects, and branding associated with Confidometer 
                are the intellectual property of Confidometer and its licensors.
              </p>
              <p>
                We grant you a non-exclusive, non-transferable, revocable license to access and use the platform for personal, non-commercial professional development purposes.
              </p>
            </div>
          </section>

          {/* Section 7: Disclaimers */}
          <section id="disclaimers" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <AlertTriangle size={24} className="section-icon" />
              <h2>7. Disclaimers & No Guarantee</h2>
            </div>
            <div className="privacy-section-content">
              <div className="warning-callout">
                <AlertTriangle size={20} />
                <div>
                  <strong>Educational Guidance Disclaimer</strong>
                  <p>
                    Confidometer is designed solely for self-coaching and interview practice. Our AI feedback, scorecards,
                    and telemetry reflect automated heuristics and do not constitute an official endorsement or guarantee of employment by any hiring organization.
                  </p>
                </div>
              </div>
              <p>
                The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, whether express or implied.
              </p>
            </div>
          </section>

          {/* Section 8: Limitation of Liability */}
          <section id="limitation-liability" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Lock size={24} className="section-icon" />
              <h2>8. Limitation of Liability</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                To the maximum extent permitted by applicable law, in no event shall Confidometer, its founders, or contributors 
                be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or career opportunities, 
                arising out of or related to your use of the platform.
              </p>
            </div>
          </section>

          {/* Section 9: Termination */}
          <section id="termination" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Globe size={24} className="section-icon" />
              <h2>9. Suspension & Termination</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                We reserve the right to suspend or terminate your account and access to Confidometer at our discretion, without prior notice, 
                for conduct that violates these Terms of Use, harms other users, or compromises platform security.
              </p>
              <p>
                You may terminate your account at any time by contacting support or deleting your account data via platform settings.
              </p>
            </div>
          </section>

          {/* Section 10: Governing Law & Contact */}
          <section id="governing-law" className="privacy-section-card glass">
            <div className="privacy-section-header">
              <Mail size={24} className="section-icon" />
              <h2>10. Governing Law & Inquiries</h2>
            </div>
            <div className="privacy-section-content">
              <p>
                These Terms shall be governed by and construed in accordance with applicable laws, without regard to its conflict of law provisions.
              </p>
              <div className="contact-box">
                <h4>Have Questions About These Terms?</h4>
                <p>Feel free to reach out to our legal and support team:</p>
                <div className="contact-details">
                  <span className="contact-item">
                    <Mail size={16} /> <strong>Email:</strong> support@confidometer.ai
                  </span>
                  <span className="contact-item">
                    <Globe size={16} /> <strong>Platform:</strong> https://confidometer.ai
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
        aria-label="Scroll to top of terms"
      >
        <ArrowUp size={18} />
      </button>
    </div>
  );
}
