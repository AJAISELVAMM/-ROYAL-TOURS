import React from 'react';
import './ClickSpark.css';

/**
 * ClickSpark — Burst spark effect at button click point.
 * Radiating white/gold/purple particles and burst lines matching Reference 1 & 3.
 */
export default function ClickSpark({ active = true, x = 0, y = 0, style = {} }) {
  if (!active) return null;

  return (
    <div
      className="click-spark-container"
      style={{ left: `${x}px`, top: `${y}px`, ...style }}
      aria-hidden="true"
    >
      {/* Central burst flash */}
      <div className="spark-core-flash" />

      {/* Radiating spark spikes */}
      <svg
        className="spark-spikes-svg"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <line x1="50" y1="50" x2="50" y2="10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="50" x2="78" y2="22" stroke="#e9d5ff" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="50" y1="50" x2="90" y2="50" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="50" x2="78" y2="78" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="50" y1="50" x2="50" y2="90" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="50" x2="22" y2="78" stroke="#e9d5ff" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="50" y1="50" x2="10" y2="50" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="50" x2="22" y2="22" stroke="#c084fc" strokeWidth="2.5" strokeLinecap="round" />
        {/* Core circle */}
        <circle cx="50" cy="50" r="7" fill="#ffffff" />
        <circle cx="50" cy="50" r="14" fill="#a855f7" fillOpacity="0.4" />
      </svg>

      {/* Flying micro particles */}
      <span className="spark-particle p1" />
      <span className="spark-particle p2" />
      <span className="spark-particle p3" />
      <span className="spark-particle p4" />
      <span className="spark-particle p5" />
      <span className="spark-particle p6" />
    </div>
  );
}
