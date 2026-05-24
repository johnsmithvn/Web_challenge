/**
 * UrlInputPopover — Shared popover for inserting media (Image, YouTube, Audio).
 * Supports both URL input AND file upload (for image/audio).
 *
 * When `anchorRef` is provided, renders via React Portal with fixed positioning
 * to escape any parent stacking context (e.g. ProseMirror/Tiptap).
 * Otherwise, renders inline with absolute positioning (e.g. MarkdownEditor).
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
 *   anchorRef — optional React ref to anchor element (enables portal mode)
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import '../styles/url-input-popover.css';

export default function UrlInputPopover({
  open, onClose, onSubmit,
  label = 'URL', placeholder = 'https://...',
  icon = '🔗', allowUpload = false, accept = '*/*',
  anchorRef,
}) {
  const [url, setUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const wrapRef = useRef(null);

  const usePortal = !!anchorRef;

  // Calculate position from anchor element (portal mode only)
  useEffect(() => {
    if (!open || !anchorRef?.current) return;
    const update = () => {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

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
      
      let folderName = 'documents';
      if (file.type.startsWith('image/')) folderName = 'images';
      else if (file.type.startsWith('audio/')) folderName = 'audio';
      else if (file.type.startsWith('video/')) folderName = 'video';
      
      formData.append('folder', folderName);

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

  const popoverEl = (
    <div
      ref={wrapRef}
      className={`url-popover${usePortal ? ' url-popover--portal' : ''}`}
      style={usePortal ? { position: 'fixed', top: `${pos.top}px`, left: `${pos.left}px` } : undefined}
    >
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

  // Portal mode: render at document.body (escapes all stacking contexts)
  // Inline mode: render in-place with absolute positioning
  return usePortal ? createPortal(popoverEl, document.body) : popoverEl;
}
