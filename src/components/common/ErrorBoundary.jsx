// =============================================================================
// ErrorBoundary.jsx — React Error Boundary for resilient, crash-free UX.
// Prevents blank white screens and provides graceful recovery to the dashboard.
// =============================================================================

import React from 'react';
import Button from './Button.jsx';
import Icon from './Icon.jsx';
import Logo from './Logo.jsx';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoDashboard = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="error-boundary-view"
          style={{
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center',
            background: 'var(--bg-main, #fafbfc)',
            borderRadius: '16px',
            margin: '20px',
            border: '1px solid var(--border)'
          }}
        >
          <div style={{ marginBottom: '20px' }}>
            <Logo size={36} />
          </div>

          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--purple-50)',
              color: 'var(--purple)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <Icon name="alert-triangle" size={28} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
            Something went wrong
          </h2>

          <p style={{ maxWidth: '440px', fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '24px' }}>
            We encountered an unexpected issue rendering this section. Your live GPS location and ROYAL TOURS safety tools remain secure.
          </p>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button variant="outline" icon="refresh-cw" onClick={this.handleReset}>
              Try Again
            </Button>
            <Button variant="primary" icon="grid" onClick={this.handleGoDashboard}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
