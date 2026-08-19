"use client";

import { useEffect, useState } from "react";
import { getApplications, updateApplicationStatus } from "@/utils/autoapply_api";
import { CheckCircle, ExternalLink, FileText } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function ApplicationsTrackerPage() {
  const toast = useToast();
  const [applications, setApplications] = useState([]);
  const [selectedApp, setSelectedApp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadApps() {
      try {
        const data = await getApplications();
        setApplications(data);
        if (data.length > 0) setSelectedApp(data[0]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadApps();
  }, []);

  const handleStatusChange = async (appId, newStatus) => {
    try {
      const updated = await updateApplicationStatus(appId, newStatus);
      setApplications(prev => prev.map(a => a.id === appId ? updated : a));
      if (selectedApp?.id === appId) setSelectedApp(updated);
      toast.success(`Application status updated to ${newStatus}`);
    } catch (err) {
      toast.error("Status update failed: " + (err.message || "Unknown error"));
    }
  };

  return (
    <div className="aa-container" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 className="aa-title" style={{ fontSize: "2rem" }}>Application Tracker</h1>
        <p className="aa-subtitle">Review auto-prepared cover letters, form answers, and application statuses.</p>
      </div>

      {loading ? (
        <div style={{ display: "flex", minHeight: "40vh", alignItems: "center", justifyContent: "center" }}>
          <div className="loader-spinner" />
        </div>
      ) : applications.length === 0 ? (
        <div className="aa-card" style={{ textAlign: "center", padding: 60 }}>
          <CheckCircle size={40} color="var(--muted)" style={{ margin: "0 auto 12px", display: "block" }} />
          <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)" }}>No Applications Prepared Yet</h3>
          <p className="aa-subtitle" style={{ fontSize: "0.88rem" }}>Applications are automatically prepared when high-match jobs are discovered.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
          {/* Applications List */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {applications.map((app) => (
              <div
                key={app.id}
                onClick={() => setSelectedApp(app)}
                className="aa-card"
                style={{
                  padding: 16,
                  cursor: "pointer",
                  borderColor: selectedApp?.id === app.id ? "var(--teal)" : "var(--line)",
                  background: selectedApp?.id === app.id ? "rgba(45, 212, 191, 0.08)" : "var(--surface)"
                }}
              >
                <div className="aa-flex-between">
                  <div>
                    <h4 style={{ fontSize: "0.95rem", fontWeight: 800, margin: "0 0 4px 0", color: "var(--text)" }}>{app.job?.title}</h4>
                    <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: 0 }}>{app.job?.company}</p>
                  </div>
                  <span className="aa-badge-tag matched" style={{ textTransform: "uppercase", fontSize: "0.7rem" }}>
                    {app.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Application Details */}
          {selectedApp && (
            <div className="aa-card">
              <div className="aa-card-header">
                <div>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "var(--text)" }}>{selectedApp.job?.title}</h2>
                  <p style={{ fontSize: "0.85rem", color: "var(--teal)", fontWeight: 700, margin: "4px 0 0 0" }}>{selectedApp.job?.company} • {selectedApp.job?.location}</p>
                </div>

                <a href={selectedApp.job?.application_url} target="_blank" rel="noopener noreferrer" className="aa-btn aa-btn-primary" style={{ padding: "6px 14px", fontSize: "0.8rem" }}>
                  Apply Link <ExternalLink size={13} />
                </a>
              </div>

              {/* Status Selector */}
              <div style={{ marginBottom: 20 }}>
                <label className="aa-label">Update Application Status</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {["ready", "submitted", "interview", "offer", "rejected"].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleStatusChange(selectedApp.id, st)}
                      className={`aa-btn ${selectedApp.status === st ? "aa-btn-primary" : "aa-btn-secondary"}`}
                      style={{ padding: "6px 12px", fontSize: "0.78rem", textTransform: "capitalize" }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cover Letter Preview */}
              <div>
                <h4 style={{ fontSize: "0.9rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <FileText size={16} color="var(--teal)" /> AI Generated Cover Letter
                </h4>
                <div style={{ background: "var(--surface-strong)", border: "1px solid var(--line)", padding: 16, borderRadius: 12, fontSize: "0.85rem", lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap" }}>
                  {selectedApp.cover_letter || "No cover letter generated."}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
