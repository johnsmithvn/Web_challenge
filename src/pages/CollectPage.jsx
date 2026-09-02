import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useCollections } from '../hooks/useCollections';
import { useUserTasks } from '../hooks/useUserTasks';
import { useTags } from '../hooks/useTags';
import { useCollectionNotes } from '../hooks/useCollectionNotes';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { useToast } from '../contexts/ToastContext';
import '../styles/collect.css';

// Sub-components
import KBSubHeader from '../components/kb/KBSubHeader';
import KBListView from '../components/kb/KBListView';
import KBGalleryView from '../components/kb/KBGalleryView';
import KBGraphView from '../components/kb/KBGraphView';
import KBCanvasView from '../components/kb/KBCanvasView';
import KBReaderView from '../components/kb/KBReaderView';
import KBEditorView from '../components/kb/KBEditorView';
import KBShortcutsModal from '../components/kb/KBShortcutsModal';
import KBLinkModal from '../components/kb/KBLinkModal';
import KBTagModal from '../components/kb/KBTagModal';

import { filterArticles } from '../utils/kbDeriveUtils';

export default function CollectPage() {
  const { user } = useAuth();
  const { items, isLoading, fetchItems, addItem, updateItem, deleteItem } = useCollections();
  const { addTask, linkCollection, pendingTasks } = useUserTasks();
  const { tags: centralTags, addTag: addCentralTag, linkTag, unlinkTag, deleteTag: deleteCentralTag } = useTags();
  const notesHook = useCollectionNotes();
  const { confirm, ConfirmModal } = useConfirm();
  const { showToast } = useToast();

  // Navigation & View state
  const [view, setView] = useState('list'); // 'list' | 'gallery' | 'graph' | 'canvas' | 'reader' | 'editor'
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [cursor, setCursor] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [activeTagIds, setActiveTagIds] = useState([]);
  const [sort, setSort] = useState('new');
  const [filterTaskId, setFilterTaskId] = useState('');

  // Bulk mode
  const [bulk, setBulk] = useState(false);
  const [picked, setPicked] = useState([]);

  // Modals & Overlays
  const [keysOpen, setKeysOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

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

  // Tags list
  const allTags = useMemo(() => {
    const map = new Map();
    items.filter(i => i.type !== 'inbox').forEach(i => {
      (i._tags || []).forEach(t => { if (t && t.id) map.set(t.id, t); });
    });
    centralTags.forEach(t => map.set(t.id, t));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, centralTags]);

  // Attach linked tasks to items for display
  const articlesWithTasks = useMemo(() => {
    return items.map(item => {
      const linkedTasks = pendingTasks.filter(t => (item._linkedTaskIds || []).includes(t.id));
      return {
        ...item,
        _linkedTasks: linkedTasks,
      };
    });
  }, [items, pendingTasks]);

  // Filtered & sorted list
  const filteredArticles = useMemo(() => {
    return filterArticles(articlesWithTasks, {
      q: search,
      type: typeFilter,
      tags: activeTagIds,
      sort,
      taskId: filterTaskId,
    });
  }, [articlesWithTasks, search, typeFilter, activeTagIds, sort, filterTaskId]);

  const hasFilter = !!(search || typeFilter || activeTagIds.length > 0 || filterTaskId);

  const clearFilters = useCallback(() => {
    setSearch('');
    setTypeFilter('');
    setActiveTagIds([]);
    setFilterTaskId('');
    setCursor(0);
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

  // Navigation handlers
  const openReader = useCallback((article) => {
    const idx = filteredArticles.findIndex(a => a.id === article.id);
    if (idx >= 0) setCursor(idx);
    setSelectedArticle(article);
    setView('reader');
  }, [filteredArticles]);

  const openEditor = useCallback((article = null) => {
    setSelectedArticle(article);
    setView('editor');
  }, []);

  const goLibrary = useCallback(() => {
    setView('list');
    setSelectedArticle(null);
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
        url:            draft.url || null,
      };

      let savedId;
      if (selectedArticle?.id) {
        await updateItem(selectedArticle.id, payload);
        savedId = selectedArticle.id;
      } else {
        const created = await addItem({ ...payload, status: 'read' });
        savedId = created?.id;
      }

      // Sync tags via junction table
      if (savedId && draft.tags) {
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
      const updatedArticle = { ...draft, id: savedId };
      setSelectedArticle(updatedArticle);
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
    setSelectedArticle(prev => ({ ...prev, body: newBody }));
    fetchItems({});
  }, [selectedArticle, updateItem, showToast, fetchItems]);

  // Keyboard Shortcuts Handler (Global)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isTyping = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;

      // ⌘Z — Undo delete
      if (mod && e.key.toLowerCase() === 'z' && trash) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Escape key priority chain
      if (e.key === 'Escape') {
        if (keysOpen || linkOpen || tagsOpen) {
          setKeysOpen(false);
          setLinkOpen(false);
          setTagsOpen(false);
          return;
        }
        if (isTyping) {
          e.target.blur();
          return;
        }
        if (view === 'reader' || view === 'editor' || view === 'graph' || view === 'canvas') {
          setView('list');
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

      if (isTyping) return;

      const k = e.key.toLowerCase();

      // G-sequence navigation
      if (gSeqRef.current === 'g') {
        gSeqRef.current = '';
        clearTimeout(gTimeoutRef.current);
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
          setSelectedArticle(filteredArticles[nextIdx]);
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
          setSelectedArticle(filteredArticles[prevIdx]);
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
  }, [keysOpen, linkOpen, tagsOpen, view, bulk, hasFilter, trash, cursor, filteredArticles, selectedArticle, openEditor, openReader, handleDeleteArticle, handleUndo, clearFilters]);

  if (!user) {
    return (
      <div className="kb-page">
        <div className="kb-empty-state">
          <span className="kb-empty-state__icon">🔒</span>
          <h2 className="kb-empty-state__title">Đăng nhập để xem Kho Kiến Thức</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="kb-page">
      {ConfirmModal}

      {/* Sub-header (only visible when not in reader or editor mode) */}
      {view !== 'reader' && view !== 'editor' && (
        <KBSubHeader
          view={view}
          onViewChange={setView}
          search={search}
          onSearchChange={q => { setSearch(q); setCursor(0); }}
          articleCount={filteredArticles.length}
          onNewArticle={() => openEditor(null)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
      )}

      {/* Content views */}
      <div className="kb-content">
        {isLoading ? (
          <div className="kb-loading">Đang tải kho kiến thức...</div>
        ) : view === 'list' ? (
          <KBListView
            articles={filteredArticles}
            allTags={allTags}
            cursor={cursor}
            typeFilter={typeFilter}
            onTypeFilter={t => { setTypeFilter(t); setCursor(0); }}
            activeTagIds={activeTagIds}
            onToggleTag={toggleTag}
            sort={sort}
            onSort={setSort}
            bulk={bulk}
            onToggleBulk={() => { setBulk(b => !b); setPicked([]); }}
            picked={picked}
            onTogglePick={togglePick}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onBulkTag={() => setTagsOpen(true)}
            onBulkDelete={handleBulkDelete}
            onOpenReader={openReader}
            onOpenEditor={openEditor}
            onDelete={handleDeleteArticle}
            hasFilter={hasFilter}
            onClearFilter={clearFilters}
          />
        ) : view === 'gallery' ? (
          <KBGalleryView
            articles={filteredArticles}
            onOpenReader={openReader}
          />
        ) : view === 'graph' ? (
          <KBGraphView
            articles={articlesWithTasks}
            onOpenReader={openReader}
          />
        ) : view === 'canvas' ? (
          <KBCanvasView
            articles={articlesWithTasks}
            onOpenReader={openReader}
          />
        ) : view === 'reader' && selectedArticle ? (
          <KBReaderView
            article={selectedArticle}
            allArticles={articlesWithTasks}
            onBack={goLibrary}
            onPrev={cursor > 0 ? () => {
              const idx = cursor - 1;
              setCursor(idx);
              setSelectedArticle(filteredArticles[idx]);
            } : null}
            onNext={cursor < filteredArticles.length - 1 ? () => {
              const idx = cursor + 1;
              setCursor(idx);
              setSelectedArticle(filteredArticles[idx]);
            } : null}
            onEdit={() => openEditor(selectedArticle)}
            onDelete={() => handleDeleteArticle(selectedArticle)}
            notesHook={notesHook}
            onOpenArticle={openReader}
            onOpenGraph={() => setView('graph')}
            onOpenLinkModal={() => setLinkOpen(true)}
            onCreateTask={async (item) => {
              const result = await addTask({
                title: item.title,
                description: item.url || (item.body_text || '').slice(0, 200) || '',
              });
              if (result) {
                await linkCollection(result.id, item.id);
                showToast(`Đã tạo nhiệm vụ cho "${item.title}"`);
              }
            }}
            onUpdateUrl={async (oldUrl, newUrl) => {
              await updateItem(selectedArticle.id, { url: newUrl });
              setSelectedArticle(prev => ({ ...prev, url: newUrl }));
              fetchItems({});
            }}
          />
        ) : view === 'editor' ? (
          <KBEditorView
            initial={selectedArticle}
            onSave={handleSaveArticle}
            onCancel={goLibrary}
            isSaving={isSaving}
            suggestions={allTags}
            isNew={!selectedArticle}
            onOpenLinkModal={() => setLinkOpen(true)}
          />
        ) : null}
      </div>

      {/* Floating help button (?) */}
      <button
        className="kb-help-btn"
        onClick={() => setKeysOpen(true)}
        title="Bảng phím tắt (?)"
      >
        ?
      </button>

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
        tags={allTags}
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
    </div>
  );
}
