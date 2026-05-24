import React, { useState, useRef, useEffect } from 'react';
import { useRandomPodcast } from '../hooks/useRandomPodcast';
import { extractDriveDirectUrl } from '../utils/mediaUtils';
import { Play, Pause, SkipForward, X, Music } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function GlobalAudioPlayer() {
  const { podcast, fetchRandomPodcast, isLoading } = useRandomPodcast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const audioRef = useRef(null);
  const location = useLocation();

  // If user is on /collect and specifically reading a podcast, we might want to hide the global player or sync it.
  // For now, let's just make it a floating player that the user can dismiss.
  
  // Auto-play requirement: "phát ngẫu nhiên các bài podcast khi vào trang"
  // Browsers block autoplay without interaction. So we just load it and let the user click play.
  // Wait, if we want autoplay, we can try, but catch the error.
  useEffect(() => {
    if (podcast && audioRef.current && !isDismissed) {
      // Don't auto-play immediately to avoid console errors, wait for user to click play.
      // But if we really want to try:
      // audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(false);
    }
  }, [podcast, isDismissed]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error("Autoplay blocked:", e));
    }
    setIsPlaying(!isPlaying);
  };

  if (!podcast || isDismissed) return null;

  const directUrl = extractDriveDirectUrl(podcast.url) || podcast.url;

  return (
    <div className={`global-audio-player ${isMinimized ? 'is-minimized' : ''}`}>
      <audio
        ref={audioRef}
        src={directUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          fetchRandomPodcast(); // Autoplay next random podcast
        }}
        preload="none"
      />
      
      {isMinimized ? (
        <button className="gap-btn-restore" onClick={() => setIsMinimized(false)} title="Mở rộng Trình phát">
          <Music size={20} />
          {isPlaying && <span className="gap-playing-dot" />}
        </button>
      ) : (
        <div className="gap-container">
          <div className="gap-info">
            <span className="gap-title">{podcast.title}</span>
            <span className="gap-subtitle">Podcast ngẫu nhiên</span>
          </div>
          
          <div className="gap-controls">
            <button className="gap-btn" onClick={togglePlay}>
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button className="gap-btn" onClick={fetchRandomPodcast} title="Đổi bài khác">
              <SkipForward size={20} />
            </button>
            <button className="gap-btn gap-btn-min" onClick={() => setIsMinimized(true)} title="Thu nhỏ">
              <MinusIcon size={20} />
            </button>
            <button className="gap-btn gap-btn-close" onClick={() => {
              setIsDismissed(true);
              if (audioRef.current) audioRef.current.pause();
            }} title="Tắt">
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MinusIcon({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}
