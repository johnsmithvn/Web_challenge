import { Fragment, useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAccounts } from '../hooks/useAccounts';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../components/ConfirmModal';
import AccountDetail, { GroupPicker } from '../components/AccountDetail';
import AccountAvatar from '../components/AccountAvatar';
import RootMap, { RootRow } from '../components/RootMap';
import { MoneyMatrix, MoneyPanel } from '../components/MoneyLinks';
import AppIcon from '../components/AppIcon';
import SkeletonList from '../components/SkeletonList';
import {
  matchesQuery, itemSubtitle, newId, relativeUpdated, avatarHue, groupTree, groupKey, inGroup,
  isPasswordOnly, rootsOf, untrackedIdentifiers, moneyMatrix, mailboxTitle, normalizeGroup,
  groupSuggestions, groupIcon, NO_AUTOFILL,
} from '../utils/vaultLogic';
import ACCOUNT_TEMPLATES from '../data/account-templates.json';
import '../styles/accounts.css';

/**
 * AccountsPage (/accounts) — Account Vault, thiết kế Keyplate.
 *
 * Every user-authored item property is decrypted only after the separate Vault
 * passphrase unlocks the in-memory DEK. Locked means no list or metadata browse.
 *
 * Layout: header · body 3 cột (nhóm · danh sách · chi tiết), breakpoint 900px.
 * Cột nhóm đổi dạng chỉ bằng container query: đủ rộng thì có chữ, hẹp thì thành
 * rail icon — cùng một markup.
 *
 * KHÔNG có hook đo bề rộng và không có resize listener — khác prototype. Dưới
 * 900px CSS đọc `.acc-vault[data-screen]` và cho 3 màn đi sâu dần (thiết kế
 * M1–M3): 'home' = danh sách nhóm cả màn, 'list' = item trong nhóm, 'detail'.
 * Trên 900px cùng attribute đó bị bỏ qua. Nên React chỉ giữ `screen` như một
 * state bình thường và bấm vào đâu cũng set nó, không cần biết đang ở bề rộng
 * nào. Nút back, thanh copy ghim đáy… cũng do CSS ẩn ở desktop.
 * Bất biến dựa vào đó: trên desktop `screen` chỉ còn là 'home' khi chưa bấm gì
 * (mọi lối chọn nhóm / tag / item đều set nó khác 'home').
 *
 * Dialog chọn template là dialog RIÊNG (`.acc-scrim`/`.acc-dialog`), cố ý không
 * dùng GenericModal: component đó mang style Life Hub vào và phá fidelity.
 */

const {
  templates: TEMPLATES, filterIcons: FILTER_ICONS, groupIcons: GROUP_ICONS, groupPresets: GROUP_PRESETS,
} = ACCOUNT_TEMPLATES;
const TPL_BY_KEY = new Map(TEMPLATES.map((t) => [t.key, t]));

export default function AccountsPage() {
  const { user } = useAuth();
  const { items, isLoading, saveItem, createItem, deleteItem, toggleFavorite,
    setAuthState, setCodeUsed, vaultStatus, vaultError,
    setupVault, unlockVault, lockVault, changePassphrase, recoverVault, recoveryKey, exportVault, restoreVault } = useAccounts();
  const { showToast } = useToast();
  const { confirm, ConfirmModal } = useConfirm();

  const [query, setQuery] = useState('');
  const [viewState, setView] = useState('all');   // 'all' | 'fav' | 'weak' | 'roots' | 'none' (Ungrouped) | 'g:<groupKey>'
  const [rootId, setRootId] = useState(null);     // gốc đang mở ở màn Roots (null = gốc đầu danh sách)
  const [moneySel, setMoneySel] = useState(null); // { type: 'row' | 'col', id } ở màn Money links
  const [tplFilter, setTplFilter] = useState(''); // '' = mọi loại
  const [tag, setTag] = useState(null);           // tag id
  const [selectedId, setSelectedId] = useState(null);
  const [screen, setScreen] = useState('home');   // 'home' | 'list' | 'detail' — chỉ có nghĩa dưới 900px
  const [pickerOpen, setPickerOpen] = useState(false);
  const [changePassOpen, setChangePassOpen] = useState(false);
  const [recoveryKitKey, setRecoveryKitKey] = useState(null);

  useEffect(() => {
    if (recoveryKey) {
      setRecoveryKitKey(recoveryKey);
    }
  }, [recoveryKey]);
  const [creating, setCreating] = useState(null); // tplKey đang tạo, null = rảnh
  // Chuyển nhóm hàng loạt: chế độ chọn ở danh sách + thanh Move to group
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState(() => new Set());
  const [bulkGroup, setBulkGroup] = useState('');
  const [moving, setMoving] = useState(false);
  const [newGroup, setNewGroup] = useState(0); // đổi = remount GroupPicker; >0 = "+ New group", mở sẵn ô gõ tên
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

  // ── Nhóm ────────────────────────────────────────────────────
  const tree = useMemo(() => groupTree(items), [items]);
  const groupByKey = useMemo(() => new Map(
    tree.groups.flatMap((g) => [[g.key, g], ...g.children.map((c) => [c.key, c])])
  ), [tree]);
  // Nhóm đang chọn biến mất (item cuối vừa chuyển đi) → về All, khỏi kẹt ở danh sách rỗng
  const view = viewState.startsWith('g:') && !groupByKey.has(viewState.slice(2)) ? 'all' : viewState;
  const activeGroup = view.startsWith('g:') ? groupByKey.get(view.slice(2)) : null;
  const pickView = (v) => { setView(v); setTag(null); setScreen('list'); };
  const pickTag = (id) => { setTag(tag === id ? null : id); setScreen('list'); };

  // ── Lọc ─────────────────────────────────────────────────────
  const visible = useMemo(() => items.filter((i) => {
    if (view === 'fav' && !i.favorite) return false;
    if (view === 'weak' && !isPasswordOnly(i)) return false;
    if (view === 'none' && groupKey(i.group)) return false;
    if (activeGroup && !inGroup(i, activeGroup.key)) return false;
    if (tplFilter && i.tpl !== tplFilter) return false;
    if (tag && !i.tags.some((t) => t.id === tag)) return false;
    // matchesQuery loại giá trị secret khỏi vùng tìm — xem vaultLogic.js
    return matchesQuery(i, query);
  }), [items, view, activeGroup, tplFilter, tag, query]);

  const selected = items.find((i) => i.id === selectedId) || null;

  // ── Roots ───────────────────────────────────────────────────
  // ponytail: tính lại cả cây cho mọi gốc mỗi lần items đổi — vài trăm item vẫn
  // nhẹ; cần cache theo gốc nếu vault lên hàng nghìn.
  const roots = useMemo(() => rootsOf(items), [items]);
  const untracked = useMemo(() => untrackedIdentifiers(items), [items]);
  const rootIds = useMemo(() => new Set(roots.map((r) => r.item.id)), [roots]);
  const visibleRoots = roots.filter((r) => matchesQuery(r.item, query));
  const activeRoot = roots.find((r) => r.item.id === rootId) || visibleRoots[0] || null;
  const pickRoot = (id) => { setView('roots'); setTag(null); setRootId(id); setScreen('detail'); };
  // Từ bản đồ gốc mở một item thường → rời màn Roots, sang trang chi tiết của nó
  const openItem = (id) => { setView('all'); setTag(null); open(id); };

  // ── Money links ─────────────────────────────────────────────
  const money = useMemo(() => moneyMatrix(items), [items]);
  // Chưa chọn gì → hàng đầu bảng; hàng/cột đã chọn biến mất (sửa link) → cũng về hàng đầu
  const moneyFallback = money.rows[0] ? { type: 'row', id: money.rows[0].item.id } : null;
  const activeMoney = moneySel && (moneySel.type === 'row' ? money.rows : money.cols)
    .some((x) => x.item.id === moneySel.id) ? moneySel : moneyFallback;
  const pickMoney = (sel) => { setMoneySel(sel); setScreen('detail'); };

  const counts = useMemo(() => {
    const c = { fav: 0, weak: 0 };
    for (const i of items) {
      if (i.favorite) c.fav++;
      if (isPasswordOnly(i)) c.weak++;
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

  const listTitle = tag
    ? `#${usedTags.find((t) => t.id === tag)?.name || 'tag'}`
    : activeGroup ? activeGroup.name
      : view === 'fav' ? 'Favourites'
        : view === 'weak' ? 'Password only'
          : view === 'roots' ? 'Roots'
            : view === 'money' ? 'Money links'
            : view === 'none' ? 'Ungrouped'
              : 'All items';
  const listCount = view === 'roots' ? visibleRoots.length : view === 'money' ? money.cells : visible.length;

  // Ở màn 'home' (mobile) gõ tìm kiếm là tìm TOÀN vault → nhảy sang danh sách All.
  // Ô tìm kiếm nằm ở header, header vẫn hiện ở màn 'list' → input không bị
  // unmount giữa chừng, bàn phím không tắt. Desktop: xem bất biến ở đầu file.
  const onSearch = (value) => {
    setQuery(value);
    if (screen === 'home' && value) { setView('all'); setTag(null); setScreen('list'); }
  };

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
    // Mở lại là về màn Vault từ đầu. Xoá luôn bộ lọc + chuỗi tìm kiếm (có thể chứa
    // chữ nhạy cảm), và giữ bất biến "screen 'home' = chưa chọn gì" ở đầu file.
    setScreen('home');
    setView('all');
    setTag(null);
    setQuery('');
    setRevealed({});
    setCopied(null);
    setPickerOpen(false);
    setPendingTags([]);
    setSelecting(false);
    setPicked(new Set());
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
    const id = await createItem(tplKey, { group: activeGroup?.path || '' });
    setCreating(null);
    if (!id) { showToast('Could not create the item', { icon: 'warning' }); return; }
    setPickerOpen(false);
    open(id, { edit: true });
  };

  // "Add as item" ở màn Roots: email → Email account (tiêu đề "Gmail"/"Outlook"… theo
  // tên miền, địa chỉ vào field Email address), SĐT → Identity giữ số đó. Cả hai lập
  // tức thành gốc (luật identifiersOf) mà tiêu đề không phải là chính địa chỉ.
  const handleAddRoot = async (u) => {
    if (creating) return;
    const isEmail = u.ident.includes('@');
    setCreating(isEmail ? 'email' : 'identity');
    const id = await createItem(isEmail ? 'email' : 'identity', isEmail
      ? { title: mailboxTitle(u.value), values: { 'Email address': u.value } }
      : { title: `Phone · ${u.value}`, values: { 'Phone numbers': u.value } });
    setCreating(null);
    if (!id) { showToast('Could not create the item', { icon: 'warning' }); return; }
    setView('all');
    setTag(null);
    open(id, { edit: true });
  };

  // ── Chuyển nhóm hàng loạt ───────────────────────────────────
  // Nhóm suy ra từ item nên "tạo nhóm" = chọn item rồi gõ tên nhóm mới vào thanh
  // Move to group. "+ New group" ở cột nhóm chỉ mở chế độ chọn ở All items, ô gõ
  // tên nhóm mở sẵn.
  const groupPaths = groupSuggestions(items, GROUP_PRESETS);
  const exitSelect = () => { setSelecting(false); setPicked(new Set()); setBulkGroup(''); };
  const startSelect = ({ fresh = false } = {}) => {
    setSelecting(true);
    setPicked(new Set());
    setBulkGroup('');
    if (fresh) { setView('all'); setTag(null); }
    setScreen('list');
    setNewGroup(fresh ? (n) => n + 1 : 0);
  };
  const togglePick = (id) => setPicked((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allVisiblePicked = visible.length > 0 && visible.every((i) => picked.has(i.id));
  const toggleAllVisible = () => setPicked((s) => {
    const next = new Set(s);
    visible.forEach((i) => (allVisiblePicked ? next.delete(i.id) : next.add(i.id)));
    return next;
  });

  const moveSelected = async () => {
    if (moving || !picked.size) return;
    const target = normalizeGroup(bulkGroup);
    // Bỏ qua item đã ở đúng nhóm: không ghi, không thêm dòng log thừa
    const todo = items.filter((i) => picked.has(i.id) && normalizeGroup(i.group) !== target);
    setMoving(true);
    let ok = 0;
    // Tuần tự, không Promise.all: mỗi item là một lần ghi ciphertext có CAS riêng;
    // ghi song song hàng chục request không nhanh hơn bao nhiêu mà lỗi thì khó báo.
    for (const it of todo) {
      if (await saveItem({ ...it, group: target })) ok++;
    }
    setMoving(false);
    const where = target ? target.replace('/', ' › ') : 'Ungrouped';
    if (ok < todo.length) {
      showToast(`Moved ${ok} of ${todo.length} to ${where}. The rest failed.`, { icon: 'warning' });
    } else {
      showToast(todo.length ? `Moved ${ok} item${ok === 1 ? '' : 's'} to ${where}` : `Already in ${where}`);
    }
    exitSelect();
    if (ok || !todo.length) pickView(target ? `g:${groupKey(target)}` : 'none');
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
        onRecover={recoverVault}
        onExport={exportVault}
        onRestore={restoreVault}
      />
    );
  }

  return (
    <div className="acc-vault" data-screen={screen} data-view={view === 'money' ? 'money' : undefined}>
      {/* ── Header ── */}
      <header className="acc-head">
        <div className="acc-brand">
          <span className="acc-brand__name">Keyplate</span>
          <span className="acc-brand__vault">Vault 01</span>
        </div>

        {/* Thanh điều hướng màn 'list' trên mobile (M2) — CSS ẩn ở desktop và ở các màn khác */}
        <div className="acc-head__nav">
          <button type="button" className="acc-head__back" onClick={() => setScreen('home')}>
            <AppIcon name="caretLeft" size={16} /> Vault
          </button>
          <h2 className="acc-head__title">
            {listTitle} <span className="acc-head__count">{listCount}</span>
          </h2>
        </div>

        <div className="acc-search">
          <AppIcon name="search" size={15} />
          <input
            className="acc-input"
            type="search"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            {...NO_AUTOFILL}
            placeholder={activeGroup ? `Search in ${activeGroup.name}` : `Search all ${items.length} items`}
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
          {/* Mobile: hai nút này thành nút icon 44px; chữ giấu bằng clip nên tên truy cập vẫn còn */}
          <button className="acc-act acc-head__icon" onClick={handleLock}>
            <AppIcon name="lock" size={15} /><span className="acc-head__label">Lock</span>
          </button>
          <button className="acc-btn acc-btn--primary acc-head__icon" onClick={() => setPickerOpen(true)}>
            <AppIcon name="plus" size={15} /><span className="acc-head__label">New item</span>
          </button>
        </div>
      </header>

      {vaultError && <div className="acc-vault-error" role="alert">{vaultError}</div>}

      {/* ── Body ── */}
      <div className="acc-body">
        {/* ── Cột nhóm. Thay thanh lọc Types/Tags cũ: 14/18 item cùng loại ACC nên
            lọc theo loại gần như không chia được gì; loại lùi thành select ở đầu
            danh sách. ── */}
        <nav className="acc-pane acc-groups" aria-label="Groups">
          <GroupBtn icon={FILTER_ICONS.all} label="All items" count={items.length}
            on={view === 'all' && !tag} onClick={() => pickView('all')} />
          <GroupBtn icon={FILTER_ICONS.fav} label="Favourites" count={counts.fav}
            on={view === 'fav' && !tag} onClick={() => pickView('fav')} />
          {/* Mặc định template Account chỉ có phương thức password → đây thường là danh
              sách việc cần làm thật, nên nó đứng ngay dưới All / Favourites */}
          {counts.weak > 0 && (
            <GroupBtn warn icon="warning" label="Password only" count={counts.weak}
              on={view === 'weak' && !tag} onClick={() => pickView('weak')} />
          )}
          {/* Bản đồ gốc định danh (PA3): mailbox / SĐT mà item khác dựa vào */}
          {(roots.length > 0 || untracked.length > 0) && (
            <GroupBtn icon="tree" label="Roots" count={roots.length}
              on={view === 'roots' && !tag} onClick={() => pickView('roots')} />
          )}
          {/* Ví / thẻ ⇒ tài khoản: liên kết tiền tách khỏi cây đăng nhập của Roots */}
          {money.cells > 0 && (
            <GroupBtn icon="money" label="Money links" count={money.cells}
              on={view === 'money' && !tag} onClick={() => pickView('money')} />
          )}

          <div className="acc-groups__cap">Groups</div>
          {tree.groups.map((g) => (
            <Fragment key={g.key}>
              <GroupBtn icon={groupIcon(g.name, GROUP_ICONS)} hue={avatarHue(g.name)} label={g.name} count={g.count}
                on={view === `g:${g.key}` && !tag} onClick={() => pickView(`g:${g.key}`)} />
              {/* Con mang màu của CHA: cả nhánh đọc ra là một khối */}
              {g.children.map((c) => (
                <GroupBtn key={c.key} sub icon={groupIcon(c.name, GROUP_ICONS)} hue={avatarHue(g.name)} label={c.name}
                  count={c.count} on={view === `g:${c.key}` && !tag} onClick={() => pickView(`g:${c.key}`)} />
              ))}
            </Fragment>
          ))}
          {tree.ungrouped > 0 && (
            <GroupBtn icon={GROUP_ICONS.ungrouped} label="Ungrouped" count={tree.ungrouped}
              on={view === 'none' && !tag} onClick={() => pickView('none')} />
          )}
          {tree.groups.length === 0 && items.length > 0 && (
            <p className="acc-groups__hint">Pick items with + New group, or give one a group in Edit.</p>
          )}
          {items.length > 0 && (
            <GroupBtn icon="plus" label="New group" count="" on={false} onClick={() => startSelect({ fresh: true })} />
          )}

          {/* CỐ Ý chỉ liệt kê tag đang gắn trên item của vault, không phải toàn bộ
              tag hệ thống. Chỗ chọn tag từ cả hệ thống là ở chế độ sửa của item. */}
          {usedTags.length > 0 && (
            <>
              <div className="acc-groups__cap acc-groups__cap--tags">Tags</div>
              <div className="acc-groups__tags">
                {usedTags.map((t) => (
                  <button key={t.id} type="button" aria-pressed={tag === t.id}
                    className={`acc-chip acc-chip--tag${tag === t.id ? ' acc-chip--on' : ''}`}
                    onClick={() => pickTag(t.id)}
                  >#{t.name}</button>
                ))}
              </div>
            </>
          )}

          {/* Mobile: header không còn chỗ cho nút "Đổi mật khẩu" → nó xuống cuối màn Vault.
              Desktop CSS ẩn dòng này (nút ở header vẫn còn). */}
          <button type="button" className="acc-act acc-groups__passphrase" onClick={() => setChangePassOpen(true)}>
            <AppIcon name="key" size={14} /> Đổi mật khẩu Vault
          </button>
        </nav>

        {view === 'money' ? (
          <section className="acc-pane acc-pane--list" aria-label="Money links">
            <MoneyMatrix matrix={money} selected={activeMoney} onSelect={pickMoney} />
          </section>
        ) : view === 'roots' ? (
          <section className="acc-pane acc-pane--list" aria-label="Identity roots">
            <div className="acc-listhead">
              <h2 className="acc-listhead__title">Roots</h2>
              <span className="acc-listhead__count">{visibleRoots.length}</span>
            </div>
            <p className="acc-roots__hint">Mailboxes and numbers other items lean on, most depended-on first.</p>

            {visibleRoots.map((r) => (
              <RootRow key={r.item.id} root={r} on={r.item.id === activeRoot?.item.id}
                onOpen={() => pickRoot(r.item.id)} />
            ))}
            {!roots.length && (
              <div className="acc-list__empty">
                No roots yet. An item whose title is an email or phone number, or an Identity item, becomes one.
              </div>
            )}
            {roots.length > 0 && !visibleRoots.length && (
              <div className="acc-list__empty">No roots match this search.</div>
            )}

            {untracked.length > 0 && (
              <>
                <div className="acc-roots__cap">Not in vault yet</div>
                {untracked.map((u) => (
                  <div className="acc-untracked" key={u.ident}>
                    <span className="acc-untracked__id">{u.value}</span>
                    <span className="acc-untracked__why">
                      Used by {u.items.map((i) => i.title).join(', ')}. It has no item of its own, so its
                      password and 2-step aren&apos;t tracked.
                    </span>
                    <button type="button" className="acc-act acc-untracked__add"
                      disabled={!!creating} onClick={() => handleAddRoot(u)}>
                      {creating ? 'Creating…' : '+ Add as item'}
                    </button>
                  </div>
                ))}
              </>
            )}
          </section>
        ) : (
        <section className={`acc-pane acc-pane--list${selecting ? ' acc-pane--selecting' : ''}`}>
          <div className="acc-listhead">
            <h2 className="acc-listhead__title">{listTitle}</h2>
            <span className="acc-listhead__count">
              {visible.length} {visible.length === 1 ? 'entry' : 'entries'}
            </span>
            {/* Chỉ liệt kê loại đang có item — 6 loại rỗng không chiếm chỗ */}
            <select className="acc-select acc-select--filter" value={tplFilter}
              onChange={(e) => setTplFilter(e.target.value)} aria-label="Filter by type">
              <option value="">All types</option>
              {TEMPLATES.filter((t) => counts[t.key] || t.key === tplFilter).map((t) => (
                <option key={t.key} value={t.key}>{t.chip} · {counts[t.key] || 0}</option>
              ))}
            </select>
            {items.length > 0 && (
              <button type="button" className={`acc-act${selecting ? ' acc-act--on' : ''}`} aria-pressed={selecting}
                onClick={() => (selecting ? exitSelect() : startSelect())}>
                {selecting ? 'Done' : 'Select'}
              </button>
            )}
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
            <ListRow key={i.id} item={i} on={i.id === selectedId} onOpen={() => open(i.id)}
              selecting={selecting} picked={picked.has(i.id)} onPick={() => togglePick(i.id)} />
          ))}

          {selecting && (
            <div className="acc-bulkbar" role="region" aria-label="Move selected items to a group">
              <div className="acc-bulkbar__top">
                <span className="acc-bulkbar__count">{picked.size} selected</span>
                <button type="button" className="acc-act" onClick={toggleAllVisible} disabled={!visible.length}>
                  {allVisiblePicked ? 'Clear these' : `Select all ${visible.length}`}
                </button>
              </div>
              <div className="acc-bulkbar__row">
                <GroupPicker key={newGroup} startCustom={newGroup > 0} value={bulkGroup} onChange={setBulkGroup}
                  paths={groupPaths} onEnter={moveSelected} />
                <button type="button" className="acc-btn acc-btn--primary" onClick={moveSelected}
                  disabled={!picked.size || moving}>
                  {moving ? 'Moving…' : 'Move'}
                </button>
                <button type="button" className="acc-btn" onClick={exitSelect} disabled={moving}>Cancel</button>
              </div>
            </div>
          )}
        </section>
        )}

        <section className="acc-pane acc-pane--detail">
          {view === 'money' ? (
            <MoneyPanel
              key={activeMoney ? `${activeMoney.type}:${activeMoney.id}` : 'none'}
              items={items}
              matrix={money}
              selected={activeMoney}
              rootIds={rootIds}
              backLabel="Money links"
              onBack={() => setScreen('list')}
              onOpenItem={openItem}
              onPickRoot={pickRoot}
            />
          ) : view === 'roots' ? (
            activeRoot ? (
              <RootMap
                key={activeRoot.item.id}
                root={activeRoot}
                items={items}
                rootIds={rootIds}
                backLabel="Roots"
                onBack={() => setScreen('list')}
                onOpenItem={openItem}
                onPickRoot={pickRoot}
              />
            ) : (
              <div className="acc-detail__blank">
                <div>
                  <h2>No root selected</h2>
                  <p>Roots appear once an item is titled with an email or phone number.</p>
                </div>
              </div>
            )
          ) : selected ? (
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
              backLabel={listTitle}
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

      <RecoveryKeyModal
        recoveryKey={recoveryKitKey}
        onClose={() => setRecoveryKitKey(null)}
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

function RecoveryKeyModal({ recoveryKey, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!recoveryKey) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = `LIFE HUB VAULT - EMERGENCY RECOVERY KEY\n`
      + `========================================\n`
      + `Recovery Key: ${recoveryKey}\n`
      + `Created: ${new Date().toISOString()}\n\n`
      + `IMPORTANT: Keep this key safe. If you ever forget your Vault passphrase, `
      + `this key is the ONLY way to recover your encrypted accounts.\n`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifehub-vault-recovery-key.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return createPortal(
    <div className="acc-scrim" role="dialog" aria-modal="true" aria-label="Emergency Recovery Key">
      <div className="acc-dialog" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <div className="acc-dialog__head">
          <h3 className="acc-dialog__title">Khóa khôi phục dự phòng (Recovery Key)</h3>
          <button className="acc-btn acc-btn--ghost" onClick={onClose}>Đóng</button>
        </div>
        <p className="acc-dialog__lede">
          Nếu bạn quên mật khẩu Vault, khóa này là cách <strong>duy nhất</strong> để lấy lại quyền truy cập vào danh sách tài khoản của bạn.
        </p>

        <div style={{
          background: 'var(--bg-card-subtle, rgba(0,0,0,0.15))',
          padding: '14px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '0.95rem',
          fontWeight: 700,
          letterSpacing: '1px',
          textAlign: 'center',
          wordBreak: 'break-all',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
          color: 'var(--purple, #a78bfa)',
          margin: '12px 0'
        }}>
          {recoveryKey}
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', margin: '14px 0' }}>
          <button type="button" className="acc-btn" onClick={handleCopy}>
            {copied ? '✓ Đã sao chép' : 'Sao chép khóa'}
          </button>
          <button type="button" className="acc-btn acc-btn--primary" onClick={handleDownload}>
            Tải file .txt về máy
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button type="button" className="acc-btn acc-btn--ghost" onClick={onClose}>
            Tôi đã lưu khóa an toàn
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function VaultGate({ status, error, onSetup, onUnlock, onRecover, onExport, onRestore }) {
  const [mode, setMode] = useState('standard'); // 'standard' | 'recover'
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
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

    if (mode === 'recover') {
      if (!recoveryKeyInput.trim()) {
        setFormError('Vui lòng nhập mã Recovery Key.');
        return;
      }
      if (passphrase.length < 12) {
        setFormError('Mật khẩu Vault mới phải có ít nhất 12 ký tự.');
        return;
      }
      if (passphrase !== confirmation) {
        setFormError('Mật khẩu xác nhận không khớp.');
        return;
      }
      setBusy(true);
      const result = await onRecover(recoveryKeyInput.trim(), passphrase);
      setBusy(false);
      if (!result.ok) setFormError(result.error || 'Khôi phục Vault thất bại.');
      return;
    }

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
        {mode === 'recover' ? (
          <>
            <div className="acc-gate__icon"><AppIcon name="shieldCheck" size={24} /></div>
            <div className="acc-brand__name">Keyplate</div>
            <h1>Khôi phục Vault</h1>
            <p>Nhập mã Recovery Key dự phòng và đặt một mật khẩu Vault mới.</p>

            <label htmlFor="vault-rec-key">Mã Recovery Key</label>
            <input
              id="vault-rec-key"
              className="acc-input"
              type="text"
              placeholder="LHV1-XXXX-XXXX-..."
              value={recoveryKeyInput}
              onChange={(e) => setRecoveryKeyInput(e.target.value)}
              required
              autoFocus
            />

            <label htmlFor="vault-passphrase-new">Mật khẩu Vault mới (tối thiểu 12 ký tự)</label>
            <input
              id="vault-passphrase-new"
              className="acc-input"
              type="password"
              minLength={12}
              autoComplete="new-password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              required
            />

            <label htmlFor="vault-passphrase-new-confirm">Xác nhận mật khẩu mới</label>
            <input
              id="vault-passphrase-new-confirm"
              className="acc-input"
              type="password"
              minLength={12}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              required
            />

            {(formError || error) && (
              <div className="acc-gate__error" role="alert">{formError || error}</div>
            )}
            <button className="acc-btn acc-btn--primary" type="submit" disabled={busy}>
              {busy ? 'Đang khôi phục…' : 'Khôi phục và Mở khóa'}
            </button>

            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <button
                type="button"
                className="acc-btn acc-btn--ghost"
                style={{ fontSize: '0.85rem' }}
                onClick={() => { setMode('standard'); setFormError(''); }}
              >
                ← Quay lại Mở khóa bằng mật khẩu
              </button>
            </div>
          </>
        ) : (
          <>
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
                  Khóa khôi phục dự phòng (Recovery Key) sẽ được cấp ngay sau khi bạn tạo Vault.
                </div>
              </>
            )}

            {(formError || error) && (
              <div className="acc-gate__error" role="alert">{formError || error}</div>
            )}
            <button className="acc-btn acc-btn--primary" type="submit" disabled={busy}>
              {busy ? 'Working…' : setup ? 'Create encrypted Vault' : 'Unlock'}
            </button>

            {!setup && (
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  className="acc-btn acc-btn--ghost"
                  style={{ fontSize: '0.82rem' }}
                  onClick={() => { setMode('recover'); setFormError(''); }}
                >
                  Quên mật khẩu Vault? Khôi phục bằng Recovery Key
                </button>
              </div>
            )}
          </>
        )}
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

/* ── Một dòng của cột nhóm ───────────────────────────────────── */
/* `hue` → `--h`, cùng công thức màu với avatar; không có hue (All, Favourites,
   Ungrouped) thì plate trung tính. Tên luôn nằm trong DOM: ở dạng rail CSS chỉ
   giấu bằng clip, nên nút vẫn có tên truy cập được; `title` là tooltip khi rê. */
function GroupBtn({ icon, hue, label, count, on, sub, warn, onClick }) {
  const tone = warn ? ' acc-grp--warn' : hue === undefined ? ' acc-grp--plain' : '';
  return (
    <button type="button" title={label} aria-pressed={on} onClick={onClick}
      className={`acc-grp${sub ? ' acc-grp--sub' : ''}${tone}${on ? ' acc-grp--on' : ''}`}
      style={hue === undefined ? undefined : { '--h': hue }}>
      <span className="acc-grp__plate"><AppIcon name={icon} size={15} /></span>
      <span className="acc-grp__name">{label}</span>
      <span className="acc-grp__num">{count}</span>
      {/* Mũi tên "đi sâu" chỉ hiện ở màn Vault mobile (M1), nơi mỗi dòng mở ra một màn mới */}
      <span className="acc-grp__chev" aria-hidden="true"><AppIcon name="caretRight" size={13} /></span>
    </button>
  );
}

/* ── Dòng danh sách ──────────────────────────────────────────── */
/* Ô 36px là AVATAR (logo/chữ cái), không phải mã 3 chữ — 20 item cùng template
   mà cùng in "ACC" thì không quét được bằng mắt. Mã vẫn giữ, xuống thành badge
   nhỏ cạnh tiêu đề: nó vẫn cần để nhận loại, và chip link + dòng sign-in đang
   dùng cùng ngôn ngữ thị giác đó. */
function ListRow({ item, on, onOpen, selecting, picked, onPick }) {
  const tpl = TPL_BY_KEY.get(item.tpl);
  // Chế độ chọn: cả dòng là <label> bọc checkbox thật — bấm đâu cũng bật/tắt, và
  // không có control lồng trong <button> (HTML không cho).
  const Row = selecting ? 'label' : 'button';
  return (
    <Row className={`acc-row${selecting ? ' acc-row--select' : on ? ' acc-row--on' : ''}${picked ? ' acc-row--picked' : ''}`}
      onClick={selecting ? undefined : onOpen}>
      {selecting && <input type="checkbox" className="acc-row__check" checked={picked} onChange={onPick} />}
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
      <span className="acc-row__side">
        <span className="acc-row__at">{relativeUpdated(item.updated)}</span>
        {/* Chỉ cờ rủi ro, không cờ "an toàn": màu vàng chỉ xuất hiện khi có việc phải làm */}
        {isPasswordOnly(item) && <span className="acc-row__auth">PWD only</span>}
      </span>
    </Row>
  );
}
