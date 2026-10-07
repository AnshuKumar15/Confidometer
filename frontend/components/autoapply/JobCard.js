"use client";

import MatchScoreBadge from "./MatchScoreBadge";
import { Building2, MapPin, ExternalLink, CheckCircle2, AlertCircle, Clock } from "lucide-react";

function formatJobDate(postedDate, createdAt) {
  if (!postedDate && !createdAt) return null;
  try {
    let dateObj = null;
    if (postedDate) {
      const s = String(postedDate).trim();
      if (/^\d{10}$/.test(s)) {
        dateObj = new Date(parseInt(s, 10) * 1000);
      } else {
        dateObj = new Date(s);
      }
    }
    if ((!dateObj || isNaN(dateObj.getTime())) && createdAt) {
      dateObj = new Date(createdAt);
    }
    if (!dateObj || isNaN(dateObj.getTime())) {
      return postedDate;
    }
    const diffMs = Date.now() - dateObj.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours >= 0 && diffHours < 1) return "Just now";
    if (diffHours >= 1 && diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays >= 1 && diffDays < 7) return `${diffDays}d ago`;
    if (diffDays >= 7 && diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch (e) {
    return postedDate;
  }
}

export default function JobCard({ matchItem, onApply, onSkip, onToggleApplied }) {
  const { id, job, overall_score, missing_skills, strengths, status, skip_reason } = matchItem;
  const isApplied = status === "applied";
  const formattedDate = formatJobDate(job?.posted_date, job?.created_at);

  return (
    <div className="aa-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", border: isApplied ? "1px solid rgba(45, 212, 191, 0.4)" : "1px solid var(--line)" }}>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h3 style={{ fontSize: "1.15rem", fontWeight: 800, margin: 0, color: "var(--text)" }}>
                {job.title}
              </h3>
              {isApplied && (
                <span className="aa-badge-tag matched" style={{ padding: "2px 8px", fontSize: "0.75rem" }}>
                  <CheckCircle2 size={12} /> APPLIED
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, fontSize: "0.85rem", color: "var(--muted)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: "var(--text)" }}>
                <Building2 size={14} color="var(--teal)" />
                {job.company}
              </span>
              <span>•</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <MapPin size={14} color="var(--cyan)" />
                {job.location || "Remote"}
              </span>
              <span>•</span>
              <span className="aa-badge-tag">{job.source_platform.toUpperCase()}</span>
              {job.work_mode && (
                <>
                  <span>•</span>
                  <span className="aa-badge-tag" style={{ fontSize: "0.74rem", textTransform: "capitalize" }}>
                    {job.work_mode === "onsite" ? "On-site" : job.work_mode}
                  </span>
                </>
              )}
              {job.min_experience !== null && job.min_experience !== undefined ? (
                <>
                  <span>•</span>
                  <span className="aa-badge-tag matched" style={{ fontSize: "0.74rem" }}>
                    {job.max_experience !== null && job.max_experience !== undefined
                      ? `${job.min_experience}-${job.max_experience} ${job.max_experience === 1 ? "Yr" : "Yrs"}`
                      : job.min_experience === 0
                      ? "0-1 Yr"
                      : `${job.min_experience}+ Yrs`}
                  </span>
                </>
              ) : matchItem.match_reasons?.some((r) => r.toLowerCase().includes("open experience")) ? (
                <>
                  <span>•</span>
                  <span className="aa-badge-tag" style={{ border: "1px solid rgba(45, 212, 191, 0.4)", color: "var(--teal)" }}>
                    Open Exp
                  </span>
                </>
              ) : matchItem.match_reasons?.some((r) => r.toLowerCase().includes("early-career") || r.toLowerCase().includes("entry-level")) ? (
                <>
                  <span>•</span>
                  <span className="aa-badge-tag matched" style={{ fontSize: "0.74rem" }}>
                    0-1 Yr
                  </span>
                </>
              ) : matchItem.match_reasons?.some((r) => r.toLowerCase().includes("mid-level") || r.toLowerCase().includes("2-4")) ? (
                <>
                  <span>•</span>
                  <span className="aa-badge-tag matched" style={{ fontSize: "0.74rem" }}>
                    2-4 Yrs
                  </span>
                </>
              ) : matchItem.match_reasons?.some((r) => r.toLowerCase().includes("senior") || r.toLowerCase().includes("5-9")) ? (
                <>
                  <span>•</span>
                  <span className="aa-badge-tag matched" style={{ fontSize: "0.74rem" }}>
                    Senior
                  </span>
                </>
              ) : null}
              {formattedDate && (
                <>
                  <span>•</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <Clock size={11} color="var(--cyan)" />
                    {formattedDate}
                  </span>
                </>
              )}
            </div>
          </div>

          <MatchScoreBadge score={overall_score} size="md" />
        </div>

        {/* Strengths & Missing Skills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
          {strengths?.slice(0, 3).map((skill, idx) => (
            <span key={idx} className="aa-badge-tag matched">
              <CheckCircle2 size={11} /> {skill}
            </span>
          ))}

          {missing_skills?.slice(0, 2).map((skill, idx) => (
            <span key={idx} className="aa-badge-tag missing">
              <AlertCircle size={11} /> Missing: {skill}
            </span>
          ))}
        </div>

        {skip_reason && (
          <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.2)", fontSize: "0.78rem", color: "var(--amber)" }}>
            Skipped: {skip_reason}
          </div>
        )}
      </div>

      {/* Actions Footer */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a
          href={job.application_url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)", textDecoration: "none" }}
        >
          View Posting <ExternalLink size={13} />
        </a>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Tick Box Option to Mark as Applied */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onToggleApplied) onToggleApplied(id, !isApplied);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: "0.82rem",
              fontWeight: 700,
              background: isApplied ? "rgba(45, 212, 191, 0.18)" : "rgba(255, 255, 255, 0.05)",
              border: isApplied ? "1px solid #2dd4bf" : "1px solid var(--line)",
              color: isApplied ? "#2dd4bf" : "var(--text)",
              transition: "all 0.15s ease",
              userSelect: "none"
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                border: isApplied ? "1px solid #2dd4bf" : "1.5px solid var(--muted)",
                background: isApplied ? "#2dd4bf" : "transparent",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#000",
                fontSize: "11px",
                fontWeight: 900
              }}
            >
              {isApplied ? "✓" : ""}
            </span>
            {isApplied ? "Applied ✓" : "Mark Applied"}
          </button>

          {onSkip && status !== "skipped" && (
            <button onClick={() => onSkip(matchItem)} className="aa-btn aa-btn-secondary" style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
