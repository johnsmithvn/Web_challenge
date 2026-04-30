import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTags } from '../hooks/useTags';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { Settings, Tag, Plus, Pencil, Trash2, Check, X, Palette } from 'lucide-react';
import '../styles/settings.css';

/* ── Color palette for tag picker ──────────────────────────── */
const TAG_COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4',
  '#22c55e', '#84cc16', '#f59e0b', '#f97316',
  '#ef4444', '#f43f5e', '#ec4899', '#a855f7',
];

/* ── SettingsPage ──────────────────────────────────────────── */
export default function SettingsPage() {
  const { user } = useAuth();
  const {
    tags, isLoading, fetchTags,
    addTag, updateTag, deleteTag,
    getAllTagUsageCounts,
  } = useTags();
  const { confirm, ConfirmModal } = useConfirm();

  // Local state
  const [usageCounts, setUsageCounts] = useState({});
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#8b5cf6');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(null); // 'new' | tagId | null
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Fetch usage counts on mount
  useEffect(() => {
    if (user) {
      getAllTagUsageCounts().then(setUsageCounts);
    }
  }, [user, tags.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────
  const handleAddTag = useCallback(async (e) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    setIsAdding(true);
    setAddError('');
    try {
      const result = await addTag(newTagName, newTagColor);
      if (result) {
        setNewTagName('');
        setNewTagColor('#8b5cf6');
        setShowColorPicker(null);
      } else {
        setAddError('Không thể thêm tag. Thử lại.');
      }
    } catch {
      setAddError('Lỗi kết nối. Thử lại.');
    } finally {
      setIsAdding(false);
    }
  }, [newTagName, newTagColor, addTag]);

  const handleStartEdit = useCallback((tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || '#8b5cf6');
    setShowColorPicker(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editName.trim()) return;
    await updateTag(editingId, { name: editName, color: editColor });
    setEditingId(null);
    setEditName('');
    setEditColor('');
    setShowColorPicker(null);
  }, [editingId, editName, editColor, updateTag]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditName('');
    setEditColor('');
    setShowColorPicker(null);
  }, []);

  const handleDeleteTag = useCallback(async (tag) => {
    const count = usageCounts[tag.id] || 0;
    const ok = await confirm({
      title: `Xóa tag "${tag.name}"?`,
      message: count > 0
        ? `Tag này đang được dùng ở ${count} nơi. Xóa sẽ tự động gỡ liên kết tất cả.`
        : 'Tag sẽ bị xóa vĩnh viễn.',
      confirmLabel: 'Xóa',
      danger: true,
    });
    if (!ok) return;
    await deleteTag(tag.id);
  }, [confirm, deleteTag, usageCounts]);

  // Sort tags alphabetically
  const sortedTags = useMemo(() =>
    [...tags].sort((a, b) => a.name.localeCompare(b.name)),
    [tags]
  );

  if (!user) {
    return (
      <div className="settings-page">
        <div className="settings-auth-wall">🔐 Đăng nhập để truy cập Cài Đặt</div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {ConfirmModal}

      {/* Header */}
      <div className="settings-header">
        <div className="settings-header__icon"><Settings size={28} /></div>
        <div>
          <h1 className="settings-title">Cài Đặt</h1>
          <p className="settings-subtitle">Quản lý tags và tùy chỉnh hệ thống</p>
        </div>
      </div>

      {/* Tag Manager Section */}
      <section className="settings-section">
        <div className="settings-section__header">
          <Tag size={20} />
          <h2>Quản Lý Tags</h2>
          <span className="settings-section__count">{tags.length} tags</span>
        </div>

        {/* Add tag form */}
        <form className="settings-tag-form" onSubmit={handleAddTag}>
          <div className="settings-tag-form__color-wrapper">
            <button
              type="button"
              className="settings-color-btn"
              style={{ background: newTagColor }}
              onClick={() => setShowColorPicker(showColorPicker === 'new' ? null : 'new')}
              title="Chọn màu"
            >
              <Palette size={14} />
            </button>
            {showColorPicker === 'new' && (
              <div className="settings-color-picker">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`settings-color-swatch${newTagColor === c ? ' settings-color-swatch--active' : ''}`}
                    style={{ background: c }}
                    onClick={() => { setNewTagColor(c); setShowColorPicker(null); }}
                  />
                ))}
              </div>
            )}
          </div>
          <input
            className="settings-tag-form__input"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            placeholder="Tên tag mới..."
            maxLength={50}
          />
          <button
            type="submit"
            className="btn btn-primary settings-tag-form__submit"
            disabled={!newTagName.trim() || isAdding}
          >
            <Plus size={16} /> {isAdding ? 'Đang thêm...' : 'Thêm'}
          </button>
        </form>
        {addError && <div className="settings-add-error">{addError}</div>}

        {/* Tag list */}
        {isLoading ? (
          <div className="settings-loading">⏳ Đang tải...</div>
        ) : sortedTags.length === 0 ? (
          <div className="settings-empty">
            <Tag size={40} strokeWidth={1} />
            <p>Chưa có tag nào. Tạo tag đầu tiên ở trên.</p>
          </div>
        ) : (
          <div className="settings-tag-list">
            {sortedTags.map(tag => {
              const isEditing = editingId === tag.id;
              const count = usageCounts[tag.id] || 0;

              if (isEditing) {
                return (
                  <div key={tag.id} className="settings-tag-item settings-tag-item--editing">
                    <div className="settings-tag-item__edit-row">
                      <div className="settings-tag-form__color-wrapper">
                        <button
                          type="button"
                          className="settings-color-btn"
                          style={{ background: editColor }}
                          onClick={() => setShowColorPicker(showColorPicker === tag.id ? null : tag.id)}
                          title="Đổi màu"
                        >
                          <Palette size={14} />
                        </button>
                        {showColorPicker === tag.id && (
                          <div className="settings-color-picker">
                            {TAG_COLORS.map(c => (
                              <button
                                key={c}
                                type="button"
                                className={`settings-color-swatch${editColor === c ? ' settings-color-swatch--active' : ''}`}
                                style={{ background: c }}
                                onClick={() => { setEditColor(c); setShowColorPicker(null); }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        className="settings-tag-edit-input"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit();
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        maxLength={50}
                        autoFocus
                      />
                      <button className="settings-tag-action settings-tag-action--save" onClick={handleSaveEdit} title="Lưu">
                        <Check size={16} />
                      </button>
                      <button className="settings-tag-action settings-tag-action--cancel" onClick={handleCancelEdit} title="Hủy">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={tag.id} className="settings-tag-item">
                  <div className="settings-tag-item__info">
                    <span className="settings-tag-dot" style={{ background: tag.color || '#8b5cf6' }} />
                    <span className="settings-tag-name">#{tag.name}</span>
                    <span className="settings-tag-count">{count} liên kết</span>
                  </div>
                  <div className="settings-tag-item__actions">
                    <button
                      className="settings-tag-action settings-tag-action--edit"
                      onClick={() => handleStartEdit(tag)}
                      title="Sửa"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="settings-tag-action settings-tag-action--delete"
                      onClick={() => handleDeleteTag(tag)}
                      title="Xóa"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Future sections placeholder */}
      <section className="settings-section settings-section--future">
        <div className="settings-section__header">
          <Settings size={20} />
          <h2>Thêm tùy chọn</h2>
        </div>
        <div className="settings-future-hint">
          <p>🎨 Theme · 🔔 Notifications · 👤 Account</p>
          <p className="settings-future-hint__sub">Sẽ có trong phiên bản sau</p>
        </div>
      </section>
    </div>
  );
}
