"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getProfile, getDashboardStats, triggerJobSearch } from "@/utils/autoapply_api";
import {
  Sparkles, Bot, Briefcase, CheckCircle, ArrowRight,
  Settings, BarChart2, ShieldCheck, Zap, Sliders
} from "lucide-react";
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
          <p style={{ color: "var(--muted)", fontWeight: 600 }}>Loading ApplyBuddy Control Hub...</p>
        </div>
      </div>
    );
  }

  if (!onboarded) {
    return (
      <div
        className="aa-container"
        style={{
          textAlign: "center",
          padding: "40px 16px 20px",
          minHeight: "calc(100vh - 140px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          maxWidth: 1040,
          margin: "0 auto"
        }}
      >
        <div>
          <div className="aa-badge aa-badge-score-high" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 16px", marginBottom: 18 }}>
            <Sparkles size={14} /> AI Job Discovery & Application Copilot
          </div>

          <h1 className="aa-title" style={{ fontSize: "3.2rem", lineHeight: 1.15, margin: "0 auto 16px", maxWidth: 840 }}>
            Discover Top Opportunities & <br />
            <span className="aa-gradient-text">Apply with Precision AI</span>
          </h1>

          <p className="aa-subtitle" style={{ maxWidth: 640, margin: "0 auto 32px", fontSize: "1.02rem", lineHeight: 1.6 }}>
            Upload your resume once. ApplyBuddy continuously scans top hiring platforms, evaluates compatibility against your skills, prepares tailored application materials, and organizes your job pipeline.
          </p>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <Link href="/autoapply/onboarding" className="aa-btn aa-btn-primary" style={{ padding: "14px 32px", fontSize: "1.05rem", display: "inline-flex", alignItems: "center", gap: 8 }}>
              Start One-Time Onboarding <ArrowRight size={18} />
            </Link>
          </div>

          {/* Feature Grid: Exactly 3 Cards */}
          <div className="aa-grid-3" style={{ marginTop: 52, textAlign: "left" }}>
            <div className="aa-card" style={{ padding: "26px 24px" }}>
              <Bot size={32} color="var(--teal)" style={{ marginBottom: 14 }} />
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0 0 8px 0", color: "var(--text)" }}>Smart Match Scoring</h3>
              <p className="aa-subtitle" style={{ fontSize: "0.88rem", margin: 0, lineHeight: 1.5 }}>
                Evaluates job postings against your resume, highlighting matching strengths and identifying missing skill requirements.
              </p>
            </div>
            <div className="aa-card" style={{ padding: "26px 24px" }}>
              <Zap size={32} color="var(--cyan)" style={{ marginBottom: 14 }} />
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0 0 8px 0", color: "var(--text)" }}>Custom Cover Letters</h3>
              <p className="aa-subtitle" style={{ fontSize: "0.88rem", margin: 0, lineHeight: 1.5 }}>
                Generates tailored, company-specific cover letters and intelligent answers to common screening questionnaires automatically.
              </p>
            </div>
            <div className="aa-card" style={{ padding: "26px 24px" }}>
              <ShieldCheck size={32} color="var(--amber)" style={{ marginBottom: 14 }} />
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "0 0 8px 0", color: "var(--text)" }}>Verified Links & Control</h3>
              <p className="aa-subtitle" style={{ fontSize: "0.88rem", margin: 0, lineHeight: 1.5 }}>
                Direct access to verified application postings with complete control over match thresholds, blacklists, and pipeline tracking.
              </p>
            </div>
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
            <h1 style={{ fontSize: "1.6rem", fontWeight: 900, margin: 0, color: "var(--text)" }}>AI ApplyBuddy Control Hub</h1>
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
          <Link href="/autoapply/onboarding?reset=true" className="aa-btn aa-btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", fontSize: "0.85rem" }} title="Re-run the step-by-step setup wizard">
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
