import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KIND_META, contentKind, itemPlainText, safeHostname, ageDays,
  filterArticles, quickSortQueue, suggestTopic, pickResurface,
} from '../../utils/kbDeriveUtils';
import { toDateStr, formatDate } from '../../utils/dateUtils';
import { useAuth } from '../../contexts/AuthContext';
import { MAX_TOPICS } from '../../hooks/useCollectionTopics';

/**
 * KBOverview — tab "Tổng quan" (1a): lời chào + chòm sao nhỏ, Xếp nhanh (bài mới chưa có chủ đề,
 * từng bài một, phím 1–9 / →), Các chủ đề, Gặp lại hôm nay, Gần đây.
 * Chỉ để xem và tìm lại: không có trạng thái đọc, không có việc phải dọn.
 */

const ago = d => (d <= 0 ? 'hôm nay' : `${d} ngày trước`);
const greetingOf = h => (h < 11 ? 'Chào buổi sáng' : h < 13 ? 'Chào buổi trưa' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối');
// Vị trí sao cố định theo id: cùng bài luôn nằm cùng chỗ trên bầu trời nhỏ
const hash = s => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const SKY_W = 420;
const SKY_H = 200;

/** Bầu trời nhỏ: bài có liên kết sáng hơn và được nối bằng đường chòm sao. */
function MiniSky({ articles, edges, onOpen }) {
  const { stars, lines } = useMemo(() => {
    const degree = new Map();
    edges.forEach(e => { degree.set(e.from, (degree.get(e.from) || 0) + 1); degree.set(e.to, (degree.get(e.to) || 0) + 1); });
    const picked = [...articles].sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0)).slice(0, 26);
    const pos = new Map(picked.map(a => {
      const h = hash(a.id);
      return [a.id, { x: 24 + (h % (SKY_W - 48)), y: 18 + ((h >>> 9) % (SKY_H - 44)) }];
    }));
    return {
      stars: picked.map(a => ({ a, ...pos.get(a.id), d: degree.get(a.id) || 0 })),
      lines: edges.filter(e => pos.has(e.from) && pos.has(e.to)).map(e => ({ ...e, p: pos.get(e.from), q: pos.get(e.to) })),
    };
  }, [articles, edges]);

  return (
    <button className="kb-ov-sky" onClick={onOpen} title="Mở bầu trời">
      <svg viewBox={`0 0 ${SKY_W} ${SKY_H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {lines.map(l => (
          <line key={`${l.from}|${l.to}`} x1={l.p.x} y1={l.p.y} x2={l.q.x} y2={l.q.y} className="kb-ov-sky__line" />
        ))}
        {stars.map(s => (
          <circle
            key={s.a.id}
            cx={s.x}
            cy={s.y}
            r={s.d ? 2.6 + Math.min(s.d, 4) * 0.35 : 1.5}
            className={s.d ? 'kb-ov-sky__star is-lit' : 'kb-ov-sky__star'}
            style={s.d && s.a._topic ? { fill: s.a._topic.color } : undefined}
          />
        ))}
        {stars.filter(s => s.d).slice(0, 4).map(s => (
          <text key={s.a.id} x={s.x + 8} y={s.y - 5} className="kb-ov-sky__label">{s.a.title.slice(0, 18)}</text>
        ))}
      </svg>
      <span className="kb-ov-sky__caption">{articles.length} sao · {edges.length} đường nối</span>
    </button>
  );
}

/** Clickable card. A div (not <button>) because it holds headings and lists. */
function Card({ onOpen, className = '', style, children }) {
  return (
    <div
      className={`kb-ov-card ${className}`}
      style={style}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
    >
      {children}
    </div>
  );
}

export default function KBOverview({
  articles, topics, topicCounts, recentIds, keysDisabled, linkCount, edges,
  onOpenReader, onOpenTopic, onOpenMine, onManageTopics, onNewArticle, onAssign, onOpenGraph,
}) {
  const { user, profile } = useAuth();
  const name = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'bạn';

  // One clock per visit: ages and "Gặp lại hôm nay" stay stable while the tab is open.
  const [now] = useState(() => Date.now());
  const [skipped, setSkipped] = useState(() => new Set());
  const sortRef = useRef(null);

  const library = useMemo(() => filterArticles(articles), [articles]);
  const fullQueue = useMemo(() => quickSortQueue(articles, now), [articles, now]);
  const queue = useMemo(() => fullQueue.filter(a => !skipped.has(a.id)), [fullQueue, skipped]);
  const [startCount] = useState(fullQueue.length);
  const done = Math.max(0, startCount - queue.length);
  const total = done + queue.length;
  const current = queue[0] || null;
  const suggestedId = useMemo(
    () => (current ? suggestTopic(current, articles, topics) : null),
    [current, articles, topics],
  );
  const skip = () => setSkipped(prev => new Set(prev).add(current.id));

  const mine = useMemo(() => filterArticles(articles, { mine: true }), [articles]);
  const mineSnippet = mine.find(a => a._notes?.length)?._notes[0].content;

  const topicCards = useMemo(
    () => topics.map(t => ({ topic: t, latest: filterArticles(articles, { topic: t.id }).slice(0, 2) })),
    [topics, articles],
  );

  const resurface = useMemo(() => pickResurface(articles, toDateStr(new Date(now)), 3, now), [articles, now]);
  const recent = useMemo(() => {
    const byId = new Map(articles.map(a => [a.id, a]));
    return recentIds.map(id => byId.get(id)).filter(a => a && a.status !== 'archived').slice(0, 5);
  }, [articles, recentIds]);

  // Xếp nhanh from the keyboard: 1–9 picks a topic, → skips.
  useEffect(() => {
    if (!current || keysDisabled) return undefined;
    const handler = e => {
      const t = e.target;
      if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSkipped(prev => new Set(prev).add(current.id));
        return;
      }
      const topic = /^[1-9]$/.test(e.key) ? topics[Number(e.key) - 1] : null;
      if (topic) {
        e.preventDefault();
        onAssign(current, topic.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, keysDisabled, topics, onAssign]);

  if (topicCounts.all === 0) {
    return (
      <div className="kb-empty kb-empty--page">
        <div className="kb-empty__stars" aria-hidden="true"><span /><span className="kb-orb" /><span /></div>
        <h2 className="kb-empty__title">Bầu trời còn trống</h2>
        <p className="kb-empty__desc">Dán một link hay một đoạn chữ đáng giữ để thắp ngôi sao đầu tiên.</p>
        <button className="kb-btn-primary" onClick={onNewArticle}>Viết bài mới</button>
      </div>
    );
  }

  const canSort = current && topics.length > 0;
  const segs = Math.min(total, 10);
  const lit = total ? Math.min(segs, Math.floor((done / total) * segs) + 1) : 0;

  return (
    <div className="kb-overview" style={{ animation: 'kb-in .22s ease' }}>
      {/* Lời chào + bầu trời nhỏ */}
      <section className="kb-ov-hero">
        <div className="kb-ov-hero__text">
          <p className="kb-ov-hero__date">
            {new Date(now).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="kb-ov-hero__title">{greetingOf(new Date(now).getHours())}, {name}.</h1>
          <p className="kb-ov-hero__line">
            Bầu trời của bạn có <b>{library.length} ngôi sao</b> và {linkCount} đường nối.
            {fullQueue.length > 0 && ` ${fullQueue.length} bài mới đang chờ được xếp vào chòm.`}
          </p>
          <div className="kb-ov-hero__btns">
            {canSort && (
              <button
                className="kb-btn-soft"
                onClick={() => {
                  sortRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  sortRef.current?.querySelector('.kb-ov-topic')?.focus({ preventScroll: true });
                }}
              >
                Bắt đầu xếp
              </button>
            )}
            <button className="kb-btn-ghost" onClick={onOpenGraph}>Mở bầu trời ↗</button>
          </div>
        </div>
        <MiniSky articles={library} edges={edges} onOpen={onOpenGraph} />
      </section>

      {/* Xếp nhanh */}
      {canSort && (
        <section className="kb-ov-sort" ref={sortRef}>
          <div className="kb-ov-sort__main">
            <div className="kb-ov-sort__head">
              <h2 className="kb-ov-title">Xếp nhanh</h2>
              <span className="kb-badge-soft">{done + 1} / {total}</span>
            </div>
            <div className="kb-ov-sort__segs" style={{ '--segs': segs }} aria-hidden="true">
              {Array.from({ length: segs }, (_, i) => <span key={i} className={i < lit ? 'is-lit' : ''} />)}
            </div>
            <div className="kb-ov-sort__meta">
              {KIND_META[contentKind(current)].label}
              {current.url && ` · ${safeHostname(current.url)}`}
              {` · cất ${ago(ageDays(current, now))}`}
            </div>
            <button className="kb-ov-sort__title" onClick={() => onOpenReader(current)}>{current.title}</button>
            {itemPlainText(current) && <p className="kb-ov-sort__excerpt">{itemPlainText(current).slice(0, 260)}</p>}
            <div className="kb-ov-sort__btns">
              <button className="kb-btn-ghost kb-btn-ghost--small" onClick={skip}>Để sau <kbd className="kb-kbd">→</kbd></button>
            </div>
          </div>
          <div className="kb-ov-sort__pick">
            <div className="kb-ov-sort__pick-head">
              <span>Xếp vào chủ đề</span>
              <span className="kb-ov-sort__hint">Nhấn phím 1–{Math.min(topics.length, 9)}</span>
            </div>
            <div className="kb-ov-topics">
              {topics.map((t, i) => (
                <button
                  key={t.id}
                  className={`kb-ov-topic${suggestedId === t.id ? ' is-suggested' : ''}`}
                  onClick={() => onAssign(current, t.id)}
                  title={t.description || t.name}
                >
                  {i < 9 && <kbd className="kb-kbd">{i + 1}</kbd>}
                  <span className="kb-dot" style={{ '--kb-topic': t.color }} />
                  <span className="kb-ov-topic__name">{t.name}</span>
                  {suggestedId === t.id && <span className="kb-ov-topic__hint">gợi ý</span>}
                </button>
              ))}
              {topics.length < MAX_TOPICS && (
                <button className="kb-ov-topic kb-ov-topic--new" onClick={onManageTopics}>+ Chủ đề mới</button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Các chủ đề */}
      <section>
        <header className="kb-ov-head">
          <h2 className="kb-ov-title">Các chủ đề</h2>
          <span className="kb-ov-head__count">{topics.length}/{MAX_TOPICS}</span>
          <span className="kb-spacer" />
          <button className="kb-link" onClick={onManageTopics}>Quản lý</button>
        </header>
        <div className="kb-ov-grid">
          {topicCards.map(({ topic, latest }) => {
            const n = topicCounts[topic.id] || 0;
            return (
              <Card key={topic.id} onOpen={() => onOpenTopic(topic.id)} className={n ? '' : 'is-dim'} style={{ '--kb-topic': topic.color }}>
                <h3 className="kb-ov-card__name">
                  <span className="kb-dot" />
                  {topic.name}
                  <span className="kb-ov-card__num">{n}</span>
                </h3>
                {topic.description && <p className="kb-ov-card__desc">{topic.description}</p>}
                {latest.length > 0 && (
                  <ul className="kb-ov-card__list">
                    {latest.map(a => <li key={a.id}>{a.title}</li>)}
                  </ul>
                )}
              </Card>
            );
          })}
          <Card onOpen={onOpenMine} className="kb-ov-card--mine">
            <h3 className="kb-ov-card__name">
              ✎ Ghi chú của tôi
              <span className="kb-ov-card__num">{mine.length}</span>
            </h3>
            <p className="kb-ov-card__desc">Ghi chú, trích dẫn của bạn và những bài bạn có ghi chú</p>
            {mineSnippet && <p className="kb-ov-card__quote">“{mineSnippet.slice(0, 120)}”</p>}
          </Card>
        </div>
      </section>

      {/* Gặp lại hôm nay · Gần đây */}
      {(resurface.length > 0 || recent.length > 0) && (
        <div className="kb-ov-two">
          {resurface.length > 0 && (
            <section className="kb-ov-panel">
              <header className="kb-ov-head">
                <h2 className="kb-ov-title">Gặp lại hôm nay</h2>
                <span className="kb-ov-head__note">bài cũ hơn 30 ngày, đổi mỗi ngày</span>
              </header>
              <div className="kb-ov-stack">
                {resurface.map(a => (
                  <button key={a.id} className="kb-ov-resurface" onClick={() => onOpenReader(a)}>
                    <span className="kb-ov-resurface__meta">
                      <span style={{ color: a._topic?.color }}>{a._topic ? a._topic.name : 'Chưa xếp'}</span>
                      {` · ${ago(ageDays(a, now))}`}
                    </span>
                    <span className="kb-ov-resurface__title">{a.title}</span>
                    {(a._notes?.[0]?.content || itemPlainText(a)) && (
                      <span className="kb-ov-resurface__quote">{(a._notes?.[0]?.content || itemPlainText(a)).slice(0, 160)}</span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
          {recent.length > 0 && (
            <section className="kb-ov-panel">
              <header className="kb-ov-head">
                <h2 className="kb-ov-title">Gần đây</h2>
                <span className="kb-ov-head__note">mở trên máy này</span>
              </header>
              <div className="kb-ov-recent">
                {recent.map(a => (
                  <button key={a.id} className="kb-ov-recent__row" onClick={() => onOpenReader(a)}>
                    <span className="kb-ov-recent__title">{a.title}</span>
                    <span className="kb-ov-recent__kind">{KIND_META[contentKind(a)].label}</span>
                    <span className="kb-ov-recent__topic">
                      <span className="kb-dot" style={a._topic ? { '--kb-topic': a._topic.color } : undefined} />
                      {a._topic ? a._topic.name : 'Chưa xếp'}
                    </span>
                    <span className="kb-ov-recent__date">{formatDate(a.created_at)}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
