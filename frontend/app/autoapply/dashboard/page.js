"use client";

import { useEffect, useState } from "react";
import { getDashboardStats, getActivityLog } from "@/utils/autoapply_api";
import StatCard from "@/components/autoapply/StatCard";
import { BarChart2, Briefcase, CheckCircle, Clock, Sparkles, TrendingUp } from "lucide-react";

export default function AutoApplyDashboard() {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [dashData, activityData] = await Promise.all([
          getDashboardStats(),
          getActivityLog()
        ]);
        setStats(dashData);
        setActivities(activityData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "50vh", alignItems: "center", justifyContent: "center" }}>
        <div className="loader-spinner" />
      </div>
    );
  }

  return (
    <div className="aa-container" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 className="aa-title" style={{ fontSize: "2rem" }}>AutoApply Performance Dashboard</h1>
        <p className="aa-subtitle">Detailed analytics, conversion metrics, and system activity.</p>
      </div>

      {/* Metrics Row 1 */}
      <div className="aa-grid-4">
        <StatCard title="Applications Prepared" value={stats?.total_jobs_applied || 0} subtitle="Ready to submit" icon={Briefcase} />
        <StatCard title="Jobs Found & Evaluated" value={stats?.total_jobs_found || 0} subtitle="Across all sources" icon={BarChart2} />
        <StatCard title="Avg Match Score" value={`${stats?.average_match_score || 0}%`} subtitle="Precision score" icon={TrendingUp} />
        <StatCard title="Interviews & Offers" value={`${stats?.interviews || 0} / ${stats?.offers || 0}`} subtitle="Conversion count" icon={CheckCircle} />
      </div>

      {/* Grid Layout: Status Breakdown + Activity Log */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {/* Status Distribution */}
        <div className="aa-card">
          <div className="aa-card-header">
            <h3 className="aa-card-title"><BarChart2 size={20} color="var(--teal)" /> Status Distribution</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.entries(stats?.status_distribution || {}).map(([key, val]) => (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>
                  <span>{key}</span>
                  <span>{val}</span>
                </div>
                <div style={{ height: 8, width: "100%", borderRadius: 4, background: "var(--surface-strong)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (val / Math.max(1, stats?.total_jobs_found || 1)) * 100)}%`,
                      background: "linear-gradient(90deg, var(--teal), #14b8a6)",
                      borderRadius: 4
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Activity Timeline */}
        <div className="aa-card">
          <div className="aa-card-header">
            <h3 className="aa-card-title"><Clock size={20} color="var(--cyan)" /> System Activity Log</h3>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 350, overflowY: "auto" }}>
            {activities.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--muted)", fontStyle: "italic" }}>No activity recorded yet.</p>
            ) : (
              activities.map((act) => (
                <div key={act.id} style={{ padding: 12, borderRadius: 12, background: "var(--surface-strong)", border: "1px solid var(--line)", display: "flex", gap: 12 }}>
                  <Sparkles size={18} color="var(--teal)" style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text)", textTransform: "uppercase" }}>{act.action}</div>
                    <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "2px 0 0 0" }}>{JSON.stringify(act.details)}</p>
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginTop: 4 }}>
                      {new Date(act.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
