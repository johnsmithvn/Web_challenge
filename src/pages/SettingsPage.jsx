import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTags } from '../hooks/useTags';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import {
  GearSix as Settings, Tag, Plus, PencilSimple as Pencil, Trash as Trash2, Check, X,
  Palette, User, FloppyDisk as Save, Envelope as Mail, At as AtSign,
  ToggleLeft, ToggleRight, Coins,
} from '@phosphor-icons/react';
import AppIcon from '../components/AppIcon';
import SkeletonList from '../components/SkeletonList';
import { getUsdRate, getAutoK, setUsdRate, setAutoK } from '../utils/currencyUtils';
import '../styles/settings.css';
import { logger } from '../utils/logger';

/* ── Color palette for tag picker ──────────────────────────── */
const TAG_COLORS = [
  '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4',
  '#22c55e', '#84cc16', '#f59e0b', '#f97316',
  '#ef4444', '#f43f5e', '#ec4899', '#a855f7',
];

/* ── Sidebar menu items (extensible) ──────────────────────── */
// Tab "Quotes" bị bỏ 2026-08-16: nó CRUD bảng `inspirational_quotes` mà `QuoteWidget`
// không bao giờ đọc (widget lấy từ `src/data/quotes.json` + item type='quote' trong
// Knowledge), nên quote thêm ở đây không hiện ra ở đâu cả. Nơi thêm quote giờ là
// Knowledge — đã user-facing, đã hiện thật. Bảng vẫn còn trong database.
const MENU_ITEMS = [
  { key: 'general', label: 'Chung',   icon: Settings,   desc: 'Tags & hệ thống' },
  { key: 'profile', label: 'Hồ sơ',  icon: User,       desc: 'Thông tin cá nhân' },
];

/* ══════════════════════════════════════════════════════════════
   FINANCE SETTINGS SECTION
   ══════════════════════════════════════════════════════════════ */
function FinanceSettingsSection() {
  const [usdRate, setUsdRateState] = useState(() => getUsdRate());
  const [autoK, setAutoKState] = useState(() => getAutoK());
  const [saveMsg, setSaveMsg] = useState('');

  const handleSaveRate = (e) => {
    if (e) e.preventDefault();
    const rate = parseFloat(usdRate);
    if (isNaN(rate) || rate <= 0) return;
    setUsdRate(rate);
    setSaveMsg('Đã lưu tỷ giá');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const handleToggleAutoK = () => {
    const next = !autoK;
    setAutoK(next);
    setAutoKState(next);
    setSaveMsg('Đã cập nhật Auto-K');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  return (
    <section className="settings-section" style={{ marginBottom: '1.5rem' }}>
      <div className="settings-section__header">
        <Coins size={20} />
        <h2>Cấu Hình Tiền Tệ & Chi Tiêu</h2>
        {saveMsg && <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>{saveMsg}</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
        {/* USD Rate Input */}
        <form onSubmit={handleSaveRate} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Tỷ giá quy đổi USD ➔ VND</div>
            {/* Ô tiền của Chi tiêu chạy `sanitizeDigits` (chỉ giữ chữ số) trước khi parse
                nên ký tự `$` không bao giờ sống tới `parseCurrencyInput`. Nơi duy nhất
                gõ được "10$" là ô chi phí dự kiến ở Ươm mầm — nói đúng chỗ đó. */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dùng cho ô <strong>chi phí dự kiến ở Ươm mầm</strong>, nơi gõ được “10$”. Ô tiền trong Chi tiêu chỉ nhận chữ số.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="number"
              className="settings-tag-form__input"
              aria-label="Tỷ giá USD sang VND"
              style={{ width: '100px', textAlign: 'right', height: '36px', padding: '0 0.75rem' }}
              value={usdRate}
              onChange={e => setUsdRateState(e.target.value)}
              onBlur={handleSaveRate}
              min="1"
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>đ</span>
          </div>
        </form>

        {/* Divider */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }} />

        {/* Auto-K Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Tự động thêm 3 số 0 (Auto-K)</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mặc định nhân 1.000 cho số ngắn dưới 10.000 (Ví dụ: 50 ➔ 50.000đ)</div>
          </div>
          <button
            type="button"
            onClick={handleToggleAutoK}
            title={autoK ? 'Đang bật' : 'Đang tắt'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {autoK ? <ToggleRight size={28} color="#22c55e" /> : <ToggleLeft size={28} color="var(--text-muted)" />}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   TAG MANAGER SECTION
   ══════════════════════════════════════════════════════════════ */
const TAG_USAGE_LABELS = { task: 'nhiệm vụ', finance: 'giao dịch', collection: 'bài viết' };

function TagManagerSection({ user }) {
  const {
    tags, isLoading,
    addTag, updateTag, deleteTag,
    getAllTagUsageCounts, getTagUsageBreakdown,
  } = useTags();
  const { confirm, ConfirmModal } = useConfirm();

  const [usageCounts, setUsageCounts] = useState({});
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#8b5cf6');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    if (user) {
      getAllTagUsageCounts().then(setUsageCounts);
    }
  }, [user, tags.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const breakdown = await getTagUsageBreakdown(tag.id);
    const parts = Object.entries(breakdown)
      .filter(([, n]) => n > 0)
      .map(([key, n]) => `${n} ${TAG_USAGE_LABELS[key]}`);

    const ok = await confirm({
      title: `Xóa tag "${tag.name}"?`,
      message: parts.length > 0
        ? `Tag đang gắn ở: ${parts.join(', ')}. Xoá tag chỉ gỡ liên kết — KHÔNG xoá các mục đó.`
        : 'Tag sẽ bị xóa vĩnh viễn.',
      confirmLabel: 'Xóa',
      danger: true,
    });
    if (!ok) return;
    await deleteTag(tag.id);
  }, [confirm, deleteTag, getTagUsageBreakdown]);

  const sortedTags = useMemo(() =>
    [...tags].sort((a, b) => a.name.localeCompare(b.name)),
    [tags]
  );

  return (
    <>
      {ConfirmModal}
      <section className="settings-section">
        <div className="settings-section__header">
          <Tag size={20} />
          <h2>Quản Lý Tags</h2>
          <span className="settings-section__count">{sortedTags.length} tags</span>
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
            aria-label="Tên tag mới"
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
          <SkeletonList rows={4} lines={1} right={false} gap="6px" label="Đang tải tag" />
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
                        aria-label="Sửa tên tag"
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
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROFILE SECTION
   ══════════════════════════════════════════════════════════════ */
// `bio` bị bỏ khỏi form 2026-08-16: không màn nào trong app hiển thị nó, nên đó là
// một ô bắt người dùng gõ rồi ném vào hư không. Cột `profiles.bio` GIỮ NGUYÊN trong
// database (xoá cột cần migration riêng); nếu sau này có trang hồ sơ thì nối lại.
function ProfileSection({ user, profile, updateProfile }) {
  const [form, setForm] = useState({
    display_name: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(''); // 'success' | 'error' | ''
  const [dirty, setDirty] = useState(false);

  // Sync form from profile
  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
      });
      setDirty(false);
    }
  }, [profile]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    setSaveMsg('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    const updates = {};
    if (form.display_name.trim() !== (profile?.display_name || '')) {
      updates.display_name = form.display_name.trim();
    }

    if (Object.keys(updates).length === 0) {
      setSaving(false);
      setSaveMsg('nothing');
      return;
    }

    const { error } = await updateProfile(updates);
    setSaving(false);
    if (error) {
      logger.warn('[Profile] update failed:', error.message);
      setSaveMsg('error');
    } else {
      setSaveMsg('success');
      setDirty(false);
    }
  };

  const username = profile?.username || user?.email?.split('@')[0] || '—';
  const avatarUrl = profile?.avatar_url;
  const initials = (form.display_name || username || 'U').slice(0, 2).toUpperCase();

  return (
    <section className="settings-section">
      <div className="settings-section__header">
        <User size={20} />
        <h2>Hồ sơ cá nhân</h2>
      </div>

      {/* Avatar + Username (read-only) */}
      <div className="settings-profile-hero">
        <div className="settings-profile-avatar">
          {avatarUrl
            ? <img src={avatarUrl} alt={initials} className="settings-profile-avatar__img" />
            : <span className="settings-profile-avatar__initials">{initials}</span>
          }
        </div>
        <div className="settings-profile-hero__info">
          <div className="settings-profile-username">@{username}</div>
          <div className="settings-profile-uid">ID: {user?.id?.slice(0, 8)}…</div>
        </div>
      </div>

      {/* Editable fields */}
      <div className="settings-profile-fields">
        <div className="settings-profile-field">
          <label htmlFor="prof-displayname">
            <User size={14} />
            Tên hiển thị
          </label>
          <input
            id="prof-displayname"
            type="text"
            value={form.display_name}
            onChange={e => handleChange('display_name', e.target.value)}
            placeholder="Tên của bạn"
            maxLength={50}
            className="settings-profile-input"
          />
        </div>

        <div className="settings-profile-field">
          <label htmlFor="prof-email">
            <Mail size={14} />
            Email
          </label>
          <input
            id="prof-email"
            type="email"
            value={user?.email || ''}
            readOnly
            aria-readonly="true"
            className="settings-profile-input"
          />
          <span className="settings-profile-field__hint">Email đăng nhập do Supabase Auth quản lý; app chưa hỗ trợ đổi email.</span>
        </div>

      </div>

      {/* Save button + feedback */}
      <div className="settings-profile-actions">
        <button
          className="btn btn-primary settings-profile-save"
          onClick={handleSave}
          disabled={saving || !dirty}
        >
          <Save size={16} />
          {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
        {saveMsg === 'success' && <span className="settings-profile-msg settings-profile-msg--ok"><AppIcon name="checkCircle" size={14} /> Đã lưu</span>}
        {saveMsg === 'error' && <span className="settings-profile-msg settings-profile-msg--err"><AppIcon name="warning" size={14} /> Lỗi, thử lại</span>}
        {saveMsg === 'nothing' && <span className="settings-profile-msg settings-profile-msg--ok">Không có gì thay đổi</span>}
      </div>

      {/* Read-only info */}
      <div className="settings-profile-readonly">
        <div className="settings-profile-readonly__item">
          <AtSign size={14} />
          <span>Tên đăng nhập:</span>
          <strong>{username}</strong>
          <span className="settings-profile-readonly__badge">Không đổi được</span>
        </div>
        <div className="settings-profile-readonly__item">
          <AppIcon name="calendar" size={15} />
          <span>Tham gia:</span>
          <strong>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : '—'}</strong>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   SETTINGS PAGE (main)
   ══════════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  const { user, profile, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('general');

  if (!user) {
    return (
      <div className="settings-page">
        <div className="settings-auth-wall"><AppIcon name="lock" size={18} /> Đăng nhập để truy cập Cài Đặt</div>
      </div>
    );
  }

  return (
    <div className="settings-page">

      {/* Header */}
      <div className="settings-header">
        <div className="settings-header__icon"><Settings size={28} /></div>
        <div>
          <h1 className="settings-title">Cài Đặt</h1>
          <p className="settings-subtitle">Quản lý tags, hồ sơ và tùy chỉnh hệ thống</p>
        </div>
      </div>

      {/* Layout: sidebar + content */}
      <div className="settings-layout">
        {/* Sidebar */}
        <aside className="settings-sidebar">
          <nav className="settings-sidebar__nav">
            {MENU_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  className={`settings-sidebar__item${activeTab === item.key ? ' settings-sidebar__item--active' : ''}`}
                  onClick={() => setActiveTab(item.key)}
                >
                  <Icon size={18} />
                  <div className="settings-sidebar__item-text">
                    <span className="settings-sidebar__item-label">{item.label}</span>
                    <span className="settings-sidebar__item-desc">{item.desc}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content area */}
        <main className="settings-content">
          {activeTab === 'general' && (
            <>
              <FinanceSettingsSection />
              <TagManagerSection user={user} />
            </>
          )}
          {activeTab === 'profile' && <ProfileSection user={user} profile={profile} updateProfile={updateProfile} />}
        </main>
      </div>
    </div>
  );
}
