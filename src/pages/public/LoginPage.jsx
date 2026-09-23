import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../components/common/Logo.jsx';
import Button from '../../components/common/Button.jsx';
import Icon from '../../components/common/Icon.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import LoginBackgroundAnimation from '../../components/auth/LoginBackgroundAnimation.jsx';
import TravelBoy from '../../components/animation/TravelBoy.jsx';
import ClickSpark from '../../components/animation/ClickSpark.jsx';
import LoginLoadingTrain from '../../components/animation/LoginLoadingTrain.jsx';
import '../../components/animation/LoginAnimation.css';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Animation states: 'idle' | 'boy-running' | 'boy-clicking' | 'train-loading'
  const [animPhase, setAnimPhase] = useState('idle');
  const pendingRoleRef = useRef(null);
  const timersRef = useRef([]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading || animPhase !== 'idle') return;

    setError('');

    // Pre-check fields
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setAnimPhase('boy-running');

    // Step 2: Boy runs toward login button
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const runDuration = prefersReducedMotion ? 100 : 750;
    const clickDuration = prefersReducedMotion ? 50 : 350;

    const t1 = setTimeout(async () => {
      // Step 3: Boy reaches button and clicks with spark
      setAnimPhase('boy-clicking');

      const t2 = setTimeout(async () => {
        try {
          // Real authentication request
          const result = await login(email, password);

          if (!result.success) {
            // If authentication fails, stop animation and return to form with error
            setAnimPhase('idle');
            setLoading(false);
            setError(result.error);
            return;
          }

          // Authentication succeeded: trigger Train Loading state
          pendingRoleRef.current = result.role;
          setAnimPhase('train-loading');
        } catch (err) {
          setAnimPhase('idle');
          setLoading(false);
          setError(err?.message || 'Login failed. Please try again.');
        }
      }, clickDuration);

      timersRef.current.push(t2);
    }, runDuration);

    timersRef.current.push(t1);
  }

  function handleTrainComplete() {
    const role = pendingRoleRef.current;
    navigate(role === 'admin' ? '/control-center' : '/dashboard', { replace: true });
  }

  return (
    <div className="auth-page auth-page--login">
      <LoginBackgroundAnimation />
      <div className="auth-brand">
        <Logo size={36} showIcon={false} />
      </div>
      <div className="auth-card">
        {animPhase === 'train-loading' ? (
          /* STEP 4 & 5: Train Loading Scene inside Card (Matching Reference Image 2) */
          <LoginLoadingTrain onComplete={handleTrainComplete} />
        ) : (
          /* Normal form and animated boy overlay (Matching Reference Image 1) */
          <div className="login-card-content-fade">
            <h1 className="auth-title">Welcome back</h1>
            <p className="auth-subtitle">Sign in to continue your journey.</p>

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
                    disabled={loading}
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span className="field-label">Password</span>
                <div className="field-control">
                  <Icon name="lock" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    className="field-eye"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    disabled={loading}
                  >
                    <Icon name={showPassword ? 'eye-off' : 'eye'} size={16} />
                  </button>
                </div>
              </label>

              <div className="auth-row-between">
                <span></span>
                <Link to="/forgot-password" className="link-btn">
                  Forgot Password?
                </Link>
              </div>

              {error && <div className="form-error"><Icon name="alert-circle" size={15} /> {error}</div>}

              <Button
                type="submit"
                block
                size="lg"
                loading={loading && animPhase === 'idle'}
                disabled={loading}
              >
                Login
              </Button>
            </form>

            <p className="auth-alt">
              Don't have an account?{' '}
              <Link to="/create-account" className="link">Create Account</Link>
            </p>

            {/* STEP 2 & 3: Boy Running In and Tapping Login Button */}
            {(animPhase === 'boy-running' || animPhase === 'boy-clicking') && (
              <>
                <div className={`login-boy-overlay phase-${animPhase === 'boy-running' ? 'running' : 'clicking'}`}>
                  <TravelBoy
                    mode={animPhase === 'boy-running' ? 'run' : 'click'}
                    scale={0.92}
                    facing="right"
                  />
                </div>

                {animPhase === 'boy-clicking' && (
                  <div className="login-spark-wrapper">
                    <ClickSpark active={true} />
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <p className="auth-back">
        <Link to="/" className="link">← Back to home</Link>
      </p>
    </div>
  );
}
