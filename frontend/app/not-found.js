"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home, ArrowLeft, Compass, Sparkles } from "lucide-react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="not-found-wrapper">
      <div className="not-found-card glass">
        <div className="not-found-badge">
          <Sparkles size={14} /> 404 Error
        </div>

        <div className="not-found-glitch-container">
          <span className="not-found-number">404</span>
        </div>

        <h1 className="not-found-title">Page Not Found</h1>
        <p className="not-found-desc">
          The page you are looking for might have been moved, renamed, or is temporarily unavailable. Let&apos;s get you back on track!
        </p>

        <div className="not-found-actions">
          <Link href="/" className="button primary not-found-btn">
            <Home size={17} /> Go to Homepage
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="button subtle not-found-btn"
          >
            <ArrowLeft size={17} /> Go Back
          </button>
        </div>

        <div className="not-found-quicklinks">
          <span className="quicklinks-label">Popular Destinations:</span>
          <div className="quicklinks-row">
            <Link href="/upload" className="quicklink-pill">AI Interview</Link>
            <Link href="/speak" className="quicklink-pill">Get Set Speak</Link>
            <Link href="/peer" className="quicklink-pill">Peer-to-Peer</Link>
            <Link href="/autoapply" className="quicklink-pill">ApplyBuddy</Link>
            <Link href="/dashboard" className="quicklink-pill">Dashboard</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
