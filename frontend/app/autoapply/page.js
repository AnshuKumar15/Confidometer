"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProfile, getDashboardStats, triggerJobSearch } from "@/utils/autoapply_api";
import { Sparkles, Bot, Briefcase, CheckCircle, ArrowRight, Settings, BarChart2, ShieldCheck, Zap, Sliders } from "lucide-react";
import StatCard from "@/components/autoapply/StatCard";

export default function AutoApplyHub() {
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);
  const [stats, setStats] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const profile = await getProfile();
        if (profile) {
          setOnboarded(true);
          const data = await getDashboardStats();
          setStats(data);
        } else {
          setOnboarded(false);
        }
      } catch (err) {
        setOnboarded(false);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleManualSearch = async () => {
    setSearching(true);
    try {
      await triggerJobSearch();
      const updated = await getDashboardStats();
      setStats(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "50vh", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="loader-spinner" style={{ margin: "0 auto 12px" }} />
          <p style={{ color: "var(--muted)", fontWeight: 600 }}>Loading AutoApply Control Hub...</p>
        </div>
      </div>
    );
  }

  if (!onboarded) {
    return (
      <div className="aa-container" style={{ textAlign: "center", padding: "60px 16px" }}>
        <div className="aa-badge aa-badge-score-high" style={{ padding: "6px 16px", marginBottom: 20 }}>
          <Sparkles size={14} /> Next-Gen AI Recruiter Engine
        </div>

        <h1 className="aa-title" style={{ fontSize: "3.2rem" }}>
          Apply to 100s of Jobs <br />
          <span className="aa-gradient-text">On Autopilot 24/7</span>
        </h1>

        <p className="aa-subtitle" style={{ maxWidth: 640, margin: "0 auto 36px" }}>
          Upload your resume once. Configure your dream roles and salary. Let your personal AI recruiter continuously discover, match, and apply to top opportunities on your behalf.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
          <Link href="/autoapply/onboarding" className="aa-btn aa-btn-primary" style={{ padding: "14px 32px", fontSize: "1.05rem" }}>
            Start One-Time Onboarding <ArrowRight size={18} />
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="aa-grid-3" style={{ marginTop: 60, textAlign: "left" }}>
          <div className="aa-card">
            <Bot size={32} color="var(--teal)" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0 0 8px 0" }}>Smart Match Scoring</h3>
            <p className="aa-subtitle" style={{ fontSize: "0.88rem" }}>Evaluates skills, experience, and location with high-precision AI matching.</p>
          </div>
          <div className="aa-card">
            <Zap size={32} color="var(--cyan)" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0 0 8px 0" }}>Custom Cover Letters</h3>
            <p className="aa-subtitle" style={{ fontSize: "0.88rem" }}>Generates tailored, company-specific cover letters automatically.</p>
          </div>
          <div className="aa-card">
            <ShieldCheck size={32} color="var(--amber)" style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0 0 8px 0" }}>Total Transparency</h3>
            <p className="aa-subtitle" style={{ fontSize: "0.88rem" }}>Full audit trail and controls over match thresholds and blocked companies.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aa-container" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div className="aa-card aa-flex-between" style={{ padding: "20px 24px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#2dd4bf", boxShadow: "0 0 10px #2dd4bf" }} />
            <h1 style={{ fontSize: "1.6rem", fontWeight: 900, margin: 0, color: "var(--text)" }}>AI AutoApply Control Hub</h1>
          </div>
          <p style={{ margin: "4px 0 0 0", fontSize: "0.88rem", color: "var(--muted)" }}>
            Your AI career agent is continuously monitoring job boards in the background.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={handleManualSearch} disabled={searching} className="aa-btn aa-btn-outline">
            <Sparkles size={16} />
            {searching ? "Searching Jobs..." : "Run Job Search Now"}
          </button>
          <Link href="/autoapply/onboarding" className="aa-btn aa-btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: "0.85rem" }} title="Re-run the step-by-step setup wizard">
            <Sliders size={15} /> Re-run Setup
          </Link>
          <Link href="/autoapply/settings" className="aa-btn aa-btn-secondary" style={{ padding: "10px" }} title="Settings">
            <Settings size={18} />
          </Link>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="aa-grid-4">
        <StatCard title="Applications Prepared" value={stats?.total_jobs_applied || 0} subtitle="Ready to submit" icon={Briefcase} />
        <StatCard title="Jobs Matched" value={stats?.total_jobs_matched || 0} subtitle="Passed threshold" icon={CheckCircle} />
        <StatCard title="Average Match" value={`${stats?.average_match_score || 0}%`} subtitle="Relevance score" icon={BarChart2} />
        <StatCard title="Interviews" value={stats?.interviews || 0} subtitle="Converted candidates" icon={Bot} />
      </div>

      {/* Navigation Quick Links */}
      <div className="aa-grid-3">
        <Link href="/autoapply/dashboard" className="aa-card" style={{ textDecoration: "none" }}>
          <BarChart2 size={24} color="var(--teal)" style={{ marginBottom: 12 }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)" }}>Full Analytics Dashboard</h3>
          <p className="aa-subtitle" style={{ fontSize: "0.85rem" }}>View detailed application distributions, timelines, and conversion stats.</p>
        </Link>

        <Link href="/autoapply/jobs" className="aa-card" style={{ textDecoration: "none" }}>
          <Briefcase size={24} color="var(--cyan)" style={{ marginBottom: 12 }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)" }}>Discovered Jobs Engine</h3>
          <p className="aa-subtitle" style={{ fontSize: "0.85rem" }}>Browse all discovered job postings and review match breakdowns.</p>
        </Link>

        <Link href="/autoapply/applications" className="aa-card" style={{ textDecoration: "none" }}>
          <CheckCircle size={24} color="var(--amber)" style={{ marginBottom: 12 }} />
          <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)" }}>Application Tracker</h3>
          <p className="aa-subtitle" style={{ fontSize: "0.85rem" }}>Manage auto-prepared cover letters, form answers, and application statuses.</p>
        </Link>
      </div>
    </div>
  );
}
