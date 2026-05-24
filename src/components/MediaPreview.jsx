import React from 'react';
import { extractDriveFileId, getMediaType, getYoutubeEmbedUrl, extractDriveDirectUrl } from '../utils/mediaUtils';
import CustomAudioPlayer from './CustomAudioPlayer';

/**
 * MediaPreview — Shared component for rendering Google Drive, YouTube, or standard media links (Audio/Video).
 * Bypasses CORS/third-party cookie restrictions by embedding Drive links via iframe previews,
 * and renders compact player bars for audio files.
 *
 * @param {Object} props
 * @param {string} props.url - The file/media URL
 * @param {string} [props.type] - The note/article type (e.g. 'podcast')
 * @param {string} [props.title] - Media title/label
 * @param {Object} [props.style] - Custom styles
 * @param {string} [props.className] - Custom class name
 * @param {Function} [props.onToggleFormat] - Callback when media type is toggled manually
 */
const stringifyChildren = (children) => {
  if (!children) return '';
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(stringifyChildren).join('');
  if (children.props && children.props.children) return stringifyChildren(children.props.children);
  return '';
};

function MediaPreview({ url, type, title, style, className, onToggleFormat }) {
  if (!url) return null;

  const mediaType = getMediaType(url);

  const handleToggle = (format) => {
    if (!onToggleFormat) return;
    const cleanUrl = url.split('#')[0];
    let newUrl = cleanUrl;
    if (format === 'audio') newUrl += '#audio';
    if (format === 'video') newUrl += '#video';
    onToggleFormat(newUrl);
  };

  const renderToggleBar = () => {
    if (!onToggleFormat) return null;
    const hasAudioTag = url.includes('#audio');
    const hasVideoTag = url.includes('#video');
    const hasNoTag = !hasAudioTag && !hasVideoTag;

    // We show format toggles for Drive and direct Audio/Video links
    if (mediaType !== 'drive' && mediaType !== 'audio' && mediaType !== 'video') {
      return null;
    }

    return (
      <div className="kb-media-toggle-bar">
        <span className="kb-media-toggle-label">Định dạng:</span>
        <button
          type="button"
          className={`kb-media-toggle-btn${hasAudioTag ? ' kb-media-toggle-btn--active' : ''}`}
          onClick={() => handleToggle('audio')}
        >
          🎵 Dạng audio
        </button>
        <button
          type="button"
          className={`kb-media-toggle-btn${hasVideoTag ? ' kb-media-toggle-btn--active' : ''}`}
          onClick={() => handleToggle('video')}
        >
          📺 Dạng video
        </button>
        {mediaType === 'drive' && (
          <button
            type="button"
            className={`kb-media-toggle-btn${hasNoTag ? ' kb-media-toggle-btn--active' : ''}`}
            onClick={() => handleToggle('drive')}
          >
            📁 Dạng Drive
          </button>
        )}
      </div>
    );
  };

  switch (mediaType) {
    case 'youtube': {
      const embedUrl = getYoutubeEmbedUrl(url);
      if (!embedUrl) return null;
      return (
        <div className={`kb-video-embed ${className || ''}`} style={style}>
          <iframe
            src={embedUrl}
            title={title || 'YouTube Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    case 'drive': {
      const driveFileId = extractDriveFileId(url);
      if (!driveFileId) return null;
      const isAudio = url.includes('#audio') || type === 'podcast';
      
      if (isAudio) {
        const directUrl = extractDriveDirectUrl(url) || url;
        const fallbackUrl = `https://drive.google.com/file/d/${driveFileId}/preview`;
        return (
          <div className={`${className || ''}`} style={{ margin: '1rem 0', ...style }}>
            <CustomAudioPlayer 
              src={directUrl} 
              fallbackUrl={fallbackUrl} 
              title={title} 
            />
            {renderToggleBar()}
          </div>
        );
      }
      
      return (
        <div 
          className={`kb-audio-player ${className || ''}`} 
          style={{ background: 'none', padding: 0, border: 'none', margin: '1rem 0', ...style }}
        >
          <iframe
            src={`https://drive.google.com/file/d/${driveFileId}/preview`}
            width="100%"
            height="360"
            style={{ 
              border: '1px solid rgba(255,255,255,0.08)', 
              borderRadius: '8px', 
              background: '#000', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              transition: 'height 0.3s ease'
            }}
            allow="autoplay"
            allowFullScreen
            title={title || 'Google Drive Media'}
          />
          {title && (
            <span 
              className="kb-audio-player__label" 
              style={{ marginTop: '0.5rem', display: 'block' }}
            >
              {title}
            </span>
          )}
          {renderToggleBar()}
        </div>
      );
    }

    case 'audio': {
      return (
        <div className={`${className || ''}`} style={{ margin: '1rem 0', ...style }}>
          <CustomAudioPlayer 
            src={url.split('#')[0]} 
            title={title} 
          />
          {renderToggleBar()}
        </div>
      );
    }

    case 'video': {
      return (
        <div className={`kb-audio-player ${className || ''}`} style={{ background: 'none', padding: 0, border: 'none', margin: '1rem 0', ...style }}>
          <video 
            controls 
            src={url.split('#')[0]} 
            preload="metadata" 
            style={{ 
              width: '100%', 
              maxHeight: '400px', 
              borderRadius: '8px', 
              background: '#000',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }} 
          />
          {title && (
            <span 
              className="kb-audio-player__label" 
              style={{ marginTop: '0.5rem', display: 'block' }}
            >
              {title}
            </span>
          )}
          {renderToggleBar()}
        </div>
      );
    }

    default:
      return null;
  }
}

const MemoizedMediaPreview = React.memo(MediaPreview, (prev, next) => {
  return (
    prev.url === next.url &&
    prev.type === next.type &&
    prev.className === next.className &&
    JSON.stringify(prev.style) === JSON.stringify(next.style) &&
    stringifyChildren(prev.title) === stringifyChildren(next.title)
  );
});

export default MemoizedMediaPreview;
