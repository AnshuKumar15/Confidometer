"use client";

export default function StatCard({ icon: Icon, title, value, subtitle, color = "teal" }) {
  return (
    <div className="aa-stat-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="aa-stat-label">{title}</span>
        {Icon && <Icon size={18} color="var(--teal)" />}
      </div>

      <div className="aa-stat-value">{value}</div>

      {subtitle && <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: 0 }}>{subtitle}</p>}
    </div>
  );
}
