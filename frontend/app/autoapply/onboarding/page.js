"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { parseResume, completeOnboarding, getProfile, getPreferences } from "@/utils/autoapply_api";
import { Upload, Check, ArrowRight, ArrowLeft, Sparkles, Building2, ShieldAlert, Sliders, Briefcase, GraduationCap, MapPin, Target, X, Plus } from "lucide-react";
import RoleTagInput from "@/components/autoapply/RoleTagInput";
import SalaryRangeSlider from "@/components/autoapply/SalaryRangeSlider";

const STEPS = [
  "Upload Resume",
  "Your Goals",
  "Work & Location",
  "Background",
  "Review Profile",
  "Filters & Rules",
  "Launch"
];

const GOAL_OPTIONS = [
  { id: "Urgent income for my basic needs", label: "Urgent income for my basic needs" },
  { id: "First full-time job for career start", label: "First full-time job for career start" },
  { id: "Extra source of income", label: "Extra source of income" },
  { id: "Better work-life balance", label: "Better work-life balance" },
  { id: "Secure, long-term job in my field", label: "Secure, long-term job in my field" }
];

const WORK_MODE_OPTIONS = ["Fully remote", "Hybrid", "In-office"];

const POPULAR_CITIES = ["Bengaluru", "Mumbai", "Delhi-NCR", "Hyderabad", "Pune", "Chennai", "Noida", "Gurugram", "Remote"];

const EDUCATION_OPTIONS = [
  "No formal education",
  "High school",
  "Associate",
  "Bachelor's",
  "Master's",
  "Doctorate / PhD"
];

const EXPERIENCE_YEAR_OPTIONS = [
  "0-1 year",
  "2-4 years",
  "5-9 years",
  "10-19 years",
  "20+ years"
];

export default function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cityInput, setCityInput] = useState("");

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    skills: [],
    technical_skills: [],
    soft_skills: [],
    work_experience: [],
    education: [],
    github: "",
    linkedin: "",
    portfolio: "",
    career_goals: ""
  });

  const [preferences, setPreferences] = useState({
    job_titles: ["AI Engineer", "Software Engineer"],
    locations: ["Bengaluru", "Remote"],
    work_modes: ["Fully remote", "Hybrid"],
    min_salary: 800000,
    preferred_salary: 1500000,
    currency: "INR",
    employment_types: ["Full-Time"],
    blacklisted_companies: [],
    experience_level: "2-4 years",
    career_goal_intent: "Secure, long-term job in my field",
    education_level: "Bachelor's",
    visa_sponsorship: false,
    open_to_relocation: true
  });

  const [config, setConfig] = useState({
    min_match_score: 85,
    daily_limit: 20,
    search_frequency_minutes: 60,
    cover_letter_style: "professional"
  });

  // Pre-fill existing profile & preferences if re-running setup
  useEffect(() => {
    async function loadExisting() {
      try {
        const [existingProf, existingPref] = await Promise.all([getProfile(), getPreferences()]);
        if (existingProf) {
          setProfile((prev) => ({ ...prev, ...existingProf }));
        }
        if (existingPref) {
          setPreferences((prev) => ({ ...prev, ...existingPref }));
        }
      } catch (e) {
        // First-time onboarding, keep defaults
      }
    }
    loadExisting();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      const data = await parseResume(file);
      setProfile((prev) => ({
        ...prev,
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        skills: data.skills || [],
        technical_skills: data.technical_skills || [],
        soft_skills: data.soft_skills || [],
        work_experience: data.work_experience || [],
        education: data.education || [],
        github: data.github || "",
        linkedin: data.linkedin || "",
        portfolio: data.portfolio || "",
        career_goals: data.career_goals || ""
      }));
      setCurrentStep(1);
    } catch (err) {
      alert("Failed to parse resume: " + err.message);
    } finally {
      setParsing(false);
    }
  };

  const toggleWorkMode = (mode) => {
    const current = preferences.work_modes || [];
    if (current.includes(mode)) {
      setPreferences({ ...preferences, work_modes: current.filter((m) => m !== mode) });
    } else {
      setPreferences({ ...preferences, work_modes: [...current, mode] });
    }
  };

  const addLocation = (city) => {
    const trimmed = city.trim();
    if (!trimmed) return;
    const current = preferences.locations || [];
    if (!current.includes(trimmed)) {
      setPreferences({ ...preferences, locations: [...current, trimmed] });
    }
    setCityInput("");
  };

  const removeLocation = (city) => {
    setPreferences({
      ...preferences,
      locations: (preferences.locations || []).filter((l) => l !== city)
    });
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      await completeOnboarding({ profile, preferences, config });
      router.push("/autoapply");
    } catch (err) {
      alert("Error completing onboarding: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="aa-container" style={{ maxWidth: 840 }}>
      {/* Progress Stepper */}
      <div className="aa-stepper">
        {STEPS.map((label, idx) => {
          let statusClass = "";
          if (idx < currentStep) statusClass = "completed";
          if (idx === currentStep) statusClass = "active";
          return (
            <div key={idx} className={`aa-step-item ${statusClass}`}>
              <div className="aa-step-num">
                {idx < currentStep ? <Check size={16} /> : idx + 1}
              </div>
              <span className="aa-step-label">{label}</span>
            </div>
          );
        })}
      </div>

      {/* STEP 0: Upload Resume */}
      {currentStep === 0 && (
        <div className="aa-card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(45, 212, 191, 0.15)", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Upload size={32} />
          </div>

          <h2 style={{ fontSize: "1.8rem", fontWeight: 900, margin: "0 0 8px 0" }}>Upload Your Resume</h2>
          <p className="aa-subtitle" style={{ maxWidth: 480, margin: "0 auto 28px" }}>
            Our Gemini AI engine will parse your resume into a structured candidate profile in seconds.
          </p>

          <label className="aa-upload-zone">
            <input type="file" accept=".pdf,.txt" onChange={handleFileUpload} style={{ display: "none" }} />
            <Sparkles size={32} color="var(--teal)" style={{ margin: "0 auto 12px", display: "block" }} />
            <span style={{ display: "block", fontSize: "1rem", fontWeight: 700, color: "var(--text)" }}>
              {parsing ? "Parsing resume with AI..." : "Click to select or drag PDF / TXT resume"}
            </span>
            <span style={{ display: "block", fontSize: "0.8rem", color: "var(--muted)", marginTop: 4 }}>
              Supports PDF and TXT (Max 10MB)
            </span>
          </label>
        </div>
      )}

      {/* STEP 1: Your Goals ("What are you looking for?") */}
      {currentStep === 1 && (
        <div className="aa-card" style={{ padding: "32px 28px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--teal)" }}>Your Goals</span>
            <h2 style={{ fontSize: "2rem", fontWeight: 900, margin: "6px 0 0 0" }}>What are you looking for?</h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 580, margin: "0 auto" }}>
            {GOAL_OPTIONS.map((opt) => {
              const isSelected = preferences.career_goal_intent === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPreferences({ ...preferences, career_goal_intent: opt.id })}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 20px",
                    borderRadius: 16,
                    border: isSelected ? "2px solid var(--teal)" : "1px solid var(--line)",
                    background: isSelected ? "rgba(45, 212, 191, 0.08)" : "var(--surface)",
                    color: isSelected ? "var(--text)" : "var(--text)",
                    cursor: "pointer",
                    fontSize: "1rem",
                    fontWeight: 700,
                    textAlign: "left",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: isSelected ? "2px solid var(--teal)" : "2px solid var(--muted)",
                    background: isSelected ? "var(--teal)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#080f0c"
                  }}>
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </div>
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          <div className="aa-flex-between" style={{ marginTop: 32 }}>
            <button onClick={() => setCurrentStep(0)} className="aa-btn aa-btn-secondary"><ArrowLeft size={16} /> Back</button>
            <button onClick={() => setCurrentStep(2)} className="aa-btn aa-btn-primary">Continue <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {/* STEP 2: Work Preferences & On-Site Location */}
      {currentStep === 2 && (
        <div className="aa-card" style={{ padding: "32px 28px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--cyan)" }}>Job Preferences</span>
            <h2 style={{ fontSize: "2rem", fontWeight: 900, margin: "6px 0 0 0" }}>What type of jobs do you prefer?</h2>
          </div>

          {/* Work Modes Selection */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 580, margin: "0 auto 32px" }}>
            {WORK_MODE_OPTIONS.map((mode) => {
              const isSelected = (preferences.work_modes || []).includes(mode);
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => toggleWorkMode(mode)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "16px 20px",
                    borderRadius: 16,
                    border: isSelected ? "2px solid var(--teal)" : "1px solid var(--line)",
                    background: isSelected ? "rgba(45, 212, 191, 0.08)" : "var(--surface)",
                    color: "var(--text)",
                    cursor: "pointer",
                    fontSize: "1rem",
                    fontWeight: 700,
                    textAlign: "left",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    border: isSelected ? "2px solid var(--teal)" : "2px solid var(--muted)",
                    background: isSelected ? "var(--teal)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#080f0c"
                  }}>
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </div>
                  <span>{mode}</span>
                </button>
              );
            })}
          </div>

          {/* On-Site Locations Search & Chips */}
          <div style={{ maxWidth: 580, margin: "0 auto", borderTop: "1px solid var(--line)", paddingTop: 24 }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <MapPin size={18} color="var(--teal)" /> Where would you like to work on-site?
            </h3>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input
                type="text"
                className="aa-input"
                placeholder="Type city (e.g. Bengaluru, Mumbai)..."
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLocation(cityInput);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => addLocation(cityInput)}
                className="aa-btn aa-btn-secondary"
                style={{ padding: "0 16px" }}
              >
                <Plus size={16} /> Add
              </button>
            </div>

            {/* Popular City Chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {POPULAR_CITIES.map((city) => {
                const isAdded = (preferences.locations || []).includes(city);
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => isAdded ? removeLocation(city) : addLocation(city)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 14,
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      border: isAdded ? "1px solid var(--teal)" : "1px solid var(--line)",
                      background: isAdded ? "rgba(45, 212, 191, 0.15)" : "var(--surface-strong)",
                      color: isAdded ? "var(--teal)" : "var(--muted)",
                      cursor: "pointer"
                    }}
                  >
                    {isAdded ? `✓ ${city}` : `+ ${city}`}
                  </button>
                );
              })}
            </div>

            {/* Selected Location Tags */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(preferences.locations || []).map((loc) => (
                <span
                  key={loc}
                  className="aa-badge-tag matched"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, fontSize: "0.85rem", fontWeight: 700 }}
                >
                  <MapPin size={12} /> {loc}
                  <button
                    type="button"
                    onClick={() => removeLocation(loc)}
                    style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", opacity: 0.8 }}
                  >
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="aa-flex-between" style={{ marginTop: 32 }}>
            <button onClick={() => setCurrentStep(1)} className="aa-btn aa-btn-secondary"><ArrowLeft size={16} /> Back</button>
            <button onClick={() => setCurrentStep(3)} className="aa-btn aa-btn-primary">Continue <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {/* STEP 3: Background (Highest Level of Education & Years of Work Experience) */}
      {currentStep === 3 && (
        <div className="aa-card" style={{ padding: "32px 28px" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--teal)" }}>Your Background</span>
            <h2 style={{ fontSize: "1.8rem", fontWeight: 900, margin: "6px 0 0 0" }}>What is your highest level of education?</h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 540, margin: "0 auto 32px" }}>
            {EDUCATION_OPTIONS.map((edu) => {
              const isSelected = preferences.education_level === edu;
              return (
                <button
                  key={edu}
                  type="button"
                  onClick={() => setPreferences({ ...preferences, education_level: edu })}
                  style={{
                    padding: "14px 20px",
                    borderRadius: 14,
                    border: isSelected ? "2px solid var(--teal)" : "1px solid var(--line)",
                    background: isSelected ? "rgba(45, 212, 191, 0.08)" : "var(--surface)",
                    color: "var(--text)",
                    cursor: "pointer",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    textAlign: "center",
                    transition: "all 0.2s ease"
                  }}
                >
                  {edu}
                </button>
              );
            })}
          </div>

          <div style={{ textAlign: "center", marginBottom: 24, borderTop: "1px solid var(--line)", paddingTop: 24 }}>
            <h2 style={{ fontSize: "1.8rem", fontWeight: 900, margin: "0 0 16px 0" }}>How many years of total work experience do you have?</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 540, margin: "0 auto" }}>
              {EXPERIENCE_YEAR_OPTIONS.map((exp) => {
                const isSelected = preferences.experience_level === exp;
                return (
                  <button
                    key={exp}
                    type="button"
                    onClick={() => setPreferences({ ...preferences, experience_level: exp })}
                    style={{
                      padding: "14px 20px",
                      borderRadius: 14,
                      border: isSelected ? "2px solid var(--teal)" : "1px solid var(--line)",
                      background: isSelected ? "rgba(45, 212, 191, 0.08)" : "var(--surface)",
                      color: "var(--text)",
                      cursor: "pointer",
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      textAlign: "center",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {exp}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="aa-flex-between" style={{ marginTop: 32 }}>
            <button onClick={() => setCurrentStep(2)} className="aa-btn aa-btn-secondary"><ArrowLeft size={16} /> Back</button>
            <button onClick={() => setCurrentStep(4)} className="aa-btn aa-btn-primary">Continue <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {/* STEP 4: Review Profile & Target Roles */}
      {currentStep === 4 && (
        <div className="aa-card">
          <div className="aa-card-header">
            <h2 className="aa-card-title"><Sparkles size={20} color="var(--teal)" /> Review Profile & Roles</h2>
          </div>

          <div className="aa-grid-2">
            <div className="aa-form-group">
              <label className="aa-label">Full Name</label>
              <input type="text" className="aa-input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
            </div>
            <div className="aa-form-group">
              <label className="aa-label">Email Address</label>
              <input type="email" className="aa-input" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
            </div>
          </div>

          <div className="aa-form-group">
            <label className="aa-label">Technical Skills (Comma separated)</label>
            <input type="text" className="aa-input" value={profile.technical_skills.join(", ")} onChange={(e) => setProfile({ ...profile, technical_skills: e.target.value.split(",").map(s => s.trim()) })} />
          </div>

          <div className="aa-form-group" style={{ marginTop: 16 }}>
            <label className="aa-label">Target Job Titles</label>
            <RoleTagInput
              selectedRoles={preferences.job_titles}
              onChange={(newRoles) => setPreferences({ ...preferences, job_titles: newRoles })}
            />
          </div>

          {/* INR Salary Range Slider */}
          <div className="aa-form-group" style={{ marginTop: 20 }}>
            <SalaryRangeSlider
              minSalary={preferences.min_salary || 800000}
              preferredSalary={preferences.preferred_salary || 1500000}
              onChange={({ minSalary, preferredSalary }) => {
                setPreferences({
                  ...preferences,
                  currency: "INR",
                  min_salary: minSalary,
                  preferred_salary: preferredSalary
                });
              }}
            />
          </div>

          <div className="aa-flex-between" style={{ marginTop: 24 }}>
            <button onClick={() => setCurrentStep(3)} className="aa-btn aa-btn-secondary"><ArrowLeft size={16} /> Back</button>
            <button onClick={() => setCurrentStep(5)} className="aa-btn aa-btn-primary">Next <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {/* STEP 5: Filters & Rules */}
      {currentStep === 5 && (
        <div className="aa-card">
          <div className="aa-card-header">
            <h2 className="aa-card-title"><ShieldAlert size={20} color="var(--amber)" /> Filters & Rules</h2>
          </div>

          <div className="aa-form-group">
            <label className="aa-label">Blacklisted Companies (Comma separated)</label>
            <input type="text" className="aa-input" placeholder="e.g. Company X, Company Y" value={preferences.blacklisted_companies.join(", ")} onChange={(e) => setPreferences({ ...preferences, blacklisted_companies: e.target.value.split(",").map(c => c.trim()) })} />
          </div>

          <div className="aa-grid-2">
            <div className="aa-form-group">
              <label className="aa-label">Minimum Match Score (%)</label>
              <input type="number" className="aa-input" min="50" max="100" value={config.min_match_score} onChange={(e) => setConfig({ ...config, min_match_score: Number(e.target.value) })} />
            </div>
            <div className="aa-form-group">
              <label className="aa-label">Daily Application Preparation Limit</label>
              <input type="number" className="aa-input" min="1" max="100" value={config.daily_limit} onChange={(e) => setConfig({ ...config, daily_limit: Number(e.target.value) })} />
            </div>
          </div>

          <div className="aa-flex-between" style={{ marginTop: 24 }}>
            <button onClick={() => setCurrentStep(4)} className="aa-btn aa-btn-secondary"><ArrowLeft size={16} /> Back</button>
            <button onClick={() => setCurrentStep(6)} className="aa-btn aa-btn-primary">Next <ArrowRight size={16} /></button>
          </div>
        </div>
      )}

      {/* STEP 6: Launch */}
      {currentStep === 6 && (
        <div className="aa-card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(45, 212, 191, 0.15)", color: "var(--teal)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <Sparkles size={32} />
          </div>

          <h2 style={{ fontSize: "1.8rem", fontWeight: 900, margin: "0 0 8px 0" }}>Ready to Launch Your AI Recruiter</h2>
          <p className="aa-subtitle" style={{ maxWidth: 520, margin: "0 auto 28px" }}>
            Your preferences, parsed profile, and automation rules are saved. Click launch to start automatic job discovery.
          </p>

          <div className="aa-flex-between" style={{ maxWidth: 400, margin: "0 auto" }}>
            <button onClick={() => setCurrentStep(5)} className="aa-btn aa-btn-secondary"><ArrowLeft size={16} /> Back</button>
            <button onClick={handleComplete} disabled={submitting} className="aa-btn aa-btn-primary" style={{ padding: "12px 28px", fontSize: "1rem" }}>
              {submitting ? "Launching Engine..." : "Launch AutoApply Engine 🚀"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
