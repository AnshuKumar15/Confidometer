"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import GaugeChart from "@/components/GaugeChart";
import BarChart from "@/components/BarChart";
import MetricCard from "@/components/MetricCard";
import { getAnalysis } from "@/utils/api";

export default function DashboardClient() {
  const params = useSearchParams();
  const speechId = useMemo(() => params.get("speechId"), [params]);

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!speechId) {
      setLoading(false);
      return;
    }

    async function run() {
      try {
        const result = await getAnalysis(speechId);
        setData(result);
      } catch (err) {
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }

    run();
  }, [speechId]);

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
  const chartData = [
    { label: "Eye", value: Number(data?.eye_contact || 0) },
    { label: "Voice", value: Number(data?.voice_stability || 0) },
    { label: "Gesture", value: Number(data?.gesture_frequency || 0) },
    { label: "Filler Control", value: Math.max(0, 100 - Number(data?.filler_count || 0) * 2) }
  ];

  return (
    <div className="dashboard-grid">
      <GaugeChart score={score} />

      <section className="metrics-grid">
        <MetricCard label="Confidence" value={score.toFixed(1)} hint="Composite score" tone="good" />
        <MetricCard label="Eye Contact" value={Number(data?.eye_contact || 0).toFixed(1)} hint="Percent" />
        <MetricCard label="Voice Stability" value={Number(data?.voice_stability || 0).toFixed(1)} hint="Percent" />
        <MetricCard label="Gesture Activity" value={Number(data?.gesture_frequency || 0).toFixed(1)} hint="Percent" />
        <MetricCard label="Filler Count" value={String(data?.filler_count ?? 0)} hint="Lower is better" tone="warn" />
      </section>

      <BarChart data={chartData} />
    </div>
  );
}
