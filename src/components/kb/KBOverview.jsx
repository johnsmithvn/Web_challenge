import { useEffect, useMemo, useState } from 'react';
import {
  KIND_META, contentKind, itemPlainText, safeHostname, ageDays,
  filterArticles, quickSortQueue, suggestTopic, pickResurface,
} from '../../utils/kbDeriveUtils';
import { toDateStr } from '../../utils/dateUtils';
import KBTopicPicker from './KBTopicPicker';

/**
 * KBOverview — tab "Tổng quan": điểm vào của Knowledge.
 * Xếp nhanh (bài mới chưa có chủ đề, từng bài một) · Các chủ đề · Gặp lại hôm nay · Mở gần đây.
 * Chỉ để xem và tìm lại: không có trạng thái đọc, không có việc phải dọn.
 */

const ago = d => (d <= 0 ? 'hôm nay' : `${d} ngày`);

function Head({ title, count, note, action, onAction }) {
  return (
    <header className="kb-ov-head">
      <h2 className="kb-ov-head__title">{title}{count !== undefined && <span className="kb-ov-head__count"> · {count}</span>}</h2>
      {note && <span className="kb-ov-head__note">{note}</span>}
      <span className="kb-ov-head__spacer" />
      {action && <button className="kb-ov-head__action" onClick={onAction}>{action}</button>}
    </header>
  );
}

/** Clickable card. A div (not <button>) because it holds headings and lists. */
function Card({ onOpen, className = '', children }) {
  return (
    <div
      className={`kb-ov-card ${className}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
    >
      {children}
    </div>
  );
}

const TopicDot = ({ topic }) => (
  <span className="kb-ov-topic">
    <span className="kb-chip__dot" style={{ background: topic?.color || 'var(--kb-faint)' }} />
    {topic ? topic.name : 'Chưa xếp'}
  </span>
);

export default function KBOverview({
  articles, topics, topicCounts, recentIds, keysDisabled,
  onOpenReader, onOpenTopic, onOpenMine, onManageTopics, onNewArticle, onAssign,
}) {
  // One clock per visit: ages and "Gặp lại hôm nay" stay stable while the tab is open.
  const [now] = useState(() => Date.now());
  const [skipped, setSkipped] = useState(() => new Set());

  const queue = useMemo(
    () => quickSortQueue(articles, now).filter(a => !skipped.has(a.id)),
    [articles, now, skipped],
  );
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
    return recentIds.map(id => byId.get(id)).filter(a => a && a.status !== 'archived').slice(0, 3);
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
      <div className="kb-empty-state">
        <span className="kb-empty-state__icon">◌</span>
        <h2 className="kb-empty-state__title">Kho đang trống</h2>
        <p className="kb-empty-state__desc">Dán một link hay một đoạn chữ đáng giữ để bắt đầu.</p>
        <button className="kb-btn-primary" onClick={onNewArticle}>＋ Bài mới</button>
      </div>
    );
  }

  return (
    <div className="kb-overview" style={{ animation: 'kb-in .22s ease' }}>
      {/* 1 · Xếp nhanh */}
      {current && topics.length > 0 && (
        <section>
          <Head title="Xếp nhanh" count={`còn ${queue.length}`} note="bài mới chưa có chủ đề — chỗ chờ, không phải việc phải làm" />
          <div className="kb-ov-sort">
            <div className="kb-row__meta">
              <span>{KIND_META[contentKind(current)].label}</span>
              {current.url && <><span className="kb-row__sep">·</span><span>{safeHostname(current.url)}</span></>}
              <span className="kb-row__sep">·</span>
              <span>{ago(ageDays(current, now))}</span>
            </div>
            <button className="kb-ov-sort__title" onClick={() => onOpenReader(current)}>{current.title}</button>
            {itemPlainText(current) && <p className="kb-ov-sort__excerpt">{itemPlainText(current).slice(0, 160)}</p>}
            <div className="kb-ov-sort__actions">
              <KBTopicPicker
                topics={topics}
                value={undefined}
                onChange={id => onAssign(current, id)}
                suggestedId={suggestedId}
                allowNone={false}
                showKeys
              />
              <span className="kb-ov-head__spacer" />
              <button className="kb-btn-ghost kb-btn-ghost--small" onClick={skip}>Để sau →</button>
            </div>
          </div>
        </section>
      )}

      {/* 2 · Các chủ đề */}
      <section>
        <Head title="Các chủ đề" count={`${topics.length}/8`} action="Quản lý" onAction={onManageTopics} />
        <div className="kb-ov-grid">
          {topicCards.map(({ topic, latest }) => (
            <Card key={topic.id} onOpen={() => onOpenTopic(topic.id)}>
              <h3 className="kb-ov-card__name">
                <span className="kb-chip__dot" style={{ background: topic.color }} />
                {topic.name}
                <span className="kb-ov-card__num">{topicCounts[topic.id] || 0}</span>
              </h3>
              {topic.description && <p className="kb-ov-card__desc">{topic.description}</p>}
              {latest.length > 0 && (
                <ul className="kb-ov-card__list">
                  {latest.map(a => <li key={a.id}><span>{KIND_META[contentKind(a)].glyph}</span> {a.title}</li>)}
                </ul>
              )}
            </Card>
          ))}
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

      {/* 3 · Gặp lại hôm nay · Mở gần đây */}
      {(resurface.length > 0 || recent.length > 0) && (
        <div className="kb-ov-two">
          {resurface.length > 0 && (
            <section>
              <Head title="Gặp lại hôm nay" note="bài cũ hơn 30 ngày, đổi mỗi ngày" />
              <div className="kb-ov-stack">
                {resurface.map(a => (
                  <Card key={a.id} onOpen={() => onOpenReader(a)}>
                    <div className="kb-row__meta">
                      <TopicDot topic={a._topic} />
                      <span className="kb-row__sep">·</span>
                      <span>{ago(ageDays(a, now))} trước</span>
                    </div>
                    <h3 className="kb-ov-card__title">{a.title}</h3>
                    {(a._notes?.[0]?.content || itemPlainText(a)) && (
                      <p className="kb-ov-card__quote">{(a._notes?.[0]?.content || itemPlainText(a)).slice(0, 140)}</p>
                    )}
                  </Card>
                ))}
              </div>
            </section>
          )}
          {recent.length > 0 && (
            <section>
              <Head title="Mở gần đây" note="trên máy này" />
              <div className="kb-ov-recent">
                {recent.map(a => (
                  <button key={a.id} className="kb-ov-recent__row" onClick={() => onOpenReader(a)}>
                    <span className="kb-ov-recent__glyph" style={{ color: a._topic?.color || 'var(--kb-faint)' }}>
                      {KIND_META[contentKind(a)].glyph}
                    </span>
                    <span className="kb-ov-recent__title">{a.title}</span>
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
