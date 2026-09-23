import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../../components/common/Logo.jsx";
import Button from "../../components/common/Button.jsx";
import Icon from "../../components/common/Icon.jsx";
import * as authService from "../../services/authService.js";
import { useToast } from "../../context/ToastContext.jsx";
import LoginBackgroundAnimation from "../../components/auth/LoginBackgroundAnimation.jsx";

const OTP_SECONDS = 60;
const RESEND_COOLDOWN = 30;
const MAX_ATTEMPTS = 5;

function OtpModal({ otpCode, expiresIn, phone, onVerified, onClose }) {
  const { push } = useToast();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(expiresIn || OTP_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN);
  const [currentOtp, setCurrentOtp] = useState(otpCode);
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [expired, setExpired] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const inputsRef = useRef([]);
  const countdownRef = useRef(null);
  const resendRef = useRef(null);

  function startCountdown(seconds) {
    clearInterval(countdownRef.current);
    setCountdown(seconds);
    setExpired(false);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(countdownRef.current); setExpired(true); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  function startResendCooldown() {
    clearInterval(resendRef.current);
    setResendCooldown(RESEND_COOLDOWN);
    resendRef.current = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(resendRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  useEffect(() => {
    startCountdown(expiresIn || OTP_SECONDS);
    startResendCooldown();
    setTimeout(() => inputsRef.current[0]?.focus(), 100);
    return () => { clearInterval(countdownRef.current); clearInterval(resendRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = useCallback((index, value) => {
    const v = value.replace(/[^\d]/g, "").slice(-1);
    setDigits((d) => { const next = [...d]; next[index] = v; return next; });
    if (v && index < 5) inputsRef.current[index + 1]?.focus();
    setError("");
  }, []);

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) inputsRef.current[index - 1]?.focus();
  }, [digits]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const text = (e.clipboardData.getData("text") || "").replace(/[^\d]/g, "").slice(0, 6);
    if (!text) return;
    const next = Array(6).fill("");
    text.split("").forEach((ch, i) => (next[i] = ch));
    setDigits(next);
    inputsRef.current[Math.min(text.length, 5)]?.focus();
  }, []);

  async function handleVerify() {
    if (expired) { setError("OTP has expired. Please request a new one."); return; }
    if (blocked) { setError("Too many attempts. Please request a new OTP."); return; }
    const code = digits.join("");
    if (code.length < 6) { setError("Please enter the complete 6-digit code."); return; }
    setVerifying(true); setError("");
    const result = await authService.verifyDemoOTP(code);
    setVerifying(false);
    if (result.success) {
      clearInterval(countdownRef.current); clearInterval(resendRef.current);
      onVerified();
    } else if (result.tooManyAttempts) {
      setBlocked(true); setAttemptsLeft(0);
      setError("Too many incorrect attempts. Please request a new OTP.");
    } else if (result.expired) {
      setExpired(true); setError("OTP has expired. Please request a new one.");
    } else {
      const newLeft = Math.max(0, attemptsLeft - 1);
      setAttemptsLeft(newLeft);
      if (newLeft <= 0) { setBlocked(true); setError("Too many incorrect attempts. Please request a new OTP."); }
      else setError(`Incorrect OTP. ${newLeft} attempt${newLeft === 1 ? "" : "s"} remaining.`);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError(""); setDigits(["", "", "", "", "", ""]); setBlocked(false); setAttemptsLeft(MAX_ATTEMPTS);
    const result = await authService.resendDemoOTP();
    if (result.success) {
      setCurrentOtp(result.otp);
      startCountdown(result.expiresIn || OTP_SECONDS);
      startResendCooldown();
      push("New OTP generated", "success");
      setTimeout(() => inputsRef.current[0]?.focus(), 100);
    } else {
      setError(result.error || "Could not generate new OTP. Please try again.");
    }
  }

  const canVerify = digits.join("").length === 6 && !expired && !blocked && !verifying;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="otp-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal modal-sm" style={{ width: "100%", maxWidth: "400px" }}>
        <div className="modal-header">
          <span className="modal-title" id="otp-modal-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "20px" }}>&#128272;</span> Verify Account
          </span>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ textAlign: "center" }}>
          {/* Demo OTP Display */}
          <div style={{
            background: "var(--purple-50)", border: "1.5px solid var(--lavender-soft)",
            borderRadius: "12px", padding: "16px 20px", marginBottom: "18px"
          }}>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "6px" }}>
              Your verification OTP is
            </p>
            <div style={{
              fontSize: "34px", fontWeight: "800", letterSpacing: "8px",
              color: "var(--purple-deep)", fontVariantNumeric: "tabular-nums", lineHeight: 1.2
            }}>
              {currentOtp}
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-faint)", marginTop: "8px" }}>
              {expired
                ? <span style={{ color: "var(--red)", fontWeight: 600 }}>OTP expired</span>
                : <>OTP expires in <strong style={{ color: countdown <= 10 ? "var(--red)" : "var(--purple)" }}>{countdown}s</strong></>
              }
            </p>
          </div>

          <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "18px" }}>
            Enter the code above for{" "}
            <strong style={{ color: "var(--text)" }}>
              {phone ? `${phone.slice(0, 2)}\u2022\u2022\u2022\u2022\u2022\u2022${phone.slice(-2)}` : "your phone"}
            </strong>
          </p>

          <div className="otp-inputs" onPaste={handlePaste} style={{ justifyContent: "center", marginBottom: "16px" }}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => (inputsRef.current[i] = el)}
                className="otp-input"
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                aria-label={`Digit ${i + 1}`}
                disabled={expired || blocked}
                style={{ opacity: expired || blocked ? 0.5 : 1 }}
              />
            ))}
          </div>

          {error && (
            <div className="form-error" style={{ marginBottom: "14px", textAlign: "left" }}>
              <Icon name="alert-circle" size={15} /> {error}
            </div>
          )}

          <Button block size="lg" onClick={handleVerify} loading={verifying} disabled={!canVerify}>
            Verify OTP
          </Button>

          <div style={{ marginTop: "16px", display: "flex", justifyContent: "center", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
            {resendCooldown > 0 ? (
              <span className="otp-countdown">Resend OTP in {resendCooldown}s</span>
            ) : (
              <button className="link-btn" onClick={handleResend}>Resend OTP</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreateAccountPage() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpExpiresIn, setOtpExpiresIn] = useState(OTP_SECONDS);

  function update(key, value) { setForm((f) => ({ ...f, [key]: value })); }

  async function handleVerifyNumber(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Please enter your full name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return setError("Please enter a valid email address.");
    if (!/^\d{10}$/.test(form.phone)) return setError("Please enter a valid 10-digit phone number.");
    if (form.password.length < 6) return setError("Password must be at least 6 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");

    setLoading(true);
    const result = await authService.requestDemoOTP({
      name: form.name, email: form.email, phone: form.phone, password: form.password
    });
    setLoading(false);

    if (!result.success) { setError(result.error || "Something went wrong. Please try again."); return; }

    setOtpCode(result.otp);
    setOtpExpiresIn(result.expiresIn || OTP_SECONDS);
    setOtpOpen(true);
  }

  function handleOtpVerified() {
    setOtpOpen(false);
    push("Account created successfully! Please login to continue.", "success");
    navigate("/login", { replace: true });
  }

  return (
    <div className="auth-page auth-page--login">
      <LoginBackgroundAnimation />
      <div className="auth-brand"><Logo size={36} showIcon={false} /></div>
      <div className="auth-card">
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-subtitle">Join ROYAL TOURS and start your journey.</p>

        <form onSubmit={handleVerifyNumber} className="auth-form">
          <label className="field">
            <span className="field-label">Full Name</span>
            <div className="field-control">
              <Icon name="user" size={16} />
              <input type="text" value={form.name} onChange={(e) => update("name", e.target.value)}
                placeholder="Your full name" autoComplete="name" required />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Email Address</span>
            <div className="field-control">
              <Icon name="mail" size={16} />
              <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
                placeholder="you@example.com" autoComplete="email" required />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Phone Number</span>
            <div className="field-control">
              <Icon name="phone" size={16} />
              <input type="tel" inputMode="numeric" value={form.phone}
                onChange={(e) => update("phone", e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                placeholder="10-digit mobile number" required />
              <span className="field-suffix">Verify</span>
            </div>
          </label>

          <label className="field">
            <span className="field-label">Password</span>
            <div className="field-control">
              <Icon name="lock" size={16} />
              <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)}
                placeholder="At least 6 characters" autoComplete="new-password" required />
            </div>
          </label>

          <label className="field">
            <span className="field-label">Confirm Password</span>
            <div className="field-control">
              <Icon name="lock" size={16} />
              <input type="password" value={form.confirm} onChange={(e) => update("confirm", e.target.value)}
                placeholder="Re-enter your password" autoComplete="new-password" required />
            </div>
          </label>

          {error && <div className="form-error"><Icon name="alert-circle" size={15} /> {error}</div>}

          <Button type="submit" block size="lg" loading={loading} iconRight="arrow-right">
            Verify Number
          </Button>
        </form>

        <p className="auth-alt">
          Already have an account?{" "}<Link to="/login" className="link">Login</Link>
        </p>
      </div>
      <p className="auth-back">
        <Link to="/" className="link">← Back to home</Link>
      </p>

      {otpOpen && (
        <OtpModal
          otpCode={otpCode}
          expiresIn={otpExpiresIn}
          phone={form.phone}
          onVerified={handleOtpVerified}
          onClose={() => setOtpOpen(false)}
        />
      )}
    </div>
  );
}
