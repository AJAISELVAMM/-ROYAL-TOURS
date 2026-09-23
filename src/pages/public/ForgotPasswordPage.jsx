import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/common/Logo.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import * as authService from '../../services/authService.js';
import LoginBackgroundAnimation from '../../components/auth/LoginBackgroundAnimation.jsx';

export default function ForgotPasswordPage() {
  const { user, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [devMail, setDevMail] = useState(null);

  useEffect(() => {
    if (isAuthenticated && user?.email && !email) {
      setEmail(user.email);
    }
  }, [isAuthenticated, user?.email]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await authService.forgotPassword(email);
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setSubmitted(true);

    // In local development, safely check for dev mail preview
    if (import.meta.env.DEV) {
      try {
        const mail = await authService.getDevMailPreview();
        if (mail && mail.resetUrl) {
          setDevMail(mail);
        }
      } catch {
        // Dev preview is strictly non-blocking
      }
    }
  }

  return (
    <div className="auth-page auth-page--login">
      <LoginBackgroundAnimation />
      <div className="auth-brand">
        <Logo size={36} showIcon={false} />
      </div>

      <div className="auth-card">
        {submitted ? (
          <div className="auth-success-card">
            <div className="success-mark">
              <Icon name="check" size={28} />
            </div>
            <h1 className="auth-title">Check your inbox</h1>
            <p className="auth-subtitle">
              If an account exists for <strong>{email}</strong>, password reset instructions have been sent.
            </p>

            {import.meta.env.DEV && devMail?.resetUrl && (
              <div
                style={{
                  background: 'var(--purple-50, #f5f3ff)',
                  border: '1px solid var(--purple-200, #ddd6fe)',
                  borderRadius: '12px',
                  padding: '14px',
                  margin: '16px 0 20px',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', fontSize: '13px', fontWeight: 650, color: 'var(--purple, #7c3aed)' }}>
                  <Icon name="info" size={14} /> Development Mail Preview
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted, #64748b)', margin: '0 0 10px' }}>
                  No email API key required. You can test the reset link directly below:
                </p>
                <a
                  href={devMail.resetUrl}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#fff',
                    background: 'var(--purple, #7c3aed)',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    textDecoration: 'none'
                  }}
                >
                  Open Reset Password Link <Icon name="arrow-right" size={14} />
                </a>
              </div>
            )}

            <Link to={isAuthenticated ? '/account' : '/login'}>
              <Button block size="lg">
                {isAuthenticated ? 'Return to Account' : 'Return to Login'}
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="auth-title">Forgot Password</h1>
            <p className="auth-subtitle">Enter your registered email to receive a password reset link.</p>

            <form onSubmit={handleSubmit} className="auth-form">
              <label className="field">
                <span className="field-label">Email Address</span>
                <div className="field-control">
                  <Icon name="mail" size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              {error && <div className="form-error"><Icon name="alert-circle" size={15} /> {error}</div>}

              <Button type="submit" block size="lg" loading={loading}>
                Send Reset Link
              </Button>
            </form>
          </>
        )}
      </div>

      <p className="auth-back">
        <Link to={isAuthenticated ? '/account' : '/login'} className="link">
          <Icon name="arrow-left" size={14} /> {isAuthenticated ? 'Back to account' : 'Back to login'}
        </Link>
      </p>
    </div>
  );
}
