import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseEnabled } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import '../styles/widgets.css';

/**
 * KnowledgeResurface — "Hôm nay nhớ lại" widget.
 * Randomly surfaces 1 old Collect item for spaced repetition.
 * Only shows items that are typed (not inbox) and not archived.
 */
export default function KnowledgeResurface() {
  const { user, isAuthenticated } = useAuth();
  const enabled = isSupabaseEnabled && isAuthenticated && !!user;

  const [item, setItem] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const fetchRandom = useCallback(async () => {
    if (!enabled) return;
    try {
      // Get count of eligible items (typed, not archived, older than 1 day)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const cutoff = yesterday.toISOString();

      const { data, error } = await supabase
        .from('collections')
        .select('id, title, type, url, body, created_at')
        .eq('user_id', user.id)
        .neq('type', 'inbox')
        .neq('status', 'archived')
        .lt('created_at', cutoff)
        .limit(20);

      if (error || !data || data.length === 0) return;

      // Pick random
      const randomItem = data[Math.floor(Math.random() * data.length)];
      setItem(randomItem);
    } catch (err) {
      console.warn('[KnowledgeResurface] error:', err.message);
    }
  }, [enabled, user]);

  useEffect(() => {
    // Check if already dismissed today
    const today = new Date().toISOString().split('T')[0];
    const dismissedDate = sessionStorage.getItem('lh_resurface_dismissed');
    if (dismissedDate === today) {
      setDismissed(true);
      return;
    }
    fetchRandom();
  }, [fetchRandom]);

  const handleDismiss = () => {
    const today = new Date().toISOString().split('T')[0];
    sessionStorage.setItem('lh_resurface_dismissed', today);
    setDismissed(true);
  };

  const handleMarkRead = async () => {
    if (!item) return;
    try {
      await supabase
        .from('collections')
        .update({ status: 'read', reviewed_at: new Date().toISOString() })
        .eq('id', item.id);
    } catch (_) { /* fire and forget */ }
    handleDismiss();
  };

  const handleNext = () => {
    setItem(null);
    fetchRandom();
  };

  if (!enabled || dismissed || !item) return null;

  const TYPE_ICONS = { link: '🔗', quote: '💬', want: '📌', learn: '📚', idea: '💡' };

  return (
    <div className="resurface-widget">
      <div className="resurface-widget__header">
        <span className="resurface-widget__title">🧠 Hôm nay nhớ lại</span>
        <button className="resurface-widget__close" onClick={handleDismiss} title="Đóng">✕</button>
      </div>
      <div className="resurface-widget__card">
        <span className="resurface-widget__type">{TYPE_ICONS[item.type] || '📝'} {item.type}</span>
        <div className="resurface-widget__text">{item.title}</div>
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="resurface-widget__link">
            {item.url.length > 40 ? item.url.slice(0, 40) + '…' : item.url}
          </a>
        )}
      </div>
      <div className="resurface-widget__actions">
        <button onClick={handleMarkRead} className="resurface-widget__btn resurface-widget__btn--primary">
          ✅ Đã xem
        </button>
        <button onClick={handleNext} className="resurface-widget__btn">
          🔄 Cái khác
        </button>
        <button onClick={handleDismiss} className="resurface-widget__btn">
          Bỏ qua
        </button>
      </div>
    </div>
  );
}
