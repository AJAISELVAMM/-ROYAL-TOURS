import React from 'react';
import './TravelBoy.css';

/**
 * TravelBoy — Cute animated travel boy character.
 * Visual design matches Reference Image 1 & 3:
 * - Purple hoodie with pouch and hood
 * - Dark blue travel backpack
 * - Navy athletic joggers
 * - Purple and white sneakers
 * - Cute spiky dark anime/manga travel hairstyle
 *
 * Supported modes:
 * - 'run': Running cycle with alternating legs and swinging arms
 * - 'click': Reaching forward and tapping/clicking
 * - 'enter-door': Walking away/entering into the glowing portal
 * - 'wave': Waving hand cheerfully (used inside the train cabin)
 */
export default function TravelBoy({
  mode = 'run',
  className = '',
  style = {},
  facing = 'right',
  scale = 1
}) {
  return (
    <div
      className={`travel-boy-root travel-boy--${mode} travel-boy--face-${facing} ${className}`}
      style={{
        ...style,
        transform: `${style.transform || ''} scale(${scale})`.trim()
      }}
      aria-hidden="true"
    >
      <svg
        className="travel-boy-svg"
        viewBox="0 0 160 180"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="boySkin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fed7aa" />
            <stop offset="100%" stopColor="#fdba74" />
          </linearGradient>
          <linearGradient id="boyBlush" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="boyHoodie" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#6d28d9" />
          </linearGradient>
          <linearGradient id="boyHoodieLight" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
          <linearGradient id="boyBackpack" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#312e81" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
          <linearGradient id="boyPants" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id="boyShoe" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4c1d95" />
          </linearGradient>
          <linearGradient id="boyHair" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#18181b" />
            <stop offset="100%" stopColor="#27272a" />
          </linearGradient>
        </defs>

        {/* BACKPACK (Behind character torso) */}
        <g className="boy-part-backpack">
          <rect x="22" y="72" width="34" height="46" rx="14" fill="url(#boyBackpack)" />
          <path d="M26 84 Q18 96 24 110" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" />
          <rect x="26" y="98" width="26" height="16" rx="6" fill="#4338ca" />
          <circle cx="39" cy="106" r="3" fill="#a5b4fc" />
          {/* Straps */}
          <path d="M42 76 C46 64 64 62 70 76" stroke="#4338ca" strokeWidth="5" strokeLinecap="round" fill="none" />
        </g>

        {/* BACK LEG */}
        <g className="boy-part-leg-back">
          <path d="M60 118 L46 148 L32 152" stroke="url(#boyPants)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
          {/* Back Shoe */}
          <g transform="translate(18, 142)">
            <ellipse cx="14" cy="12" rx="15" ry="7" fill="url(#boyShoe)" />
            <rect x="3" y="14" width="22" height="4" rx="2" fill="#f8fafc" />
            <path d="M7 10 Q14 8 20 10" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>

        {/* FRONT LEG */}
        <g className="boy-part-leg-front">
          <path d="M78 118 L94 144 L114 150" stroke="url(#boyPants)" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
          {/* Front Shoe */}
          <g transform="translate(100, 140)">
            <ellipse cx="15" cy="12" rx="16" ry="7.5" fill="url(#boyShoe)" />
            <rect x="4" y="14" width="24" height="4" rx="2" fill="#f8fafc" />
            <path d="M8 10 Q16 7 22 10" stroke="#ddd6fe" strokeWidth="2" strokeLinecap="round" />
          </g>
        </g>

        {/* TORSO / HOODIE */}
        <g className="boy-part-torso">
          {/* Body main */}
          <path
            d="M48 80 C48 70 60 66 75 66 C90 66 102 70 102 80 L96 122 C96 126 92 128 75 128 C58 128 54 126 54 122 Z"
            fill="url(#boyHoodie)"
          />
          {/* Hoodie kangaroo front pocket */}
          <path
            d="M62 100 Q75 96 88 100 L86 118 Q75 120 64 118 Z"
            fill="url(#boyHoodieLight)"
            opacity="0.85"
          />
          <path d="M63 103 Q75 99 87 103" stroke="#c4b5fd" strokeWidth="1.5" strokeLinecap="round" />
          {/* Collar / hood rim */}
          <path
            d="M58 72 C64 82 86 82 92 72 C88 64 62 64 58 72 Z"
            fill="#5b21b6"
          />
          {/* Drawstrings */}
          <path d="M68 76 L67 92" stroke="#e0e7ff" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M82 76 L83 92" stroke="#e0e7ff" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="67" cy="93" r="2" fill="#a78bfa" />
          <circle cx="83" cy="93" r="2" fill="#a78bfa" />
        </g>

        {/* BACK ARM */}
        <g className="boy-part-arm-back">
          <path d="M54 78 L32 94 L22 88" stroke="url(#boyHoodieLight)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="20" cy="87" r="7" fill="url(#boySkin)" />
        </g>

        {/* HEAD */}
        <g className="boy-part-head">
          {/* Neck */}
          <rect x="70" y="60" width="10" height="12" rx="4" fill="url(#boySkin)" />

          {/* Face */}
          <ellipse cx="80" cy="46" rx="22" ry="20" fill="url(#boySkin)" />
          {/* Cheerful blush */}
          <ellipse cx="68" cy="52" rx="5" ry="3" fill="url(#boyBlush)" />
          <ellipse cx="92" cy="52" rx="5" ry="3" fill="url(#boyBlush)" />

          {/* Eyes - Big anime travel sparkle */}
          <g className="boy-eyes">
            {/* Left Eye */}
            <ellipse cx="73" cy="45" rx="4.5" ry="6" fill="#1e1b4b" />
            <circle cx="71.5" cy="43" r="2" fill="#ffffff" />
            <circle cx="74.5" cy="47" r="1" fill="#ffffff" />
            {/* Right Eye */}
            <ellipse cx="88" cy="45" rx="4.5" ry="6" fill="#1e1b4b" />
            <circle cx="86.5" cy="43" r="2" fill="#ffffff" />
            <circle cx="89.5" cy="47" r="1" fill="#ffffff" />
            {/* Eyebrows */}
            <path d="M68 37 Q74 34 78 37" stroke="#18181b" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M84 37 Q88 34 94 37" stroke="#18181b" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>

          {/* Cute smile */}
          <path d="M76 53 Q81 59 86 53" stroke="#991b1b" strokeWidth="2.2" strokeLinecap="round" fill="#fda4af" />

          {/* Ears */}
          <ellipse cx="58" cy="47" rx="4.5" ry="5.5" fill="url(#boySkin)" />
          <ellipse cx="102" cy="47" rx="4.5" ry="5.5" fill="url(#boySkin)" />

          {/* HAIR - Spiky layered travel style */}
          <g className="boy-hair">
            <path
              d="M58 44 C54 30 64 16 80 16 C96 16 106 28 104 42 C99 36 94 34 88 36 C84 31 76 30 72 35 C68 34 62 38 58 44 Z"
              fill="url(#boyHair)"
            />
            {/* Front fringe / spikes */}
            <path d="M62 36 L66 45 L72 37 L78 46 L84 36 L90 45 L96 38" fill="url(#boyHair)" />
            {/* Purple highlight tuft */}
            <path d="M74 20 C76 15 84 16 86 21 C82 20 78 20 74 20 Z" fill="#a855f7" />
            <path d="M64 26 C68 22 74 23 76 27 C72 26 68 26 64 26 Z" fill="#c084fc" opacity="0.8" />
          </g>
        </g>

        {/* FRONT ARM (Running swing OR Pointing/Tapping forward) */}
        <g className="boy-part-arm-front">
          {mode === 'click' || mode === 'run' ? (
            /* Reaching forward / pointing hand */
            <g className="boy-arm-pointing">
              <path
                d="M84 80 L112 86 L134 86"
                stroke="url(#boyHoodieLight)"
                strokeWidth="13"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Hand with pointing index finger */}
              <g transform="translate(132, 80)">
                <ellipse cx="6" cy="6" rx="7" ry="6" fill="url(#boySkin)" />
                {/* Outstretched pointing finger */}
                <path d="M8 5 L20 5" stroke="url(#boySkin)" strokeWidth="4.5" strokeLinecap="round" />
                {/* Thumb */}
                <path d="M6 3 L10 1" stroke="url(#boySkin)" strokeWidth="3.5" strokeLinecap="round" />
              </g>
            </g>
          ) : mode === 'wave' ? (
            /* Cheerful waving hand */
            <g className="boy-arm-waving">
              <path
                d="M84 80 L104 62 L116 46"
                stroke="url(#boyHoodieLight)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <g transform="translate(114, 38)">
                <circle cx="6" cy="6" r="6.5" fill="url(#boySkin)" />
                <path d="M4 1 L5 -3" stroke="url(#boySkin)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M7 1 L9 -4" stroke="url(#boySkin)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M10 2 L13 -2" stroke="url(#boySkin)" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            </g>
          ) : (
            /* Normal swinging arm */
            <g className="boy-arm-swing">
              <path
                d="M84 80 L108 98 L124 92"
                stroke="url(#boyHoodieLight)"
                strokeWidth="13"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="126" cy="92" r="7" fill="url(#boySkin)" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
