import { Component } from 'react';
import AppIcon from './AppIcon';
import { isStaleChunkError, reloadForStaleChunk } from '../utils/chunkReload';

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
    // Chunk cũ chết sau khi deploy: tự tải lại một lần, không bắt user đọc lỗi kỹ thuật.
    if (isStaleChunkError(error)) reloadForStaleChunk();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    // "Thử lại" (reset state) KHÔNG cứu được lỗi chunk: React.lazy cache promise đã
    // reject nên render lại là ném lại. Lỗi này chỉ có một đường ra là tải lại trang.
    const staleChunk = isStaleChunkError(this.state.error);

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
        <span><AppIcon name="warning" size={48} weight="duotone" /></span>
        <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>
          {staleChunk ? 'Ứng dụng vừa được cập nhật' : 'Có lỗi xảy ra'}
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', lineHeight: 1.6 }}>
          {staleChunk
            ? 'Bản mới đã được deploy trong lúc tab này đang mở nên phần vừa bấm không tải được. Tải lại trang là xong — dữ liệu không mất gì.'
            : this.state.error?.message || 'Trang này gặp sự cố không mong muốn.'}
        </p>
        <button
          className="btn btn-primary"
          onClick={() => (staleChunk
            ? window.location.reload()
            : this.setState({ hasError: false, error: null }))}
          style={{ marginTop: '0.5rem' }}
        >
          <AppIcon name="refresh" size={16} /> {staleChunk ? 'Tải lại trang' : 'Thử lại'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => window.location.href = '/'}
          style={{ fontSize: '0.85rem' }}
        >
          <AppIcon name="back" size={16} /> Về Trang Chủ
        </button>
      </div>
    );
  }
}
