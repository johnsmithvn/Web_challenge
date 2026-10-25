import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  KIND_META,
  contentKind,
  progressOf,
  findNeighbors,
  readTime,
  isTiptapBody,
  extractHeadings,
  slugifyVi,
  getOutboundLinks,
  findBacklinks,
} from '../../utils/kbDeriveUtils';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import MediaPreview from '../MediaPreview';
import { stripMediaTag } from '../../utils/mediaUtils';

const TiptapReadOnly = lazy(() => import('../TiptapEditor').then(m => ({ default: m.TiptapReadOnly })));

const REMARK_PLUGINS = [remarkGfm];

// Tiến độ 5 bước (progressOf), theo thứ tự
const PROGRESS_STEPS = [
  { key: 'unread', label: 'Chưa đọc xong', hint: 'vừa cất' },
  { key: 'read', label: 'Đã đọc', hint: 'bấm Đọc xong' },
  { key: 'noted', label: 'Đã rút ra', hint: 'có ghi chú của bạn' },
  { key: 'practicing', label: 'Đang thực hành', hint: 'có task chưa xong' },
  { key: 'practiced', label: 'Đã thực hành', hint: 'task đã xong' },
];

function AroundGroup({ title, note, items, onOpen }) {
  if (items.length === 0) return null;
  return (
    <div className="kb-around__group">
      <div className="kb-around__label">{title}{note && <em> · {note}</em>}</div>
      {items.map(a => (
        <div key={a.id} className="kb-rail-link-row" onClick={() => onOpen(a)}>
          <span className="kb-badge__dot" style={{ background: a._topic?.color || 'var(--kb-faint)' }} />
          <span className="kb-rail-link-title">{a.title}</span>
        </div>
      ))}
    </div>
  );
}

export default function KBReaderView({
  article,
  allArticles,
  topics,
  pendingTaskIds,
  onBack,
  onPrev,
  onNext,
  onEdit,
  onDelete,
  onArchive,
  onToggleRead,
  onAssignTopic,
  onCreateTask,
  onNotesChange,
  notesHook,
  onOpenArticle,
  onOpenGraph,
  onOpenLinkModal,
  onUpdateUrl,
}) {
  const [focusMode, setFocusMode] = useState(false);
  const [readProg, setReadProg] = useState(0);
  const scrollRef = useRef(null);
  const miniCanvasRef = useRef(null);
  const noteInputRef = useRef(null);

  // Sub-notes state
  const { notes, isLoading: isNotesLoading, fetchNotes, addNote, updateNote, deleteNote } = notesHook;
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteContent, setEditNoteContent] = useState('');

  useEffect(() => {
    if (article?.id) fetchNotes(article.id);
  }, [article?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reading progress tracking
  const handleScroll = (e) => {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    if (max > 0) {
      setReadProg(Math.min(1, Math.max(0, el.scrollTop / max)));
    }
  };

  const kind = KIND_META[contentKind(article)];
  const topic = article._topic;
  const topicColor = topic?.color || 'var(--kb-faint)';
  const isTiptap = isTiptapBody(article);
  const wordsCount = (article.body_text || article.body || '').trim().split(/\s+/).filter(Boolean).length;
  const mins = article.word_count ? Math.max(1, Math.ceil(article.word_count / 220)) : readTime(article.body_text || article.body || '');

  // Markdown Headings for TOC
  const headings = useMemo(() => extractHeadings(article.body || ''), [article.body]);

  // Outbound wiki links
  const outboundLinks = useMemo(() => getOutboundLinks(article, allArticles), [article, allArticles]);

  // Inbound backlinks
  const backlinks = useMemo(
    () => findBacklinks(article.title, allArticles).filter(b => b.article.id !== article.id),
    [article.title, article.id, allArticles],
  );

  // Xung quanh: cùng chủ đề · cùng nguồn · lưu gần thời điểm
  const around = useMemo(() => findNeighbors(article, allArticles), [article, allArticles]);

  // Tasks associated with this collection (only open ones are loaded; the rest are done)
  const tasks = article._linkedTasks || [];
  const doneTaskCount = (article._linkedTaskIds || []).filter(id => !pendingTaskIds.has(id)).length;

  // One source: the bài row (onNotesChange refetches it after a note is added / removed)
  const progress = progressOf(article, pendingTaskIds);
  const progressIdx = PROGRESS_STEPS.findIndex(s => s.key === progress);
  const isRead = article.status === 'read';

  const handleToggleRead = () => {
    onToggleRead();
    if (!isRead) {
      // Vừa đọc xong → mời rút ra một câu ngay trong ô ghi chú
      noteInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      noteInputRef.current?.focus({ preventScroll: true });
    }
  };

  // Mini graph for rail (always renders a lively local cluster)
  useEffect(() => {
    const canvas = miniCanvasRef.current;
    if (!canvas || focusMode) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || 310;
    const H = 208;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Collect neighbor nodes: linked nodes first, then same tag, then fallback pool
    const directIds = new Set([article.id, ...outboundLinks.map(a => a.id), ...backlinks.map(b => b.article.id)]);
    let pool = allArticles.filter(a => directIds.has(a.id));

    if (pool.length < 5) {
      const tagNames = (article._tags || []).map(t => typeof t === 'string' ? t : t.name);
      const sameTagArticles = allArticles.filter(a =>
        a.id !== article.id &&
        !directIds.has(a.id) &&
        (a._tags || []).some(t => tagNames.includes(typeof t === 'string' ? t : t.name))
      );
      pool = [...pool, ...sameTagArticles].slice(0, 7);
    }

    if (pool.length < 4) {
      const remaining = allArticles.filter(a => a.id !== article.id && !pool.some(p => p.id === a.id));
      pool = [...pool, ...remaining.slice(0, 5 - pool.length)];
    }

    const localNodes = pool.slice(0, 8);
    const cx = W / 2, cy = H / 2;
    const simNodes = localNodes.map((n, i) => {
      if (n.id === article.id) return { ...n, x: cx, y: cy, isCurrent: true };
      const angle = (2 * Math.PI * (i - 1)) / Math.max(1, localNodes.length - 1);
      const r = Math.min(W, H) * 0.38;
      return {
        ...n,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        isCurrent: false,
      };
    });

    ctx.clearRect(0, 0, W, H);

    // Draw lines to center
    const centerNode = simNodes.find(n => n.isCurrent) || simNodes[0];
    simNodes.forEach(n => {
      if (n.isCurrent) return;
      ctx.beginPath();
      ctx.moveTo(centerNode.x, centerNode.y);
      ctx.lineTo(n.x, n.y);
      const isDirect = outboundLinks.some(o => o.id === n.id) || backlinks.some(b => b.article.id === n.id);
      ctx.strokeStyle = isDirect ? 'oklch(0.78 0.11 72 / 0.45)' : 'oklch(0.312 0.014 275 / 0.35)';
      ctx.lineWidth = isDirect ? 1.4 : 1;
      if (!isDirect) ctx.setLineDash([3, 3]);
      else ctx.setLineDash([]);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Draw node circles
    simNodes.forEach(n => {

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.isCurrent ? 7.5 : 5, 0, Math.PI * 2);
      ctx.fillStyle = n.isCurrent ? 'oklch(0.78 0.11 72)' : 'oklch(0.555 0.012 275)';
      ctx.fill();

      if (n.isCurrent) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = 'oklch(0.78 0.11 72 / 0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.font = '500 12.5px "Spectral", Georgia, serif';
      ctx.fillStyle = n.isCurrent ? 'oklch(0.96 0.008 275)' : 'oklch(0.85 0.010 275)';
      ctx.textAlign = 'center';
      const label = n.title.length > 16 ? n.title.slice(0, 14) + '…' : n.title;
      ctx.fillText(label, n.x, n.y + 17);
    });

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      for (const n of simNodes) {
        if (Math.hypot(mx - n.x, my - n.y) <= 14) {
          if (!n.isCurrent) onOpenArticle(n);
          return;
        }
      }
    };
    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
  }, [article, outboundLinks, backlinks, allArticles, focusMode, onOpenArticle]);

  // Markdown custom renderer for Wiki Links and Embeds
  const mdComponents = useMemo(() => ({
    h1: ({ children }) => <h2 id={slugifyVi(String(children))}>{children}</h2>,
    h2: ({ children }) => <h2 id={slugifyVi(String(children))}>{children}</h2>,
    h3: ({ children }) => <h3 id={slugifyVi(String(children))}>{children}</h3>,
    p: ({ children }) => {
      const text = String(children);
      if (typeof children === 'string' && text.includes('[[')) {
        const parts = [];
        let lastIdx = 0;
        const regex = /\[\[([^\]]+)\]\]/g;
        let m;
        while ((m = regex.exec(text)) !== null) {
          if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
          const targetTitle = m[1].trim();
          const targetArticle = allArticles.find(a => a.title === targetTitle);
          parts.push(
            <span
              key={m.index}
              className={`kb-wl${!targetArticle ? ' kb-wl--missing' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (targetArticle) onOpenArticle(targetArticle);
              }}
              title={targetArticle ? `Mở "${targetTitle}"` : `Chưa có bài "${targetTitle}"`}
            >
              {targetTitle}
            </span>
          );
          lastIdx = m.index + m[0].length;
        }
        if (lastIdx < text.length) parts.push(text.slice(lastIdx));
        return <p>{parts}</p>;
      }
      return <p>{children}</p>;
    },
    a: ({ href, children }) => {
      if (href && /youtube\.com|youtu\.be|\.(mp3|m4a|ogg|wav|aac|flac)(\?|$)|drive\.google\.com/i.test(href)) {
        return <MediaPreview url={href} title={children} onToggleFormat={onUpdateUrl ? (newUrl) => onUpdateUrl(href, newUrl) : undefined} />;
      }
      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
    },
  }), [allArticles, onOpenArticle, onUpdateUrl]);

  // Sub-note handlers
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    await addNote(article.id, newNote);
    setNewNote('');
    onNotesChange();
  };

  const handleDeleteNote = async (noteId) => {
    await deleteNote(noteId);
    onNotesChange();
  };

  const handleSaveNoteEdit = async (noteId) => {
    if (!editNoteContent.trim()) return;
    await updateNote(noteId, editNoteContent);
    setEditingNoteId(null);
    setEditNoteContent('');
  };

  return (
    <div className="kb-reader" style={{ animation: 'kb-up .25s ease' }}>
      {/* Top sticky bar */}
      <div className="kb-reader__bar">
        <div className="kb-reader__bar-inner">
          <button className="kb-back-btn" onClick={onBack}>← Thư viện</button>
          {onPrev && <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onPrev} title="Bài trước (K)">↑</button>}
          {onNext && <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onNext} title="Bài sau (J)">↓</button>}

          {/* Chủ đề: đổi một chạm (native select — không cần popover riêng) */}
          <label className="kb-reader__topic" title="Đổi chủ đề">
            <span className="kb-chip__dot" style={{ background: topicColor }} />
            <select
              value={article.topic_id || ''}
              onChange={e => onAssignTopic(e.target.value || null)}
              aria-label="Chủ đề của bài"
            >
              {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              <option value="">Chưa xếp</option>
            </select>
          </label>

          <div className="kb-subheader__spacer" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 8px' }}>
            <span style={{ fontFamily: 'var(--kb-mono)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--kb-faint)' }}>
              {kind.label} · {article.title}
            </span>
          </div>

          <button
            className={`kb-btn-ghost kb-btn-ghost--small${focusMode ? ' kb-btn-ghost--active' : ''}`}
            onClick={() => setFocusMode(v => !v)}
            title="Chế độ tập trung (F)"
          >
            {focusMode ? 'Thu gọn · F' : 'Tập trung · F'}
          </button>

          <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onOpenLinkModal}>
            ↔ Liên kết
          </button>

          <button
            className={`kb-btn-ghost kb-btn-ghost--small${isRead ? ' kb-btn-ghost--done' : ''}`}
            onClick={handleToggleRead}
            aria-pressed={isRead}
            title={isRead ? 'Bấm để đánh dấu lại là chưa đọc xong' : 'Đánh dấu đã đọc xong'}
          >
            {isRead ? '✓ Đã đọc' : 'Đọc xong'}
          </button>

          <button
            className="kb-btn-ghost kb-btn-ghost--small"
            onClick={() => onCreateTask(article)}
            title="Tạo task để thử / áp dụng điều trong bài"
          >
            ◇ Thực hành
          </button>

          <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onEdit}>
            ✎ Sửa · E
          </button>

          <button className="kb-btn-ghost kb-btn-ghost--small" onClick={onArchive} title="Ẩn khỏi mọi danh sách, không xoá">
            Lưu trữ
          </button>

          <button className="kb-btn-ghost kb-btn-ghost--small kb-btn-ghost--danger" onClick={onDelete} title="Xóa bài">
            ⌫
          </button>
        </div>
      </div>

      {/* Reading progress line */}
      <div className="kb-reader__progress">
        <div className="kb-reader__progress-fill" style={{ width: `${Math.round(readProg * 100)}%` }} />
      </div>

      {/* Main Reader Layout */}
      <div className="kb-reader__layout">
        {/* Main Prose Column */}
        <article
          ref={scrollRef}
          onScroll={handleScroll}
          className="kb-reader__main"
          style={{ maxWidth: focusMode ? '1080px' : undefined, margin: focusMode ? '0 auto' : undefined }}
        >
          <div className="kb-reader__paper">
            {/* Metadata line */}
            <div className="kb-reader__hero-meta">
              <span style={{ color: topicColor }}>{topic ? topic.name : 'Chưa xếp'}</span>
              <span>·</span>
              <span>{kind.label}</span>
              {article.url && <><span>·</span><span>{stripMediaTag(article.url)}</span></>}
              <span>·</span>
              <span>{formatDate(article.created_at)}</span>
              <span>·</span>
              <span>{mins} phút đọc</span>
            </div>

            {/* Title H1 */}
            <h1 className="kb-reader__h1">{article.title}</h1>

            {/* Tags */}
            {(article._tags || []).length > 0 && (
              <div className="kb-reader__tags">
                {article._tags.map(t => {
                  const name = typeof t === 'string' ? t : t.name;
                  const color = typeof t === 'string' ? 'var(--kb-dim)' : (t.color || 'var(--kb-dim)');
                  return (
                    <span key={name} className="kb-tag-chip">
                      <span className="kb-badge__dot" style={{ background: color }} />
                      {name}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Media preview block if url exists */}
            {article.url && (
              <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                <MediaPreview url={article.url} type={article.type} onToggleFormat={onUpdateUrl} />
              </div>
            )}

            {/* Body */}
            <div className="kb-prose" style={{ marginTop: '28px' }}>
              {isTiptap ? (
                <Suspense fallback={<div className="kb-loading">Đang tải nội dung...</div>}>
                  <TiptapReadOnly content={article.body} />
                </Suspense>
              ) : article.body ? (
                <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={mdComponents}>
                  {article.body}
                </ReactMarkdown>
              ) : (
                <p className="kb-prose__empty">Bài viết này chưa có nội dung. Chọn Sửa để thêm.</p>
              )}
            </div>

            {/* Sub-notes Section */}
            <section className="kb-subnotes">
              <div className="kb-subnotes__header">
                <span className="kb-subnotes__title">Ghi chú cá nhân</span>
                <span className="kb-subnotes__count">{notes.length}</span>
              </div>

              {isNotesLoading && <div className="kb-loading">Đang tải ghi chú...</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '16px' }}>
                {notes.map(n => (
                  <div key={n.id} className="kb-subnote">
                    {editingNoteId === n.id ? (
                      <div>
                        <textarea
                          className="kb-subnote-form__textarea"
                          value={editNoteContent}
                          onChange={e => setEditNoteContent(e.target.value)}
                          rows={3}
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveNoteEdit(n.id);
                            if (e.key === 'Escape') setEditingNoteId(null);
                          }}
                        />
                        <div className="kb-subnote-form__actions">
                          <button className="kb-btn-ghost kb-btn-ghost--small" onClick={() => setEditingNoteId(null)}>Hủy</button>
                          <button className="kb-btn-primary kb-btn-ghost--small" onClick={() => handleSaveNoteEdit(n.id)}>Lưu</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="kb-subnote__content">{n.content}</div>
                        <div className="kb-subnote__footer">
                          <span className="kb-subnote__date">{formatDateTime(n.created_at)}</span>
                          <div className="kb-subnote__actions">
                            <button className="kb-subnote__btn" onClick={() => { setEditingNoteId(n.id); setEditNoteContent(n.content); }}>sửa</button>
                            <button className="kb-subnote__btn kb-subnote__btn--danger" onClick={() => handleDeleteNote(n.id)}>xóa</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add new note box */}
                <div style={{ border: '1px dashed var(--kb-line)', borderRadius: '3px', padding: '11px 14px' }}>
                  <textarea
                    ref={noteInputRef}
                    className="kb-subnote-form__textarea"
                    placeholder="Rút ra gì không? Điều đáng nhớ nhất, áp dụng ở đâu… (⌘↵ để lưu)"
                    aria-label="Ghi chú của bạn về bài này"
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleAddNote();
                      }
                    }}
                    rows={2}
                  />
                  {newNote.trim() && (
                    <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                      <button className="kb-btn-primary" onClick={handleAddNote}>
                        Lưu ghi chú
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </article>

        {/* Right Rail Sidebar */}
        {!focusMode && (
          <aside className="kb-reader__rail">
            {/* 1. Article Metadata & Stats Card */}
            <div className="kb-rail-card">
              <div className="kb-rail-card__header">
                <span className="kb-rail-card__title">Thông tin bài viết</span>
                <span className="kb-badge kb-badge--tag" style={{ color: topicColor }}>
                  {kind.label}
                </span>
              </div>
              <div className="kb-rail-info-grid">
                <div className="kb-rail-info-item">
                  <span className="kb-rail-info-label">Độ dài</span>
                  <span className="kb-rail-info-value">{wordsCount} từ ({mins} phút)</span>
                </div>
                <div className="kb-rail-info-item">
                  <span className="kb-rail-info-label">Ngày tạo</span>
                  <span className="kb-rail-info-value">{formatDate(article.created_at)}</span>
                </div>
                {article.url && (
                  <div className="kb-rail-info-item" style={{ gridColumn: 'span 2' }}>
                    <span className="kb-rail-info-label">Nguồn</span>
                    <a
                      href={stripMediaTag(article.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="kb-rail-info-value"
                      style={{ color: 'var(--kb-brass)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {stripMediaTag(article.url)} ↗
                    </a>
                  </div>
                )}
              </div>

              {/* Tiến độ 5 bước */}
              <ol className="kb-progress" aria-label="Tiến độ">
                {PROGRESS_STEPS.map((s, i) => (
                  <li
                    key={s.key}
                    className={`kb-progress__step${i < progressIdx ? ' kb-progress__step--done' : ''}${i === progressIdx ? ' kb-progress__step--current' : ''}`}
                    aria-current={i === progressIdx ? 'step' : undefined}
                  >
                    <span className="kb-progress__dot" />
                    <span className="kb-progress__label">{s.label}</span>
                    <span className="kb-progress__hint">{s.hint}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* 1b. Xung quanh */}
            <div className="kb-rail-card">
              <div className="kb-rail-card__header">
                <span className="kb-rail-card__title">Xung quanh</span>
              </div>
              <div className="kb-around">
                <AroundGroup title="Cùng chủ đề" items={around.sameTopic} onOpen={onOpenArticle} />
                <AroundGroup title="Cùng nguồn" items={around.sameSource} onOpen={onOpenArticle} />
                {around.nearTime.length > 0 && (around.sameTopic.length > 0 || around.sameSource.length > 0) && (
                  <hr className="kb-around__sep" />
                )}
                <AroundGroup title="Lưu gần thời điểm" note="có thể khác chủ đề" items={around.nearTime} onOpen={onOpenArticle} />
                {around.sameTopic.length + around.sameSource.length + around.nearTime.length === 0 && (
                  <div className="kb-around__empty">Chưa có bài nào ở gần.</div>
                )}
              </div>
            </div>

            {/* 2. Neighborhood Mini-Graph Card */}
            <div className="kb-rail-card">
              <div className="kb-rail-card__header">
                <span className="kb-rail-card__title">Lân cận</span>
                <span
                  onClick={onOpenGraph}
                  style={{ fontFamily: 'var(--kb-mono)', fontSize: '0.78rem', fontWeight: 600, color: 'var(--kb-brass)', cursor: 'pointer' }}
                >
                  toàn cảnh ↗
                </span>
              </div>
              <div style={{ padding: '6px' }}>
                <canvas ref={miniCanvasRef} style={{ display: 'block', width: '100%', height: '208px', cursor: 'pointer' }} />
              </div>
            </div>

            {/* 3. Table of Contents Card */}
            {headings.length > 1 && (
              <div className="kb-rail-card">
                <div className="kb-rail-card__header">
                  <span className="kb-rail-card__title">Mục lục</span>
                  <span className="kb-rail-card__count">{headings.length} mục</span>
                </div>
                <nav className="kb-toc" style={{ padding: '8px 10px' }}>
                  {headings.map((h, i) => (
                    <a
                      key={i}
                      href={`#${h.id}`}
                      className={`kb-toc__item${h.level === 3 ? ' kb-toc__item--h3' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        const el = document.getElementById(h.id);
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}

            {/* 4. Outbound Links Card */}
            <div className="kb-rail-card">
              <div className="kb-rail-card__header">
                <span className="kb-rail-card__title">Trỏ tới</span>
                <span className="kb-rail-card__count">{outboundLinks.length}</span>
              </div>
              <div style={{ padding: '8px 10px' }}>
                {outboundLinks.length === 0 ? (
                  <div style={{ fontSize: '0.88rem', color: 'var(--kb-faint)' }}>Chưa trỏ tới bài nào.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {outboundLinks.map(target => {
                      return (
                        <div
                          key={target.id}
                          onClick={() => onOpenArticle(target)}
                          className="kb-rail-link-row"
                        >
                          <span className="kb-badge__dot" style={{ background: target._topic?.color || 'var(--kb-faint)' }} />
                          <span className="kb-rail-link-title">{target.title}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 5. Inbound Backlinks Card */}
            <div className="kb-rail-card">
              <div className="kb-rail-card__header">
                <span className="kb-rail-card__title">Được trỏ về</span>
                <span className="kb-rail-card__count">{backlinks.length}</span>
              </div>
              <div style={{ padding: '8px 10px' }}>
                {backlinks.length === 0 ? (
                  <div style={{ fontSize: '0.88rem', color: 'var(--kb-faint)', lineHeight: 1.5 }}>
                    Chưa bài nào trỏ về. Gõ <code style={{ color: 'var(--kb-brass)' }}>[[{article.title}]]</code> ở bài khác để nối.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {backlinks.map(b => (
                      <div
                        key={b.article.id}
                        onClick={() => onOpenArticle(b.article)}
                        className="kb-rail-backlink-card"
                      >
                        <div style={{ fontSize: '0.92rem', color: 'var(--kb-tx)', fontWeight: 500 }}>{b.article.title}</div>
                        {b.context && (
                          <div className="kb-backlink-ctx" style={{ marginTop: '4px' }}>
                            "{b.context}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 6. Connected Tasks Card */}
            <div className="kb-rail-card">
              <div className="kb-rail-card__header">
                <span className="kb-rail-card__title">Nhiệm vụ liên kết</span>
                <span className="kb-rail-card__count">{tasks.length + doneTaskCount}</span>
              </div>
              <div style={{ padding: '8px 10px' }}>
                {tasks.length === 0 && doneTaskCount === 0 ? (
                  <div style={{ fontSize: '0.88rem', color: 'var(--kb-faint)', lineHeight: 1.5 }}>
                    Chưa có task nào. Bấm <strong>"◇ Thực hành"</strong> ở thanh trên để tạo.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {tasks.map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem' }}>
                        <span style={{ color: 'var(--kb-brass)' }}>◇</span>
                        <span style={{ color: 'var(--kb-dim)' }}>{t.title}</span>
                      </div>
                    ))}
                    {doneTaskCount > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: 'var(--kb-sage)' }}>
                        <span>✓</span>
                        <span>{doneTaskCount} task đã xong</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
