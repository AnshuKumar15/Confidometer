"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "confidometer_recent_speeches";

export default function HistoryPage() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      setItems(JSON.parse(raw));
    } catch {
      setItems([]);
    }
  }, []);

  function handleDelete(speechId) {
    const next = items.filter((i) => i.speechId !== speechId);
    setItems(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  return (
    <div className="history-page">
      <section className="section-head">
        <h1>Recent Sessions</h1>
        <p>Quick shortcuts to previously processed speech dashboards.</p>
      </section>

      <div className="history-list glass">
        {items.length === 0 ? (
          <p className="muted">No local history yet. Analyze a video first.</p>
        ) : (
          items.map((item) => (
            <article className="history-row" key={item.speechId}>
              <div>
                <h3>Speech #{item.speechId}</h3>
                <p>{item.createdAt}</p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href={`/dashboard?speechId=${item.speechId}`} className="button subtle">
                  Open Dashboard
                </Link>
                <button
                  type="button"
                  className="button danger"
                  onClick={() => handleDelete(item.speechId)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
