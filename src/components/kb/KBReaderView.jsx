import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  KIND_META,
  contentKind,
  findNeighbors,
  readTime,
  isTiptapBody,
  extractHeadings,
  slugifyVi,
  getOutboundLinks,
  findBacklinks,
  safeHostname,
} from '../../utils/kbDeriveUtils';
import { formatDate, formatDateTime } from '../../utils/dateUtils';
import AppIcon from '../AppIcon';
import { KBTopicSelect } from './KBTopicPicker';
import MediaPreview from '../MediaPreview';
import { stripMediaTag } from '../../utils/mediaUtils';

const TiptapReadOnly = lazy(() => import('../TiptapEditor').then(m => ({ default: m.TiptapReadOnly })));

const REMARK_PLUGINS = [remarkGfm];

function RailSection({ title, count, action, children }) {
  return (
    <section className="kb-rail-sec">
      <header className="kb-rail-sec__head">
        <h3 className="kb-rail-sec__title">{title}{count !== undefined && <span className="kb-rail-sec__count"> · {count}</span>}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function RailRow({ article, meta, onOpen }) {
  return (
    <button className="kb-rail-row" onClick={() => onOpen(article)}>
      <span className="kb-dot" style={article._topic ? { '--kb-topic': article._topic.color } : undefined} />
      <span className="kb-rail-row__title">{article.title}</span>
      {meta && <span className="kb-rail-row__meta">{meta}</span>}
    </button>
  );
}

export default function KBReaderView({
  article,
  allArticles,
  topics,
  onBack,
  onPrev,
  onNext,
  onEdit,
  onDelete,
  onAssignTopic,
  onNotesChange,
  notesHook,
  onOpenArticle,
  onOpenGraph,
  onOpenLinkModal,
  onUpdateUrl,
}) {
  const [focusMode, setFocusMode] = useState(false);
  const [readProg, setReadProg] = useState(0);
  const miniCanvasRef = useRef(null);
  const topicSelectRef = useRef(null);

  // Sub-notes state
  const { notes, isLoading: isNotesLoading, fetchNotes, addNote, updateNote, deleteNote } = notesHook;
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteContent, setEditNoteContent] = useState('');

  useEffect(() => {
    if (article?.id) fetchNotes(article.id);
  }, [article?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // F — chế độ đọc tập trung (ẩn cột phải)
  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      if (e.key.toLowerCase() !== 'f' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable) return;
      if (document.querySelector('.kb-overlay')) return;
      setFocusMode(v => !v);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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

  // Tasks associated with this collection
  const tasks = article._linkedTasks || [];

  // "+ Gán chủ đề" mở luôn ô chọn chủ đề trên thanh trên: click vào ô gõ của SearchSelect
  // nổi lên khung điều khiển, khung mở menu và focus ô gõ
  const openTopicPicker = () => topicSelectRef.current?.click();

  // Mini graph for rail (always renders a lively local cluster)
  useEffect(() => {
    const canvas = miniCanvasRef.current;
    if (!canvas || focusMode) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || 286;
    const H = 150;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Màu theo token của trang (đổi theo nền sáng / tối)
    const css = getComputedStyle(canvas);
    const color = name => css.getPropertyValue(name).trim();
    const accent = color('--kb-accent');
    const line = color('--kb-line');
    const tx = color('--kb-tx');
    const dim = color('--kb-dim');
    const font = color('--kb-font');

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
      return {
        ...n,
        x: cx + W * 0.36 * Math.cos(angle),
        y: cy + H * 0.36 * Math.sin(angle),
        isCurrent: false,
      };
    });

    ctx.clearRect(0, 0, W, H);

    // Draw lines to center
    const centerNode = simNodes.find(n => n.isCurrent) || simNodes[0];
    simNodes.forEach(n => {
      if (n.isCurrent) return;
      const isDirect = outboundLinks.some(o => o.id === n.id) || backlinks.some(b => b.article.id === n.id);
      ctx.beginPath();
      ctx.moveTo(centerNode.x, centerNode.y);
      ctx.lineTo(n.x, n.y);
      ctx.strokeStyle = isDirect ? accent : line;
      ctx.globalAlpha = isDirect ? 0.55 : 1;
      ctx.lineWidth = 1;
      ctx.setLineDash(isDirect ? [] : [3, 4]);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Draw stars
    simNodes.forEach(n => {
      ctx.shadowBlur = n.isCurrent ? 14 : 6;
      ctx.shadowColor = n.isCurrent ? accent : (n._topic?.color || tx);
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.isCurrent ? 6 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = n.isCurrent ? accent : (n._topic?.color || tx);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (n.isCurrent) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.35;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.font = `500 11px ${font}`;
      ctx.fillStyle = n.isCurrent ? tx : dim;
      ctx.textAlign = 'center';
      const label = n.title.length > 16 ? n.title.slice(0, 14) + '…' : n.title;
      ctx.fillText(label, n.x, n.y + 18);
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

  const aroundCount = around.sameTopic.length + around.sameSource.length + around.nearTime.length;

  return (
    <div className={`kb-reader${focusMode ? ' kb-reader--focus' : ''}`} style={{ animation: 'kb-up .25s ease' }}>
      {/* Thanh trên: quay lại · vị trí · ↑↓ · chủ đề · 4 nút */}
      {/* Thanh trong suốt, hai cụm nổi — trời và trăng vẫn hiện phía sau */}
      <div className="kb-reader__bar">
        <div className="kb-reader__group">
          <button className="kb-reader__back" onClick={onBack} title="Quay lại (Esc)" aria-label="Quay lại Kiến thức">
            <AppIcon name="back" size={16} />
            <span>Kiến thức</span>
          </button>
          <span className="kb-reader__divider" />
          <button className="kb-icon-btn" onClick={onPrev || undefined} disabled={!onPrev} title="Bài trước (K)" aria-label="Bài trước">
            <AppIcon name="caretUp" size={16} />
          </button>
          <button className="kb-icon-btn" onClick={onNext || undefined} disabled={!onNext} title="Bài sau (J)" aria-label="Bài sau">
            <AppIcon name="caretDown" size={16} />
          </button>
        </div>

        <div className="kb-reader__group">
          {/* Chủ đề: đổi một chạm. 'none' = Chưa xếp (SearchSelect coi '' là chưa chọn) */}
          <KBTopicSelect
            options={[
              ...topics.map(t => ({ value: t.id, label: t.name, color: t.color })),
              { value: 'none', label: 'Chưa xếp', color: 'var(--kb-gold)' },
            ]}
            value={article.topic_id || 'none'}
            onChange={v => onAssignTopic(v === 'none' ? null : v)}
            empty={!topic}
            ariaLabel="Chủ đề của bài"
            inputRef={topicSelectRef}
          />
          <span className="kb-reader__divider" />

          <button className="kb-icon-btn" onClick={onOpenLinkModal} title="Liên kết bài viết" aria-label="Liên kết bài viết">
            <AppIcon name="linkSimple" size={17} />
          </button>
          <button
            className={`kb-icon-btn kb-reader__focus${focusMode ? ' is-on' : ''}`}
            onClick={() => setFocusMode(v => !v)}
            title={focusMode ? 'Hiện cột phải (F)' : 'Đọc tập trung (F)'}
            aria-pressed={focusMode}
          >
            <AppIcon name="arrowsOutSimple" size={17} />
          </button>
          <button className="kb-icon-btn" onClick={onEdit} title="Sửa (E)" aria-label="Sửa">
            <AppIcon name="pencil" size={17} />
          </button>
          <button className="kb-icon-btn kb-icon-btn--danger" onClick={onDelete} title="Xoá bài" aria-label="Xoá bài">
            <AppIcon name="trash" size={17} />
          </button>
        </div>
      </div>

      {/* Reading progress line */}
      <div className="kb-reader__progress">
        <div className="kb-reader__progress-fill" style={{ transform: `scaleX(${readProg})` }} />
      </div>

      <div className="kb-reader__layout">
        <div className="kb-reader__main" onScroll={handleScroll}>
          <article className="kb-reader__article">
            <div className="kb-reader__hero-meta">
              <span>{kind.label}</span>
              {article.url && <span>{safeHostname(stripMediaTag(article.url))}</span>}
              <span>{formatDate(article.created_at)}</span>
              <span>{mins} phút đọc</span>
            </div>

            <h1 className="kb-reader__h1">{article.title}</h1>

            {(!topic || (article._tags || []).length > 0) && (
              <div className="kb-reader__tags">
                {!topic && topics.length > 0 && (
                  <button className="kb-reader__assign" onClick={openTopicPicker}>+ Gán chủ đề</button>
                )}
                {(article._tags || []).map(t => {
                  const name = typeof t === 'string' ? t : t.name;
                  return <span key={name} className="kb-tag-chip">#{name}</span>;
                })}
              </div>
            )}

            {/* Media preview block if url exists */}
            {article.url && (
              <div className="kb-reader__media">
                <MediaPreview url={article.url} type={article.type} onToggleFormat={onUpdateUrl} />
              </div>
            )}

            {/* Body */}
            <div className="kb-prose kb-reader__body">
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
                <h2 className="kb-subnotes__title">Ghi chú của bạn</h2>
                <span className="kb-subnotes__count">{notes.length}</span>
              </div>

              {isNotesLoading && <div className="kb-loading">Đang tải ghi chú...</div>}

              <div className="kb-subnotes__list">
                {notes.map(n => (
                  <div key={n.id} className="kb-subnote">
                    {editingNoteId === n.id ? (
                      <div>
                        <textarea
                          className="kb-subnote-form__textarea is-editing"
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
                          <button className="kb-btn-ghost kb-btn-ghost--small" onClick={() => setEditingNoteId(null)}>Huỷ</button>
                          <button className="kb-btn-primary kb-btn-primary--small" onClick={() => handleSaveNoteEdit(n.id)}>Lưu</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="kb-subnote__content">{n.content}</div>
                        <div className="kb-subnote__footer">
                          <span className="kb-subnote__date">{formatDateTime(n.created_at)}</span>
                          <div className="kb-subnote__actions">
                            <button className="kb-subnote__btn" onClick={() => { setEditingNoteId(n.id); setEditNoteContent(n.content); }}>Sửa</button>
                            <button className="kb-subnote__btn kb-subnote__btn--danger" onClick={() => handleDeleteNote(n.id)}>Xoá</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add new note box */}
                <div className="kb-subnote-new">
                  <textarea
                    className="kb-subnote-form__textarea"
                    placeholder="Ghi lại một ý khi đọc… (⌘↵ để lưu)"
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
                    <div className="kb-subnote-form__actions">
                      <button className="kb-btn-primary kb-btn-primary--small" onClick={handleAddNote}>Lưu ghi chú</button>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </article>
        </div>

        {/* Cột phải */}
        {!focusMode && (
          <aside className="kb-reader__rail">
            <div className="kb-rail-info">
              <div><span className="kb-rail-info__label">Độ dài</span><span className="kb-rail-info__value">{wordsCount} từ · {mins} phút</span></div>
              <div><span className="kb-rail-info__label">Ngày tạo</span><span className="kb-rail-info__value">{formatDate(article.created_at)}</span></div>
              {article.url && (
                <div className="kb-rail-info__wide">
                  <span className="kb-rail-info__label">Nguồn</span>
                  <a className="kb-rail-info__value kb-rail-info__link" href={stripMediaTag(article.url)} target="_blank" rel="noopener noreferrer">
                    {stripMediaTag(article.url)} ↗
                  </a>
                </div>
              )}
            </div>

            <RailSection title="Lân cận" action={<button className="kb-link" onClick={onOpenGraph}>Mở bầu trời ↗</button>}>
              <canvas ref={miniCanvasRef} className="kb-rail-sky" />
            </RailSection>

            <RailSection title="Xung quanh">
              {aroundCount === 0 ? (
                <p className="kb-rail-empty">Chưa có bài nào ở gần.</p>
              ) : (
                <div className="kb-rail-list">
                  {around.sameTopic.map(a => <RailRow key={a.id} article={a} meta="cùng chủ đề" onOpen={onOpenArticle} />)}
                  {around.sameSource.map(a => <RailRow key={a.id} article={a} meta="cùng nguồn" onOpen={onOpenArticle} />)}
                  {around.nearTime.map(a => <RailRow key={a.id} article={a} meta="cất cùng lúc" onOpen={onOpenArticle} />)}
                </div>
              )}
            </RailSection>

            {headings.length > 1 && (
              <RailSection title="Mục lục" count={headings.length}>
                <nav className="kb-toc">
                  {headings.map((h, i) => (
                    <a
                      key={i}
                      href={`#${h.id}`}
                      className={`kb-toc__item${h.level === 3 ? ' kb-toc__item--h3' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      {h.text}
                    </a>
                  ))}
                </nav>
              </RailSection>
            )}

            <RailSection title="Trỏ tới" count={outboundLinks.length}>
              {outboundLinks.length === 0 ? (
                <p className="kb-rail-empty">Chưa trỏ tới bài nào.</p>
              ) : (
                <div className="kb-rail-list">
                  {outboundLinks.map(target => <RailRow key={target.id} article={target} onOpen={onOpenArticle} />)}
                </div>
              )}
            </RailSection>

            <RailSection title="Được trỏ về" count={backlinks.length}>
              {backlinks.length === 0 ? (
                <p className="kb-rail-empty">
                  Chưa bài nào trỏ về. Gõ <code>[[{article.title}]]</code> ở bài khác để nối.
                </p>
              ) : (
                <div className="kb-rail-list">
                  {backlinks.map(b => (
                    <button key={b.article.id} className="kb-rail-backlink" onClick={() => onOpenArticle(b.article)}>
                      <span className="kb-rail-backlink__title">{b.article.title}</span>
                      {b.context && <span className="kb-backlink-ctx">“{b.context}”</span>}
                    </button>
                  ))}
                </div>
              )}
            </RailSection>

            <RailSection title="Nhiệm vụ liên kết" count={tasks.length}>
              {tasks.length === 0 ? (
                <p className="kb-rail-empty">Chưa có task nào. Nối bài với task từ trang Nhiệm vụ (Liên kết bài viết).</p>
              ) : (
                <div className="kb-rail-list">
                  {tasks.map(t => (
                    <div key={t.id} className="kb-rail-task">
                      <span className="kb-rail-task__mark">◇</span>
                      <span>{t.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </RailSection>
          </aside>
        )}
      </div>
    </div>
  );
}
