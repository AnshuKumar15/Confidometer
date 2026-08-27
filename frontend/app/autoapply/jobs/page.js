"use client";

import { useEffect, useState, useCallback } from "react";
import { getDiscoveredJobs, triggerJobSearch, updateJobMatchStatus } from "@/utils/autoapply_api";
import JobCard from "@/components/autoapply/JobCard";
import { Briefcase, Sparkles, CheckCircle2, Search, Filter, Layers, RefreshCw } from "lucide-react";

const PLATFORMS = [
  { key: "all", label: "All Platforms" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "instahyre", label: "Instahyre" },
  { key: "unstop", label: "Unstop India" },
  { key: "wellfound", label: "Wellfound" },
  { key: "jobicy", label: "Jobicy" },
  { key: "arbeitnow", label: "Arbeitnow" },
  { key: "remotive", label: "Remotive" },
  { key: "indeed", label: "Indeed / JSearch" },
  { key: "foundit", label: "Foundit" },
];

export default function DiscoveredJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState("matched");
  const [platform, setPlatform] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searching, setSearching] = useState(false);

  const loadJobs = useCallback(async (isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const currentOffset = isLoadMore ? jobs.length : 0;
      const data = await getDiscoveredJobs({
        status: filter,
        platform: platform,
        search: search,
        limit: 50,
        offset: currentOffset,
      });

      if (isLoadMore) {
        setJobs((prev) => [...prev, ...data]);
        setHasMore(data.length === 50);
      } else {
        setJobs(data);
        setHasMore(data.length === 50);
      }
    } catch (err) {
      console.error("Error loading jobs:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, platform, search, jobs.length]);

  useEffect(() => {
    loadJobs(false);
  }, [filter, platform, search]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleSearch = async () => {
    setSearching(true);
    try {
      await triggerJobSearch();
      await loadJobs(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const handleToggleApplied = async (matchId, markAsApplied) => {
    const newStatus = markAsApplied ? "applied" : "matched";

    // 1. Optimistic UI update
    setJobs((prev) =>
      prev.map((item) => (item.id === matchId ? { ...item, status: newStatus } : item))
    );

    // 2. Persist to backend database
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
      {/* Header */}
      <div className="aa-flex-between" style={{ flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 className="aa-title" style={{ fontSize: "2rem" }}>Discovered Jobs Engine</h1>
          <p className="aa-subtitle">
            Opportunities discovered across LinkedIn, Instahyre, Unstop, Wellfound, Indeed, and more.
          </p>
        </div>

        <button onClick={handleSearch} disabled={searching} className="aa-btn aa-btn-primary">
          <Sparkles size={16} />
          {searching ? "Searching all sources..." : "Discover New Jobs"}
        </button>
      </div>

      {/* Search & Top Controls */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
        {/* Status Filter Tabs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
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
              style={{ padding: "6px 14px", fontSize: "0.82rem", fontWeight: filter === tab.key ? 700 : 500 }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Live Search Input */}
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 6, minWidth: 260 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input
              type="text"
              placeholder="Search title, company, skills..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="aa-input"
              style={{ paddingLeft: 34, fontSize: "0.85rem", height: 38 }}
            />
          </div>
          <button type="submit" className="aa-btn aa-btn-secondary" style={{ padding: "0 12px", height: 38, fontSize: "0.82rem" }}>
            Filter
          </button>
        </form>
      </div>

      {/* Platform Filter Pills */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
          Platform:
        </span>
        {PLATFORMS.map((p) => {
          const isActive = platform === p.key;
          return (
            <button
              key={p.key}
              onClick={() => setPlatform(p.key)}
              className="aa-badge-tag"
              style={{
                cursor: "pointer",
                border: isActive ? "1px solid var(--teal)" : "1px solid var(--line)",
                background: isActive ? "rgba(45, 212, 191, 0.15)" : "transparent",
                color: isActive ? "var(--teal)" : "var(--muted)",
                fontWeight: isActive ? 700 : 500,
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: "0.78rem",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease"
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Results Header */}
      {!loading && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.82rem", color: "var(--muted)" }}>
          <span>
            Showing <strong style={{ color: "var(--text)" }}>{jobs.length}</strong> {filter} opportunities
            {platform !== "all" && <span> on <strong style={{ color: "var(--teal)" }}>{platform.toUpperCase()}</strong></span>}
            {search && <span> matching &ldquo;<strong style={{ color: "var(--teal)" }}>{search}</strong>&rdquo;</span>}
          </span>
        </div>
      )}

      {/* Jobs Grid */}
      {loading ? (
        <div style={{ display: "flex", minHeight: "40vh", alignItems: "center", justifyContent: "center" }}>
          <div className="loader-spinner" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="aa-card" style={{ textAlign: "center", padding: 60 }}>
          <Briefcase size={40} color="var(--muted)" style={{ margin: "0 auto 12px", display: "block" }} />
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)" }}>
            {filter === "applied" ? "No Applied Jobs Saved Yet" : "No Jobs Found"}
          </h3>
          <p className="aa-subtitle" style={{ fontSize: "0.88rem" }}>
            {filter === "applied"
              ? "Tick off 'Mark Applied' on any job card to save it here in your applied jobs tracker."
              : platform !== "all"
              ? `No jobs found for ${platform.toUpperCase()}. Try selecting 'All Platforms' or click 'Discover New Jobs'.`
              : "Click 'Discover New Jobs' to trigger an instant discovery cycle across all sources."}
          </p>
        </div>
      ) : (
        <>
          <div className="aa-grid-2">
            {jobs.map((item) => (
              <JobCard key={item.id} matchItem={item} onToggleApplied={handleToggleApplied} onSkip={handleSkip} />
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
              <button
                onClick={() => loadJobs(true)}
                disabled={loadingMore}
                className="aa-btn aa-btn-secondary"
                style={{ padding: "10px 28px", fontSize: "0.9rem" }}
              >
                {loadingMore ? <RefreshCw size={16} className="spin" /> : <Layers size={16} />}
                {loadingMore ? "Loading More Jobs..." : "Load More Opportunities"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
