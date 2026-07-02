"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

export default function GaugeChart({ score = 0 }) {
  const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
  const data = [{ name: "score", value: safeScore }];

  return (
    <div className="gauge-wrap glass">
      <h3>Confidence Meter</h3>
      <div className="gauge-inner">
        <ResponsiveContainer width="100%" height={240}>
          <RadialBarChart data={data} startAngle={200} endAngle={-20} innerRadius="70%" outerRadius="100%">
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={20} fill="url(#gaugeGradient)" />
            <defs>
              <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" />
                <stop offset="100%" stopColor="#f59e0b" />
              </linearGradient>
            </defs>
          </RadialBarChart>
        </ResponsiveContainer>
        <p className="gauge-score">{safeScore.toFixed(1)}</p>
      </div>
    </div>
  );
}
