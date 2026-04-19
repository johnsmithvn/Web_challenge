import { Component } from 'react';

/**
 * ErrorBoundary — wraps any subtree, catches render errors.
 * Shows a friendly fallback instead of white screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught:', error.message, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <span style={{ fontSize: '3rem' }}>⚠️</span>
        <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>
          Có lỗi xảy ra
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: 1.6 }}>
          {this.state.error?.message || 'Trang này gặp sự cố không mong muốn.'}
        </p>
        <button
          className="btn btn-primary"
          onClick={() => this.setState({ hasError: false, error: null })}
          style={{ marginTop: '0.5rem' }}
        >
          🔄 Thử lại
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => window.location.href = '/'}
          style={{ fontSize: '0.85rem' }}
        >
          ← Về Trang Chủ
        </button>
      </div>
    );
  }
}
