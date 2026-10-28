import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SpeakerHigh as Volume2, SpeakerX as VolumeX, CircleNotch as Loader2 } from '@phosphor-icons/react';
import { logger } from '../utils/logger';

/**
 * Helper to format seconds into MM:SS format.
 */
function formatTime(secs) {
  if (isNaN(secs) || secs === Infinity) return '00:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * CustomAudioPlayer — thanh phát audio HTML5 của Knowledge (MediaPreview).
 */
const stringifyChildren = (children) => {
  if (!children) return '';
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(stringifyChildren).join('');
  if (children.props && children.props.children) return stringifyChildren(children.props.children);
  return '';
};

function CustomAudioPlayer({ src, title }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const audioRef = useRef(null);

  // Sync volume state
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Toggle play/pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {
        // Safe play failure catch
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleProgressChange = (e) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleError = () => {
    logger.warn('Audio load failed:', src);
    setIsLoading(false);
    setDuration(0);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="kb-custom-audio-player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadStart={() => setIsLoading(true)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onError={handleError}
      />

      <div className="kb-audio-left">
        <button
          type="button"
          onClick={togglePlay}
          className="kb-audio-play-btn"
          disabled={isLoading && duration === 0}
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
        >
          {isLoading && duration === 0 ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isPlaying ? (
            <Pause size={16} fill="currentColor" />
          ) : (
            <Play size={16} fill="currentColor" style={{ marginLeft: '2px' }} />
          )}
        </button>
      </div>

      <div className="kb-audio-center">
        <div className="kb-audio-title-bar">
          <span className="kb-audio-title">{title || 'Audio Player'}</span>
          <span className="kb-audio-time">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        <div className="kb-audio-slider-container">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleProgressChange}
            className="kb-audio-slider"
            style={{
              background: `linear-gradient(to right, var(--kb-accent) ${progressPercent}%, var(--kb-line) ${progressPercent}%)`
            }}
          />
        </div>
      </div>

      <div className="kb-audio-right">
        <div className="kb-audio-volume-control">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="kb-audio-volume-btn"
            aria-label="Âm lượng"
          >
            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              setIsMuted(false);
            }}
            className="kb-audio-volume-slider"
            style={{
              background: `linear-gradient(to right, var(--kb-dim) ${(isMuted ? 0 : volume) * 100}%, var(--kb-line) ${(isMuted ? 0 : volume) * 100}%)`
            }}
          />
        </div>
      </div>
    </div>
  );
}

const MemoizedCustomAudioPlayer = React.memo(CustomAudioPlayer, (prev, next) => {
  return (
    prev.src === next.src &&
    stringifyChildren(prev.title) === stringifyChildren(next.title)
  );
});

export default MemoizedCustomAudioPlayer;
