import Link from "next/link";
import { ArrowRight, Sparkles, Video } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="landing">
      <section className="hero glass">
        <p className="kicker">
          <Sparkles size={14} /> Meet Liza, Your AI Interview Agent
        </p>
        <h1>Mock interviews, elevated by AI.</h1>
        <p className="hero-copy">
          Confidometer uses Liza, an interactive AI agent, to interview you live. Speak naturally while our AI analyzes your confidence, eye contact, gestures, and vocal stability in real time.
        </p>

        <div className="hero-actions">
          <Link href="/upload" className="button primary">
            Start AI Interview <ArrowRight size={16} />
          </Link>
          <Link href="/dashboard" className="button subtle">
            View Dashboard
          </Link>
        </div>

        <div className="hero-stats">
          <article>
            <h3>4 Signals</h3>
            <p>Voice, fillers, gesture, eye-contact</p>
          </article>
          <article>
            <h3>Fast Feedback</h3>
            <p>Track improvements after each mock interview</p>
          </article>
          <article>
            <h3>Actionable</h3>
            <p>Readable score profile for your next session</p>
          </article>
        </div>
      </section>

      <section className="feature-grid">
        <article className="feature-card glass">
          <Video size={20} />
          <h3>Interactive Mock Interview</h3>
          <p>Practice live with Liza, who asks custom questions based on your resume and target role.</p>
        </article>
        <article className="feature-card glass">
          <Sparkles size={20} />
          <h3>Detailed Analysis</h3>
          <p>Get instant scores on filler words, gestures, voice stability, and visual confidence.</p>
        </article>
      </section>
    </div>
  );
}
