"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Loader from "@/components/Loader";
import { getAnalysis } from "@/utils/api";

export default function ProcessingClient() {
  const params = useSearchParams();
  const router = useRouter();
  const speechId = useMemo(() => params.get("speechId"), [params]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!speechId) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await getAnalysis(speechId);
        if (cancelled) return;

        if (data.status === "completed") {
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
          router.replace(`/dashboard?speechId=${speechId}`);
          return;
        }

        if (data.status === "failed") {
          setError("Processing failed. Please upload another recording.");
          return;
        }

        setTimeout(poll, 2500);
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

  return (
    <div className="processing-page">
      <Loader />
      {error ? <p className="error-text centered">{error}</p> : null}
    </div>
  );
}
