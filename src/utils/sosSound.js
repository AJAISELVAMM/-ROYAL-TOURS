// =============================================================================
// sosSound.js — SOS Alert Sound, Vibration & Browser Notification Dispatcher.
// Uses HTML5 Audio with src/assets/sounds/sos-alert.mp3 + Web Audio API fallback.
// Continuous alerting continues until user clicks [View].
// =============================================================================

let isAlerting = false;
let audioElement = null;
let alertInterval = null;
let vibrationInterval = null;
let audioContextInstance = null;
let activeAlertId = null;

/**
 * Synthesize SOS siren burst using Web Audio API oscillator
 */
function playWebAudioSiren() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContextInstance || audioContextInstance.state === 'closed') {
      audioContextInstance = new AudioCtx();
    }
    const ctx = audioContextInstance;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';

    // Frequency siren sweep 800Hz <-> 1200Hz
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.3);
    osc.frequency.linearRampToValueAtTime(800, now + 0.6);
    osc.frequency.linearRampToValueAtTime(1200, now + 0.9);
    osc.frequency.linearRampToValueAtTime(800, now + 1.2);
    osc.frequency.linearRampToValueAtTime(1000, now + 1.5);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.6);
  } catch {
    // Graceful fallback
  }
}

/**
 * Play single burst of SOS alert sound
 */
export function playSOSAlertSound() {
  try {
    if (!audioElement) {
      audioElement = new Audio('/sounds/sos-alert.mp3');
      audioElement.volume = 0.9;
    }
    audioElement.currentTime = 0;
    const playPromise = audioElement.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        playWebAudioSiren();
      });
    }
  } catch {
    playWebAudioSiren();
  }
}

/**
 * Trigger device vibration pattern [300, 150, 300, 150, 500] where supported
 */
export function triggerSOSVibration() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([300, 150, 300, 150, 500]);
    }
  } catch {
    // Ignore unsupported
  }
}

/**
 * Start continuous SOS alert (Sound + Vibration).
 * Must ONLY stop when user clicks [View].
 */
export function startContinuousSOSAlert(alertId = null) {
  if (isAlerting) return;
  isAlerting = true;
  activeAlertId = alertId;

  playSOSAlertSound();
  triggerSOSVibration();

  // Loop alert every 2.5 seconds until stopped
  if (!alertInterval) {
    alertInterval = setInterval(() => {
      if (!isAlerting) return;
      playSOSAlertSound();
    }, 2500);
  }

  if (!vibrationInterval) {
    vibrationInterval = setInterval(() => {
      if (!isAlerting) return;
      triggerSOSVibration();
    }, 2500);
  }
}

/**
 * Stop continuous SOS alert sound and vibration immediately
 */
export function stopSOSAlert(alertId = null) {
  if (alertId && activeAlertId && alertId !== activeAlertId) return;
  isAlerting = false;
  activeAlertId = null;

  if (alertInterval) {
    clearInterval(alertInterval);
    alertInterval = null;
  }

  if (vibrationInterval) {
    clearInterval(vibrationInterval);
    vibrationInterval = null;
  }

  if (audioElement) {
    try {
      audioElement.pause();
      audioElement.currentTime = 0;
    } catch {
      // ignore
    }
  }

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(0);
    }
  } catch {
    // ignore
  }
}

/**
 * Show system browser notification for SOS emergency
 */
export function showBrowserSOSNotification(title = '🚨 SOS EMERGENCY ALERT', body = 'An emergency SOS alert has been triggered!') {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/hero-banner.jpg',
        tag: 'royal-tours-sos',
        requireInteraction: true
      });
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          new Notification(title, {
            body,
            icon: '/hero-banner.jpg',
            tag: 'royal-tours-sos',
            requireInteraction: true
          });
        }
      }).catch(() => {});
    }
  } catch {
    // Ignore
  }
}

/**
 * Trigger incoming SOS response across all channels
 */
export function triggerIncomingSOSAlert(alertData = {}) {
  startContinuousSOSAlert(alertData.sosId || alertData.id || null);

  const tourist = alertData.touristName || alertData.userName || alertData.user?.name || 'A group member';
  const type = alertData.emergencyType || 'Emergency';
  showBrowserSOSNotification(
    `🚨 ROYAL TOURS: ${type} SOS Alert!`,
    `${tourist} triggered an emergency SOS alert. Location coordinates transmitted.`
  );
}
