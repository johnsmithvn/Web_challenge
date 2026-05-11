/**
 * UrlInputPopover — Shared popover for inserting media (Image, YouTube, Audio).
 * Supports both URL input AND file upload (for image/audio).
 *
 * Props:
 *   open      — boolean, controls visibility
 *   onClose   — callback to close
 *   onSubmit  — callback(url: string) when user confirms
 *   label     — field label ("URL ảnh", "YouTube URL", etc.)
 *   placeholder — input placeholder
 *   icon      — optional emoji/icon before label
 *   allowUpload — boolean, show file upload button (default: false)
 *   accept    — file input accept string (e.g. "image/*", "audio/*")
 */
import { useState, useEffect, useRef } from 'react';
import '../styles/url-input-popover.css';

export default function UrlInputPopover({
  open, onClose, onSubmit,
  label = 'URL', placeholder = 'https://...',
  icon = '🔗', allowUpload = false, accept = '*/*',
}) {
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const wrapRef = useRef(null);

  // Reset + focus on open
  useEffect(() => {
    if (open) {
      setUrl('');
      setUploading(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onClose();
    };
    const id = setTimeout(() => document.addEventListener('mousedown', onClick), 100);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', onClick); };
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (trimmed) onSubmit(trimmed);
    onClose();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', file.type.startsWith('audio') ? 'audio' : 'images');

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          onSubmit(data.url);
          onClose();
          return;
        }
      }
      setUrl('⚠ Upload thất bại — cần Vercel + API keys');
    } catch {
      setUrl('⚠ Upload không khả dụng (local dev). Nhập URL trực tiếp.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div ref={wrapRef} className="url-popover">
      <div className="url-popover__label">
        <span className="url-popover__icon">{icon}</span>
        {label}
      </div>

      <input
        ref={inputRef}
        className="url-popover__input"
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder={placeholder}
        disabled={uploading}
      />

      <div className="url-popover__actions">
        {/* File upload button */}
        {allowUpload && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="url-popover__btn url-popover__btn--upload"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? '⏳ Đang upload...' : '📁 Chọn file'}
            </button>
          </>
        )}

        <div style={{ flex: 1 }} />

        <button
          type="button"
          className="url-popover__btn url-popover__btn--cancel"
          onClick={onClose}
          disabled={uploading}
        >
          Hủy
        </button>
        <button
          type="button"
          className="url-popover__btn url-popover__btn--save"
          onClick={handleSubmit}
          disabled={!url.trim() || uploading}
        >
          Chèn
        </button>
      </div>
    </div>
  );
}
