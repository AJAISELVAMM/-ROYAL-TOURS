import React, { useEffect, useState, useRef } from 'react';
import TravelBoy from './TravelBoy.jsx';
import ClickSpark from './ClickSpark.jsx';
import './LogoutOverlayAnimation.css';

/**
 * LogoutOverlayAnimation — Multi-stage animated logout sequence.
 * Faithfully reproduces all 6 steps shown in Reference Image 3:
 *
 * Stage 1 (0ms - 900ms):
 *   - "Logging out... See you soon!" card appears.
 *   - Boy runs from screen center towards bottom-left sidebar Logout button.
 *
 * Stage 2 (900ms - 1500ms):
 *   - Boy reaches Logout button, taps it with spark flash.
 *   - Glowing portal/doorway opens near bottom-left.
 *
 * Stage 3 (1500ms - 2400ms):
 *   - Boy steps into the luminous purple doorway.
 *
 * Stage 4 (2400ms - 4800ms):
 *   - Full-screen scenic dreamscape: mountains, sky, clouds, birds.
 *   - Directional signpost: "New Journey / New Places / Better You".
 *   - Sleek modern purple bullet train glides across elevated sky track.
 *   - Cute boy visible smiling and waving from train front cabin window!
 *   - "Logging you out... Thanks for being with us!" with train progress bar.
 *
 * Stage 5 (4800ms - 6200ms):
 *   - Train zooms away into distance.
 *   - Purple checkmark appears: "You're all set! See you soon on your next journey."
 *
 * Stage 6 (6200ms+):
 *   - Sequence finishes, triggers onComplete callback (clears auth, navigates to /login).
 */
export default function LogoutOverlayAnimation({ onComplete }) {
  const [stage, setStage] = useState(1);
  const [sparkActive, setSparkActive] = useState(false);
  const [trainProgress, setTrainProgress] = useState(0);
  const completedRef = useRef(false);

  useEffect(() => {
    // Stage 1 -> Stage 2 (Boy arrives at logout button, taps & sparks)
    const t1 = setTimeout(() => {
      setStage(2);
      setSparkActive(true);
    }, 950);

    // Turn off spark flash after 450ms
    const tSpark = setTimeout(() => {
      setSparkActive(false);
    }, 1450);

    // Stage 2 -> Stage 3 (Doorway opens, boy enters)
    const t2 = setTimeout(() => {
      setStage(3);
    }, 1400);

    // Stage 3 -> Stage 4 (Full-screen sky & train journey)
    const t3 = setTimeout(() => {
      setStage(4);
    }, 2400);

    // Stage 4 -> Stage 5 (Train zooms off, "You're all set!" checkmark appears)
    const t4 = setTimeout(() => {
      setStage(5);
    }, 4900);

    // Stage 5 -> Stage 6 (Finish & redirect)
    const t5 = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        if (onComplete) onComplete();
      }
    }, 6300);

    return () => {
      clearTimeout(t1);
      clearTimeout(tSpark);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [onComplete]);

  // Train progress ticker during Stage 4
  useEffect(() => {
    if (stage !== 4) return;
    const start = Date.now();
    const duration = 2400;
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setTrainProgress(pct);
      if (elapsed >= duration) clearInterval(timer);
    }, 25);

    return () => clearInterval(timer);
  }, [stage]);

  return (
    <div
      className={`logout-overlay-root logout-stage-${stage}`}
      role="dialog"
      aria-modal="true"
      aria-label="Logging out animation"
    >
      {/* =====================================================================
          STAGES 1, 2, 3: OVERLAY ON EXISTING PAGE
          ===================================================================== */}
      {(stage === 1 || stage === 2 || stage === 3) && (
        <>
          {/* Dimmed backdrop to keep existing page softly visible behind */}
          <div className="logout-stage-backdrop" />

          {/* Central Initial Modal: "Logging out... See you soon!" */}
          <div className="logout-initial-card">
            <div className="logout-card-icon-wrap">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <h3 className="logout-initial-title">Logging out...</h3>
            <p className="logout-initial-subtitle">See you soon!</p>
            <div className="logout-initial-bar-track">
              <div className="logout-initial-bar-fill" />
            </div>
          </div>

          {/* Glowing Portal Door at Bottom-Left (near sidebar logout button) */}
          {(stage === 2 || stage === 3) && (
            <div className="logout-portal-door">
              <div className="door-glow-flare" />
              <div className="door-frame">
                <div className="door-light-beam" />
              </div>
            </div>
          )}

          {/* The Cute Boy running to bottom-left Logout button, tapping, and entering door */}
          <div className={`logout-boy-runner stage-${stage}`}>
            <TravelBoy
              mode={stage === 1 ? 'run' : stage === 2 ? 'click' : 'enter-door'}
              scale={stage === 3 ? 0.75 : 0.88}
              facing={stage === 1 ? 'left' : 'right'}
            />
          </div>

          {/* Button Spark Burst at Bottom-Left */}
          {sparkActive && (
            <div className="logout-button-spark">
              <ClickSpark active={true} />
            </div>
          )}
        </>
      )}

      {/* =====================================================================
          STAGE 4 & 5: FULL-SCREEN TRAVEL DREAMSCAPE & BULLET TRAIN
          ===================================================================== */}
      {(stage === 4 || stage === 5) && (
        <div className="logout-cinematic-scene">
          {/* Panoramic Lavender Sky & Mountain Backdrop */}
          <div className="cinematic-backdrop">
            {/* Birds in sky */}
            <div className="cinematic-birds">
              <svg width="120" height="50" viewBox="0 0 120 50" fill="none">
                <path d="M10 20 C14 12, 22 12, 26 18 C30 12, 38 12, 42 20 C36 17, 28 20, 26 25 C24 20, 16 17, 10 20 Z" fill="#6d28d9" opacity="0.6" />
                <path d="M55 10 C58 4, 64 4, 67 9 C70 4, 76 4, 79 10 C75 8, 69 10, 67 14 C65 10, 59 8, 55 10 Z" fill="#7c3aed" opacity="0.5" />
                <path d="M85 24 C88 18, 94 18, 97 22 C100 18, 106 18, 109 24 C105 22, 100 24, 97 27 C95 24, 90 22, 85 24 Z" fill="#8b5cf6" opacity="0.55" />
              </svg>
            </div>

            {/* Distant Mountain Peaks */}
            <svg
              className="cinematic-mountains-svg"
              viewBox="0 0 1440 380"
              fill="none"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Back peak layer */}
              <path
                d="M0 240 L180 120 L320 220 L510 90 L680 230 L840 110 L1040 250 L1220 130 L1440 240 L1440 380 L0 380 Z"
                fill="#d8b4fe"
                opacity="0.5"
              />
              {/* Mid peak layer */}
              <path
                d="M0 270 L240 180 L420 270 L620 160 L800 280 L980 170 L1180 280 L1360 190 L1440 250 L1440 380 L0 380 Z"
                fill="#c084fc"
                opacity="0.6"
              />
            </svg>

            {/* Fluffy Cloud Banks below track */}
            <div className="cinematic-cloud-bank" />
          </div>

          {/* Directional Signpost (Right Side): "New Journey / New Places / Better You" */}
          <div className="logout-signpost">
            <svg width="150" height="150" viewBox="0 0 150 150" fill="none">
              {/* Wooden Post */}
              <rect x="70" y="20" width="10" height="130" rx="3" fill="#a16207" />
              <rect x="72" y="20" width="3" height="130" fill="#ca8a04" opacity="0.6" />
              {/* Board 1: New Journey */}
              <g transform="translate(18, 25)">
                <path d="M0 0 L90 0 L104 14 L90 28 L0 28 Z" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
                <text x="12" y="19" fill="#78350f" fontSize="11" fontWeight="700" fontFamily="sans-serif">New Journey</text>
              </g>
              {/* Board 2: New Places */}
              <g transform="translate(26, 60)">
                <path d="M0 0 L84 0 L98 14 L84 28 L0 28 Z" fill="#fde047" stroke="#ca8a04" strokeWidth="1.5" />
                <text x="12" y="19" fill="#78350f" fontSize="11" fontWeight="700" fontFamily="sans-serif">New Places</text>
              </g>
              {/* Board 3: Better You */}
              <g transform="translate(22, 95)">
                <path d="M0 0 L88 0 L102 14 L88 28 L0 28 Z" fill="#fef08a" stroke="#ca8a04" strokeWidth="1.5" />
                <text x="12" y="19" fill="#78350f" fontSize="11" fontWeight="700" fontFamily="sans-serif">Better You</text>
              </g>
            </svg>
          </div>

          {/* Elevated High-Speed Sky Railway Track */}
          <div className="logout-sky-track">
            <div className="sky-track-pylons" />
            <div className="sky-track-beam" />
            <div className="sky-track-rail" />
          </div>

          {/* High-Speed Purple Bullet Train with Boy Waving */}
          <div className={`logout-bullet-train-assembly ${stage === 5 ? 'train-zoom-away' : ''}`}>
            <svg
              className="bullet-train-svg"
              viewBox="0 0 520 140"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="bulletBody" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="60%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#5b21b6" />
                </linearGradient>
                <linearGradient id="bulletStripe" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#e9d5ff" />
                </linearGradient>
                <linearGradient id="bulletWindow" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
              </defs>

              {/* TRAIN REAR CARRIAGE */}
              <g>
                <rect x="30" y="44" width="130" height="60" rx="8" fill="url(#bulletBody)" />
                <rect x="30" y="70" width="130" height="10" fill="url(#bulletStripe)" />
                {/* Windows */}
                <rect x="44" y="52" width="24" height="15" rx="4" fill="url(#bulletWindow)" />
                <rect x="76" y="52" width="24" height="15" rx="4" fill="url(#bulletWindow)" />
                <rect x="108" y="52" width="24" height="15" rx="4" fill="url(#bulletWindow)" />
                <rect x="140" y="52" width="14" height="15" rx="3" fill="url(#bulletWindow)" />
                {/* Skirt / Bogie Wheels */}
                <rect x="36" y="104" width="118" height="6" rx="2" fill="#1e1b4b" />
                <circle cx="58" cy="112" r="8" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="124" cy="112" r="8" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
              </g>

              {/* TRAIN MIDDLE CARRIAGE */}
              <g>
                <rect x="166" y="44" width="135" height="60" rx="8" fill="url(#bulletBody)" />
                <rect x="166" y="70" width="135" height="10" fill="url(#bulletStripe)" />
                {/* Windows */}
                <rect x="178" y="52" width="24" height="15" rx="4" fill="url(#bulletWindow)" />
                <rect x="210" y="52" width="24" height="15" rx="4" fill="url(#bulletWindow)" />
                <rect x="242" y="52" width="24" height="15" rx="4" fill="url(#bulletWindow)" />
                <rect x="274" y="52" width="20" height="15" rx="4" fill="url(#bulletWindow)" />
                {/* Skirt / Bogie */}
                <rect x="174" y="104" width="120" height="6" rx="2" fill="#1e1b4b" />
                <circle cx="196" cy="112" r="8" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="264" cy="112" r="8" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
              </g>

              {/* TRAIN NOSE / LOCOMOTIVE LEAD CAR */}
              <g>
                {/* Aerodynamic bullet locomotive nose */}
                <path
                  d="M305 44 L430 44 C470 44 505 70 514 92 C518 100 512 104 500 104 L305 104 Z"
                  fill="url(#bulletBody)"
                />
                <path
                  d="M305 70 L442 70 C465 70 488 80 496 90 L488 94 C480 84 460 76 440 76 L305 76 Z"
                  fill="url(#bulletStripe)"
                />
                {/* Passenger windows in lead car */}
                <rect x="318" y="52" width="22" height="15" rx="4" fill="url(#bulletWindow)" />
                <rect x="348" y="52" width="22" height="15" rx="4" fill="url(#bulletWindow)" />
                {/* Driver Cockpit Curved Windshield */}
                <path
                  d="M405 50 L452 50 C468 50 482 62 488 74 L420 74 C412 64 410 54 405 50 Z"
                  fill="url(#bulletWindow)"
                />
                {/* Front Headlights */}
                <ellipse cx="504" cy="94" rx="5" ry="3.5" fill="#fef08a" />
                <polygon points="510,94 540,84 540,104" fill="url(#bulletStripe)" opacity="0.4" />
                {/* Lead Skirt */}
                <rect x="312" y="104" width="180" height="6" rx="2" fill="#1e1b4b" />
                <circle cx="338" cy="112" r="8" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
                <circle cx="410" cy="112" r="8" fill="#334155" stroke="#94a3b8" strokeWidth="2" />
              </g>
            </svg>

            {/* Cute Boy waving from the front passenger window of the train! */}
            <div className="train-boy-passenger">
              <TravelBoy mode="wave" scale={0.46} facing="right" />
            </div>
          </div>

          {/* Bottom Card for Stage 4: "Logging you out... Thanks for being with us!" */}
          {stage === 4 && (
            <div className="logout-train-footer-card">
              <h2 className="logout-train-title">Logging you out...</h2>
              <p className="logout-train-subtitle">Thanks for being with us!</p>

              {/* Progress bar with cute moving train indicator */}
              <div className="logout-progress-track">
                <div
                  className="logout-progress-fill"
                  style={{ width: `${trainProgress}%` }}
                >
                  <div className="logout-progress-train-badge">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff">
                      <path d="M4 15.5C4 17.43 5.57 19 7.5 19L6 20.5V21H18V20.5L16.5 19C18.43 19 20 17.43 20 15.5V5C20 2.5 17.5 2 12 2C6.5 2 4 2.5 4 5V15.5ZM12 4C17 4 18 4.5 18 6V10H6V6C6 4.5 7 4 12 4ZM6 12H18V15.5C18 16.33 17.33 17 16.5 17H7.5C6.67 17 6 16.33 6 15.5V12ZM8.5 16C9.33 16 10 15.33 10 14.5C10 13.67 9.33 13 8.5 13C7.67 13 7 13.67 7 14.5C7 15.33 7.67 16 8.5 16ZM15.5 16C16.33 16 17 15.33 17 14.5C17 13.67 16.33 13 15.5 13C14.67 13 14 13.67 14 14.5C14 15.33 14.67 16 15.5 16Z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stage 5: "You're all set! See you soon on your next journey." */}
          {stage === 5 && (
            <div className="logout-allset-card">
              <div className="allset-check-badge">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="allset-title">You're all set!</h2>
              <p className="allset-subtitle">See you soon on your next journey.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
