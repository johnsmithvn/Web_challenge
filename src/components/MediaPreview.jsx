import React, { useEffect, useState } from 'react';
import { extractDriveFileId, getMediaType, getYoutubeEmbedUrl, getDriveStreamUrl, stripMediaTag } from '../utils/mediaUtils';
import CustomAudioPlayer from './CustomAudioPlayer';
import AppIcon from './AppIcon';

const stringifyChildren = (children) => {
  if (!children) return '';
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(stringifyChildren).join('');
  if (children.props && children.props.children) return stringifyChildren(children.props.children);
  return '';
};

/**
 * Drive: hỏi `/api/stream?meta=1` loại file và proxy có stream được không.
 * Stream được → trình phát của app (thanh audio / <video>); không → iframe Drive cỡ theo loại.
 * Không biết loại (file riêng tư, hoặc `npm run dev` không có api/) → iframe + nút chọn tay, lưu bằng #video.
 */
function DriveMedia({ url, title, onToggleFormat }) {
  const streamUrl = getDriveStreamUrl(url);
  const [meta, setMeta] = useState(); // undefined = đang hỏi, null = không biết

  useEffect(() => {
    let alive = true;
    fetch(`${streamUrl}&meta=1`)
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(m => { if (alive) setMeta(m?.mimeType ? m : null); });
    return () => { alive = false; };
  }, [streamUrl]);

  if (meta === undefined) return <div className="kb-media-pending" aria-busy="true" />;

  const isAudio = meta?.mimeType.startsWith('audio/');
  const isVideo = meta?.mimeType.startsWith('video/');
  if (meta?.streamable && isAudio) return <CustomAudioPlayer src={streamUrl} title={title} />;
  if (meta?.streamable && isVideo) return <video className="kb-media-video" src={streamUrl} controls preload="metadata" playsInline />;

  // Ảnh / PDF trên Drive cũng vào khung 16:9 — chỉ audio mới cần khung thấp
  const asVideo = meta ? !isAudio : url.includes('#video');
  const pick = (format) => onToggleFormat(`${stripMediaTag(url)}#${format}`);

  return (
    <div className={`kb-drive${asVideo ? ' kb-drive--video' : ''}`}>
      <iframe
        className="kb-drive__frame"
        src={`https://drive.google.com/file/d/${extractDriveFileId(url)}/preview`}
        allow="autoplay"
        allowFullScreen
        title={stringifyChildren(title) || 'Google Drive'}
      />
      {!meta && onToggleFormat && (
        <div className="kb-seg kb-seg--quiet" role="group" aria-label="Kiểu khung">
          <button type="button" className={`kb-seg__item${asVideo ? '' : ' is-active'}`} aria-pressed={!asVideo} onClick={() => pick('audio')}>
            <AppIcon name="headphones" size={14} /> Audio
          </button>
          <button type="button" className={`kb-seg__item${asVideo ? ' is-active' : ''}`} aria-pressed={asVideo} onClick={() => pick('video')}>
            <AppIcon name="video" size={14} /> Video
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * MediaPreview — YouTube, Google Drive, hoặc link audio/video trực tiếp, dùng chung cho trang đọc và Tiptap.
 *
 * @param {Object} props
 * @param {string} props.url - Link media
 * @param {string} [props.title] - Tên hiện trên thanh audio
 * @param {Function} [props.onToggleFormat] - Lưu link mới khi user chọn tay Audio/Video (chỉ Drive không rõ loại)
 */
function MediaPreview({ url, title, onToggleFormat }) {
  switch (getMediaType(url)) {
    case 'youtube':
      return (
        <div className="kb-video-embed">
          <iframe
            src={getYoutubeEmbedUrl(url)}
            title={stringifyChildren(title) || 'YouTube Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );

    case 'drive':
      // key: đổi file thì dựng lại, không hiện meta của file trước
      return <DriveMedia key={extractDriveFileId(url)} url={url} title={title} onToggleFormat={onToggleFormat} />;

    case 'audio':
      return <CustomAudioPlayer src={stripMediaTag(url)} title={title} />;

    case 'video':
      return <video className="kb-media-video" src={stripMediaTag(url)} controls preload="metadata" playsInline />;

    default:
      return null;
  }
}

const MemoizedMediaPreview = React.memo(MediaPreview, (prev, next) => (
  prev.url === next.url && stringifyChildren(prev.title) === stringifyChildren(next.title)
));

export default MemoizedMediaPreview;
