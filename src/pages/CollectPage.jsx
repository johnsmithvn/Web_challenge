import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useCollections } from '../hooks/useCollections';
import { useCollectionTopics } from '../hooks/useCollectionTopics';
import { useUserTasks } from '../hooks/useUserTasks';
import { useTags } from '../hooks/useTags';
import { useCollectionNotes } from '../hooks/useCollectionNotes';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import SkeletonList from '../components/SkeletonList';
import { useToast } from '../contexts/ToastContext';
import SkyBackground from '../components/SkyBackground';
import { useIsMobile } from '../hooks/useIsMobile';
import '../styles/collect.css';

// Sub-components
import KBSidebar from '../components/kb/KBSidebar';
import KBListView from '../components/kb/KBListView';
import KBGalleryView from '../components/kb/KBGalleryView';
import KBGraphView from '../components/kb/KBGraphView';
import KBCanvasView from '../components/kb/KBCanvasView';
import KBReaderView from '../components/kb/KBReaderView';
import KBEditorView from '../components/kb/KBEditorView';
import KBShortcutsModal from '../components/kb/KBShortcutsModal';
import KBLinkModal from '../components/kb/KBLinkModal';
import KBTagModal from '../components/kb/KBTagModal';
import KBTopicModal from '../components/kb/KBTopicModal';
import KBOverview from '../components/kb/KBOverview';

import { filterArticles, pushRecent, deriveGraph, groupArticles } from '../utils/kbDeriveUtils';

// "Mở gần đây" — per-device convenience, so localStorage (RULES §4: new keys use vl_).
const RECENT_KEY = 'vl_kb_recent';
const readRecent = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
};

// Views Esc / "← Thư viện" can return to.
const LIBRARY_VIEWS = ['overview', 'list', 'gallery', 'graph', 'canvas'];

const MINE_HEADING = { kind: 'mine', name: 'Ghi chú của tôi', description: 'Ghi chú, trích dẫn của bạn và những bài bạn có ghi chú.' };
const UNSORTED_HEADING = { kind: 'none', name: 'Chưa xếp', description: 'Bài chưa vào chủ đề nào. Xếp nhanh từng bài ở Tổng quan, hoặc bấm Chọn để gán nhiều bài một lần.' };
const ALL_HEADING = { kind: 'all', name: 'Tất cả bài' };

export default function CollectPage() {
  const { user } = useAuth();
  const { items, isLoading, fetchItems, addItem, updateItem, updateItems, deleteItem } = useCollections();
  const {
    topics, addTopic, updateTopic, reorderTopics, deleteTopic, mergeTopics, seedStarterTopics,
  } = useCollectionTopics();
  const { pendingTasks } = useUserTasks();
  const { tags: centralTags, addTag: addCentralTag, linkTag, unlinkTag, deleteTag: deleteCentralTag } = useTags();
  const notesHook = useCollectionNotes();
  const { confirm, ConfirmModal } = useConfirm();
  const { showToast } = useToast();

  // Navigation & View state
  const [view, setView] = useState('overview'); // LIBRARY_VIEWS | 'reader' | 'editor'
  // Only the id is kept; the bài itself always comes from live data (see selectedArticle below),
  // so topic / status / notes / link changes show in the reader without manual syncing.
  const [selectedId, setSelectedId] = useState(null);
  const [cursor, setCursor] = useState(0);
  const returnViewRef = useRef('overview');
  const [recentIds, setRecentIds] = useState(readRecent);

  // Filters
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState(''); // '' all · 'none' Chưa xếp · topic id
  const [mineOnly, setMineOnly] = useState(false); // "Ghi chú của tôi", opened from Tổng quan
  const [activeTagIds, setActiveTagIds] = useState([]);
  const [sort, setSort] = useState('new');
  const [filterTaskId, setFilterTaskId] = useState('');
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [groupBy, setGroupBy] = useState('month'); // month | topic | none

  const isMobile = useIsMobile();

  // Điện thoại: KB có hàng trên + tab đáy riêng → ẩn thanh Life Hub + tab đáy chung (như Finance).
  // Chưa đăng nhập thì giữ thanh chung để còn nút đăng nhập.
  useEffect(() => {
    if (!user) return undefined;
    document.body.classList.add('in-knowledge-workspace');
    return () => document.body.classList.remove('in-knowledge-workspace');
  }, [user]);

  // Bulk mode
  const [bulk, setBulk] = useState(false);
  const [picked, setPicked] = useState([]);

  // Modals & Overlays
  const [keysOpen, setKeysOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [topicsOpen, setTopicsOpen] = useState(false);

  // Undo trash buffer
  const [trash, setTrash] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // G-key sequence for navigation
  const gSeqRef = useRef('');
  const gTimeoutRef = useRef(null);

  // Initial fetch
  useEffect(() => {
    if (user) fetchItems({});
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tags used by Knowledge bài only — the filter row must not show Finance/Tasks tags.
  // Central tags give the current name/colour; the tag manager still works on all tags.
  const kbTags = useMemo(() => {
    const central = new Map(centralTags.map(t => [t.id, t]));
    const used = new Map();
    items.forEach(i => (i._tags || []).forEach(t => { if (t?.id) used.set(t.id, central.get(t.id) || t); }));
    return [...used.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, centralTags]);

  const topicById = useMemo(() => new Map(topics.map(t => [t.id, t])), [topics]);

  // Attach topic + open linked tasks to items for display
  const articlesWithTasks = useMemo(() => items.map(item => ({
    ...item,
    _topic: topicById.get(item.topic_id) || null,
    _linkedTasks: pendingTasks.filter(t => (item._linkedTaskIds || []).includes(t.id)),
  })), [items, pendingTasks, topicById]);

  const selectedArticle = useMemo(
    () => (selectedId ? articlesWithTasks.find(a => a.id === selectedId) || null : null),
    [articlesWithTasks, selectedId],
  );

  // Bài per topic for the chip row and the topic manager
  const topicCounts = useMemo(() => {
    const counts = { all: 0, none: 0 };
    items.forEach(i => {
      if (i.type === 'inbox' || i.status === 'archived') return;
      counts.all += 1;
      const key = i.topic_id || 'none';
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [items]);

  // [[wiki]] links across the whole kho: the "N liên kết" count and the "Có liên kết" filter
  const wikiEdges = useMemo(() => deriveGraph(items, { inferTagLinks: false }).edges, [items]);
  const linkedIds = useMemo(() => new Set(wikiEdges.flatMap(e => [e.from, e.to])), [wikiEdges]);

  // Grouped for the list; the flat order (J/K, ↑↓ in the reader, Gallery) follows the groups
  const groups = useMemo(() => groupArticles(filterArticles(articlesWithTasks, {
    q: search,
    tags: activeTagIds,
    sort,
    taskId: filterTaskId,
    topic: topicFilter,
    mine: mineOnly,
    linked: linkedOnly ? linkedIds : null,
  }), groupBy, { topics }), [
    articlesWithTasks, search, activeTagIds, sort, filterTaskId, topicFilter, mineOnly, linkedOnly, linkedIds, groupBy, topics,
  ]);
  const filteredArticles = useMemo(() => groups.flatMap(g => g.items), [groups]);

  const mineCount = useMemo(() => filterArticles(articlesWithTasks, { mine: true }).length, [articlesWithTasks]);

  // Hàng thẻ đầu danh sách đếm trong phạm vi (chủ đề / Ghi chú của tôi), không theo bộ lọc —
  // lọc thì hàng thẻ vẫn đứng yên, không làm cả danh sách nhảy
  const scopeTagCounts = useMemo(() => {
    const counts = {};
    filterArticles(articlesWithTasks, { topic: topicFilter, mine: mineOnly })
      .forEach(a => (a._tags || []).forEach(t => { counts[t.id] = (counts[t.id] || 0) + 1; }));
    return counts;
  }, [articlesWithTasks, topicFilter, mineOnly]);

  // Sơ đồ / Canvas: chỉ lọc theo chủ đề
  const topicArticles = useMemo(
    () => filterArticles(articlesWithTasks, { topic: topicFilter }),
    [articlesWithTasks, topicFilter],
  );

  // Filters inside the list ("Xoá lọc"); the topic / "Ghi chú của tôi" scope is the sidebar's
  const listFiltering = !!(search || linkedOnly || activeTagIds.length > 0 || filterTaskId);
  const hasFilter = listFiltering || !!(topicFilter || mineOnly);

  const clearListFilters = useCallback(() => {
    setSearch('');
    setLinkedOnly(false);
    setActiveTagIds([]);
    setFilterTaskId('');
    setCursor(0);
  }, []);

  const clearFilters = useCallback(() => {
    clearListFilters();
    setTopicFilter('');
    setMineOnly(false);
  }, [clearListFilters]);

  // Heading above the list: topic page, Chưa xếp, Ghi chú của tôi, or Tất cả bài
  const currentTopic = topicById.get(topicFilter) || null;
  const listHeading = currentTopic
    ? { kind: 'topic', name: currentTopic.name, description: currentTopic.description, color: currentTopic.color, count: topicCounts[currentTopic.id] || 0 }
    : topicFilter === 'none' ? { ...UNSORTED_HEADING, count: topicCounts.none }
      : mineOnly ? { ...MINE_HEADING, count: mineCount }
        : { ...ALL_HEADING, count: topicCounts.all };

  // "Xếp nhanh" lives in Tổng quan, which shows every bài
  const goQuickSort = useCallback(() => {
    setTopicFilter('');
    setMineOnly(false);
    setView('overview');
  }, []);

  // Chip row / Tổng quan → list filtered to one topic (a chip replaces "Ghi chú của tôi")
  const chooseTopic = useCallback((topicId) => {
    setTopicFilter(topicId);
    setMineOnly(false);
    setCursor(0);
    if (view === 'overview') setView('list');
  }, [view]);

  const openMine = useCallback(() => {
    setMineOnly(true);
    setTopicFilter('');
    setCursor(0);
    setView('list');
  }, []);

  // Tag filter toggle
  const toggleTag = useCallback((tagId) => {
    setActiveTagIds(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
    setCursor(0);
  }, []);

  // Bulk handlers
  const togglePick = useCallback((id) => {
    setPicked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  const selectAll = useCallback(() => {
    setPicked(filteredArticles.map(a => a.id));
  }, [filteredArticles]);

  const deselectAll = useCallback(() => {
    setPicked([]);
  }, []);

  const handleBulkDelete = useCallback(async () => {
    if (picked.length === 0) return;
    const ok = await confirm({
      title: `Xóa ${picked.length} bài viết?`,
      message: 'Hành động này không thể hoàn tác.',
      confirmLabel: 'Xóa tất cả',
      danger: true,
    });
    if (!ok) return;

    for (const id of picked) {
      await deleteItem(id);
    }
    showToast(`Đã xóa ${picked.length} bài viết.`);
    setPicked([]);
    setBulk(false);
    fetchItems({});
  }, [picked, confirm, deleteItem, showToast, fetchItems]);

  const handleBulkAssign = useCallback(async (topicId) => {
    if (picked.length === 0) return;
    if (!(await updateItems(picked, { topic_id: topicId }))) {
      showToast('Không gán được chủ đề. Thử lại.');
      return;
    }
    showToast(`Đã chuyển ${picked.length} bài vào ${topicId ? topicById.get(topicId)?.name : 'Chưa xếp'}`);
    setPicked([]);
    setBulk(false);
  }, [picked, updateItems, topicById, showToast]);

  // Topic manager: confirm the destructive ones, then reload bài (their topic_id changed in the DB)
  const handleDeleteTopic = useCallback(async (topic) => {
    const n = topicCounts[topic.id] || 0;
    const ok = await confirm({
      title: `Xóa chủ đề "${topic.name}"?`,
      message: n ? `${n} bài trong chủ đề này sẽ về Chưa xếp. Bài không bị xóa.` : 'Chủ đề đang trống.',
      confirmLabel: 'Xóa chủ đề',
      danger: true,
    });
    if (!ok) return;
    if (!(await deleteTopic(topic.id))) {
      showToast('Không xóa được chủ đề. Thử lại.');
      return;
    }
    if (topicFilter === topic.id) setTopicFilter('');
    fetchItems({});
  }, [topicCounts, confirm, deleteTopic, showToast, topicFilter, fetchItems]);

  const handleMergeTopic = useCallback(async (from, to) => {
    const n = topicCounts[from.id] || 0;
    const ok = await confirm({
      title: `Gộp "${from.name}" vào "${to.name}"?`,
      message: `${n} bài sẽ chuyển sang ${to.name}, rồi chủ đề ${from.name} bị xóa.`,
      confirmLabel: 'Gộp',
    });
    if (!ok) return;
    if (!(await mergeTopics(from.id, to.id))) {
      showToast('Không gộp được chủ đề. Thử lại.');
      return;
    }
    if (topicFilter === from.id) setTopicFilter(to.id);
    showToast(`Đã gộp vào ${to.name}`);
    fetchItems({});
  }, [topicCounts, confirm, mergeTopics, showToast, topicFilter, fetchItems]);

  // Navigation handlers — reader/editor remember which library view to go back to
  const rememberReturn = useCallback(() => {
    if (LIBRARY_VIEWS.includes(view)) returnViewRef.current = view;
  }, [view]);

  const openReader = useCallback((article) => {
    const idx = filteredArticles.findIndex(a => a.id === article.id);
    if (idx >= 0) setCursor(idx);
    rememberReturn();
    setSelectedId(article.id);
    setView('reader');

    const next = pushRecent(recentIds, article.id);
    setRecentIds(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage off: list lives in memory */ }
  }, [filteredArticles, rememberReturn, recentIds]);

  const openEditor = useCallback((article = null) => {
    rememberReturn();
    setSelectedId(article?.id ?? null);
    setView('editor');
  }, [rememberReturn]);

  const goLibrary = useCallback(() => {
    setView(returnViewRef.current);
    setSelectedId(null);
  }, []);

  // Delete article with undo trash buffer
  const handleDeleteArticle = useCallback(async (article) => {
    const ok = await confirm({
      title: `Xóa "${article.title}"?`,
      message: 'Bài viết sẽ được đưa vào bộ đệm hoàn tác (⌘Z).',
      confirmLabel: 'Xóa',
      danger: true,
    });
    if (!ok) return;

    const success = await deleteItem(article.id);
    if (success) {
      setTrash(article);
      showToast(`Đã xóa "${article.title}"`, {
        actionLabel: 'Hoàn tác (⌘Z)',
        onAction: async () => {
          await addItem(article);
          setTrash(null);
          showToast(`Đã hoàn tác khôi phục "${article.title}"`);
          fetchItems({});
        },
      });
      if (view === 'reader') goLibrary();
    }
  }, [confirm, deleteItem, addItem, showToast, view, goLibrary, fetchItems]);

  // Undo delete
  const handleUndo = useCallback(async () => {
    if (!trash) return;
    await addItem(trash);
    showToast(`Đã hoàn tác khôi phục "${trash.title}"`);
    setTrash(null);
    fetchItems({});
  }, [trash, addItem, showToast, fetchItems]);

  const handleAssignTopic = useCallback((article, topicId) => updateItem(article.id, { topic_id: topicId }), [updateItem]);

  // Save Article
  const handleSaveArticle = useCallback(async (draft) => {
    setIsSaving(true);
    try {
      const payload = {
        title:          draft.title,
        body:           draft.body,
        body_text:      draft.body_text || '',
        word_count:     draft.word_count || 0,
        content_format: draft.content_format || 'markdown',
        type:           draft.type,
        topic_id:       draft.topic_id || null,
        url:            draft.url || null,
      };

      let savedId;
      if (selectedArticle?.id) {
        if (await updateItem(selectedArticle.id, payload)) savedId = selectedArticle.id;
      } else {
        const created = await addItem({ ...payload, status: 'read' });
        savedId = created?.id;
      }
      if (!savedId) {
        showToast('Không lưu được bài. Thử lại.');
        return;
      }

      // Sync tags via junction table
      if (draft.tags) {
        const draftTagNames = draft.tags.map(t => typeof t === 'string' ? t : t.name);
        const existingTags = selectedArticle?._tags || [];
        const existingNames = existingTags.map(t => t.name);

        // Tags to add
        for (const t of draft.tags) {
          const name = typeof t === 'string' ? t : t.name;
          if (!existingNames.includes(name)) {
            const tagObj = await addCentralTag(name, typeof t === 'string' ? '#8b5cf6' : (t.color || '#8b5cf6'));
            if (tagObj) await linkTag(savedId, tagObj.id, 'collection');
          }
        }

        // Tags to remove
        for (const t of existingTags) {
          if (!draftTagNames.includes(t.name)) {
            await unlinkTag(savedId, t.id, 'collection');
          }
        }
      }

      await fetchItems({});
      showToast(`Đã lưu "${draft.title}"`);

      // Open reader of the saved article
      setSelectedId(savedId);
      setView('reader');
    } finally {
      setIsSaving(false);
    }
  }, [selectedArticle, updateItem, addItem, addCentralTag, linkTag, unlinkTag, fetchItems, showToast]);

  // Toggle wiki link in article
  const handleToggleWikiLink = useCallback(async (targetArticle) => {
    if (!selectedArticle) return;
    const marker = `[[${targetArticle.title}]]`;
    const body = selectedArticle.body || '';
    let newBody;
    if (body.includes(marker)) {
      newBody = body.replace(new RegExp(`\\s*\\[\\[${targetArticle.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`, 'g'), '');
      showToast(`Đã gỡ liên kết tới "${targetArticle.title}"`);
    } else {
      newBody = body.trimEnd() + `\n\nLiên quan: ${marker}`;
      showToast(`Đã nối tới "${targetArticle.title}"`);
    }
    await updateItem(selectedArticle.id, { body: newBody });
  }, [selectedArticle, updateItem, showToast]);

  // Keyboard Shortcuts Handler (Global)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      // ⌘Z — Undo delete (not while typing: there ⌘Z undoes text)
      if (mod && e.key.toLowerCase() === 'z' && trash && !isTyping) {
        e.preventDefault();
        handleUndo();
        return;
      }

      const modalOpen = keysOpen || linkOpen || tagsOpen || topicsOpen;

      // Escape key priority chain
      if (e.key === 'Escape') {
        if (modalOpen) {
          setKeysOpen(false);
          setLinkOpen(false);
          setTagsOpen(false);
          setTopicsOpen(false);
          return;
        }
        if (isTyping) {
          e.target.blur();
          return;
        }
        if (view === 'reader' || view === 'editor') {
          goLibrary();
          return;
        }
        if (view === 'graph' || view === 'canvas') {
          setView('overview');
          return;
        }
        if (bulk) {
          setBulk(false);
          setPicked([]);
          return;
        }
        if (hasFilter) {
          clearFilters();
          return;
        }
        return;
      }

      // Page shortcuts never act behind an open dialog
      if (isTyping || modalOpen) return;

      const k = e.key.toLowerCase();

      // G-sequence navigation
      if (gSeqRef.current === 'g') {
        gSeqRef.current = '';
        clearTimeout(gTimeoutRef.current);
        if (k === 't') { setView('overview'); return; }
        if (k === 'l') { setView('list'); return; }
        if (k === 'g') { setView('graph'); return; }
        if (k === 'c') { setView('canvas'); return; }
        if (k === 'q') { setView('gallery'); return; }
      }
      if (k === 'g') {
        gSeqRef.current = 'g';
        clearTimeout(gTimeoutRef.current);
        gTimeoutRef.current = setTimeout(() => { gSeqRef.current = ''; }, 1200);
        return;
      }

      // Single-key shortcuts
      if (k === '?') { e.preventDefault(); setKeysOpen(true); return; }
      if (k === 'n') { e.preventDefault(); openEditor(null); return; }
      if (k === 'v') { setBulk(b => !b); setPicked([]); return; }

      // Cursor movement (J/K)
      if (k === 'j') {
        e.preventDefault();
        if (view === 'reader') {
          const nextIdx = Math.min(filteredArticles.length - 1, cursor + 1);
          setCursor(nextIdx);
          if (filteredArticles[nextIdx]) setSelectedId(filteredArticles[nextIdx].id);
        } else {
          setCursor(c => Math.min(filteredArticles.length - 1, c + 1));
        }
        return;
      }
      if (k === 'k') {
        e.preventDefault();
        if (view === 'reader') {
          const prevIdx = Math.max(0, cursor - 1);
          setCursor(prevIdx);
          if (filteredArticles[prevIdx]) setSelectedId(filteredArticles[prevIdx].id);
        } else {
          setCursor(c => Math.max(0, c - 1));
        }
        return;
      }

      // Enter to open cursor article
      if (e.key === 'Enter' && view === 'list' && filteredArticles[cursor]) {
        e.preventDefault();
        openReader(filteredArticles[cursor]);
        return;
      }

      // E to edit current or cursor article
      if (k === 'e') {
        const target = view === 'reader' ? selectedArticle : filteredArticles[cursor];
        if (target) {
          e.preventDefault();
          openEditor(target);
        }
        return;
      }

      // Delete cursor article
      if (e.key === 'Backspace' && view === 'list' && filteredArticles[cursor]) {
        e.preventDefault();
        handleDeleteArticle(filteredArticles[cursor]);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keysOpen, linkOpen, tagsOpen, topicsOpen, view, bulk, hasFilter, trash, cursor, filteredArticles, selectedArticle, openEditor, openReader, goLibrary, handleDeleteArticle, handleUndo, clearFilters]);

  if (!user) {
    return (
      <div className="kb-page">
        <div className="kb-empty kb-empty--page">
          <h2 className="kb-empty__title">Đăng nhập để xem Kho Kiến Thức</h2>
        </div>
      </div>
    );
  }

  const isDoc = view === 'reader' || view === 'editor';

  return (
    <div className="kb-page">
      <SkyBackground isMobile={isMobile} calm />
      {ConfirmModal}

      <div className={`kb-shell${isDoc ? ' kb-shell--doc' : ''}`}>
      {/* Cột trái — ẩn ở trang đọc / soạn để có chỗ đọc */}
      {!isDoc && (
        <KBSidebar
          isMobile={isMobile}
          view={view}
          onViewChange={setView}
          search={search}
          onSearchChange={q => { setSearch(q); setCursor(0); }}
          articleCount={topicCounts.all}
          linkCount={wikiEdges.length}
          onNewArticle={() => openEditor(null)}
          topics={topics}
          topicFilter={topicFilter}
          mineOnly={mineOnly}
          onTopicFilter={chooseTopic}
          onOpenMine={openMine}
          topicCounts={topicCounts}
          mineCount={mineCount}
          onManageTopics={() => setTopicsOpen(true)}
        />
      )}

      {/* Content views */}
      <main className="kb-content">
        {isLoading ? (
          <SkeletonList rows={6} gap="6px" label="Đang tải kho kiến thức" />
        ) : view === 'overview' && !search.trim() ? (
          <KBOverview
            articles={articlesWithTasks}
            topics={topics}
            topicCounts={topicCounts}
            recentIds={recentIds}
            keysDisabled={keysOpen || linkOpen || tagsOpen || topicsOpen}
            onOpenReader={openReader}
            onOpenTopic={chooseTopic}
            onOpenMine={openMine}
            onManageTopics={() => setTopicsOpen(true)}
            onNewArticle={() => openEditor(null)}
            onAssign={handleAssignTopic}
            linkCount={wikiEdges.length}
            onOpenGraph={() => setView('graph')}
          />
        ) : view === 'list' || view === 'overview' ? (
          // Tổng quan + đang gõ tìm → kết quả hiện như Danh sách
          <KBListView
            groups={groups}
            total={filteredArticles.length}
            scopeTags={kbTags}
            tagCounts={scopeTagCounts}
            topics={topics}
            heading={listHeading}
            unsortedCount={topicCounts.none}
            onManageTopics={() => setTopicsOpen(true)}
            onManageTags={() => setTagsOpen(true)}
            onQuickSort={goQuickSort}
            onNewArticle={() => openEditor(null)}
            cursorId={filteredArticles[cursor]?.id}
            activeTagIds={activeTagIds}
            onToggleTag={toggleTag}
            linkedOnly={linkedOnly}
            onToggleLinked={() => { setLinkedOnly(v => !v); setCursor(0); }}
            groupBy={groupBy}
            onGroupBy={g => { setGroupBy(g); setCursor(0); }}
            sort={sort}
            onSort={setSort}
            bulk={bulk}
            onToggleBulk={() => { setBulk(b => !b); setPicked([]); }}
            picked={picked}
            onTogglePick={togglePick}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onBulkAssign={handleBulkAssign}
            onBulkDelete={handleBulkDelete}
            onOpenReader={openReader}
            onOpenEditor={openEditor}
            onDelete={handleDeleteArticle}
            filtering={listFiltering}
            onClearFilter={clearListFilters}
          />
        ) : view === 'gallery' ? (
          <KBGalleryView
            articles={filteredArticles}
            onOpenReader={openReader}
          />
        ) : view === 'graph' ? (
          <KBGraphView
            articles={topicArticles}
            topics={topics}
            onOpenReader={openReader}
          />
        ) : view === 'canvas' ? (
          <KBCanvasView
            articles={topicArticles}
            onOpenReader={openReader}
          />
        ) : view === 'reader' && selectedArticle ? (
          <KBReaderView
            article={selectedArticle}
            allArticles={articlesWithTasks}
            topics={topics}
            onBack={goLibrary}
            onPrev={cursor > 0 ? () => {
              const idx = cursor - 1;
              setCursor(idx);
              setSelectedId(filteredArticles[idx].id);
            } : null}
            onNext={cursor < filteredArticles.length - 1 ? () => {
              const idx = cursor + 1;
              setCursor(idx);
              setSelectedId(filteredArticles[idx].id);
            } : null}
            onEdit={() => openEditor(selectedArticle)}
            onDelete={() => handleDeleteArticle(selectedArticle)}
            onAssignTopic={topicId => handleAssignTopic(selectedArticle, topicId)}
            onNotesChange={() => fetchItems({})}
            notesHook={notesHook}
            onOpenArticle={openReader}
            onOpenGraph={() => setView('graph')}
            onOpenLinkModal={() => setLinkOpen(true)}
            onUpdateUrl={url => updateItem(selectedArticle.id, { url })}
          />
        ) : view === 'editor' ? (
          <KBEditorView
            initial={selectedArticle}
            onSave={handleSaveArticle}
            onCancel={goLibrary}
            isSaving={isSaving}
            topics={topics}
            allArticles={articlesWithTasks}
            isNew={!selectedArticle}
            defaultTopicId={currentTopic?.id ?? null}
            onOpenLinkModal={() => setLinkOpen(true)}
          />
        ) : null}
      </main>
      </div>

      {/* Modals & Overlays */}
      <KBShortcutsModal
        open={keysOpen}
        onClose={() => setKeysOpen(false)}
      />

      <KBLinkModal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        currentArticle={selectedArticle}
        allArticles={articlesWithTasks}
        onToggleLink={handleToggleWikiLink}
      />

      <KBTagModal
        open={tagsOpen}
        onClose={() => setTagsOpen(false)}
        tags={centralTags}
        onAddTag={async (name) => {
          await addCentralTag(name, '#8b5cf6');
          showToast(`Đã thêm thẻ #${name}`);
        }}
        onDeleteTag={async (tag) => {
          if (tag.id) {
            await deleteCentralTag(tag.id);
            showToast(`Đã xóa thẻ #${tag.name}`);
            fetchItems({});
          }
        }}
      />

      {topicsOpen && (
        <KBTopicModal
          onClose={() => setTopicsOpen(false)}
          topics={topics}
          counts={topicCounts}
          currentId={topicFilter}
          onSeed={seedStarterTopics}
          onAdd={addTopic}
          onUpdate={updateTopic}
          onReorder={reorderTopics}
          onMerge={handleMergeTopic}
          onDelete={handleDeleteTopic}
        />
      )}
    </div>
  );
}
