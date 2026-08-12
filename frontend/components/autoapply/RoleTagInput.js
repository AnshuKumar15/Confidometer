"use client";

import { useState } from "react";
import { Plus, X, ChevronDown } from "lucide-react";

const SUGGESTED_ROLES = [
  "AI Engineer",
  "Machine Learning Engineer",
  "Data Scientist",
  "Backend Developer",
  "Software Engineer",
  "Frontend Developer",
  "Full Stack Developer",
  "DevOps Engineer",
  "Data Engineer",
  "Product Manager",
  "Mobile Developer",
  "Cloud Architect",
  "Security Engineer",
  "QA Automation Engineer"
];

export default function RoleTagInput({ selectedRoles = [], onChange }) {
  const [inputValue, setInputValue] = useState("");
  const [selectedDropdownRole, setSelectedDropdownRole] = useState("");

  const addRole = (roleToAdd) => {
    const trimmed = roleToAdd.trim();
    if (!trimmed) return;
    if (!selectedRoles.includes(trimmed)) {
      onChange([...selectedRoles, trimmed]);
    }
    setInputValue("");
    setSelectedDropdownRole("");
  };

  const removeRole = (roleToRemove) => {
    onChange(selectedRoles.filter((r) => r !== roleToRemove));
  };

  const handleDropdownSelect = (e) => {
    const val = e.target.value;
    if (val) {
      addRole(val);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addRole(inputValue);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Dropdown Select + Custom Input Row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={selectedDropdownRole}
          onChange={handleDropdownSelect}
          className="aa-select"
          style={{ flex: "1 1 200px" }}
        >
          <option value="">-- Select Popular Role --</option>
          {SUGGESTED_ROLES.filter((r) => !selectedRoles.includes(r)).map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 6, flex: "1 1 240px" }}>
          <input
            type="text"
            className="aa-input"
            placeholder="Or type custom role & press Enter..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            onClick={() => addRole(inputValue)}
            className="aa-btn aa-btn-secondary"
            style={{ padding: "0 14px", flexShrink: 0 }}
          >
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {/* Selected Role Tags Display */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minHeight: 32, marginTop: 4 }}>
        {selectedRoles.length === 0 ? (
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>
            No target roles selected. Choose a role from above or type a custom one.
          </span>
        ) : (
          selectedRoles.map((role) => (
            <span
              key={role}
              className="aa-badge-tag matched"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                fontSize: "0.85rem",
                borderRadius: 20,
                fontWeight: 700
              }}
            >
              {role}
              <button
                type="button"
                onClick={() => removeRole(role)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  padding: 0,
                  marginLeft: 2,
                  opacity: 0.8
                }}
                title={`Remove ${role}`}
              >
                <X size={14} />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
