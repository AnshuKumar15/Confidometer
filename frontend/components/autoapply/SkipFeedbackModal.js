"use client";

import { useEffect, useState } from "react";
import { Clock, MapPin, Wrench, AlertOctagon, X, Sparkles, Check } from "lucide-react";

const SKIP_REASONS = [
  {
    key: "experience",
    label: "Experience mismatch",
    description: "Role requires more or less seniority/experience than my profile",
    icon: Clock,
    color: "var(--amber)",
    accentBg: "rgba(217, 119, 6, 0.08)",
    accentBorder: "rgba(217, 119, 6, 0.4)"
  },
  {
    key: "location",
    label: "Location mismatch",
    description: "Location is outside my target cities or work mode preference",
    icon: MapPin,
    color: "var(--cyan)",
    accentBg: "rgba(2, 132, 199, 0.08)",
    accentBorder: "rgba(2, 132, 199, 0.4)"
  },
  {
    key: "skill",
    label: "Job / skill mismatch",
    description: "Tech stack, responsibilities, or role domain do not match",
    icon: Wrench,
    color: "var(--teal)",
    accentBg: "rgba(22, 160, 133, 0.08)",
    accentBorder: "rgba(22, 160, 133, 0.4)"
  },
  {
    key: "expired",
    label: "No longer accepting application",
    description: "Posting is closed, expired, or link is no longer valid",
    icon: AlertOctagon,
    color: "var(--danger)",
    accentBg: "rgba(225, 29, 72, 0.08)",
    accentBorder: "rgba(225, 29, 72, 0.4)"
  }
];

export default function SkipFeedbackModal({ isOpen, targetItem, onClose, onConfirmSkip }) {
  const [selectedReasons, setSelectedReasons] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setSelectedReasons([]);
    }
  }, [isOpen, targetItem]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !targetItem) return null;

  const job = targetItem.job || targetItem;

  const toggleReason = (label) => {
    setSelectedReasons((prev) =>
      prev.includes(label) ? prev.filter((r) => r !== label) : [...prev, label]
    );
  };

  const handleConfirm = () => {
    if (selectedReasons.length === 0) {
      onConfirmSkip(["Candidate skipped without specific reason"]);
    } else {
      onConfirmSkip(selectedReasons);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(15, 26, 22, 0.5)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)"
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 540,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-lg, 20px)",
          boxShadow: "0 20px 45px rgba(26, 61, 52, 0.12), 0 8px 20px rgba(0, 0, 0, 0.06)",
          padding: "26px 28px",
          color: "var(--text)",
          position: "relative"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            background: "var(--bg-2)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-md, 10px)",
            padding: "7px",
            color: "var(--muted)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s ease"
          }}
          title="Cancel"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text)";
            e.currentTarget.style.borderColor = "var(--teal)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--muted)";
            e.currentTarget.style.borderColor = "var(--line)";
          }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.8rem",
              fontWeight: 800,
              color: "var(--teal)",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.5px"
            }}
          >
            <Sparkles size={14} /> Help ApplyBuddy Learn
          </div>
          <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: "0 0 6px 0", color: "var(--text)", letterSpacing: "-0.3px" }}>
            Why are you skipping this role?
          </h2>
          <p style={{ fontSize: "0.88rem", color: "var(--muted)", margin: "0 0 12px 0", lineHeight: 1.4 }}>
            <strong style={{ color: "var(--text)", fontWeight: 700 }}>{job.title}</strong> at{" "}
            <strong style={{ color: "var(--text)", fontWeight: 700 }}>{job.company}</strong>
          </p>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--muted)" }}>
            <span>Select one or more options that apply:</span>
            {selectedReasons.length > 0 && (
              <span
                style={{
                  fontWeight: 700,
                  color: "var(--teal)",
                  background: "rgba(22, 160, 133, 0.12)",
                  border: "1px solid rgba(22, 160, 133, 0.25)",
                  padding: "2px 10px",
                  borderRadius: 14,
                  fontSize: "0.75rem"
                }}
              >
                {selectedReasons.length} selected
              </span>
            )}
          </div>
        </div>

        {/* Multi-Select Reason Cards Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          {SKIP_REASONS.map((r) => {
            const Icon = r.icon;
            const isSelected = selectedReasons.includes(r.label);

            return (
              <button
                key={r.key}
                onClick={() => toggleReason(r.label)}
                type="button"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "13px 16px",
                  borderRadius: "var(--radius-md, 12px)",
                  background: isSelected ? r.accentBg : "var(--bg-2)",
                  border: isSelected ? `1.5px solid ${r.color}` : "1px solid var(--line)",
                  boxShadow: isSelected ? `0 2px 10px ${r.accentBg}` : "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: "inherit",
                  transition: "all 0.15s ease",
                  width: "100%",
                  userSelect: "none"
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = r.accentBorder;
                    e.currentTarget.style.background = r.accentBg;
                  }
                  e.currentTarget.style.transform = "translateX(2px)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "var(--line)";
                    e.currentTarget.style.background = "var(--bg-2)";
                  }
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                {/* Reason Category Icon */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    color: r.color,
                    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.04)"
                  }}
                >
                  <Icon size={19} />
                </div>

                {/* Text Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.93rem", fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
                    {r.label}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", lineHeight: 1.3 }}>
                    {r.description}
                  </div>
                </div>

                {/* Checkbox indicator */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: isSelected ? `2px solid ${r.color}` : "1.5px solid var(--line)",
                    background: isSelected ? r.color : "var(--surface)",
                    color: "#ffffff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.15s ease",
                    boxShadow: isSelected ? "0 2px 6px rgba(0, 0, 0, 0.15)" : "none"
                  }}
                >
                  {isSelected && <Check size={14} strokeWidth={3} color="#ffffff" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 16,
            borderTop: "1px solid var(--line)",
            flexWrap: "wrap",
            gap: 12
          }}
        >
          <button
            onClick={() => onConfirmSkip(["Candidate skipped without specific reason"])}
            type="button"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--muted)",
              fontSize: "0.83rem",
              cursor: "pointer",
              padding: "6px 8px",
              textDecoration: "underline",
              transition: "color 0.15s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--muted)";
            }}
          >
            Just skip without feedback
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={onClose}
              type="button"
              className="aa-btn aa-btn-secondary"
              style={{ padding: "8px 18px", fontSize: "0.85rem" }}
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              type="button"
              className="aa-btn aa-btn-primary"
              style={{
                padding: "8px 20px",
                fontSize: "0.85rem",
                fontWeight: 700,
                opacity: selectedReasons.length === 0 ? 0.5 : 1,
                cursor: selectedReasons.length === 0 ? "not-allowed" : "pointer"
              }}
              disabled={selectedReasons.length === 0}
            >
              Confirm Skip {selectedReasons.length > 0 ? `(${selectedReasons.length})` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
