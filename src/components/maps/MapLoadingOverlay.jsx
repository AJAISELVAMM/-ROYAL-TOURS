import React from 'react';

/**
 * MapLoadingOverlay.jsx
 * Centered loading overlay inside the existing map container.
 * Visually matches the reference design:
 * - Centered white rounded card with soft purple shadow
 * - Background map visible, softly dimmed/blurred
 * - Travel/safety illustration with boy, magnifying glass, purple location pin and radar ripples
 * - Title: "Finding nearby safety facilities..."
 * - Subtitle: "Searching hospitals, police stations, pharmacies and other emergency services around you."
 * - Animated purple progress bar
 * - Bottom text: "Please wait a moment..."
 * - 3 animated pulsing purple dots
 */
export default function MapLoadingOverlay({
  title = 'Finding nearby safety facilities...',
  subtitle = 'Searching hospitals, police stations, pharmacies and other emergency services around you.',
  bottomText = 'Please wait a moment...'
}) {
  return (
    <div
      className="safety-map-loading-backdrop"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(248, 250, 252, 0.42)',
        backdropFilter: 'blur(2px)',
        WebkitBackdropFilter: 'blur(2px)',
        pointerEvents: 'none',
        transition: 'opacity 0.25s ease'
      }}
    >
      <div
        className="safety-map-loading-card"
        style={{
          pointerEvents: 'auto',
          background: '#ffffff',
          borderRadius: '24px',
          boxShadow: '0 20px 45px -10px rgba(76, 29, 149, 0.14), 0 8px 24px -5px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(124, 58, 237, 0.08)',
          padding: '24px 28px 22px',
          maxWidth: '385px',
          width: '88%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'safetyCardFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Vector Illustration */}
        <div style={{ width: '100%', maxWidth: '280px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 320 160" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* Background gradient */}
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f5f3ff" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#ede9fe" stopOpacity="0.2" />
              </linearGradient>

              {/* Pin gradient */}
              <linearGradient id="pinGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9061f9" />
                <stop offset="100%" stopColor="#6c2bd9" />
              </linearGradient>

              {/* Soft shadow for pin */}
              <filter id="pinShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#7c3aed" floodOpacity="0.35" />
              </filter>
            </defs>

            {/* Subtle soft lavender sky / clouds in background */}
            <path d="M40 95 C 60 70, 110 70, 130 95 C 150 75, 200 75, 220 95 C 240 80, 280 80, 295 95 L 300 130 L 20 130 Z" fill="url(#skyGrad)" />
            
            {/* Distant city silhouette */}
            <path d="M70 100 L70 85 L85 85 L85 100 M90 100 L90 75 L105 75 L105 100 M245 100 L245 78 L260 78 L260 100 M265 100 L265 85 L278 85 L278 100" stroke="#ddd6fe" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />

            {/* Radar Ripple Ellipses beneath Pin */}
            <ellipse cx="205" cy="115" rx="55" ry="18" fill="none" stroke="#ede9fe" strokeWidth="2.5" />
            <ellipse cx="205" cy="115" rx="38" ry="12" fill="none" stroke="#ddd6fe" strokeWidth="2" />
            <ellipse cx="205" cy="115" rx="22" ry="7" fill="none" stroke="#c4b5fd" strokeWidth="2" />
            <ellipse cx="205" cy="115" rx="9" ry="3" fill="#a78bfa" opacity="0.5" />

            {/* Dashed trail from explorer to pin */}
            <path d="M150 108 C 165 98, 180 100, 195 106" stroke="#c4b5fd" strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />

            {/* Large Purple Location Pin */}
            <g transform="translate(192, 58)" filter="url(#pinShadow)">
              <path d="M13 0 C 5.8 0, 0 5.8, 0 13 C 0 22.5, 13 36, 13 36 C 13 36, 26 22.5, 26 13 C 26 5.8, 20.2 0, 13 0 Z" fill="url(#pinGrad)" />
              <circle cx="13" cy="13" r="5" fill="#ffffff" />
            </g>

            {/* Explorer Boy Character */}
            <g transform="translate(90, 48)">
              {/* Back foot */}
              <ellipse cx="22" cy="74" rx="7" ry="3.5" fill="#1e293b" />
              <path d="M22 64 L22 73" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />

              {/* Front foot stepping forward */}
              <ellipse cx="44" cy="73" rx="7" ry="3.5" fill="#1e293b" />
              <path d="M34 60 L43 72" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />

              {/* Backpack */}
              <rect x="10" y="32" width="13" height="19" rx="5" fill="#6366f1" />
              <rect x="8" y="36" width="4" height="11" rx="2" fill="#4f46e5" />

              {/* Body / Jacket */}
              <path d="M20 30 C 20 28, 38 28, 38 30 L 36 58 C 36 60, 22 60, 22 58 Z" fill="#3b82f6" />
              <path d="M22 30 L 26 58" stroke="#2563eb" strokeWidth="2" />

              {/* Left Arm bending forward holding magnifying glass */}
              <path d="M28 34 L 38 43 L 48 40" stroke="#3b82f6" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="49" cy="40" r="3.5" fill="#fed7aa" />

              {/* Magnifying Glass */}
              <g transform="translate(49, 36) rotate(35)">
                <line x1="0" y1="0" x2="0" y2="15" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="0" cy="-6" r="9" stroke="#7c3aed" strokeWidth="3" fill="#ffffff" fillOpacity="0.8" />
                <circle cx="0" cy="-6" r="6" stroke="#60a5fa" strokeWidth="1" fill="#ede9fe" fillOpacity="0.4" />
                <line x1="-3" y1="-7" x2="3" y2="-5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
              </g>

              {/* Head */}
              <circle cx="34" cy="22" r="10" fill="#fed7aa" />
              {/* Dark Hair with tuft */}
              <path d="M24 21 C 24 12, 44 10, 44 18 C 42 16, 38 16, 36 18 C 34 16, 30 16, 28 19 Z" fill="#1e1b4b" />
              <path d="M24 21 C 24 26, 27 26, 28 22 C 26 21, 25 18, 24 21 Z" fill="#1e1b4b" />
              {/* Eye looking forward */}
              <circle cx="38" cy="22" r="1.3" fill="#1e1b4b" />
            </g>
          </svg>
        </div>

        {/* Title */}
        <h3
          style={{
            margin: '12px 0 6px 0',
            fontSize: '16.5px',
            fontWeight: 750,
            color: '#1e1b4b',
            letterSpacing: '-0.2px'
          }}
        >
          {title}
        </h3>

        {/* Subtitle */}
        <p
          style={{
            margin: '0 0 16px 0',
            fontSize: '12px',
            lineHeight: 1.45,
            color: '#64748b',
            maxWidth: '300px'
          }}
        >
          {subtitle}
        </p>

        {/* Animated Progress Bar */}
        <div
          className="safety-loading-track"
          style={{
            width: '210px',
            height: '6px',
            background: '#ede9fe',
            borderRadius: '9999px',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <div
            className="safety-loading-bar"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              background: 'linear-gradient(90deg, #7c3aed 0%, #6366f1 100%)',
              borderRadius: '9999px',
              animation: 'safetyBarSweep 1.6s ease-in-out infinite'
            }}
          />
        </div>

        {/* Bottom Status Text */}
        <span
          style={{
            display: 'block',
            margin: '10px 0 12px 0',
            fontSize: '11.5px',
            color: '#94a3b8',
            fontWeight: 500
          }}
        >
          {bottomText}
        </span>

        {/* 3 Animated Purple Dots */}
        <div
          className="safety-loading-dots"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#6d28d9',
              display: 'inline-block',
              animation: 'safetyDotPulse 1.2s ease-in-out infinite 0s'
            }}
          />
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#8b5cf6',
              display: 'inline-block',
              animation: 'safetyDotPulse 1.2s ease-in-out infinite 0.2s'
            }}
          />
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#c4b5fd',
              display: 'inline-block',
              animation: 'safetyDotPulse 1.2s ease-in-out infinite 0.4s'
            }}
          />
        </div>
      </div>

      {/* Embedded CSS Keyframes for smooth animations */}
      <style>{`
        @keyframes safetyCardFadeIn {
          0% {
            opacity: 0;
            transform: scale(0.94) translateY(6px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        @keyframes safetyBarSweep {
          0% {
            left: 0%;
            width: 35%;
          }
          50% {
            width: 55%;
          }
          100% {
            left: 65%;
            width: 35%;
          }
        }
        @keyframes safetyDotPulse {
          0%, 80%, 100% {
            transform: scale(0.7);
            opacity: 0.35;
          }
          40% {
            transform: scale(1.25);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
