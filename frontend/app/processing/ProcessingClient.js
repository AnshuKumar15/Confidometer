"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAnalysis } from "@/utils/api";
import { motion, AnimatePresence } from "framer-motion";

const STAGE_LABELS = [
  { threshold: 5, label: "Initializing analysis..." },
  { threshold: 15, label: "Extracting audio track..." },
  { threshold: 30, label: "Transcribing speech with AI..." },
  { threshold: 35, label: "Detecting filler words..." },
  { threshold: 50, label: "Analyzing voice stability..." },
  { threshold: 65, label: "Tracking eye contact patterns..." },
  { threshold: 75, label: "Evaluating gestures & posture..." },
  { threshold: 80, label: "Computing confidence score..." },
  { threshold: 90, label: "Generating detailed AI feedback..." },
  { threshold: 100, label: "Finalizing reports..." },
];

function getStageLabel(progress) {
  for (let i = STAGE_LABELS.length - 1; i >= 0; i--) {
    if (progress >= STAGE_LABELS[i].threshold) return STAGE_LABELS[i].label;
  }
  return "Starting analysis...";
}

export default function ProcessingClient() {
  const params = useSearchParams();
  const router = useRouter();
  const speechId = useMemo(() => params.get("speechId"), [params]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  // Enable light theme on mount
  useEffect(() => {
    document.body.classList.add("light-theme-bg");
    return () => {
      document.body.classList.remove("light-theme-bg");
    };
  }, []);

  // Smooth animation of displayed progress toward actual progress
  useEffect(() => {
    if (displayProgress < progress) {
      const timer = setTimeout(() => {
        setDisplayProgress((prev) => Math.min(prev + 1, progress));
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [displayProgress, progress]);

  useEffect(() => {
    if (!speechId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await getAnalysis(speechId);
        if (cancelled) return;

        // Update progress
        const serverProgress = data.progress || 0;
        setProgress((prev) => Math.max(prev, serverProgress));

        if (data.status === "completed") {
          setProgress(100);
          try {
            const key = "confidometer_recent_speeches";
            const raw = localStorage.getItem(key);
            const existing = raw ? JSON.parse(raw) : [];
            const next = [
              {
                speechId,
                createdAt: new Date().toLocaleString()
              },
              ...existing.filter((item) => String(item.speechId) !== String(speechId))
            ].slice(0, 15);
            localStorage.setItem(key, JSON.stringify(next));
          } catch {
            // Ignore local history write issues.
          }
          // Brief delay so user sees 100%
          setTimeout(() => {
            if (!cancelled) router.replace(`/dashboard?speechId=${speechId}`);
          }, 800);
          return;
        }

        if (data.status === "failed") {
          setError("Processing failed. Please upload another recording.");
          return;
        }

        setTimeout(poll, 2000);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to fetch progress");
        }
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
  }, [router, speechId]);

  if (!speechId) {
    return <p className="error-text centered">Missing speech id.</p>;
  }

  const stageLabel = getStageLabel(displayProgress);

  return (
    <div className="processing-page">
      <section className="processing-card glass">
        <div className="processing-icon-ring">
          <motion.div
            className="processing-pulse-dot"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          Analyzing Your Interview
        </motion.h2>

        <AnimatePresence mode="wait">
          <motion.p
            key={stageLabel}
            className="processing-stage-label"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            {stageLabel}
          </motion.p>
        </AnimatePresence>

        <div className="progress-bar-container">
          <div className="progress-bar-track">
            <motion.div
              className="progress-bar-fill"
              style={{ width: `${displayProgress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
          <span className="progress-bar-percent">{displayProgress}%</span>
        </div>

        {error ? <p className="error-text centered">{error}</p> : null}
      </section>
    </div>
  );
}
