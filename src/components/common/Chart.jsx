import React from 'react';

const PALETTE = ['#7c3aed', '#a78bfa', '#c4b5fd', '#8b5cf6', '#5b21b6', '#ddd6fe', '#f59e0b', '#10b981', '#ef4444'];

// Simple SVG donut chart from label/value pairs.
export function DonutChart({ data, size = 150, thickness = 22, centerLabel, centerValue }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eee" strokeWidth={thickness} />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const seg = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color || PALETTE[i % PALETTE.length]}
              strokeWidth={thickness}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <div className="donut-center">
        {centerValue != null && <strong>{centerValue}</strong>}
        {centerLabel && <span>{centerLabel}</span>}
      </div>
    </div>
  );
}

// Vertical bar chart.
export function BarChart({ data, labels, height = 160, color = '#7c3aed', showValues = true }) {
  const max = Math.max(...data, 1);
  return (
    <div className="bars">
      {data.map((v, i) => (
        <div className="bar-col" key={i}>
          {showValues && <span className="bar-value">{v}</span>}
          <div className="bar-track" style={{ height }}>
            <div
              className="bar-fill"
              style={{ height: `${(v / max) * 100}%`, background: color }}
            />
          </div>
          {labels && <span className="bar-label">{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
}

// Multi-series line chart.
export function LineChart({ series, labels, height = 180 }) {
  const max = Math.max(...series.flatMap((s) => s.data), 1);
  const w = 100;
  const h = 100;
  const stepX = w / (labels.length - 1);
  const points = series.map((s) =>
    s.data.map((v, i) => `${(i * stepX).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ')
  );
  return (
    <div className="line-chart">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }}>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2="100" y1={h * g} y2={h * g} stroke="#eee" strokeWidth="0.5" />
        ))}
        {series.map((s, i) => (
          <polyline
            key={i}
            points={points[i]}
            fill="none"
            stroke={s.color || PALETTE[i % PALETTE.length]}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <div className="line-labels">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="line-legend">
        {series.map((s, i) => (
          <span key={i} className="legend-item">
            <span className="legend-dot" style={{ background: s.color || PALETTE[i % PALETTE.length] }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// Horizontal progress bar (for AI module usage).
export function ProgressBar({ label, value, color = '#7c3aed' }) {
  return (
    <div className="progress-row">
      <div className="progress-head">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}
