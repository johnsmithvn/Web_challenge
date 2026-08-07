import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTags } from '../hooks/useTags';
import { useQuotes } from '../hooks/useQuotes';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../components/ConfirmModal';
import { Settings, Tag, Plus, Pencil, Trash2, Check, X, Palette, User, Save, Mail, AtSign, FileText, Quote as QuoteIcon, ToggleLeft, ToggleRight, Coins } from 'lucide-react';
import { supabase } from '../lib/supabase';
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
const MENU_ITEMS = [
  { key: 'general', label: 'Chung',   icon: Settings,   desc: 'Tags & hệ thống' },
  { key: 'quotes',  label: 'Quotes',  icon: QuoteIcon,  desc: 'Câu nói truyền cảm hứng' },
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
    setSaveMsg('✅ Đã lưu tỷ giá');
    setTimeout(() => setSaveMsg(''), 2000);
  };

  const handleToggleAutoK = () => {
    const next = !autoK;
    setAutoK(next);
    setAutoKState(next);
    setSaveMsg('✅ Đã cập nhật Auto-K');
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
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sử dụng để quy đổi khi nhập chi phí dạng $ (Ví dụ: 89$)</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="number"
              className="settings-tag-form__input"
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
const TAG_USAGE_LABELS = { task: 'nhiệm vụ', expense: 'khoản chi', subscription: 'đăng ký', collection: 'bài viết', account: 'tài khoản' };

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
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   PROFILE SECTION
   ══════════════════════════════════════════════════════════════ */
function ProfileSection({ user, profile, updateProfile }) {
  const [form, setForm] = useState({
    display_name: '',
    email: '',
    bio: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(''); // 'success' | 'error' | ''
  const [dirty, setDirty] = useState(false);

  // Sync form from profile
  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        email: profile.email || '',
        bio: profile.bio || '',
      });
      setDirty(false);
    }
  }, [profile]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    setSaveMsg('');
  };

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    const updates = {};
    if (form.display_name.trim() !== (profile?.display_name || '')) {
      updates.display_name = form.display_name.trim();
    }
    const newEmail = form.email.trim().toLowerCase();
    const oldEmail = (profile?.email || '').toLowerCase();
    if (newEmail !== oldEmail) {
      // Validate format (skip for placeholder emails)
      if (newEmail && !newEmail.endsWith('@lifehub.local') && !isValidEmail(newEmail)) {
        setSaving(false);
        setSaveMsg('invalid_email');
        return;
      }
      // Check duplicate email (rpc excludes the caller's own row via auth.uid())
      if (newEmail && !newEmail.endsWith('@lifehub.local')) {
        const { data: emailTaken } = await supabase
          .rpc('email_exists', { p_email: newEmail });
        if (emailTaken) {
          setSaving(false);
          setSaveMsg('email_taken');
          return;
        }
      }
      updates.email = newEmail;
    }
    if (form.bio.trim() !== (profile?.bio || '')) {
      updates.bio = form.bio.trim();
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
            value={form.email}
            onChange={e => handleChange('email', e.target.value)}
            placeholder="your@email.com"
            className="settings-profile-input"
          />
          <span className="settings-profile-field__hint">Dùng để khôi phục mật khẩu</span>
        </div>

        <div className="settings-profile-field">
          <label htmlFor="prof-bio">
            <FileText size={14} />
            Giới thiệu
          </label>
          <textarea
            id="prof-bio"
            value={form.bio}
            onChange={e => handleChange('bio', e.target.value)}
            placeholder="Viết vài dòng về bạn..."
            maxLength={200}
            rows={3}
            className="settings-profile-input settings-profile-textarea"
          />
          <span className="settings-profile-field__hint">{form.bio.length}/200</span>
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
        {saveMsg === 'success' && <span className="settings-profile-msg settings-profile-msg--ok">✅ Đã lưu</span>}
        {saveMsg === 'error' && <span className="settings-profile-msg settings-profile-msg--err">❌ Lỗi, thử lại</span>}
        {saveMsg === 'nothing' && <span className="settings-profile-msg settings-profile-msg--ok">Không có gì thay đổi</span>}
        {saveMsg === 'email_taken' && <span className="settings-profile-msg settings-profile-msg--err">❌ Email này đã được dùng bởi tài khoản khác</span>}
        {saveMsg === 'invalid_email' && <span className="settings-profile-msg settings-profile-msg--err">❌ Email không hợp lệ</span>}
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
          <span style={{ fontSize: '0.85rem' }}>📅</span>
          <span>Tham gia:</span>
          <strong>{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : '—'}</strong>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════
   QUOTE MANAGER SECTION
   ══════════════════════════════════════════════════════════════ */
function QuoteManagerSection() {
  const { userQuotes, systemQuotes, addQuote, updateQuote, deleteQuote, isLoading } = useQuotes();
  const { confirm, ConfirmModal } = useConfirm();

  const [newText, setNewText] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newSource, setNewSource] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [showSystem, setShowSystem] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newText.trim()) return;
    setIsAdding(true);
    const result = await addQuote({
      text: newText.trim(),
      author: newAuthor.trim() || null,
      source: newSource.trim() || null,
      audio_url: null,
    });
    if (result) {
      setNewText('');
      setNewAuthor('');
      setNewSource('');
    }
    setIsAdding(false);
  };

  const handleStartEdit = (q) => {
    setEditingId(q.id);
    setEditText(q.text);
    setEditAuthor(q.author || '');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    await updateQuote(editingId, { text: editText.trim(), author: editAuthor.trim() || null });
    setEditingId(null);
  };

  const handleDelete = async (q) => {
    const ok = await confirm({
      title: 'Xóa quote?',
      message: `"${q.text.slice(0, 60)}${q.text.length > 60 ? '...' : ''}"`,
      confirmLabel: 'Xóa',
      danger: true,
    });
    if (ok) await deleteQuote(q.id);
  };

  const handleToggleActive = async (q) => {
    await updateQuote(q.id, { is_active: !q.is_active });
  };

  return (
    <>
      {ConfirmModal}
      <section className="settings-section">
        <div className="settings-section__header">
          <QuoteIcon size={20} />
          <h2>Quản Lý Quotes</h2>
          <span className="settings-section__count">{userQuotes.length} quotes cá nhân · {systemQuotes.length} hệ thống</span>
        </div>

        {/* Add form */}
        <form className="settings-quote-form" onSubmit={handleAdd}>
          <textarea
            className="settings-quote-form__input"
            value={newText}
            onChange={e => setNewText(e.target.value)}
            placeholder='"Kỷ luật là cầu nối giữa mục tiêu và thành tựu"'
            maxLength={500}
            rows={2}
          />
          <div className="settings-quote-form__row">
            <input
              className="settings-quote-form__small"
              value={newAuthor}
              onChange={e => setNewAuthor(e.target.value)}
              placeholder="Tác giả (tùy chọn)"
              maxLength={100}
            />
            <input
              className="settings-quote-form__small"
              value={newSource}
              onChange={e => setNewSource(e.target.value)}
              placeholder="Nguồn (tùy chọn)"
              maxLength={100}
            />
            <button
              type="submit"
              className="btn btn-primary settings-quote-form__submit"
              disabled={!newText.trim() || isAdding}
            >
              <Plus size={16} /> {isAdding ? '...' : 'Thêm'}
            </button>
          </div>
        </form>

        {/* User quotes list */}
        {isLoading ? (
          <div className="settings-loading">⏳ Đang tải...</div>
        ) : userQuotes.length === 0 ? (
          <div className="settings-empty">
            <QuoteIcon size={40} strokeWidth={1} />
            <p>Chưa có quote cá nhân. Thêm quote đầu tiên ở trên.</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {systemQuotes.length} câu hệ thống vẫn hiện trên các trang.
            </p>
          </div>
        ) : (
          <div className="settings-tag-list">
            {userQuotes.map(q => {
              if (editingId === q.id) {
                return (
                  <div key={q.id} className="settings-tag-item settings-tag-item--editing">
                    <div style={{ flex: 1 }}>
                      <textarea
                        className="settings-quote-form__input"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={2}
                        autoFocus
                      />
                      <input
                        className="settings-quote-form__small"
                        value={editAuthor}
                        onChange={e => setEditAuthor(e.target.value)}
                        placeholder="Tác giả"
                        style={{ marginTop: '0.35rem' }}
                      />
                    </div>
                    <div className="settings-tag-item__actions" style={{ alignSelf: 'flex-start' }}>
                      <button className="settings-tag-action settings-tag-action--save" onClick={handleSaveEdit}><Check size={16} /></button>
                      <button className="settings-tag-action settings-tag-action--cancel" onClick={() => setEditingId(null)}><X size={16} /></button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={q.id} className={`settings-tag-item${!q.is_active ? ' settings-tag-item--muted' : ''}`}>
                  <div className="settings-tag-item__info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.15rem' }}>
                    <span className="settings-quote-text">"{q.text}"</span>
                    {q.author && <span className="settings-quote-author">— {q.author}</span>}
                    {q.source && <span className="settings-quote-source">{q.source}</span>}
                  </div>
                  <div className="settings-tag-item__actions">
                    <button
                      className="settings-tag-action"
                      onClick={() => handleToggleActive(q)}
                      title={q.is_active ? 'Ẩn' : 'Hiện'}
                    >
                      {q.is_active ? <ToggleRight size={16} color="#22c55e" /> : <ToggleLeft size={16} />}
                    </button>
                    <button className="settings-tag-action settings-tag-action--edit" onClick={() => handleStartEdit(q)}>
                      <Pencil size={14} />
                    </button>
                    <button className="settings-tag-action settings-tag-action--delete" onClick={() => handleDelete(q)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* System quotes toggle */}
        <button
          className="settings-quote-sys-toggle"
          onClick={() => setShowSystem(v => !v)}
        >
          {showSystem ? '▲' : '▼'} {systemQuotes.length} câu hệ thống
        </button>
        {showSystem && (
          <div className="settings-tag-list" style={{ opacity: 0.6 }}>
            {systemQuotes.slice(0, 15).map(q => (
              <div key={q.id} className="settings-tag-item">
                <div className="settings-tag-item__info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem' }}>
                  <span className="settings-quote-text" style={{ fontSize: '0.8rem' }}>"{q.text}"</span>
                  {q.author && <span className="settings-quote-author">— {q.author}</span>}
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', flexShrink: 0 }}>Hệ thống</span>
              </div>
            ))}
            {systemQuotes.length > 15 && (
              <div style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                ... và {systemQuotes.length - 15} câu khác
              </div>
            )}
          </div>
        )}
      </section>
    </>
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
        <div className="settings-auth-wall">🔐 Đăng nhập để truy cập Cài Đặt</div>
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
          {activeTab === 'quotes' && <QuoteManagerSection user={user} />}
          {activeTab === 'profile' && <ProfileSection user={user} profile={profile} updateProfile={updateProfile} />}
        </main>
      </div>
    </div>
  );
}
