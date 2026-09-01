"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAutoApplyConfig, updateAutoApplyConfig, getPreferences, updatePreferences } from "@/utils/autoapply_api";
import { Sliders, Key, Save } from "lucide-react";
import { useToast } from "@/components/Toast";

export default function AutoApplySettingsPage() {
  const toast = useToast();
  const [config, setConfig] = useState({
    enabled: true,
    min_match_score: 85,
    daily_limit: 20,
    search_frequency_minutes: 60,
    cover_letter_style: "professional"
  });

  const [apiKeys, setApiKeys] = useState({
    rapidapi_key: "",
    adzuna_app_id: ""
  });

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const [c, p] = await Promise.all([getAutoApplyConfig(), getPreferences()]);
        if (c) setConfig(c);
        if (p?.api_keys) setApiKeys(p.api_keys);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateAutoApplyConfig(config),
        updatePreferences({ api_keys: apiKeys })
      ]);
      toast.success("Settings updated successfully!");
    } catch (err) {
      toast.error("Failed to save settings: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "50vh", alignItems: "center", justifyContent: "center" }}>
        <div className="loader-spinner" />
      </div>
    );
  }

  return (
    <div className="aa-container" style={{ maxWidth: 780, display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h1 className="aa-title" style={{ fontSize: "2rem" }}>ApplyBuddy Automation Settings</h1>
        <p className="aa-subtitle">Configure matching thresholds, daily application limits, and API keys.</p>
      </div>

      {/* Automation Controls */}
      <div className="aa-card">
        <div className="aa-card-header">
          <h3 className="aa-card-title"><Sliders size={20} color="var(--teal)" /> Automation Rules</h3>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyBetween: "space-between", paddingBottom: 16, borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--text)" }}>Enable ApplyBuddy Engine</span>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", margin: "2px 0 0 0" }}>Continuously search and prepare applications in background</p>
          </div>
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            style={{ width: 20, height: 20 }}
          />
        </div>

        <div className="aa-form-group">
          <label className="aa-label">Minimum Match Score ({config.min_match_score}%)</label>
          <input
            type="range"
            min="50"
            max="95"
            value={config.min_match_score}
            onChange={(e) => setConfig({ ...config, min_match_score: Number(e.target.value) })}
            style={{ width: "100%", marginTop: 8 }}
          />
        </div>

        <div className="aa-grid-2">
          <div className="aa-form-group">
            <label className="aa-label">Daily Application Limit</label>
            <input
              type="number"
              className="aa-input"
              value={config.daily_limit}
              onChange={(e) => setConfig({ ...config, daily_limit: Number(e.target.value) })}
            />
          </div>

          <div className="aa-form-group">
            <label className="aa-label">Cover Letter Tone</label>
            <select
              value={config.cover_letter_style}
              onChange={(e) => setConfig({ ...config, cover_letter_style: e.target.value })}
              className="aa-select"
            >
              <option value="professional">Professional</option>
              <option value="casual">Casual / Startup</option>
              <option value="academic">Academic</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tier 2 User API Keys */}
      <div className="aa-card">
        <div className="aa-card-header">
          <h3 className="aa-card-title"><Key size={20} color="var(--cyan)" /> Tier 2 API Keys (Optional)</h3>
        </div>
        <p className="aa-subtitle" style={{ fontSize: "0.85rem", marginBottom: 16 }}>
          Add custom API keys to expand job search coverage via premium platforms like JSearch.
        </p>

        <div className="aa-form-group">
          <label className="aa-label">RapidAPI Key (For Live Indeed & Foundit Jobs via JSearch)</label>
          <input
            type="password"
            className="aa-input"
            placeholder="Enter RapidAPI Key"
            value={apiKeys.rapidapi_key || ""}
            onChange={(e) => setApiKeys({ ...apiKeys, rapidapi_key: e.target.value })}
          />
          <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 8, background: "rgba(56, 189, 248, 0.08)", border: "1px solid rgba(56, 189, 248, 0.2)", fontSize: "0.82rem", color: "var(--text)" }}>
            <span style={{ fontWeight: 700, color: "var(--cyan)" }}>Notice on Indeed & Foundit volume:</span> Standard Free RapidAPI JSearch plans include 50 requests/month. When the quota is reached (HTTP 429), Indeed and Foundit discovery pauses while LinkedIn, Instahyre, Unstop, and Wellfound continue uninterrupted. Entering an upgraded or fresh RapidAPI key here restores real-time Indeed and Foundit polling immediately.
          </div>
        </div>
      </div>

      {/* Re-run Onboarding & Reset Preferences */}
      <div className="aa-card" style={{ border: "1px dashed var(--line)", background: "rgba(45, 212, 191, 0.03)" }}>
        <div className="aa-flex-between">
          <div>
            <h3 style={{ fontSize: "1.05rem", fontWeight: 800, margin: "0 0 4px 0", color: "var(--text)" }}>Re-run Step-by-Step Onboarding Setup</h3>
            <p className="aa-subtitle" style={{ fontSize: "0.83rem", margin: 0 }}>
              Re-enter your target roles, salary range in INR, work modes, and job search goals anytime.
            </p>
          </div>
          <Link href="/autoapply/onboarding?reset=true" className="aa-btn aa-btn-secondary" style={{ padding: "10px 18px", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
            Re-run Setup Wizard ⚙️
          </Link>
        </div>
      </div>

      <div>
        <button onClick={handleSave} disabled={saving} className="aa-btn aa-btn-primary" style={{ padding: "12px 28px", fontSize: "0.95rem" }}>
          <Save size={16} />
          {saving ? "Saving Settings..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
