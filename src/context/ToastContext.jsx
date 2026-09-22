import { createContext, useContext, useState, useCallback, useRef } from 'react';
import Icon from '../components/common/Icon.jsx';

const ToastContext = createContext(null);

let autoToastCounter = 0;
const AI_RATE_LIMIT_COOLDOWN = 60000; // 60 seconds cooldown for AI rate limit toasts
const DUPLICATE_MESSAGE_WINDOW = 2000; // 2 seconds suppression for identical messages

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});
  const lastPushedRef = useRef({}); // key -> timestamp

  const dismiss = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((message, type = 'success', options = {}) => {
    if (!message) return null;

    // Normalize options: allow passing a string ID directly or an options object
    const opts = typeof options === 'string' ? { id: options } : options || {};
    const customId = opts.id || null;
    const duration = opts.duration ?? (type === 'error' ? 5000 : 3800);
    const cooldown = opts.cooldown ?? (
      message.toLowerCase().includes('rate limit') || customId === 'ai-rate-limit'
        ? AI_RATE_LIMIT_COOLDOWN
        : (customId ? 0 : DUPLICATE_MESSAGE_WINDOW)
    );

    const now = Date.now();
    const dedupeKey = customId || `${type}:${message}`;

    // Cooldown / Duplicate check
    if (cooldown > 0) {
      const lastTime = lastPushedRef.current[dedupeKey] || 0;
      if (now - lastTime < cooldown && !opts.force) {
        // If it's a known custom ID that already exists in state, we may update it, but not spam
        if (!customId) {
          return null; // Suppress duplicate toast spam
        }
      }
    }
    lastPushedRef.current[dedupeKey] = now;

    const id = customId || `toast-${++autoToastCounter}`;

    setToasts((prev) => {
      const existingIndex = prev.findIndex((t) => t.id === id);
      if (existingIndex >= 0) {
        // Update existing toast in place instead of creating a new one
        const updated = [...prev];
        updated[existingIndex] = { id, message, type };
        return updated;
      }
      // Add new toast
      return [...prev, { id, message, type }];
    });

    // Reset auto-dismiss timer
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
    }

    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => {
        dismiss(id);
      }, duration);
    }

    return id;
  }, [dismiss]);

  const updateToast = useCallback((id, { message, type = 'success', duration = 3800 }) => {
    if (!id) return;
    setToasts((prev) => {
      const existing = prev.find((t) => t.id === id);
      if (!existing) return prev;
      return prev.map((t) => (t.id === id ? { ...t, message: message ?? t.message, type: type ?? t.type } : t));
    });

    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
    }
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => {
        dismiss(id);
      }, duration);
    }
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ push, dismiss, updateToast }}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <Icon
              name={t.type === 'error' ? 'alert-triangle' : t.type === 'info' ? 'info' : t.type === 'warning' ? 'alert-circle' : 'check'}
              size={16}
            />
            <span>{t.message}</span>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <Icon name="x" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

