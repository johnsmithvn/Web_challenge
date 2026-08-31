import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../components/ConfirmModal';
import AccountDetail from '../components/AccountDetail';
import AccountAvatar from '../components/AccountAvatar';
import AppIcon from '../components/AppIcon';
import SkeletonList from '../components/SkeletonList';
import { matchesQuery, itemSubtitle, newId, relativeUpdated } from '../utils/vaultLogic';
import ACCOUNT_TEMPLATES from '../data/account-templates.json';
import '../styles/accounts.css';

/**
 * AccountsPage (/accounts) — Account Vault, thiết kế Keyplate.
 *
 * Every user-authored item property is decrypted only after the separate Vault
 * passphrase unlocks the in-memory DEK. Locked means no list or metadata browse.
 *
 * Layout: header · banner · filter bar · body 2 pane, breakpoint 900px.
 *
 * KHÔNG có hook đo bề rộng và không có resize listener — khác prototype. Dưới
 * 900px CSS đổi `.acc-body[data-screen]` thành 2 màn hình; trên 900px cùng
 * attribute đó bị media query bỏ qua. Nên React chỉ giữ `screen` như một state
 * bình thường và bấm vào dòng nào cũng set nó, không cần biết đang ở bề rộng
 * nào. Nút "← All items" cũng do CSS ẩn ở desktop.
 *
 * Dialog chọn template là dialog RIÊNG (`.acc-scrim`/`.acc-dialog`), cố ý không
 * dùng GenericModal: component đó mang style Life Hub vào và phá fidelity.
 */

const { templates: TEMPLATES, filterIcons: FILTER_ICONS } = ACCOUNT_TEMPLATES;
const TPL_BY_KEY = new Map(TEMPLATES.map((t) => [t.key, t]));

export default function AccountsPage() {
  const { user } = useAuth();
  const { items, isLoading, saveItem, createItem, deleteItem, toggleFavorite,
    setAuthState, setCodeUsed, vaultStatus, vaultError,
    setupVault, unlockVault, lockVault, changePassphrase, exportVault, restoreVault } = useAccounts();
  const { showToast } = useToast();
  const { confirm, ConfirmModal } = useConfirm();

  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');          // 'all' | 'fav' | <tpl key>
  const [tag, setTag] = useState(null);           // tag id
  const [selectedId, setSelectedId] = useState(null);
  const [screen, setScreen] = useState('list');   // chỉ có nghĩa dưới 900px
  const [pickerOpen, setPickerOpen] = useState(false);
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [creating, setCreating] = useState(null); // tplKey đang tạo, null = rảnh
  const [autoEditId, setAutoEditId] = useState(null); // item vừa tạo → mở sẵn edit
  const [revealed, setRevealed] = useState({});   // { [fieldId]: true }
  const [copied, setCopied] = useState(null);     // 1 key tại một thời điểm
  const [pendingTags, setPendingTags] = useState([]);
  const copyTimer = useRef(null);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  // Esc đóng dialog — dialog tự dựng nên phải tự lo phần này
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setPickerOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickerOpen]);

  // ── Lọc ─────────────────────────────────────────────────────
  const visible = useMemo(() => items.filter((i) => {
    if (cat === 'fav' && !i.favorite) return false;
    if (cat !== 'all' && cat !== 'fav' && i.tpl !== cat) return false;
    if (tag && !i.tags.some((t) => t.id === tag)) return false;
    // matchesQuery loại giá trị secret khỏi vùng tìm — xem vaultLogic.js
    return matchesQuery(i, query);
  }), [items, cat, tag, query]);

  const selected = items.find((i) => i.id === selectedId) || null;

  const counts = useMemo(() => {
    const c = { all: items.length, fav: 0 };
    for (const i of items) {
      if (i.favorite) c.fav++;
      c[i.tpl] = (c[i.tpl] || 0) + 1;
    }
    return c;
  }, [items]);

  // Chỉ hiện tag đang thực sự được dùng bởi ít nhất 1 item
  const usedTags = useMemo(() => {
    const byId = new Map();
    for (const i of items) for (const t of i.tags) byId.set(t.id, t);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  // Vault tags live inside encrypted item payloads. Pending tags only exist in
  // memory until the edited item is saved; they never enter the global plaintext tag table.
  const tags = useMemo(() => {
    const byId = new Map(pendingTags.map((candidate) => [candidate.id, candidate]));
    for (const item of items) for (const candidate of item.tags) byId.set(candidate.id, candidate);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, pendingTags]);

  const addTag = useCallback(async (name) => {
    const clean = name.trim();
    const existing = tags.find((candidate) => candidate.name.toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    const created = { id: newId(), name: clean, color: '#8b5cf6' };
    setPendingTags((current) => [...current, created]);
    return created;
  }, [tags]);

  const dirty = cat !== 'all' || !!tag || !!query;
  const listTitle = tag
    ? `#${usedTags.find((t) => t.id === tag)?.name || 'tag'}`
    : cat === 'all' ? 'All items'
      : cat === 'fav' ? 'Favourites'
        : TPL_BY_KEY.get(cat)?.name || 'Items';

  // ── Hành động ───────────────────────────────────────────────
  // Reveal là per-field và chỉ sống trong lúc item đang mở: đổi item thì mọi
  // giá trị vừa hé ra phải che lại, nếu không quay lại tab sau là nó vẫn hở.
  //
  // `edit: true` chỉ dùng cho item VỪA TẠO — mở thẳng chế độ sửa. Mọi đường mở
  // khác (bấm dòng, bấm chip link) đều xoá cờ đó, nên chọn lại chính item ấy
  // sau khi Cancel sẽ không tự nhảy vào edit lần nữa.
  const open = useCallback((id, { edit = false } = {}) => {
    setSelectedId(id);
    setRevealed({});
    setScreen('detail');
    setAutoEditId(edit ? id : null);
  }, []);

  const copy = useCallback(async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1400);
    } catch {
      showToast('Clipboard blocked by the browser', { icon: 'warning' });
    }
  }, [showToast]);

  const toggleReveal = useCallback((fieldId) => {
    setRevealed((r) => ({ ...r, [fieldId]: !r[fieldId] }));
  }, []);

  const handleSave = useCallback(async (draft, tagIds) => {
    const selectedTags = tags.filter((candidate) => tagIds.includes(candidate.id));
    const ok = await saveItem({ ...draft, tags: selectedTags });
    if (!ok) showToast('Save failed', { icon: 'warning' });
    if (ok) setPendingTags([]);
    return ok;
  }, [saveItem, showToast, tags]);

  const handleLock = () => {
    setSelectedId(null);
    setScreen('list');
    setRevealed({});
    setCopied(null);
    setPickerOpen(false);
    setPendingTags([]);
    lockVault();
  };

  /**
   * Tạo item từ template. Dialog **ở nguyên** trong lúc chờ và card được bấm
   * chuyển sang trạng thái "Creating…" — trước đây dialog đóng ngay rồi im lặng
   * vài giây (13 round-trip Supabase), user tưởng bấm trượt.
   * Xong thì mở item và vào **thẳng chế độ sửa**: vừa chọn template nghĩa là
   * đang muốn điền, không phải muốn ngắm một item trống.
   */
  const handleCreate = async (tplKey) => {
    if (creating) return;               // chặn double-click tạo 2 item
    setCreating(tplKey);
    const id = await createItem(tplKey);
    setCreating(null);
    if (!id) { showToast('Could not create the item', { icon: 'warning' }); return; }
    setPickerOpen(false);
    open(id, { edit: true });
  };

  const handleDelete = async (item) => {
    // Đếm item khác đang trỏ tới nó — xoá xong chúng thành "Missing item"
    const inbound = items.filter((i) => i.id !== item.id
      && i.fields.some((f) => (f.links || []).some((L) => L.itemId === item.id))).length;

    const ok = await confirm({
      title: 'Delete this item?',
      message: `"${item.title}" and all of its fields, sign-in methods, codes and history`
        + ' will be removed.'
        + (inbound > 0 ? ` ${inbound} other item(s) link to it — those links will break.` : ''),
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    if (await deleteItem(item.id)) {
      setSelectedId(null);
      setScreen('list');
      showToast('Item deleted');
    }
  };

  if (!user) {
    return (
      <div className="acc-vault">
        <div className="acc-blank">
          <div className="acc-blank__title">Sign in to open the vault</div>
          <div className="acc-blank__hint">
            Vault data is the most private thing in the app, so it is never kept in guest mode.
          </div>
        </div>
      </div>
    );
  }

  if (vaultStatus !== 'unlocked') {
    return (
      <VaultGate
        status={vaultStatus}
        error={vaultError}
        onSetup={setupVault}
        onUnlock={unlockVault}
        onExport={exportVault}
        onRestore={restoreVault}
      />
    );
  }

  return (
    <div className="acc-vault">
      {/* ── Header ── */}
      <header className="acc-head">
        <div className="acc-brand">
          <span className="acc-brand__name">Keyplate</span>
          <span className="acc-brand__vault">Vault 01</span>
        </div>

        <div className="acc-search">
          <AppIcon name="search" size={15} />
          <input
            className="acc-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, usernames, URLs, tags…"
            aria-label="Search the vault"
          />
        </div>

        <div className="acc-head__right">
          <div className="acc-head__secure-tip" tabIndex={0} role="note" aria-label="End-to-end encryption status">
            <span className="acc-head__secure-badge">
              <AppIcon name="lock" size={13} /> AES-GCM Active
            </span>
            <div className="acc-head__secure-popup">
              <strong><AppIcon name="shieldCheck" size={14} /> Full-content encryption active</strong>
              <p>Titles, usernames, URLs, notes, tags, fields, codes and history are sent to Supabase only as AES-GCM ciphertext.</p>
            </div>
          </div>
          <button className="acc-act" onClick={() => setChangePassOpen(true)}>Đổi mật khẩu</button>
          <button className="acc-act" onClick={handleLock}>Lock</button>
          <button className="acc-btn" onClick={() => setPickerOpen(true)}>New item</button>
        </div>
      </header>

      {vaultError && <div className="acc-vault-error" role="alert">{vaultError}</div>}

      {/* ── Filter bar ── */}
      <div className="acc-filters">
        <div className="acc-filters__cap acc-filters__cap--types">Types</div>
        <div className="acc-filters__row acc-filters__row--types">
          <Chip icon={FILTER_ICONS.all} label="All" count={counts.all}
            on={cat === 'all'} onClick={() => { setCat('all'); setTag(null); }} />
          <Chip icon={FILTER_ICONS.fav} label="Favourites" count={counts.fav}
            on={cat === 'fav'} onClick={() => { setCat('fav'); setTag(null); }} />
          {TEMPLATES.map((t) => (
            <Chip key={t.key} icon={t.icon} label={t.chip} count={counts[t.key] || 0}
              on={cat === t.key} onClick={() => { setCat(t.key); setTag(null); }} />
          ))}
        </div>

        {dirty && (
          <div className="acc-filters__clear">
            <button className="acc-btn acc-btn--ghost"
              onClick={() => { setCat('all'); setTag(null); setQuery(''); }}>Clear</button>
          </div>
        )}

        <div className="acc-filters__cap acc-filters__cap--tags">Tags</div>
        {/* Hàng này CỐ Ý chỉ liệt kê tag đang gắn trên item của vault, không phải
            toàn bộ tag hệ thống: bấm một tag chưa item nào dùng thì chỉ ra danh
            sách rỗng. Chỗ chọn tag từ cả hệ thống là ở chế độ sửa của item. */}
        <div className="acc-filters__row acc-filters__row--tags">
          {usedTags.length === 0 && (
            <span className="acc-sect__meta">
              No item is tagged yet — add tags while editing an item
            </span>
          )}
          {usedTags.map((t) => (
            <button key={t.id}
              className={`acc-chip acc-chip--tag${tag === t.id ? ' acc-chip--on' : ''}`}
              onClick={() => setTag(tag === t.id ? null : t.id)}
            >#{t.name}</button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="acc-body" data-screen={screen}>
        <section className="acc-pane acc-pane--list">
          <div className="acc-listhead">
            <h2 className="acc-listhead__title">{listTitle}</h2>
            <span className="acc-listhead__count">
              {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          {isLoading && items.length === 0 && (
            <SkeletonList rows={6} lines={1} gap="4px" label="Đang tải tài khoản" />
          )}

          {!isLoading && items.length === 0 && (
            <div className="acc-blank">
              <div className="acc-blank__title">The vault is empty</div>
              <div className="acc-blank__hint">
                Hit <strong>New item</strong> and pick a template — its fields, sign-in methods
                and code sheet come pre-filled.
              </div>
            </div>
          )}

          {items.length > 0 && visible.length === 0 && (
            <div className="acc-list__empty">No entries match this filter.</div>
          )}

          {visible.map((i) => (
            <ListRow key={i.id} item={i} on={i.id === selectedId} onOpen={() => open(i.id)} />
          ))}
        </section>

        <section className="acc-pane acc-pane--detail">
          {selected ? (
            <AccountDetail
              /* key: buộc React dựng lại subtree khi đổi item, nhờ đó animation
                 acc-enter chạy lại — mốc thị giác cho biết nội dung đã đổi */
              key={selected.id}
              item={selected}
              items={items}
              tags={tags}
              autoEdit={autoEditId === selected.id}
              revealed={revealed}
              copied={copied}
              onBack={() => setScreen('list')}
              onOpen={open}
              onCopy={copy}
              onToggleReveal={toggleReveal}
              onToggleFavorite={() => toggleFavorite(selected.id)}
              onSave={handleSave}
              onDelete={() => handleDelete(selected)}
              onSetAuthState={setAuthState}
              onSetCodeUsed={setCodeUsed}
              onAddTag={addTag}
            />
          ) : (
            <div className="acc-detail__blank">
              <div>
                <h2>Nothing selected</h2>
                <p>Pick an entry on the left, or start a new one from a template.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Portal ra body: `.acc-vault` có `container-type: inline-size` → nó thành
          containing block cho position:fixed, scrim để trong đó sẽ chỉ che vùng
          vault và hở sidebar. `.acc-scrim` tự khai bộ token (accounts.css). */}
      {pickerOpen && createPortal(
        <div className="acc-scrim" onClick={() => !creating && setPickerOpen(false)}
          role="dialog" aria-modal="true" aria-label="Choose a template">
          <div className="acc-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="acc-dialog__head">
              <h3 className="acc-dialog__title">Choose a template</h3>
              <button className="acc-btn acc-btn--ghost" disabled={!!creating}
                onClick={() => setPickerOpen(false)}>Close</button>
            </div>
            <p className="acc-dialog__lede">
              Each template seeds fields, sign-in methods and — where it applies — a sheet of
              single-use codes. Everything stays renameable afterwards.
            </p>
            <div className="acc-tplgrid">
              {TEMPLATES.map((t) => (
                <button key={t.key} type="button" disabled={!!creating}
                  className={`acc-tpl${creating === t.key ? ' acc-tpl--busy' : ''}`}
                  onClick={() => handleCreate(t.key)}>
                  <div className="acc-tpl__code">{t.code}</div>
                  <div className="acc-tpl__name">{t.name}</div>
                  <div className="acc-tpl__sum">
                    {creating === t.key ? 'Creating…' : t.summary}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {ConfirmModal}

      <ChangePassphraseModal
        isOpen={changePassOpen}
        onClose={(success) => {
          setChangePassOpen(false);
          if (success) showToast('Đã đổi mật khẩu Vault thành công!', { icon: 'check' });
        }}
        onChangePassphrase={changePassphrase}
      />
    </div>
  );
}

function ChangePassphraseModal({ isOpen, onClose, onChangePassphrase }) {
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
      setError('');
      setBusy(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPass.length < 12) {
      setError('Mật khẩu mới phải có ít nhất 12 ký tự.');
      return;
    }
    if (newPass !== confirmPass) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (newPass === currentPass) {
      setError('Mật khẩu mới phải khác mật khẩu hiện tại.');
      return;
    }
    setBusy(true);
    const result = await onChangePassphrase(currentPass, newPass);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || 'Đổi mật khẩu thất bại.');
      return;
    }
    onClose(true);
  };

  return createPortal(
    <div className="acc-scrim" onClick={() => !busy && onClose(false)} role="dialog" aria-modal="true" aria-label="Change Vault Passphrase">
      <div className="acc-dialog" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <div className="acc-dialog__head">
          <h3 className="acc-dialog__title">Đổi mật khẩu mã hóa Vault</h3>
          <button className="acc-btn acc-btn--ghost" disabled={busy} onClick={() => onClose(false)}>Đóng</button>
        </div>
        <p className="acc-dialog__lede">
          Khóa mã hóa của bạn sẽ được niêm phong lại bằng mật khẩu mới. Mọi tài khoản hiện có vẫn được giữ nguyên vẹn.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '12px', marginTop: '8px' }}>
          <div>
            <label className="acc-sect__meta" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }} htmlFor="curr-pass">
              Mật khẩu hiện tại:
            </label>
            <input
              id="curr-pass"
              type="password"
              className="acc-input"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              placeholder="Nhập mật khẩu Vault hiện tại"
              required
              autoFocus
              disabled={busy}
            />
          </div>
          <div>
            <label className="acc-sect__meta" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }} htmlFor="new-pass">
              Mật khẩu mới (tối thiểu 12 ký tự):
            </label>
            <input
              id="new-pass"
              type="password"
              className="acc-input"
              value={newPass}
              minLength={12}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Nhập mật khẩu mới"
              required
              disabled={busy}
            />
          </div>
          <div>
            <label className="acc-sect__meta" style={{ display: 'block', marginBottom: '4px', fontWeight: 600 }} htmlFor="conf-pass">
              Xác nhận mật khẩu mới:
            </label>
            <input
              id="conf-pass"
              type="password"
              className="acc-input"
              value={confirmPass}
              minLength={12}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              required
              disabled={busy}
            />
          </div>
          {error && (
            <div className="acc-gate__error" role="alert">{error}</div>
          )}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
            <button type="button" className="acc-btn acc-btn--ghost" disabled={busy} onClick={() => onClose(false)}>
              Huỷ
            </button>
            <button type="submit" className="acc-btn acc-btn--primary" disabled={busy || !currentPass || !newPass || !confirmPass}>
              {busy ? 'Đang cập nhật…' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function VaultGate({ status, error, onSetup, onUnlock, onExport, onRestore }) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'loading') {
    return (
      <div className="acc-vault acc-gate">
        <div className="acc-gate__card" aria-live="polite">Checking encrypted Vault…</div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="acc-vault acc-gate">
        <div className="acc-gate__card">
          <AppIcon name="warning" size={24} />
          <h1>Vault unavailable</h1>
          <p role="alert">{error}</p>
        </div>
      </div>
    );
  }

  const setup = status === 'setup';
  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (setup && passphrase !== confirmation) {
      setFormError('Passphrases do not match.');
      return;
    }
    setBusy(true);
    const result = setup ? await onSetup(passphrase) : await onUnlock(passphrase);
    setBusy(false);
    if (!result.ok) setFormError(result.error || 'Could not open the Vault.');
  };

  return (
    <div className="acc-vault acc-gate">
      <form className="acc-gate__card" onSubmit={submit}>
        <div className="acc-gate__icon"><AppIcon name="lock" size={24} /></div>
        <div className="acc-brand__name">Keyplate</div>
        <h1>{setup ? 'Create Vault passphrase' : 'Unlock Vault'}</h1>
        <p>
          {setup
            ? 'This separate passphrase encrypts every item property before it reaches Supabase.'
            : 'Your account list stays encrypted until this passphrase unwraps the key in this browser.'}
        </p>

        <label htmlFor="vault-passphrase">Vault passphrase</label>
        <input
          id="vault-passphrase"
          className="acc-input"
          type="password"
          minLength={12}
          autoComplete={setup ? 'new-password' : 'current-password'}
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          autoFocus
          required
        />

        {setup && (
          <>
            <label htmlFor="vault-passphrase-confirm">Confirm passphrase</label>
            <input
              id="vault-passphrase-confirm"
              className="acc-input"
              type="password"
              minLength={12}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />
            <div className="acc-gate__warning">
              There is no reset or recovery path if this passphrase is lost.
            </div>
          </>
        )}

        {(formError || error) && (
          <div className="acc-gate__error" role="alert">{formError || error}</div>
        )}
        <button className="acc-btn acc-btn--primary" type="submit" disabled={busy}>
          {busy ? 'Working…' : setup ? 'Create encrypted Vault' : 'Unlock'}
        </button>
      </form>

      <VaultBackup onExport={onExport} onRestore={onRestore} />
    </div>
  );
}

/* ── Backup / restore ────────────────────────────────────────────
   Đặt ở MÀN HÌNH KHOÁ, không ở header đã unlock: đây đúng là lúc cần khôi phục
   (máy mới → màn setup), và export không cần key nên không có lý do phải vào
   trong mới sao lưu được. Đang unlock mà muốn backup thì bấm Lock trước — thêm
   một bước, nhưng bước đó cũng buộc bạn xác nhận mình còn mở lại được.

   File backup KHÔNG phải plaintext: nó chứa ciphertext + wrapped DEK, ai lấy được
   vẫn cần passphrase gốc. Nhưng mất passphrase thì file cũng vô dụng — đó là lý do
   dòng cảnh báo dưới đây không được bỏ. */
function VaultBackup({ onExport, onRestore }) {
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState(null);   // { ok, text }
  const [migration, setMigration] = useState(null); // { backup, sourcePassphrase }
  const [migrationError, setMigrationError] = useState('');

  const download = async () => {
    setBusy('export');
    setNote(null);
    setMigration(null);
    const result = await onExport();
    setBusy('');
    if (!result.ok) return setNote({ ok: false, text: result.error });

    const blob = new Blob([JSON.stringify(result.backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifehub-vault-${result.backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNote({ ok: true, text: `Exported ${result.backup.items.length} encrypted item(s). Keep the file and the passphrase apart.` });
  };

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy('restore');
    setNote(null);
    setMigration(null);
    setMigrationError('');
    let backup;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      setBusy('');
      return setNote({ ok: false, text: 'That file is not valid JSON.' });
    }
    const result = await onRestore(backup);
    setBusy('');

    if (result.needSourcePassphrase) {
      setMigration({ backup, sourcePassphrase: '' });
      return;
    }

    setNote(result.ok
      ? { ok: true, text: `Restored ${result.restored} item(s). Unlock with the passphrase that backup was made with.` }
      : { ok: false, text: result.error });
  };

  const handleMigrationConfirm = async () => {
    if (!migration?.sourcePassphrase || !migration?.backup) return;
    setBusy('restore');
    setMigrationError('');
    const result = await onRestore(migration.backup, {
      sourcePassphrase: migration.sourcePassphrase,
    });
    setBusy('');
    if (result.ok) {
      setMigration(null);
      setNote({
        ok: true,
        text: `Đã chuyển giao và tái mã hóa thành công ${result.restored} mục sang tài khoản này! Hãy mở khóa bằng mật khẩu Vault.`,
      });
    } else {
      setMigrationError(result.error || 'Giải mã thất bại. Vui lòng kiểm tra lại mật khẩu Vault gốc.');
    }
  };

  return (
    <div className="acc-gate__backup">
      <div className="acc-gate__backup-row">
        <button type="button" className="acc-act" onClick={download} disabled={!!busy}>
          {busy === 'export' ? 'Exporting…' : 'Export backup'}
        </button>
        <label className="acc-act">
          <input type="file" accept="application/json,.json" hidden onChange={upload} disabled={!!busy} />
          {busy === 'restore' ? 'Restoring…' : 'Restore from backup'}
        </label>
      </div>

      {migration && (
        <div className="acc-gate__migration">
          <div className="acc-gate__migration-head">
            <AppIcon name="arrowsClockwise" size={15} />
            <span>Chuyển giao dữ liệu từ tài khoản khác</span>
          </div>
          <p className="acc-gate__backup-note">
            Bản sao lưu này thuộc về tài khoản khác ({migration.backup.items?.length || 0} mục).
            Nhập mật khẩu Vault của tài khoản gốc để giải mã và mã hóa lại sang tài khoản này:
          </p>
          <div className="acc-gate__migration-field">
            <label htmlFor="mig-pass">Mật khẩu Vault gốc:</label>
            <input
              id="mig-pass"
              type="password"
              className="acc-input"
              value={migration.sourcePassphrase}
              onChange={(e) => setMigration((m) => ({ ...m, sourcePassphrase: e.target.value }))}
              placeholder="Nhập mật khẩu Vault cũ"
              disabled={!!busy}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleMigrationConfirm(); }}
            />
          </div>
          {migrationError && (
            <div className="acc-gate__error">{migrationError}</div>
          )}
          <div className="acc-gate__backup-row">
            <button
              type="button"
              className="acc-act"
              style={{ fontWeight: 700, color: 'var(--color-accent-400)' }}
              disabled={!migration.sourcePassphrase.trim() || !!busy}
              onClick={handleMigrationConfirm}
            >
              {busy === 'restore' ? 'Đang giải mã & tái mã hóa…' : 'Xác nhận chuyển giao'}
            </button>
            <button
              type="button"
              className="acc-act"
              disabled={!!busy}
              onClick={() => { setMigration(null); setMigrationError(''); }}
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      <p className={`acc-gate__backup-note${note && !note.ok ? ' acc-gate__backup-note--err' : ''}`}>
        {note
          ? note.text
          : 'The backup holds ciphertext only — it still needs this passphrase to open, and restore only '
            + 'runs into an empty Vault so it can never overwrite anything.'}
      </p>
    </div>
  );
}

/* ── Chip của filter bar ─────────────────────────────────────── */
function Chip({ icon, label, count, on, onClick }) {
  return (
    <button className={`acc-chip${on ? ' acc-chip--on' : ''}`} onClick={onClick}>
      <AppIcon name={icon} size={13} />
      <span>{label}</span>
      <span className="acc-chip__num">{count}</span>
    </button>
  );
}

/* ── Dòng danh sách ──────────────────────────────────────────── */
/* Ô 36px là AVATAR (logo/chữ cái), không phải mã 3 chữ — 20 item cùng template
   mà cùng in "ACC" thì không quét được bằng mắt. Mã vẫn giữ, xuống thành badge
   nhỏ cạnh tiêu đề: nó vẫn cần để nhận loại, và chip link + dòng sign-in đang
   dùng cùng ngôn ngữ thị giác đó. */
function ListRow({ item, on, onOpen }) {
  const tpl = TPL_BY_KEY.get(item.tpl);
  return (
    <button className={`acc-row${on ? ' acc-row--on' : ''}`} onClick={onOpen}>
      <AccountAvatar item={item} />
      <span className="acc-row__body">
        <span className="acc-row__top">
          <span className="acc-row__title">{item.title}</span>
          {/* <span> trần không có role thì aria-label bị AT bỏ qua — phải có role="img". */}
          {item.favorite && <span className="acc-row__star" role="img" aria-label="Favourite"><AppIcon name="star" size={13} weight="fill" /></span>}
          <span className="acc-row__code">{tpl?.code || '···'}</span>
        </span>
        <span className="acc-row__sub">{itemSubtitle(item, tpl?.name || 'Item')}</span>
      </span>
      <span className="acc-row__at">{relativeUpdated(item.updated)}</span>
    </button>
  );
}
