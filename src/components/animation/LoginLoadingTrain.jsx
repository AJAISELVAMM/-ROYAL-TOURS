import React, { useEffect, useState } from 'react';
import './LoginLoadingTrain.css';

/**
 * LoginLoadingTrain — Rendered inside the login card when authentication succeeds.
 * Exactly matches Reference Image 2:
 * - Purple vintage steam train traveling on tracks
 * - Rotating animated wheels and connecting rods
 * - Animated billowing smoke clouds
 * - Scenic mountain and palm silhouettes in soft lavender
 * - "Logging you in..." label
 * - Smoothly animating progress bar (0% -> 100%)
 */
export default function LoginLoadingTrain({ onComplete, durationMs = 2600 }) {
  const [progress, setProgress] = useState(6);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(pct);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        if (onComplete) {
          setTimeout(onComplete, 250);
        }
      }
    }, 30);

    return () => clearInterval(interval);
  }, [durationMs, onComplete]);

  return (
    <div className="login-loading-train-card" role="status" aria-live="polite">
      {/* Scenic Train View Box */}
      <div className="train-scene-viewport">
        {/* Distant Hills & Palm Tree Silhouettes */}
        <div className="train-scene-backdrop">
          <svg
            className="train-scenery-svg"
            viewBox="0 0 400 120"
            fill="none"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Soft distant mountain ridge */}
            <path
              d="M0 80 Q60 40 120 70 T240 50 T360 75 L400 80 L400 120 L0 120 Z"
              fill="#ede9fe"
              opacity="0.7"
            />
            {/* Closer hill ridge */}
            <path
              d="M0 92 Q80 65 170 85 T340 70 L400 90 L400 120 L0 120 Z"
              fill="#ddd6fe"
              opacity="0.8"
            />
            {/* Palm silhouettes on left and right */}
            <g opacity="0.45" fill="#a78bfa">
              {/* Left palms */}
              <path d="M22 100 Q26 70 30 52" stroke="#a78bfa" strokeWidth="2.5" />
              <path d="M30 52 Q18 42 12 50 Q24 50 30 52" />
              <path d="M30 52 Q22 36 28 32 Q32 44 30 52" />
              <path d="M30 52 Q40 38 46 44 Q36 48 30 52" />
              <path d="M30 52 Q42 54 48 62 Q38 58 30 52" />
              {/* Right palms */}
              <path d="M375 100 Q370 72 366 56" stroke="#a78bfa" strokeWidth="2.5" />
              <path d="M366 56 Q354 46 348 54 Q360 54 366 56" />
              <path d="M366 56 Q358 40 364 36 Q368 48 366 56" />
              <path d="M366 56 Q376 42 382 48 Q372 52 366 56" />
            </g>
          </svg>
        </div>

        {/* Train Tracks */}
        <div className="train-tracks-container">
          <div className="train-rails" />
          <div className="train-ties-scroller" />
        </div>

        {/* Billowing Steam Clouds */}
        <div className="train-smoke-emitter">
          <span className="smoke-puff puff-1" />
          <span className="smoke-puff puff-2" />
          <span className="smoke-puff puff-3" />
          <span className="smoke-puff puff-4" />
        </div>

        {/* The Animated Steam Locomotive & Carriages */}
        <div className="train-convoy-wrapper">
          <svg
            className="train-convoy-svg"
            viewBox="0 0 340 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="trainBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="50%" stopColor="#6d28d9" />
                <stop offset="100%" stopColor="#4c1d95" />
              </linearGradient>
              <linearGradient id="trainCabGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#1d4ed8" />
              </linearGradient>
              <linearGradient id="trainCarriageGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#4338ca" />
              </linearGradient>
              <linearGradient id="lampGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
              </linearGradient>
              <filter id="headlightFilter" x="-10%" y="-30%" width="200%" height="160%">
                <feGaussianBlur stdDeviation="4" result="glow" />
                <feComposite in="SourceGraphic" in2="glow" operator="over" />
              </filter>
            </defs>

            {/* TRAIN CARRIAGE 2 (Back) */}
            <g className="train-coach-back">
              <rect x="10" y="52" width="60" height="38" rx="6" fill="url(#trainCarriageGrad)" />
              <rect x="8" y="49" width="64" height="6" rx="2" fill="#312e81" />
              {/* Windows */}
              <rect x="18" y="58" width="12" height="12" rx="3" fill="#fef08a" opacity="0.9" />
              <rect x="36" y="58" width="12" height="12" rx="3" fill="#fef08a" opacity="0.9" />
              {/* Base chassis */}
              <rect x="12" y="88" width="56" height="5" fill="#1e1b4b" />
              {/* Carriage Wheels */}
              <circle className="train-wheel" cx="22" cy="95" r="7" fill="#334155" stroke="#f1f5f9" strokeWidth="2" />
              <circle className="train-wheel" cx="58" cy="95" r="7" fill="#334155" stroke="#f1f5f9" strokeWidth="2" />
              {/* Coupler link */}
              <rect x="70" y="82" width="12" height="4" rx="2" fill="#0f172a" />
            </g>

            {/* TRAIN CARRIAGE 1 (Middle) */}
            <g className="train-coach-mid">
              <rect x="80" y="50" width="70" height="40" rx="6" fill="url(#trainCarriageGrad)" />
              <rect x="78" y="47" width="74" height="6" rx="2" fill="#312e81" />
              {/* Windows */}
              <rect x="90" y="57" width="14" height="13" rx="3" fill="#fef08a" opacity="0.9" />
              <rect x="112" y="57" width="14" height="13" rx="3" fill="#fef08a" opacity="0.9" />
              <rect x="134" y="57" width="10" height="13" rx="2" fill="#fef08a" opacity="0.9" />
              {/* Base chassis */}
              <rect x="82" y="88" width="66" height="5" fill="#1e1b4b" />
              {/* Carriage Wheels */}
              <circle className="train-wheel" cx="95" cy="95" r="7" fill="#334155" stroke="#f1f5f9" strokeWidth="2" />
              <circle className="train-wheel" cx="138" cy="95" r="7" fill="#334155" stroke="#f1f5f9" strokeWidth="2" />
              {/* Coupler link to engine */}
              <rect x="150" y="82" width="12" height="4" rx="2" fill="#0f172a" />
            </g>

            {/* STEAM LOCOMOTIVE ENGINE (Front) */}
            <g className="train-engine">
              {/* Cab (Driver Cabin) */}
              <path
                d="M162 44 C162 38 168 34 176 34 L212 34 C218 34 222 38 222 44 L222 88 L162 88 Z"
                fill="url(#trainCabGrad)"
              />
              <rect x="158" y="31" width="68" height="6" rx="3" fill="#1e3a8a" />
              {/* Cab Window */}
              <rect x="175" y="43" width="18" height="18" rx="4" fill="#bae6fd" opacity="0.9" />
              <rect x="198" y="43" width="14" height="18" rx="4" fill="#bae6fd" opacity="0.9" />

              {/* Boiler Barrel Cylinder */}
              <path
                d="M222 52 L285 52 C295 52 300 58 300 68 C300 78 295 88 285 88 L222 88 Z"
                fill="url(#trainBodyGrad)"
              />
              {/* Golden Boiler Bands */}
              <line x1="240" y1="52" x2="240" y2="88" stroke="#facc15" strokeWidth="2.5" />
              <line x1="262" y1="52" x2="262" y2="88" stroke="#facc15" strokeWidth="2.5" />
              <line x1="284" y1="52" x2="284" y2="88" stroke="#facc15" strokeWidth="2.5" />

              {/* Smokestack / Chimney */}
              <path
                d="M272 52 L269 28 L283 28 L280 52 Z"
                fill="#312e81"
              />
              <ellipse cx="276" cy="27" rx="8" ry="3.5" fill="#f59e0b" />

              {/* Steam Dome */}
              <path d="M246 52 C246 44 256 44 256 52 Z" fill="#4338ca" />

              {/* Front Cowcatcher / Grille */}
              <polygon points="296,88 322,96 296,96" fill="#1e1b4b" stroke="#7c3aed" strokeWidth="1.5" />

              {/* Headlight Housing & Golden Beam */}
              <rect x="298" y="58" width="12" height="16" rx="4" fill="#d97706" />
              <circle cx="308" cy="66" r="6" fill="#fef08a" />
              <polygon points="314,66 350,54 350,78" fill="url(#lampGlow)" opacity="0.75" />

              {/* Base Frame */}
              <rect x="160" y="86" width="144" height="7" fill="#0f172a" />

              {/* Small Front Wheels */}
              <g className="train-small-wheels">
                <circle className="train-wheel-small" cx="282" cy="96" r="6.5" fill="#475569" stroke="#f1f5f9" strokeWidth="2" />
                <circle className="train-wheel-small" cx="300" cy="96" r="6.5" fill="#475569" stroke="#f1f5f9" strokeWidth="2" />
              </g>

              {/* Large Drive Wheels */}
              <g className="train-drive-wheels">
                {/* Large Wheel 1 */}
                <g transform="translate(182, 94)">
                  <circle className="train-wheel-large" cx="0" cy="0" r="14" fill="#334155" stroke="#a855f7" strokeWidth="3" />
                  <circle cx="0" cy="0" r="4.5" fill="#f8fafc" />
                  <line x1="-12" y1="0" x2="12" y2="0" stroke="#94a3b8" strokeWidth="2" className="wheel-spoke" />
                  <line x1="0" y1="-12" x2="0" y2="12" stroke="#94a3b8" strokeWidth="2" className="wheel-spoke" />
                </g>
                {/* Large Wheel 2 */}
                <g transform="translate(216, 94)">
                  <circle className="train-wheel-large" cx="0" cy="0" r="14" fill="#334155" stroke="#a855f7" strokeWidth="3" />
                  <circle cx="0" cy="0" r="4.5" fill="#f8fafc" />
                  <line x1="-12" y1="0" x2="12" y2="0" stroke="#94a3b8" strokeWidth="2" className="wheel-spoke" />
                  <line x1="0" y1="-12" x2="0" y2="12" stroke="#94a3b8" strokeWidth="2" className="wheel-spoke" />
                </g>
                {/* Large Wheel 3 */}
                <g transform="translate(250, 94)">
                  <circle className="train-wheel-large" cx="0" cy="0" r="14" fill="#334155" stroke="#a855f7" strokeWidth="3" />
                  <circle cx="0" cy="0" r="4.5" fill="#f8fafc" />
                  <line x1="-12" y1="0" x2="12" y2="0" stroke="#94a3b8" strokeWidth="2" className="wheel-spoke" />
                  <line x1="0" y1="-12" x2="0" y2="12" stroke="#94a3b8" strokeWidth="2" className="wheel-spoke" />
                </g>

                {/* Connecting Drive Rod */}
                <rect
                  className="train-drive-rod"
                  x="182"
                  y="92"
                  width="68"
                  height="4.5"
                  rx="2.2"
                  fill="#f1f5f9"
                  stroke="#64748b"
                  strokeWidth="1"
                />
              </g>
            </g>
          </svg>
        </div>
      </div>

      {/* Status Typography */}
      <h2 className="train-loading-title">Logging you in...</h2>

      {/* Animated Gradient Progress Bar */}
      <div className="train-progress-track">
        <div
          className="train-progress-fill"
          style={{ width: `${progress}%` }}
        >
          <span className="train-progress-glow" />
        </div>
      </div>
    </div>
  );
}
