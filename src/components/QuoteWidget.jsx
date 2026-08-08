/**
 * QuoteWidget — Dynamic inspirational quote with randomize + optional audio.
 *
 * Sources:
 *   1. System quotes (src/data/quotes.json) — always available
 *   2. User DB quotes (inspirational_quotes table) — future: Phase 4b
 *
 * Behavior:
 *   - On mount: picks a random quote (seed = date + pageKey for daily consistency)
 *   - 🔀 button: shuffle to a new random quote (within session)
 *   - Smooth crossfade animation on quote change
 *   - Optional audio_url: shows play button
 *
 * Props:
 *   pageKey — string identifier to seed daily quote selection (e.g. 'today', 'inbox', 'kb')
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import QUOTES_DATA from '../data/quotes.json';
import AppIcon from './AppIcon';
import '../styles/quote-widget.css';

const SYSTEM_QUOTES = QUOTES_DATA.dailyQuotes;

/** Simple deterministic hash for daily seed */
function dailySeed(pageKey = '') {
  const d = new Date();
  const day = Math.floor(d.getTime() / 86400000); // days since epoch
  let h = day * 31 + pageKey.length;
  for (let i = 0; i < pageKey.length; i++) h = (h * 37 + pageKey.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function QuoteWidget({ pageKey = 'default', kbQuotes = [] }) {
  // Merge system quotes with KB quotes (optional)
  const allQuotes = useMemo(() => {
    const pool = [...SYSTEM_QUOTES];
    // Map KB quote items → QuoteWidget format
    for (const item of kbQuotes) {
      const text = item.body_text || item.title || '';
      if (!text.trim()) continue;
      pool.push({
        text: text.length > 200 ? text.slice(0, 200) + '…' : text,
        author: item.body_text ? item.title : null,
        audio_url: null,
      });
    }
    return pool;
  }, [kbQuotes]);
  const initialIdx = useMemo(() => dailySeed(pageKey) % allQuotes.length, [pageKey, allQuotes.length]);

  const [idx, setIdx] = useState(initialIdx);
  const [animating, setAnimating] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef(null);

  const quote = allQuotes[idx] || allQuotes[0];

  const shuffle = useCallback(() => {
    setAnimating(true);
    setTimeout(() => {
      setIdx(prev => {
        let next;
        do { next = Math.floor(Math.random() * allQuotes.length); } while (next === prev && allQuotes.length > 1);
        return next;
      });
      setAnimating(false);
    }, 250); // match CSS transition duration
  }, [allQuotes.length]);

  // Stop audio on quote change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setAudioPlaying(false);
    }
  }, [idx]);

  const toggleAudio = useCallback(() => {
    if (!audioRef.current) return;
    if (audioPlaying) {
      audioRef.current.pause();
      setAudioPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setAudioPlaying(true);
    }
  }, [audioPlaying]);

  return (
    <div className={`qw ${animating ? 'qw--fade-out' : 'qw--fade-in'}`}>
      <span className="qw__mark">"</span>
      <div className="qw__body">
        <p className="qw__text">{quote.text}</p>
        {quote.author && (
          <p className="qw__author">— {quote.author}</p>
        )}
      </div>

      <div className="qw__actions">
        {/* Audio play button — only if quote has audio_url */}
        {quote.audio_url && (
          <>
            <button className="qw__btn" onClick={toggleAudio} title={audioPlaying ? 'Dừng' : 'Nghe'}>
              <AppIcon name={audioPlaying ? 'pause' : 'headphones'} size={15} />
            </button>
            <audio
              ref={audioRef}
              src={quote.audio_url}
              preload="none"
              onEnded={() => setAudioPlaying(false)}
            />
          </>
        )}

        {/* Shuffle button */}
        <button className="qw__btn qw__btn--shuffle" onClick={shuffle} title="Câu khác">
          <AppIcon name="refresh" size={15} />
        </button>
      </div>
    </div>
  );
}
