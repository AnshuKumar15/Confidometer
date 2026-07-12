"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import GaugeChart from "@/components/GaugeChart";
import BarChart from "@/components/BarChart";
import MetricCard from "@/components/MetricCard";
import { getAnalysis, getUserHistory, fetchTTSAudio, getTrends } from "@/utils/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import {
  Eye, Mic, Brain, MessageCircle, Volume2, ChevronDown, ChevronUp,
  CheckCircle, AlertTriangle, TrendingUp, Award, Star, Sparkles,
  Code2, Terminal, Zap, DollarSign
} from "lucide-react";

export default function DashboardClient() {
  const params = useSearchParams();
  const speechId = useMemo(() => params.get("speechId"), [params]);

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Feedback flow states
  const [dashboardUnlocked, setDashboardUnlocked] = useState(false);
  const [isSpeakingFeedback, setIsSpeakingFeedback] = useState(false);
  const [feedbackPlayed, setFeedbackPlayed] = useState(false);
  const audioRef = useRef(null);

  // Progress tracking
  const [historyData, setHistoryData] = useState([]);
  const [trendsData, setTrendsData] = useState(null);

  // Report accordion
  const [expandedQIdx, setExpandedQIdx] = useState(null);

  // Active report tab
  const [activeReportTab, setActiveReportTab] = useState("technical");

  // Load trends data
  useEffect(() => {
    async function loadTrends() {
      try {
        const trends = await getTrends();
        setTrendsData(trends);
      } catch (err) {
        console.warn("Failed to load trends data:", err);
      }
    }
    loadTrends();
  }, []);

  useEffect(() => {
    if (!speechId) {
      setLoading(false);
      return;
    }

    async function run() {
      try {
        const result = await getAnalysis(speechId);
        setData(result);

        // Check if already visited
        const visitedKey = `confidometer_dashboard_unlocked_${speechId}`;
        if (typeof window !== "undefined" && sessionStorage.getItem(visitedKey)) {
          setDashboardUnlocked(true);
          setFeedbackPlayed(true);
        }
      } catch (err) {
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    run();
  }, [speechId]);

  // Load history for progress tracking
  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await getUserHistory();
        if (Array.isArray(history)) {
          setHistoryData(history);
        }
      } catch {
        // Non-critical
      }
    }
    loadHistory();
  }, []);

  // Parse JSON feedback
  const technicalFeedback = useMemo(() => {
    if (!data?.technical_feedback) return [];
    try {
      return typeof data.technical_feedback === "string"
        ? JSON.parse(data.technical_feedback)
        : data.technical_feedback;
    } catch { return []; }
  }, [data]);

  const nonTechnicalFeedback = useMemo(() => {
    if (!data?.non_technical_feedback) return {};
    try {
      return typeof data.non_technical_feedback === "string"
        ? JSON.parse(data.non_technical_feedback)
        : data.non_technical_feedback;
    } catch { return {}; }
  }, [data]);

  // Combine standard non-technical feedback with custom stress telemetry
  const enrichedNonTechnicalFeedback = useMemo(() => {
    const nt = { ...nonTechnicalFeedback };
    if (data?.stress_mode) {
      nt["fidgeting"] = {
        score: data.fidgeting_index || 0,
        feedback: "Fidgeting activity level monitored under stress."
      };
      nt["speech_var"] = {
        score: data.speech_rate_variance || 0,
        feedback: "Speaking pace variation and rate spikes recorded under stress."
      };
    }
    return nt;
  }, [nonTechnicalFeedback, data]);


  // Speak short summary
  async function handleGetFeedback() {
    const summary = data?.short_summary_feedback;
    if (!summary) {
      setDashboardUnlocked(true);
      setFeedbackPlayed(true);
      return;
    }

    setIsSpeakingFeedback(true);
    try {
      const audioUrl = await fetchTTSAudio(summary);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => {
        setIsSpeakingFeedback(false);
        setFeedbackPlayed(true);
        setDashboardUnlocked(true);
        URL.revokeObjectURL(audioUrl);
        // Persist unlock
        if (typeof window !== "undefined") {
          sessionStorage.setItem(`confidometer_dashboard_unlocked_${speechId}`, "1");
        }
      };
      audio.onerror = () => {
        setIsSpeakingFeedback(false);
        setFeedbackPlayed(true);
        setDashboardUnlocked(true);
        URL.revokeObjectURL(audioUrl);
      };
      await audio.play();
    } catch {
      setIsSpeakingFeedback(false);
      setFeedbackPlayed(true);
      setDashboardUnlocked(true);
    }
  }

  function handleSkipFeedback() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeakingFeedback(false);
    setFeedbackPlayed(true);
    setDashboardUnlocked(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`confidometer_dashboard_unlocked_${speechId}`, "1");
    }
  }

  if (!speechId) {
    return <p className="error-text centered">Open this page after processing from upload.</p>;
  }

  if (loading) {
    return <p className="muted centered">Loading dashboard...</p>;
  }

  if (error) {
    return <p className="error-text centered">{error}</p>;
  }

  const score = Number(data?.confidence_score || 0);

  // Sub-scores
  const subScores = [
    { label: "Eye Contact", value: Number(data?.eye_contact_score || data?.eye_contact || 0), icon: <Eye size={18} /> },
    { label: "Technical Knowledge", value: Number(data?.technical_knowledge_score || 50), icon: <Brain size={18} /> },
    { label: "Fluency", value: Number(data?.fluency_score || 50), icon: <Mic size={18} /> },
    { label: "Use of Words", value: Number(data?.use_of_words_score || 50), icon: <MessageCircle size={18} /> },
    { label: "Filler Words", value: Number(data?.filler_words_score || Math.max(0, 100 - Number(data?.filler_count || 0) * 4)), icon: <Volume2 size={18} /> },
    { label: "Explanation Quality", value: Number(data?.explanation_quality_score || 50), icon: <Star size={18} /> },
  ];

  if (data?.interview_type === "negotiation") {
    subScores.push({
      label: "Negotiation Score",
      value: Number(data?.negotiation_score || 60),
      icon: <DollarSign size={18} />
    });
  }

  if (data?.stress_mode) {
    subScores.push({
      label: "Stress Composure",
      value: Number(data?.stress_tolerance_score || 70),
      icon: <Zap size={18} />
    });
  }

  // Add coding scores if available (DSA / Technical rounds)
  const hasCodingScores = data?.code_quality_score != null;
  if (hasCodingScores) {
    subScores.push(
      { label: "Code Quality", value: Number(data.code_quality_score || 0), icon: <Code2 size={18} /> },
      { label: "Optimization", value: Number(data.optimization_score || 0), icon: <Terminal size={18} /> },
      { label: "Thinking Process", value: Number(data.thinking_process_score || 0), icon: <Brain size={18} /> },
      { label: "Communication", value: Number(data.communication_score || 0), icon: <MessageCircle size={18} /> },
    );
  }

  // Parse coding feedback from non-technical
  const codingFeedback = nonTechnicalFeedback?.coding_feedback || null;

  // Non-technical metrics for graphical display
  const ntMetrics = [
    { key: "eye_contact", label: "Eye Contact", icon: <Eye size={16} /> },
    { key: "gestures", label: "Gestures", icon: <TrendingUp size={16} /> },
    { key: "fluency", label: "Fluency", icon: <Mic size={16} /> },
    { key: "filler_words", label: "Filler Words", icon: <Volume2 size={16} /> },
    { key: "voice_stability", label: "Voice Stability", icon: <Sparkles size={16} /> },
  ];

  if (data?.stress_mode) {
    ntMetrics.push(
      { key: "fidgeting", label: "Fidgeting Level", icon: <TrendingUp size={16} /> },
      { key: "speech_var", label: "Speech Pace Variance", icon: <Mic size={16} /> }
    );
  }



  // Progress tracking chart data
  const progressChartData = historyData
    .slice()
    .reverse()
    .map((item, idx) => ({
      name: item.created_at ? new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : `#${idx + 1}`,
      confidence: Number(item.confidence_score || 0),
      eye: Number(item.eye_contact_score || item.eye_contact || 0),
      fluency: Number(item.fluency_score || 50),
      technical: Number(item.technical_knowledge_score || 50),
      filler: Number(item.filler_words_score || 50),
    }));

  // ─── LOCKED OVERLAY ───
  if (!dashboardUnlocked) {
    return (
      <div className="dashboard-unlock-overlay">
        <motion.div
          className="unlock-card glass"
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="unlock-icon-ring">
            <Award size={40} />
          </div>
          <h2>Assessment Complete!</h2>
          <p className="unlock-subtitle">
            Your interview has been analyzed. Choose how you would like to receive your results.
          </p>

          {isSpeakingFeedback ? (
            <div className="feedback-playing-area">
              <div className="wave-bars">
                {[...Array(7)].map((_, i) => (
                  <motion.span
                    key={i}
                    className="wave-bar"
                    animate={{ scaleY: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" }}
                  />
                ))}
              </div>
              <p className="feedback-speaking-text">Liza is sharing your feedback...</p>
              <button className="button subtle" onClick={handleSkipFeedback}>
                Skip & Show Score
              </button>
            </div>
          ) : (
            <div className="unlock-buttons">
              <button className="button primary unlock-btn" onClick={handleGetFeedback}>
                <Volume2 size={18} />
                Get Interview Feedback
              </button>
              <button className="button subtle unlock-btn" onClick={handleSkipFeedback}>
                No Thanks, Show Score
              </button>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // ─── MAIN DASHBOARD ───
  return (
    <motion.div
      className="dashboard-container"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* ── Overall Score Section ── */}
      <section className="dashboard-hero-section">
        <GaugeChart score={score} />

        <div className="sub-scores-grid">
          {subScores.map((s) => {
            const color =
              s.value >= 70 ? "var(--teal)" :
              s.value >= 40 ? "var(--amber)" :
              "var(--danger)";
            return (
              <div className="sub-score-card glass" key={s.label}>
                <div className="sub-score-icon" style={{ color }}>{s.icon}</div>
                <div className="sub-score-info">
                  <span className="sub-score-label">{s.label}</span>
                  <div className="sub-score-bar-track">
                    <motion.div
                      className="sub-score-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, s.value)}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      style={{ background: color }}
                    />
                  </div>
                  <span className="sub-score-value" style={{ color }}>{s.value.toFixed(1)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Reports Tabs Section ── */}
      <section className="reports-section">
        <div className="report-tabs">
          <button
            className={`report-tab ${activeReportTab === "technical" ? "active" : ""}`}
            onClick={() => setActiveReportTab("technical")}
          >
            <Brain size={16} /> Technical Report
          </button>
          <button
            className={`report-tab ${activeReportTab === "non-technical" ? "active" : ""}`}
            onClick={() => setActiveReportTab("non-technical")}
          >
            <Eye size={16} /> Non-Technical Report
          </button>
          {(hasCodingScores || data?.dsa_code) && (
            <button
              className={`report-tab ${activeReportTab === "coding" ? "active" : ""}`}
              onClick={() => setActiveReportTab("coding")}
            >
              <Code2 size={16} /> Coding Review
            </button>
          )}
        </div>

        <div className="report-panel-container">
          <AnimatePresence mode="wait">
            {activeReportTab === "technical" ? (
              <motion.div
                key="technical"
                className="report-panel glass"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.25 }}
              >
                <h3><Brain size={18} /> Technical Feedback</h3>
                <p className="report-subtitle">Question-by-question analysis of your technical responses</p>

                {technicalFeedback.length === 0 ? (
                  <p className="muted">No technical feedback available. This is generated from AI interview sessions.</p>
                ) : (
                  <div className="tech-feedback-list">
                    {technicalFeedback.map((item, idx) => {
                      const isGood = item.verdict === "good";
                      const isExpanded = expandedQIdx === idx;
                      return (
                        <div
                          key={idx}
                          className={`tech-feedback-item ${isGood ? "good" : "improve"}`}
                        >
                          <button
                            className="tech-feedback-header"
                            onClick={() => setExpandedQIdx(isExpanded ? null : idx)}
                          >
                            <span className="tech-verdict-icon">
                              {isGood ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                            </span>
                            <span className="tech-q-label">Q{idx + 1}</span>
                            <span className="tech-q-text">{item.question}</span>
                            <span className="tech-expand-icon">
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </span>
                          </button>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                className="tech-feedback-body"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                              >
                                <div className="tech-answer-block">
                                  <span className="tech-block-label">Your Answer</span>
                                  <p>{item.answer || "—"}</p>
                                </div>
                                <div className="tech-answer-block">
                                  <span className="tech-block-label">Feedback</span>
                                  <p>{item.feedback}</p>
                                </div>
                                {item.suggested_answer && (
                                  <div className="tech-answer-block suggested">
                                    <span className="tech-block-label">Suggested Answer</span>
                                    <p>{item.suggested_answer}</p>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="non-technical"
                className="report-panel glass"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
              >
                <h3><Eye size={18} /> Non-Technical Feedback</h3>
                <p className="report-subtitle">Body language, fluency, and delivery assessment</p>

                <div className="nt-metrics-grid">
                  {ntMetrics.map((m) => {
                    const metric = enrichedNonTechnicalFeedback[m.key];
                    if (!metric) return null;
                    const val = Number(metric.score || 0);
                    const color =
                      val >= 70 ? "var(--teal)" :
                      val >= 40 ? "var(--amber)" :
                      "var(--danger)";
                    return (
                      <div key={m.key} className="nt-metric-card">
                        <div className="nt-metric-header">
                          <span className="nt-metric-icon" style={{ color }}>{m.icon}</span>
                          <span className="nt-metric-label">{m.label}</span>
                          <span className="nt-metric-value" style={{ color }}>{val.toFixed(0)}</span>
                        </div>
                        <div className="nt-bar-track">
                          <motion.div
                            className="nt-bar-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, val)}%` }}
                            transition={{ duration: 0.7, delay: 0.1 }}
                            style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }}
                          />
                        </div>
                        {metric.feedback && (
                          <p className="nt-metric-feedback">{metric.feedback}</p>
                        )}
                        {metric.count !== undefined && (
                          <span className="nt-metric-count">Count: {metric.count}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Coding Review Panel (rendered outside AnimatePresence to avoid tab conflicts) */}
        {activeReportTab === "coding" && (hasCodingScores || data?.dsa_code) && (
          <div className="report-panel glass coding-review-panel">
            <h3><Code2 size={18} /> Coding Review</h3>
            <p className="report-subtitle">Code quality, optimization, and problem-solving assessment</p>

            {/* Coding Scores Bar Chart */}
            {hasCodingScores && (
              <div className="coding-scores-grid">
                {[
                  { label: "Code Quality", value: Number(data.code_quality_score || 0), icon: <Code2 size={16} /> },
                  { label: "Optimization", value: Number(data.optimization_score || 0), icon: <Terminal size={16} /> },
                  { label: "Thinking Process", value: Number(data.thinking_process_score || 0), icon: <Brain size={16} /> },
                  { label: "Communication", value: Number(data.communication_score || 0), icon: <MessageCircle size={16} /> },
                ].map((s) => {
                  const color =
                    s.value >= 70 ? "var(--teal)" :
                    s.value >= 40 ? "var(--amber)" :
                    "var(--danger)";
                  return (
                    <div key={s.label} className="coding-score-row">
                      <div className="coding-score-header">
                        <span className="coding-score-icon" style={{ color }}>{s.icon}</span>
                        <span className="coding-score-label">{s.label}</span>
                        <span className="coding-score-value" style={{ color }}>{s.value.toFixed(0)}</span>
                      </div>
                      <div className="nt-bar-track">
                        <motion.div
                          className="nt-bar-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, s.value)}%` }}
                          transition={{ duration: 0.7, delay: 0.1 }}
                          style={{ background: `linear-gradient(90deg, ${color}, ${color}88)` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Coding Feedback */}
            {codingFeedback && (
              <div className="coding-feedback-section">
                {codingFeedback.code_review && (
                  <div className="coding-fb-block">
                    <span className="tech-block-label">Code Review</span>
                    <p>{codingFeedback.code_review}</p>
                  </div>
                )}
                <div className="coding-complexity-row">
                  {codingFeedback.time_complexity && (
                    <div className="complexity-badge">
                      <strong>Time</strong>
                      <span>{codingFeedback.time_complexity}</span>
                    </div>
                  )}
                  {codingFeedback.space_complexity && (
                    <div className="complexity-badge">
                      <strong>Space</strong>
                      <span>{codingFeedback.space_complexity}</span>
                    </div>
                  )}
                </div>
                {codingFeedback.optimization_suggestions && (
                  <div className="coding-fb-block">
                    <span className="tech-block-label">Optimization Suggestions</span>
                    <p>{codingFeedback.optimization_suggestions}</p>
                  </div>
                )}
              </div>
            )}

            {/* Submitted Code */}
            {data?.dsa_code && (
              <div className="coding-submitted-code">
                <span className="tech-block-label">Your Submitted Code</span>
                <pre className="dashboard-code-block"><code>{data.dsa_code}</code></pre>
              </div>
            )}
          </div>
        )}
      </section>


      {/* ── Progress Tracking Section ── */}
      {progressChartData.length > 1 && (
        <section className="progress-tracking-section glass">
          <h3><TrendingUp size={18} /> Progress Over Time</h3>
          <p className="report-subtitle">Track your improvement across interviews</p>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={progressChartData} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" domain={[0, 100]} fontSize={12} />
              <Tooltip
                contentStyle={{ background: "#0b1f2f", border: "1px solid rgba(148,163,184,0.25)", borderRadius: 10, color: "#eaf2ff" }}
              />
              <Legend />
              <Line type="monotone" dataKey="confidence" stroke="#2dd4bf" strokeWidth={2} name="Confidence" dot={{ r: 4 }} />
              <Line type="monotone" dataKey="eye" stroke="#22d3ee" strokeWidth={2} name="Eye Contact" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="fluency" stroke="#f59e0b" strokeWidth={2} name="Fluency" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="technical" stroke="#a78bfa" strokeWidth={2} name="Technical" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="filler" stroke="#f87171" strokeWidth={2} name="Filler Control" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}
    </motion.div>
  );
}
