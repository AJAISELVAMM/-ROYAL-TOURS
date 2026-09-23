import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../../components/common/Logo.jsx';
import Icon from '../../components/common/Icon.jsx';
import Button from '../../components/common/Button.jsx';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* Top Navbar */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <Logo size={36} showIcon={false} />
          <div className="landing-actions">
            <Button variant="ghost" onClick={() => navigate('/login')}>
              Login
            </Button>
            <Button variant="primary" onClick={() => navigate('/create-account')}>
              Create Account
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section with Scenic Panoramic Travel Backdrop */}
      <section className="landing-hero">
        <div className="landing-hero-backdrop" />
        <div className="landing-hero-inner">
          <div className="landing-hero-content">
            <span className="landing-eyebrow">AI-powered travel companion</span>
            <h1 className="landing-brand-title">ROYAL TOURS</h1>
            <p className="landing-tagline">
              Plan Smart. Explore More. Travel Safe.
            </p>
            <p className="landing-sub">
              Your all-in-one travel companion for AI trip planning, real-time safety, fair fare checking, translation, exploration and emergency support.
            </p>
            <div className="landing-cta">
              <Button size="lg" variant="primary" iconRight="arrow-right" onClick={() => navigate('/create-account')}>
                Start Journey
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/login')}>
                Login
              </Button>
            </div>

            {/* Value / Trust Indicators */}
            <div className="landing-trust-strip">
              <span className="trust-pill">
                <Icon name="shield-check" size={14} /> Safer Journeys
              </span>
              <span className="trust-dot">•</span>
              <span className="trust-pill">
                <Icon name="sparkles" size={14} /> Smarter Plans
              </span>
              <span className="trust-dot">•</span>
              <span className="trust-pill">
                <Icon name="compass" size={14} /> Better Experiences
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="footer-left">
            <Logo size={30} showIcon={false} />
            <span className="footer-note">Plan Smart. Explore More. Travel Safe.</span>
          </div>
          <div className="footer-right">
            <span className="footer-copy">© 2026 ROYAL TOURS. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
