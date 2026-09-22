import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../components/common/Logo.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import * as authService from '../../services/authService.js';
import { useToast } from '../../context/ToastContext.jsx';
import LoginBackgroundAnimation from '../../components/auth/LoginBackgroundAnimation.jsx';

const COUNTDOWN_SECONDS = 60;

export default function VerifyPhonePage() {
  const navigate = useNavigate();
  const { push } = useToast();
  const { setAuthenticatedSession } = useAuth();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('idle'); // idle | verifying | wrong | expired
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [resendLoading, setResendLoading] = useState(false);
  const inputsRef = useRef([]);
  const phone = authService.getOtpPhone();

  const mounted = useRef(false);
  useEffect(() => {
    // If there's no phone in the flow on first load, send the user back to start.
    if (!mounted.current) {
      mounted.current = true;
      if (!phone) {
        navigate('/create-account', { replace: true });
      }
    }
  }, [phone, navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = useCallback((index, value) => {
    const v = value.replace(/[^\d]/g, '').slice(-1);
    setDigits((d) => {
      const next = [...d];
      next[index] = v;
      return next;
    });
    if (v && index < 5) inputsRef.current[index + 1]?.focus();
    setError('');
  }, []);

  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  }, [digits]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const text = (e.clipboardData.getData('text') || '').replace(/[^\d]/g, '').slice(0, 6);
    if (!text) return;
    const next = Array(6).fill('');
    text.split('').forEach((ch, i) => (next[i] = ch));
    setDigits(next);
    const lastFilled = Math.min(text.length, 5);
    inputsRef.current[lastFilled]?.focus();
  }, []);

  async function handleVerify() {
    const code = digits.join('');
    if (code.length < 6) {
      setError('Please enter the complete 6-digit code.');
      return;
    }
    setStatus('verifying');
    const result = await authService.verifyOTP(code);
    if (result.success) {
      setAuthenticatedSession(result);
      push('Account created successfully. Welcome to ROYAL TOURS!', 'success');
      navigate('/dashboard', { replace: true });
    } else if (result.expired) {
      setStatus('expired');
      setError(result.error);
    } else {
      setStatus('wrong');
      setError(result.error);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    const result = await authService.resendOTP();
    setResendLoading(false);
    if (result.success) {
      setCountdown(COUNTDOWN_SECONDS);
      setDigits(['', '', '', '', '', '']);
      setError('');
      setStatus('idle');
      push('A new code has been sent', 'success');
    } else {
      setError(result.error);
    }
  }

  function handleChangeNumber() {
    authService.clearPendingRegistration();
    navigate('/create-account');
  }

  return (
    <div className="auth-page auth-page--login">
      <LoginBackgroundAnimation />
      <div className="auth-brand"><Logo size={36} /></div>
      <div className="auth-card">
        <div className="otp-head">
          <span className="otp-phone-icon"><Icon name="phone" size={22} /></span>
        </div>
        <h1 className="auth-title">Verify your number</h1>
        <p className="auth-subtitle">
          Enter the 6-digit code sent to{' '}
          <strong>{phone ? `${phone.slice(0, 2)}••••••${phone.slice(-2)}` : 'your phone'}</strong>.
        </p>

        <div className="otp-inputs" onPaste={handlePaste}>
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
              autoFocus={i === 0}
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        {error && <div className="form-error"><Icon name="alert-circle" size={15} /> {error}</div>}

        <Button
          block
          size="lg"
          onClick={handleVerify}
          loading={status === 'verifying'}
          disabled={digits.join('').length < 6}
        >
          Verify OTP
        </Button>

        <div className="otp-footer">
          {countdown > 0 ? (
            <span className="otp-countdown">Resend code in {countdown}s</span>
          ) : (
            <button className="link-btn" onClick={handleResend} disabled={resendLoading}>
              {resendLoading ? 'Sending…' : 'Resend OTP'}
            </button>
          )}
          <button className="link-btn" onClick={handleChangeNumber}>Change Number</button>
        </div>
      </div>
      <p className="auth-back">
        <Link to="/" className="link"><Icon name="arrow-left" size={14} /> Back to home</Link>
      </p>
    </div>
  );
}
