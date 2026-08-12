"use client";

import { useState, useEffect } from "react";
import { IndianRupee } from "lucide-react";

export default function SalaryRangeSlider({ minSalary = 800000, preferredSalary = 2000000, onChange }) {
  const MAX_CAP = 50; // 50 LPA max

  const [minLPA, setMinLPA] = useState(Math.min(MAX_CAP, Math.max(0, Number((minSalary / 100000).toFixed(1)))));
  const [maxLPA, setMaxLPA] = useState(Math.min(MAX_CAP, Math.max(0, Number((preferredSalary / 100000).toFixed(1)))));

  useEffect(() => {
    const minVal = Math.min(MAX_CAP, Math.max(0, Number((minSalary / 100000).toFixed(1))));
    const maxVal = Math.min(MAX_CAP, Math.max(0, Number((preferredSalary / 100000).toFixed(1))));
    setMinLPA(minVal);
    setMaxLPA(Math.max(minVal, maxVal));
  }, [minSalary, preferredSalary]);

  const handleMinSliderChange = (e) => {
    const value = Math.min(Number(e.target.value), maxLPA - 0.5);
    const newMin = Math.max(0, value);
    setMinLPA(newMin);
    onChange({ minSalary: newMin * 100000, preferredSalary: maxLPA * 100000 });
  };

  const handleMaxSliderChange = (e) => {
    const value = Math.max(Number(e.target.value), minLPA + 0.5);
    const newMax = Math.min(MAX_CAP, value);
    setMaxLPA(newMax);
    onChange({ minSalary: minLPA * 100000, preferredSalary: newMax * 100000 });
  };

  const handleMinInputChange = (e) => {
    let val = Number(e.target.value);
    if (isNaN(val)) val = 0;
    val = Math.max(0, Math.min(val, maxLPA));
    setMinLPA(val);
    onChange({ minSalary: val * 100000, preferredSalary: maxLPA * 100000 });
  };

  const handleMaxInputChange = (e) => {
    let val = Number(e.target.value);
    if (isNaN(val)) val = minLPA;
    val = Math.max(minLPA, Math.min(MAX_CAP, val));
    setMaxLPA(val);
    onChange({ minSalary: minLPA * 100000, preferredSalary: val * 100000 });
  };

  const formatRupees = (lpa) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(lpa * 100000);
  };

  const minPercent = (minLPA / MAX_CAP) * 100;
  const maxPercent = (maxLPA / MAX_CAP) * 100;

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 20, padding: 24 }}>
      {/* Header */}
      <div className="aa-flex-between" style={{ marginBottom: 20 }}>
        <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 8 }}>
          <IndianRupee size={18} color="var(--teal)" /> Target Salary Range (INR)
        </span>
        <span className="aa-badge aa-badge-score-high" style={{ fontSize: "0.85rem", padding: "6px 14px" }}>
          {minLPA} LPA — {maxLPA} LPA
        </span>
      </div>

      {/* Dual Thumb Multi-Range Slider Track */}
      <div style={{ position: "relative", width: "100%", height: 40, margin: "10px 0 20px 0" }}>
        {/* Background Track */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 0,
            right: 0,
            height: 8,
            borderRadius: 4,
            background: "var(--surface-strong)",
            border: "1px solid var(--line)"
          }}
        />

        {/* Active Highlighted Range Bar */}
        <div
          style={{
            position: "absolute",
            top: 16,
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
            height: 8,
            borderRadius: 4,
            background: "linear-gradient(90deg, var(--teal), #14b8a6)"
          }}
        />

        {/* Range Input Left (Min Thumb) */}
        <input
          type="range"
          min="0"
          max={MAX_CAP}
          step="0.5"
          value={minLPA}
          onChange={handleMinSliderChange}
          style={{
            position: "absolute",
            top: 10,
            left: 0,
            width: "100%",
            height: 20,
            margin: 0,
            appearance: "none",
            background: "transparent",
            pointerEvents: "none",
            zIndex: minLPA > MAX_CAP - 5 ? 5 : 3
          }}
          className="dual-range-thumb"
        />

        {/* Range Input Right (Max Thumb) */}
        <input
          type="range"
          min="0"
          max={MAX_CAP}
          step="0.5"
          value={maxLPA}
          onChange={handleMaxSliderChange}
          style={{
            position: "absolute",
            top: 10,
            left: 0,
            width: "100%",
            height: 20,
            margin: 0,
            appearance: "none",
            background: "transparent",
            pointerEvents: "none",
            zIndex: 4
          }}
          className="dual-range-thumb"
        />
      </div>

      {/* Bidirectional Number Inputs & Exact Value Display */}
      <div className="aa-flex-between" style={{ gap: 16, flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid var(--line)" }}>
        {/* Min Salary Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)" }}>Min (0 LPA):</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number"
              step="0.5"
              min="0"
              max={maxLPA}
              value={minLPA}
              onChange={handleMinInputChange}
              className="aa-input"
              style={{ width: 70, padding: "6px 8px", textAlign: "center", fontSize: "0.9rem", fontWeight: 800 }}
            />
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--teal)" }}>LPA</span>
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>({formatRupees(minLPA)})</span>
        </div>

        {/* Max Salary Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--muted)" }}>Max ({MAX_CAP} LPA):</label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number"
              step="0.5"
              min={minLPA}
              max={MAX_CAP}
              value={maxLPA}
              onChange={handleMaxInputChange}
              className="aa-input"
              style={{ width: 70, padding: "6px 8px", textAlign: "center", fontSize: "0.9rem", fontWeight: 800 }}
            />
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--teal)" }}>LPA</span>
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>({formatRupees(maxLPA)})</span>
        </div>
      </div>
    </div>
  );
}
