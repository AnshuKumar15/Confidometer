"use client";

import { useEffect, useState } from "react";
import { getDiscoveredJobs, triggerJobSearch, updateJobMatchStatus } from "@/utils/autoapply_api";
import JobCard from "@/components/autoapply/JobCard";
import { Briefcase, Sparkles, CheckCircle2 } from "lucide-react";

export default function DiscoveredJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState("matched");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    async function loadJobs() {
      setLoading(true);
      try {
        const data = await getDiscoveredJobs(filter === "all" ? null : filter);
        setJobs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadJobs();
  }, [filter]);

  const handleSearch = async () => {
    setSearching(true);
    try {
      await triggerJobSearch();
      const updated = await getDiscoveredJobs(filter === "all" ? null : filter);
      setJobs(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleToggleApplied = async (matchId, markAsApplied) => {
    const newStatus = markAsApplied ? "applied" : "matched";

    // 1. Optimistic UI update (Instant 0ms visual feedback)
    setJobs((prev) =>
      prev.map((item) => (item.id === matchId ? { ...item, status: newStatus } : item))
    );

    // 2. Persist to backend database in background
    try {
      await updateJobMatchStatus(matchId, newStatus);
    } catch (err) {
      console.error("Failed to update status on server:", err);
      // Revert if request failed
      setJobs((prev) =>
        prev.map((item) => (item.id === matchId ? { ...item, status: markAsApplied ? "matched" : "applied" } : item))
      );
    }
  };

  const handleSkip = async (matchId) => {
    try {
      await updateJobMatchStatus(matchId, "skipped");
      setJobs((prev) => prev.filter((item) => item.id !== matchId));
    } catch (err) {
      console.error("Failed to skip job:", err);
    }
  };

  return (
    <div className="aa-container" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="aa-flex-between">
        <div>
          <h1 className="aa-title" style={{ fontSize: "2rem" }}>Discovered Jobs Engine</h1>
          <p className="aa-subtitle">All opportunities discovered across multiple API sources and evaluated by AI.</p>
        </div>

        <button onClick={handleSearch} disabled={searching} className="aa-btn aa-btn-primary">
          <Sparkles size={16} />
          {searching ? "Searching..." : "Discover New Jobs"}
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
        {[
          { key: "matched", label: "Matched Opportunities" },
          { key: "applied", label: "Applied Jobs ✓" },
          { key: "all", label: "All Discovered" },
          { key: "skipped", label: "Skipped" }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`aa-btn ${filter === tab.key ? "aa-btn-outline" : "aa-btn-secondary"}`}
            style={{ padding: "6px 16px", fontSize: "0.82rem", fontWeight: filter === tab.key ? 700 : 500 }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <div style={{ display: "flex", minHeight: "40vh", alignItems: "center", justifyContent: "center" }}>
          <div className="loader-spinner" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="aa-card" style={{ textAlign: "center", padding: 60 }}>
          <Briefcase size={40} color="var(--muted)" style={{ margin: "0 auto 12px", display: "block" }} />
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)" }}>
            {filter === "applied" ? "No Applied Jobs Saved Yet" : "No Jobs Discovered Yet"}
          </h3>
          <p className="aa-subtitle" style={{ fontSize: "0.88rem" }}>
            {filter === "applied"
              ? "Tick off 'Mark Applied' on any job card to save it here in your applied jobs tracker."
              : "Click 'Discover New Jobs' to trigger an instant discovery cycle across all sources."}
          </p>
        </div>
      ) : (
        <div className="aa-grid-2">
          {jobs.map((item) => (
            <JobCard key={item.id} matchItem={item} onToggleApplied={handleToggleApplied} onSkip={handleSkip} />
          ))}
        </div>
      )}
    </div>
  );
}
