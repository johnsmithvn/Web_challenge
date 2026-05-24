import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Loader2, AlertCircle } from 'lucide-react';

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
 * CustomAudioPlayer — A gorgeous glassmorphic HTML5 audio player.
 * Automatically falls back to Google Drive iframe preview if the direct audio stream fails (CORS/Private).
 */
export default function CustomAudioPlayer({ src, fallbackUrl, title, onToggleFormat }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const audioRef = useRef(null);
  const progressRef = useRef(null);

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
      setHasError(false);
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
    console.warn("Direct audio streaming failed, falling back to iframe:", src);
    setIsLoading(false);
    // Only fall back to iframe if a fallbackUrl is available
    if (fallbackUrl) {
      setHasError(true);
    } else {
      // Direct file error
      setDuration(0);
    }
  };

  // If the stream fails and we have a Google Drive fallback URL, render the iframe
  if (hasError && fallbackUrl) {
    return (
      <div className="kb-audio-player kb-audio-player--iframe-fallback">
        <div className="kb-audio-player__fallback-header">
          <AlertCircle size={14} className="kb-audio-player__fallback-icon" />
          <span>Đang sử dụng trình phát dự phòng bảo mật của Drive</span>
        </div>
        <iframe
          src={fallbackUrl}
          width="100%"
          height="90px"
          style={{ 
            border: 'none', 
            borderRadius: '6px', 
            background: '#000', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
          allow="autoplay"
          title={title || 'Google Drive Media'}
        />
      </div>
    );
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="kb-custom-audio-player card">
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
              background: `linear-gradient(to right, var(--cyan) 0%, var(--cyan) ${progressPercent}%, rgba(255,255,255,0.1) ${progressPercent}%, rgba(255,255,255,0.1) 100%)`
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
              background: `linear-gradient(to right, var(--text-secondary) 0%, var(--text-secondary) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.1) 100%)`
            }}
          />
        </div>
      </div>
    </div>
  );
}
