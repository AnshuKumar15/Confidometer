"use client";

export default function MatchScoreBadge({ score = 0, size = "md" }) {
  let badgeClass = "aa-badge-score-high";
  if (score < 75) {
    badgeClass = "aa-badge-score-mid";
  }
  if (score < 55) {
    badgeClass = "aa-badge-score-low";
  }

  const fontSizes = {
    sm: { fontSize: "0.75rem", padding: "2px 8px" },
    md: { fontSize: "0.82rem", padding: "4px 12px" },
    lg: { fontSize: "0.95rem", padding: "6px 16px" }
  };

  return (
    <span className={`aa-badge ${badgeClass}`} style={fontSizes[size]}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
      {score}% Match
    </span>
  );
}
