import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../../components/common/Logo.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import * as authService from '../../services/authService.js';
import LoginBackgroundAnimation from '../../components/auth/LoginBackgroundAnimation.jsx';

export default function ResetPasswordPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [verifying, setVerifying] = useState(true);
  const [tokenInvalid, setTokenInvalid] = useState(false);
  const [tokenError, setTokenError] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function checkToken() {
      if (!token) {
        setTokenInvalid(true);
        setTokenError('This password reset link is invalid or has expired.');
        setVerifying(false);
        return;
      }
      const res = await authService.verifyResetToken(token);
      if (!res.success) {
        setTokenInvalid(true);
        setTokenError(res.error || 'This password reset link is invalid or has expired.');
      }
      setVerifying(false);
    }
    checkToken();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter a new password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please verify and try again.');
      return;
    }

    setLoading(true);
    const result = await authService.resetPassword(token, password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Failed to reset password. The link may have expired.');
      return;
    }

    setSuccess(true);
  }

  return (
    <div className="auth-page auth-page--login">
      <LoginBackgroundAnimation />
      <div className="auth-brand">
        <Logo size={36} />
      </div>

      <div className="auth-card">
        {verifying ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <p className="auth-subtitle">Verifying reset link...</p>
          </div>
        ) : tokenInvalid ? (
          <div className="auth-success-card">
            <div
              className="success-mark"
              style={{ background: 'var(--red-soft, #fee2e2)', color: 'var(--red, #ef4444)' }}
            >
              <Icon name="alert-circle" size={28} />
            </div>
            <h1 className="auth-title">Link Expired or Invalid</h1>
            <p className="auth-subtitle">{tokenError || 'This password reset link is invalid or has expired.'}</p>
            <Link to="/forgot-password">
              <Button block size="lg">
                Request New Reset Link
              </Button>
            </Link>
          </div>
        ) : success ? (
          <div className="auth-success-card">
            <div className="success-mark">
              <Icon name="check" size={28} />
            </div>
            <h1 className="auth-title">Password Reset Complete</h1>
            <p className="auth-subtitle">
              Your password has been securely updated. You can now sign in with your new password.
            </p>
            <Link to={isAuthenticated ? '/account' : '/login'}>
              <Button block size="lg">
                {isAuthenticated ? 'Return to Account' : 'Continue to Login'}
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <h1 className="auth-title">Reset Password</h1>
            <p className="auth-subtitle">Enter your new password below.</p>

            <form onSubmit={handleSubmit} className="auth-form">
              <label className="field">
                <span className="field-label">New Password</span>
                <div className="field-control">
                  <Icon name="lock" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="field-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
                  </button>
                </div>
              </label>

              <label className="field">
                <span className="field-label">Confirm Password</span>
                <div className="field-control">
                  <Icon name="lock" size={16} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="field-eye"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showConfirmPassword ? 'eye-off' : 'eye'} size={16} />
                  </button>
                </div>
              </label>

              {error && <div className="form-error"><Icon name="alert-circle" size={15} /> {error}</div>}

              <Button type="submit" block size="lg" loading={loading}>
                Reset Password
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
