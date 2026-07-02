"use client";

import { BarChart as RBarChart, Bar, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export default function BarChart({ data }) {
  return (
    <section className="chart-wrap glass">
      <h3>Signal Breakdown</h3>
      <ResponsiveContainer width="100%" height={280}>
        <RBarChart data={data} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
          <defs>
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2dd4bf" />
              <stop offset="100%" stopColor="#0891b2" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
          <XAxis dataKey="label" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" domain={[0, 100]} />
          <Tooltip contentStyle={{ background: "#111827", border: "1px solid #334155" }} />
          <Bar dataKey="value" fill="url(#barGradient)" radius={[12, 12, 4, 4]} />
        </RBarChart>
      </ResponsiveContainer>
    </section>
  );
}
