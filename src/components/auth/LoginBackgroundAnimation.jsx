import React, { useMemo } from 'react';
import './LoginBackgroundAnimation.css';

/**
 * LoginBackgroundAnimation — Royal Tours Animated Travel Atmosphere
 * Renders independent ambient layers strictly behind the login UI.
 * Purely visual, pointer-events: none, GPU-accelerated CSS/SVG animations.
 */
export default function LoginBackgroundAnimation() {
  // Precompute stable particle properties (left/right areas, avoiding center safezone)
  const particles = useMemo(() => {
    return [
      { id: 1, left: '8%', top: '25%', size: 4, dur: '16s', delay: '0s', tx: '15px', ty: '-90px', op: 0.65 },
      { id: 2, left: '14%', top: '65%', size: 5, dur: '19s', delay: '-4s', tx: '-20px', ty: '-110px', op: 0.55 },
      { id: 3, left: '22%', top: '40%', size: 3, dur: '22s', delay: '-8s', tx: '25px', ty: '-80px', op: 0.7 },
      { id: 4, left: '5%', top: '80%', size: 6, dur: '18s', delay: '-2s', tx: '18px', ty: '-130px', op: 0.5 },
      { id: 5, left: '18%', top: '15%', size: 4, dur: '21s', delay: '-6s', tx: '-12px', ty: '-95px', op: 0.6 },
      { id: 6, left: '78%', top: '22%', size: 5, dur: '17s', delay: '-3s', tx: '20px', ty: '-100px', op: 0.65 },
      { id: 7, left: '85%', top: '55%', size: 3, dur: '23s', delay: '-7s', tx: '-18px', ty: '-85px', op: 0.75 },
      { id: 8, left: '92%', top: '35%', size: 6, dur: '20s', delay: '-11s', tx: '22px', ty: '-120px', op: 0.5 },
      { id: 9, left: '82%', top: '78%', size: 4, dur: '18s', delay: '-5s', tx: '-15px', ty: '-105px', op: 0.6 },
      { id: 10, left: '74%', top: '48%', size: 3, dur: '24s', delay: '-13s', tx: '14px', ty: '-90px', op: 0.55 },
      { id: 11, left: '89%', top: '15%', size: 4, dur: '19s', delay: '-9s', tx: '-10px', ty: '-110px', op: 0.7 },
      { id: 12, left: '11%', top: '48%', size: 5, dur: '25s', delay: '-1s', tx: '16px', ty: '-115px', op: 0.6 }
    ];
  }, []);

  return (
    <div className="login-anim-root" aria-hidden="true">
      {/* Layer 1: Photorealistic Scenic Backdrop & Atmospheric Glow */}
      <div className="login-anim-backdrop" />
      <div className="login-anim-ambient-light" />

      {/* Layer 7: Ambient Cloud Drift */}
      <div className="login-cloud-layer" />

      {/* Birds Silhouette (Scenic touch in the upper left sky) */}
      <div className="login-birds-layer">
        <svg width="72" height="34" viewBox="0 0 72 34" fill="none">
          <path
            d="M2 14 C6 8, 12 8, 16 13 C20 8, 26 8, 30 14 C25 12, 19 14, 16 18 C13 14, 7 12, 2 14 Z"
            fill="#5b21b6"
            opacity="0.65"
          />
          <path
            d="M36 6 C39 2, 44 2, 47 6 C50 2, 55 2, 58 6 C54 4.5, 49 6, 47 9 C45 6, 40 4.5, 36 6 Z"
            fill="#6d28d9"
            opacity="0.55"
          />
          <path
            d="M22 24 C24 20, 28 20, 30 23 C32 20, 36 20, 38 23 C35 22, 32 23, 30 25.5 C28 23, 25 22, 22 24 Z"
            fill="#5b21b6"
            opacity="0.45"
          />
        </svg>
      </div>

      {/* SVG Canvas for Layers 2, 3, 5: Glowing Waves, Dotted Flight Path, Globe & Location Pins */}
      <svg
        className="login-anim-svg-canvas"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Luminous Neon Gradient for Waves */}
          <linearGradient id="neonWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c084fc" stopOpacity="0.85" />
            <stop offset="35%" stopColor="#e879f9" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#a855f7" stopOpacity="0.90" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.75" />
          </linearGradient>

          <linearGradient id="neonWaveGradSubtle" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9333ea" stopOpacity="0.5" />
            <stop offset="50%" stopColor="#c084fc" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#e879f9" stopOpacity="0.4" />
          </linearGradient>

          {/* Globe Hologram Gradient */}
          <radialGradient id="globeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="65%" stopColor="#f3e8ff" stopOpacity="0.05" />
            <stop offset="85%" stopColor="#d8b4fe" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#a855f7" stopOpacity="0.55" />
          </radialGradient>

          <linearGradient id="globeGridGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0.60" />
          </linearGradient>

          {/* Drop-shadow filter for glowing paths */}
          <filter id="waveGlow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur1" />
            <feGaussianBlur stdDeviation="14" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ------------------------------------------------------------------
            Layer 2: Flowing Curved Glowing Route Lines / Waves
            ------------------------------------------------------------------ */}
        <g filter="url(#waveGlow)">
          {/* Lower shimmering ambient wave */}
          <path
            className="login-neon-wave-accent"
            d="M -40 850 C 280 810, 520 880, 800 820 C 1080 760, 1280 850, 1490 810"
            fill="none"
            stroke="url(#neonWaveGradSubtle)"
            strokeWidth="1.8"
          />

          {/* Primary vivid neon wave sweeping across the water */}
          <path
            className="login-neon-wave-primary"
            d="M -40 760 C 240 690, 480 810, 740 735 C 990 660, 1220 780, 1490 705"
            fill="none"
            stroke="url(#neonWaveGrad)"
            strokeWidth="2.6"
          />

          {/* Secondary harmonic wave beneath */}
          <path
            className="login-neon-wave-secondary"
            d="M -40 805 C 290 745, 510 845, 780 775 C 1030 705, 1260 815, 1490 755"
            fill="none"
            stroke="url(#neonWaveGrad)"
            strokeWidth="2.2"
          />
        </g>

        {/* ------------------------------------------------------------------
            Holographic Illuminated Globe (Right Sky Area)
            ------------------------------------------------------------------ */}
        <g className="login-globe-aura" transform="translate(0, 0)">
          {/* Globe Atmosphere Outer Glow */}
          <circle
            cx="1210"
            cy="300"
            r="165"
            fill="url(#globeGlow)"
            stroke="url(#globeGridGrad)"
            strokeWidth="2"
            opacity="0.85"
            style={{ filter: 'drop-shadow(0 0 20px rgba(168, 85, 247, 0.45))' }}
          />

          {/* Latitudinal Ellipses */}
          <ellipse cx="1210" cy="300" rx="165" ry="55" fill="none" stroke="url(#globeGridGrad)" strokeWidth="1.2" opacity="0.65" />
          <ellipse cx="1210" cy="235" rx="146" ry="42" fill="none" stroke="url(#globeGridGrad)" strokeWidth="1.1" opacity="0.50" />
          <ellipse cx="1210" cy="365" rx="146" ry="42" fill="none" stroke="url(#globeGridGrad)" strokeWidth="1.1" opacity="0.50" />
          <ellipse cx="1210" cy="180" rx="98" ry="26" fill="none" stroke="url(#globeGridGrad)" strokeWidth="0.9" opacity="0.40" />
          <ellipse cx="1210" cy="420" rx="98" ry="26" fill="none" stroke="url(#globeGridGrad)" strokeWidth="0.9" opacity="0.40" />

          {/* Longitudinal Ellipses */}
          <ellipse cx="1210" cy="300" rx="60" ry="165" fill="none" stroke="url(#globeGridGrad)" strokeWidth="1.2" opacity="0.65" />
          <ellipse cx="1210" cy="300" rx="120" ry="165" fill="none" stroke="url(#globeGridGrad)" strokeWidth="1.1" opacity="0.55" />
          <line x1="1210" y1="135" x2="1210" y2="465" stroke="url(#globeGridGrad)" strokeWidth="1.2" opacity="0.7" />
          <line x1="1045" y1="300" x2="1375" y2="300" stroke="url(#globeGridGrad)" strokeWidth="1.2" opacity="0.7" />

          {/* Subtle stylized continental dots/outlines */}
          <path
            d="M 1130 250 Q 1150 240, 1170 255 Q 1190 270, 1205 260 Q 1220 250, 1235 265 Q 1245 285, 1230 305 Q 1210 320, 1180 300 Q 1155 310, 1140 280 Z"
            fill="rgba(192, 132, 252, 0.16)"
            stroke="#c084fc"
            strokeWidth="1.2"
            opacity="0.75"
          />
          <path
            d="M 1240 225 Q 1265 215, 1285 235 Q 1300 255, 1290 280 Q 1275 270, 1255 260 Z"
            fill="rgba(216, 180, 254, 0.18)"
            stroke="#d8b4fe"
            strokeWidth="1.1"
            opacity="0.7"
          />
          <path
            d="M 1195 330 Q 1215 340, 1225 365 Q 1215 390, 1195 385 Q 1180 365, 1195 330 Z"
            fill="rgba(192, 132, 252, 0.16)"
            stroke="#c084fc"
            strokeWidth="1.1"
            opacity="0.65"
          />
        </g>

        {/* ------------------------------------------------------------------
            Layer 3: Animated Dotted Flight Path (curving past the globe)
            ------------------------------------------------------------------ */}
        <path
          className="login-flight-path"
          d="M 680,105 C 830,75 1010,85 1160,135 C 1290,180 1375,250 1345,340 C 1315,420 1210,460 1090,520"
          fill="none"
          stroke="#7c3aed"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.75"
          style={{ filter: 'drop-shadow(0 0 6px rgba(168, 85, 247, 0.5))' }}
        />

        {/* ------------------------------------------------------------------
            Layer 5: Subtle Location Pins with Beacons
            ------------------------------------------------------------------ */}

        {/* Pin 1: Heritage Temple Hill (Left) */}
        <g className="login-pin-group" transform="translate(175, 545)">
          <circle className="login-pin-pulse" cx="0" cy="-22" r="6" fill="none" stroke="#a855f7" strokeWidth="1.8" />
          <circle className="login-pin-pulse login-pin-pulse--delay" cx="0" cy="-22" r="6" fill="none" stroke="#c084fc" strokeWidth="1.5" />
          {/* Map Pin Path */}
          <path
            d="M 0 -34 C -7.5 -34, -13.5 -28, -13.5 -20.5 C -13.5 -12, 0 0, 0 0 C 0 0, 13.5 -12, 13.5 -20.5 C 13.5 -28, 7.5 -34, 0 -34 Z"
            fill="#7c3aed"
            style={{ filter: 'drop-shadow(0 3px 6px rgba(109, 40, 217, 0.5))' }}
          />
          <circle cx="0" cy="-21" r="5" fill="#ffffff" />
          <circle cx="0" cy="-21" r="2.5" fill="#7c3aed" />
        </g>

        {/* Pin 2: Globe Surface Center-Right */}
        <g className="login-pin-group" transform="translate(1185, 305)">
          <circle className="login-pin-pulse" cx="0" cy="-18" r="5" fill="none" stroke="#c084fc" strokeWidth="1.6" />
          <circle className="login-pin-pulse login-pin-pulse--delay" cx="0" cy="-18" r="5" fill="none" stroke="#e879f9" strokeWidth="1.4" />
          <path
            d="M 0 -28 C -6 -28, -11 -23, -11 -17 C -11 -10, 0 0, 0 0 C 0 0, 11 -10, 11 -17 C 11 -23, 6 -28, 0 -28 Z"
            fill="#8b5cf6"
            style={{ filter: 'drop-shadow(0 2px 5px rgba(139, 92, 246, 0.6))' }}
          />
          <circle cx="0" cy="-17" r="4" fill="#ffffff" />
          <circle cx="0" cy="-17" r="2" fill="#8b5cf6" />
        </g>

        {/* Pin 3: Globe Upper-Right Orbit */}
        <g className="login-pin-group" transform="translate(1335, 235)">
          <circle className="login-pin-pulse" cx="0" cy="-18" r="5" fill="none" stroke="#a855f7" strokeWidth="1.6" />
          <path
            d="M 0 -28 C -6 -28, -11 -23, -11 -17 C -11 -10, 0 0, 0 0 C 0 0, 11 -10, 11 -17 C 11 -23, 6 -28, 0 -28 Z"
            fill="#7c3aed"
            style={{ filter: 'drop-shadow(0 2px 5px rgba(109, 40, 217, 0.5))' }}
          />
          <circle cx="0" cy="-17" r="4" fill="#ffffff" />
          <circle cx="0" cy="-17" r="2" fill="#7c3aed" />
        </g>

        {/* Pin 4: Scenic Lake Waterfront (Lower-Right) */}
        <g className="login-pin-group" transform="translate(1260, 680)">
          <circle className="login-pin-pulse" cx="0" cy="-18" r="5" fill="none" stroke="#a855f7" strokeWidth="1.6" />
          <path
            d="M 0 -28 C -6 -28, -11 -23, -11 -17 C -11 -10, 0 0, 0 0 C 0 0, 11 -10, 11 -17 C 11 -23, 6 -28, 0 -28 Z"
            fill="#6d28d9"
            style={{ filter: 'drop-shadow(0 2px 5px rgba(109, 40, 217, 0.5))' }}
          />
          <circle cx="0" cy="-17" r="4" fill="#ffffff" />
          <circle cx="0" cy="-17" r="2" fill="#6d28d9" />
        </g>
      </svg>

      {/* --------------------------------------------------------------------
          Layer 4: Small Purple Airplane Traveling along the Curved Flight Route
          -------------------------------------------------------------------- */}
      <div className="login-airplane-wrapper">
        <div className="login-airplane-unit">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            {/* Elegant Modern Jet Silhouette matching reference */}
            <path
              d="M21 16V14L13 9V3.5C13 2.67 12.33 2 11.5 2C10.67 2 10 2.67 10 3.5V9L2 14V16L10 13.5V19L8 20.5V22L11.5 21L15 22V20.5L13 19V13.5L21 16Z"
              fill="#5b21b6"
              stroke="#8b5cf6"
              strokeWidth="0.75"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* --------------------------------------------------------------------
          Layer 6: Small Blurred Glowing Floating Particles
          -------------------------------------------------------------------- */}
      <div className="login-particles-layer">
        {particles.map((p) => (
          <span
            key={p.id}
            className="login-particle"
            style={{
              left: p.left,
              top: p.top,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animationDuration: p.dur,
              animationDelay: p.delay,
              '--p-tx': p.tx,
              '--p-ty': p.ty,
              '--p-op': p.op
            }}
          />
        ))}
      </div>

      {/* --------------------------------------------------------------------
          Center Safe Zone: Protects card readability with a pristine soft halo
          -------------------------------------------------------------------- */}
      <div className="login-anim-safezone" />
    </div>
  );
}
