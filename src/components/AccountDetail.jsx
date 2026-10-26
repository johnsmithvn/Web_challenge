import { useState, useRef, useEffect, useMemo } from 'react';
import {
  TYPES, TYPE_HINT, isSecretType, scorePassword, generatePassword, parseCodes, codeSheet,
  linkableValues, relativeUpdated, formatStamp, newId, normalizeUrl, itemSubtitle,
  normalizeGroup, dependentsOf, isPasswordOnly, linkKind, moneySourcesOf,
  titleSuggestions, mailboxTitle, groupSuggestions, groupKey, NO_AUTOFILL, groupIcon,
} from '../utils/vaultLogic';
import ACCOUNT_TEMPLATES from '../data/account-templates.json';
import AppIcon from './AppIcon';
import AccountAvatar from './AccountAvatar';
import SearchSelect from './SearchSelect';

/**
 * AccountDetail — pane chi tiết một item, cả chế độ XEM và SỬA.
 *
 * Props-driven, KHÔNG gọi supabase (RULES §12). "Edit" clone item vào `draft`
 * cục bộ; mọi thao tác sửa draft; "Save changes" đẩy draft lên qua onSave (hook
 * tự diff ra log — xem useAccounts.saveItem). "Cancel" vứt draft.
 *
 * Ngoài chế độ sửa, bật/tắt phương thức đăng nhập và đánh dấu mã đã dùng ghi
 * log NGAY qua onSetAuthState / onSetCodeUsed. Trong chế độ sửa, các thay đổi
 * đó vào draft và chỉ thành log khi Save.
 *
 * ⚠️ Ở chế độ sửa, mọi control là input/select CÓ VIỀN THẬT (`.acc-input`,
 *    `.acc-select`) — đúng như template của bản thiết kế. Bản trước làm input
 *    không viền theo pattern Proton Pass; đó là lý do chế độ sửa trông như text
 *    trần. Đừng "dọn" viền đi lần nữa.
 *
 * ⚠️ CỐ Ý lệch RULES §4 (GenericModal): vault có bộ token riêng,
 *    component đó kéo style Life Hub vào và phá fidelity.
 *
 * Password generation is enabled because the complete item now reaches Supabase
 * only as an authenticated encrypted payload.
 */

const {
  templates: TEMPLATES, authKinds: AUTH_KINDS, titlePresets: TITLE_PRESETS, groupPresets: GROUP_PRESETS, groupIcons: GROUP_ICONS,
} = ACCOUNT_TEMPLATES;
const TPL_BY_KEY = new Map(TEMPLATES.map((t) => [t.key, t]));
const TYPE_LABEL = Object.fromEntries(TYPES.map((t) => [t.value, t.label]));
const AUTH_KIND_LIST = Object.entries(AUTH_KINDS).map(([value, v]) => ({ value, ...v }));
const CARD_BRANDS = ['Visa', 'Mastercard', 'JCB', 'American Express', 'UnionPay', 'Napas', 'Discover'];

const clone = (x) => structuredClone(x);

/* ══ Logo item ═══════════════════════════════════════════════════
   File ảnh → data URI PNG 48×48. Vẽ lại qua canvas nên KHÔNG giữ một byte nào
   của file gốc: script trong SVG, EXIF, payload lạ đều biến mất. Bước thu nhỏ
   đồng thời là bước diệt trùng — vì thế không bao giờ lưu bytes gốc.

   48px vì logo chỉ hiện ở ô 36px. Ảnh gốc 180×180 lưu nguyên là ~55 KB base64
   nằm trong ciphertext, phải tải + giải mã lại MỖI lần mở vault; 48×48 là ~3 KB.
   Cap 16 KB là lưới an toàn, canvas 48×48 thực tế không bao giờ chạm tới. */
const LOGO_PX = 48;
const LOGO_LIMIT = 16 * 1024;

function fileToLogo(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = LOGO_PX;
      canvas.height = LOGO_PX;
      // contain: giữ tỉ lệ, canh giữa — logo vuông thì lấp đầy, logo dài thì
      // thu vừa khung chứ không bị bóp méo
      const scale = Math.min(LOGO_PX / img.width, LOGO_PX / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      canvas.getContext('2d').drawImage(img, (LOGO_PX - w) / 2, (LOGO_PX - h) / 2, w, h);
      const out = canvas.toDataURL('image/png');
      if (out.length > LOGO_LIMIT) reject(new Error('Image is too complex — try a simpler one'));
      else resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('That file is not an image the browser can read'));
    };
    img.src = objectUrl;
  });
}

export default function AccountDetail({
  item, items, tags, revealed, copied, autoEdit = false, backLabel = 'All items',
  onBack, onOpen, onCopy, onToggleReveal, onToggleFavorite, onSave, onDelete,
  onSetAuthState, onSetCodeUsed, onAddTag,
}) {
  // `autoEdit` chỉ đọc ở lúc MOUNT. Component được key theo item.id ở
  // AccountsPage nên đổi item là remount — không cần effect đồng bộ lại.
  const [draft, setDraft] = useState(() => (autoEdit ? clone(item) : null));
  const [tagIds, setTagIds] = useState(() => (autoEdit ? item.tags.map((t) => t.id) : []));
  const [saving, setSaving] = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);
  const [codesRevealed, setCodesRevealed] = useState(false);
  const [newAuthKind, setNewAuthKind] = useState('password');
  const [newTag, setNewTag] = useState('');
  const [logoError, setLogoError] = useState('');
  const titleRef = useRef(null);
  const editing = !!draft;
  const shown = draft || item;
  const tpl = TPL_BY_KEY.get(shown.tpl);

  // Item vừa tạo từ template có tiêu đề tạm ("New platform account") — chọn sẵn
  // nó để user gõ đè được ngay, không phải bôi đen bằng tay.
  useEffect(() => {
    if (autoEdit && titleRef.current) titleRef.current.select();
  }, [autoEdit]);

  // patchDraft: sửa bản nháp bằng hàm mutate trên bản clone (như prototype)
  const patch = (fn) => setDraft((d) => { const c = clone(d); fn(c); return c; });

  const startEdit = () => {
    setDraft(clone(item));
    setTagIds(item.tags.map((t) => t.id));
  };

  const save = async () => {
    setSaving(true);
    // Email account để trống tiêu đề (hoặc còn "New email account") → tự đặt theo địa
    // chỉ (Gmail, Outlook…), đúng quy chuẩn tên — khỏi phải nghĩ tên cho hộp thư
    const autoTitle = draft.tpl === 'email' && draftAddress && (!draft.title.trim() || /^new\s/i.test(draft.title));
    const ok = await onSave(autoTitle ? { ...draft, title: mailboxTitle(draftAddress) } : draft, tagIds);
    setSaving(false);
    if (ok) setDraft(null);
  };

  const [draggedFieldIdx, setDraggedFieldIdx] = useState(null);
  const [dragOverFieldIdx, setDragOverFieldIdx] = useState(null);

  // moveField: Thay đổi vị trí field trong bản nháp (Reorder)
  const moveField = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= (draft?.fields?.length || 0) || fromIdx === toIdx) return;
    patch((d) => {
      const [moved] = d.fields.splice(fromIdx, 1);
      d.fields.splice(toIdx, 0, moved);
    });
  };

  const pickLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';   // reset để chọn LẠI cùng một file vẫn kích hoạt onChange
    if (!file) return;
    setLogoError('');
    try {
      const logo = await fileToLogo(file);
      patch((d) => { d.logo = logo; });
    } catch (error) {
      setLogoError(error.message);
    }
  };

  const codes = shown.codes || [];
  const showCodes = codes.length > 0 || shown.auth.some((a) => a.kind === 'codes');

  // Link là một chiều: field `link` chỉ sống ở item NGUỒN, item đích không biết
  // ai trỏ tới mình. Quét ngược `items` (đã giải mã sẵn trong AccountsPage) để
  // item đích thấy được — không thêm cột/bảng nào. dependentsOf còn ghép theo giá
  // trị (username = SĐT/email của gốc) và đi tiếp xuống cấp 2, 3: Gmail → ngân
  // hàng → thẻ của ngân hàng đó.
  const dependents = useMemo(() => dependentsOf(items, item.id), [items, item.id]);
  // Liên kết tiền KHÔNG nằm trong cây trên (xem LINK_KINDS) — ngân hàng thấy ví nào rút được từ nó ở đây
  const moneySources = useMemo(() => moneySourcesOf(items, item.id), [items, item.id]);
  const directCount = dependents.filter((d) => d.depth === 1).length;
  const depth = dependents.reduce((m, d) => Math.max(m, d.depth), 0);
  const activeAuth = item.auth.filter((a) => a.state !== 'off');
  const passwordOnly = isPasswordOnly(item);
  const signinLabel = !activeAuth.length ? 'None'
    : passwordOnly ? 'Password only'
      : activeAuth.length === 1 ? AUTH_KINDS[activeAuth[0].kind]?.label || activeAuth[0].kind
        : `${activeAuth.length} methods`;
  // Nhóm đã dùng trước, rồi bộ nhóm chuẩn — xem _groupPresetsNote trong account-templates.json
  const groupPaths = useMemo(() => groupSuggestions(items, GROUP_PRESETS), [items]);
  const groupLabel = normalizeGroup(item.group).replace('/', ' › ');

  // Gợi ý tiêu đề (tiêu đề = tên dịch vụ): Email account có địa chỉ thì "Gmail"/"Outlook"
  // đứng đầu, rồi tên đã dùng trong vault, rồi danh sách dịch vụ hay dùng
  const draftAddress = draft?.tpl === 'email'
    ? (draft.fields.find((f) => f.type === 'email' && f.value) || draft.fields.find((f) => /@/.test(f.value || '')))?.value
    : '';
  const titleOptions = useMemo(
    () => (draft
      ? titleSuggestions(items, TITLE_PRESETS, draftAddress ? [mailboxTitle(draftAddress)] : [], { mailbox: draft.tpl === 'email' })
      : []),
    [draft, items, draftAddress],
  );
  // Chọn đúng một tên có trong gợi ý khi item CHƯA có nhóm → điền nhóm theo; đã có nhóm thì không đè
  const setTitle = (value) => patch((d) => {
    d.title = value;
    const hit = titleOptions.find((o) => o.title.toLocaleLowerCase('vi') === value.trim().toLocaleLowerCase('vi'));
    if (hit?.group && !normalizeGroup(d.group)) d.group = hit.group;
  });

  // Thanh copy ghim đáy (chỉ mobile, M3): copy tên đăng nhập / secret là việc làm
  // nhiều nhất, nên nó nằm dưới ngón cái thay vì giữa danh sách field. Nhãn lấy
  // theo field ("Copy card number" cho thẻ) — không đoán là "password".
  const firstValue = (f) => (f.type === 'multi' ? (f.values || [])[0] || '' : f.value || '');
  const userField = item.fields.find((f) => !isSecretType(f.type)
    && /^(username|email|emails|primary email|email address)$/i.test(f.label) && firstValue(f));
  const passField = item.fields.find((f) => f.type === 'password' && f.value);

  return (
    <article className={`acc-detail${editing ? ' acc-detail--editing' : ''}`}>
      {/* ── 1. Khối tiêu đề ── */}
      <header className="acc-title">
        <div className="acc-title__main">
          {/* CSS ẩn nút này từ 900px trở lên — desktop có cả 2 pane cùng lúc.
              Mobile: nó cùng hàng với ☆ / Edit thành thanh điều hướng (M3). */}
          <button className="acc-btn acc-btn--ghost acc-back" onClick={onBack}>
            <AppIcon name="caretLeft" size={15} /> {backLabel}
          </button>

          {/* Logo lưu TRONG encrypted payload, không phải Storage/Drive: URL công
              khai ở hai chỗ đó là tự khai bạn có tài khoản dịch vụ nào. Đổi lại
              phải chịu base64 hai lần — đáng, vì logo cũng được mã hoá như password. */}
          {editing && (
            <div className="acc-logoedit">
              <AccountAvatar item={draft} />
              <label className="acc-act">
                <input type="file" accept="image/*" hidden onChange={pickLogo} />
                {draft.logo ? 'Replace logo' : 'Choose a logo'}
              </label>
              {draft.logo && (
                <button className="acc-act acc-act--x" onClick={() => patch((d) => { d.logo = ''; })}>
                  <AppIcon name="x" size={14} /> Remove
                </button>
              )}
              {logoError
                ? <span className="acc-logoedit__err">{logoError}</span>
                : <span className="acc-logoedit__hint">Resized to 48×48 PNG and stored encrypted.</span>}
            </div>
          )}

          {/* Đổi Type KHÔNG thêm/bớt field: field thuộc item, template chỉ điền sẵn
              lúc tạo. Mọi `tpl` đọc lên đều là key hợp lệ nhờ alias trong
              cleanItem (useAccounts.js), nên select luôn khớp một option. */}
          {editing ? (
            <div className="acc-title__meta">
              <select
                className="acc-select acc-select--tpl"
                value={shown.tpl}
                onChange={(e) => patch((d) => { d.tpl = e.target.value; })}
                aria-label="Item type"
              >
                {TEMPLATES.map((t) => (
                  <option key={t.key} value={t.key}>{t.name} · {t.code}</option>
                ))}
              </select>
              <GroupPicker value={draft.group || ''} onChange={(g) => patch((d) => { d.group = g; })} paths={groupPaths} />
            </div>
          ) : (
            <div className="acc-title__kicker">
              {groupLabel ? `${groupLabel} · ${tpl?.code || '···'}` : `${tpl?.name || 'Item'} · ${tpl?.code || '···'}`}
            </div>
          )}

          {editing ? (
            <SearchSelect
              allowCustom
              size="lg"
              className="acc-title__searchselect"
              value={draft.title}
              onChange={(val) => setTitle(val)}
              options={titleOptions.map((o) => ({
                value: o.title,
                label: o.title,
                sub: o.group ? o.group.replace('/', ' › ') : undefined,
              }))}
              placeholder={draftAddress ? `${mailboxTitle(draftAddress)} (set from the address on save)` : 'Service name, e.g. VIB, Gmail, Shopee'}
              noResultsText="No matching service"
              ariaLabel="Item title"
              inputRef={titleRef}
              inputProps={NO_AUTOFILL}
              clearable
            />
          ) : (
            <h1 className="acc-title__h1">{item.title}</h1>
          )}

          {editing ? (
            <TagEditor
              tags={tags} tagIds={tagIds} setTagIds={setTagIds}
              newTag={newTag} setNewTag={setNewTag} onAddTag={onAddTag}
            />
          ) : item.tags.length > 0 && (
            <div className="acc-title__tags">
              {item.tags.map((t) => <span key={t.id} className="acc-tag">{t.name}</span>)}
            </div>
          )}
        </div>

        <div className="acc-title__actions">
          {editing ? (
            <>
              <button className="acc-btn" onClick={() => setDraft(null)} disabled={saving}>Cancel</button>
              <button className="acc-btn acc-btn--primary" onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          ) : (
            <>
              <button
                className={`acc-btn acc-btn--icon${item.favorite ? ' acc-btn--on' : ''}`}
                onClick={onToggleFavorite}
                aria-pressed={item.favorite}
                title="Favourite"
              aria-label="Đánh dấu yêu thích"><AppIcon name="star" size={15} weight={item.favorite ? 'fill' : 'regular'} /></button>
              <button className="acc-btn acc-btn--primary" onClick={startEdit}>Edit</button>
            </>
          )}
        </div>
      </header>

      {/* ── 1b. Dải số liệu: item này quan trọng cỡ nào, trước khi phải cuộn ── */}
      {!editing && (
        <dl className="acc-kpis">
          <div className="acc-kpi"><dt>Dependents</dt><dd>{dependents.length}</dd></div>
          <div className="acc-kpi"><dt>Depth</dt><dd>{depth || '—'}</dd></div>
          <div className={`acc-kpi${passwordOnly ? ' acc-kpi--warn' : ''}`}><dt>Sign-in</dt><dd>{signinLabel}</dd></div>
          <div className="acc-kpi"><dt>Updated</dt><dd>{relativeUpdated(item.updated)}</dd></div>
        </dl>
      )}

      {/* ── 2. Card preview (chỉ item loại card) ── */}
      {shown.tpl === 'card' && <CardPreview item={shown} revealed={revealed} />}

      {/* ── 3. Fields ── */}
      <section className="acc-sect">
        <div className="acc-sect__head">
          <h3 className="acc-sect__title">Fields</h3>
          <span className="acc-sect__meta">{shown.fields.length} recorded</span>
        </div>

        <div className="acc-panel acc-panel--fields">
          {shown.fields.map((f, idx) => (
            <FieldRow
              key={f.id}
              field={f} idx={idx} totalFields={shown.fields.length} editing={editing} items={items} ownerId={item.id}
              revealed={!!revealed[f.id]} copied={copied}
              onCopy={onCopy} onToggleReveal={onToggleReveal} onOpen={onOpen} patch={patch}
              onMoveField={moveField}
              isDragging={draggedFieldIdx === idx}
              isDragOver={dragOverFieldIdx === idx}
              // Firefox KHÔNG start drag nếu dragstart không setData — đừng bỏ dòng đó.
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(idx));
                e.dataTransfer.effectAllowed = 'move';
                setDraggedFieldIdx(idx);
              }}
              // Chỉ nhận drag do chính handle khởi tạo. Không gác thì kéo text
              // trong input value cũng bubble lên đây → đổi thứ tự ngoài ý muốn.
              onDragOver={(e) => {
                if (draggedFieldIdx === null) return;
                e.preventDefault();
                setDragOverFieldIdx(idx);
              }}
              onDragEnd={() => { setDraggedFieldIdx(null); setDragOverFieldIdx(null); }}
              onDrop={(e) => {
                if (draggedFieldIdx === null) return;
                e.preventDefault();
                if (draggedFieldIdx !== idx) moveField(draggedFieldIdx, idx);
                setDraggedFieldIdx(null);
                setDragOverFieldIdx(null);
              }}
            />
          ))}
          {shown.fields.length === 0 && (
            <div className="acc-panel__empty">
              No fields yet.{editing ? ' Add one below.' : ' Hit Edit to add one.'}
            </div>
          )}
        </div>

        {editing && <AddFieldPanel patch={patch} />}
      </section>

      {/* ── 3b. Item nào phụ thuộc vào item này. Ẩn khi đang sửa: bấm sang item
             khác là remount detail → mất draft mà không hỏi. */}
      {!editing && dependents.length > 0 && (
        <section className="acc-sect">
          <div className="acc-sect__head">
            <h3 className="acc-sect__title">Depends on this</h3>
            <span className="acc-sect__meta">
              {dependents.length} {dependents.length === 1 ? 'item' : 'items'}
              {dependents.length > directCount && ` · ${Math.max(...dependents.map((d) => d.depth))} levels`}
            </span>
          </div>
          <div className="acc-panel">
            <div className={`acc-impact${passwordOnly ? ' acc-impact--warn' : ''}`}>
              <AppIcon name={passwordOnly ? 'warning' : 'link'} size={16} />
              <span>
                {directCount} {directCount === 1 ? 'item relies' : 'items rely'} on this one
                {dependents.length > directCount && `, and ${dependents.length - directCount} more through them`}.
                {passwordOnly && ' It signs in with a password only.'}
              </span>
            </div>
            {dependents.map((d) => (
              <BacklinkRow key={d.item.id} src={d.item} via={d.via} depth={d.depth} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}

      {/* ── 3c. Ví / thẻ rút được tiền từ item này (liên kết loại tiền trỏ tới đây) ── */}
      {!editing && moneySources.length > 0 && (
        <section className="acc-sect">
          <div className="acc-sect__head">
            <h3 className="acc-sect__title">Can move money out of this</h3>
            <span className="acc-sect__meta">{moneySources.length}</span>
          </div>
          <div className="acc-panel">
            {moneySources.map((s) => (
              <BacklinkRow key={s.item.id} src={s.item} via={s.via} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}

      {/* ── 4. Sign-in methods ── */}
      <section className="acc-sect">
        <div className="acc-sect__head">
          <h3 className="acc-sect__title">Sign-in methods</h3>
          {editing && (
            <div className="acc-sect__tools">
              <select className="acc-select acc-select--kind" value={newAuthKind}
                onChange={(e) => setNewAuthKind(e.target.value)} aria-label="New sign-in method">
                {AUTH_KIND_LIST.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
              <button className="acc-act" onClick={() => patch((d) => {
                d.auth.push({
                  id: newId(), kind: newAuthKind,
                  note: AUTH_KINDS[newAuthKind]?.note || '',
                  state: d.auth.length ? 'on' : 'primary',
                });
                // Thêm 'codes' mà chưa có sheet nào → tự sinh 10 mã (đặc tả)
                if (newAuthKind === 'codes' && !(d.codes || []).length) d.codes = codeSheet(10);
              })}>+ Add method</button>
            </div>
          )}
        </div>

        <div className="acc-panel">
          {shown.auth.map((a, idx) => (
            <AuthRow
              key={a.id}
              auth={a} idx={idx} editing={editing} accountId={item.id}
              onSetAuthState={onSetAuthState} patch={patch}
            />
          ))}
          {shown.auth.length === 0 && (
            <div className="acc-panel__empty">
              No sign-in method recorded. Add one in edit mode.
            </div>
          )}
        </div>
      </section>

      {/* ── 5. Single-use codes ── */}
      {showCodes && (
        <CodeSheet
          codes={codes} editing={editing} accountId={item.id}
          revealed={codesRevealed} onReveal={() => setCodesRevealed((v) => !v)}
          copied={copied} onCopy={onCopy} onSetCodeUsed={onSetCodeUsed} patch={patch}
        />
      )}

      {/* ── 6. Notes ── */}
      <section className="acc-sect">
        <div className="acc-sect__head"><h3 className="acc-sect__title">Notes</h3></div>
        {editing ? (
          <textarea {...NO_AUTOFILL}
            className="acc-textarea acc-notes-input"
            value={draft.notes}
            onChange={(e) => patch((d) => { d.notes = e.target.value; })}
            placeholder="Security questions, account owner, anything else."
          />
        ) : (
          <p className="acc-notes">{item.notes || '—'}</p>
        )}
      </section>

      {/* ── 7. History (chỉ chế độ xem — log gắn với item, không gắn draft) ── */}
      {!editing && (
        <section className="acc-sect">
          <div className="acc-sect__head">
            <h3 className="acc-sect__title">History</h3>
            <span className="acc-sect__meta">
              {item.log.length} {item.log.length === 1 ? 'event' : 'events'}
            </span>
          </div>
          <div className="acc-hist">
            {(logExpanded ? item.log : item.log.slice(0, 4)).map((l) => (
              <div className="acc-hist__row" key={l.id}>
                <span className="acc-hist__dot" aria-hidden="true" />
                <div className="acc-hist__top">
                  <span className="acc-hist__text">{l.text}</span>
                  <span className="acc-hist__at">{formatStamp(l.at)}</span>
                </div>
                {l.detail && (
                  // Chi tiết chứa bullet (secret đã mask) → monospace để bullet
                  // thẳng hàng, đọc ra "đã che" chứ không phải một cục glyph
                  <div className={`acc-hist__detail${l.detail.includes('•') ? ' acc-hist__detail--mono' : ''}`}>
                    {l.detail}
                  </div>
                )}
              </div>
            ))}
            {item.log.length === 0 && <div className="acc-hist__empty">Nothing recorded yet.</div>}
          </div>
          {!logExpanded && item.log.length > 4 && (
            <button className="acc-act acc-addrow" style={{ marginTop: '10.2px' }}
              onClick={() => setLogExpanded(true)}>Show all {item.log.length} events</button>
          )}
        </section>
      )}

      {/* ── 8. Chân trang ── */}
      <footer className="acc-foot">
        <span>
          Updated {relativeUpdated(item.updated)}
          {' · '}{shown.fields.length} field{shown.fields.length === 1 ? '' : 's'}
          {' · '}{shown.auth.length} sign-in method{shown.auth.length === 1 ? '' : 's'}
        </span>
        {!editing && (
          <button className="acc-act acc-foot__del" onClick={onDelete}>Delete item</button>
        )}
      </footer>

      {!editing && (userField || passField) && (
        <div className="acc-copybar">
          {userField && (
            <button className="acc-btn" onClick={() => onCopy(firstValue(userField), 'bar:user')}>
              {copied === 'bar:user' ? 'Copied' : `Copy ${userField.label.toLowerCase()}`}
            </button>
          )}
          {passField && (
            <button className="acc-btn acc-btn--primary" onClick={() => onCopy(passField.value, 'bar:pass')}>
              {copied === 'bar:pass' ? 'Copied' : `Copy ${passField.label.toLowerCase()}`}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/* ══ Chọn tag (chỉ chế độ sửa) ═══════════════════════════════════
   Toàn bộ tag của hệ thống liệt kê thẳng thành hàng chip bật/tắt, KHÔNG dropdown:
   không popover thì không có outside-click, không z-index, không bị pane
   `overflow-y: auto` cắt mất — và với vài chục tag thì thấy hết một lượt còn dễ
   hơn phải mở ra tìm.
   Cố ý KHÔNG dùng `TagPicker` dùng chung: trigger của nó là chữ "+ Tag" 11px,
   opacity .7, không viền, và mọi style đều inline nên CSS của vault đè không
   được → trên nền vault nó gần như vô hình. Đó chính là lý do "không thấy chỗ
   add tag". `.acc-chip` thì đã có sẵn và đúng token của vault. */
function TagEditor({ tags, tagIds, setTagIds, newTag, setNewTag, onAddTag }) {
  const [busy, setBusy] = useState(false);

  const toggle = (id) => setTagIds((s) => (
    s.includes(id) ? s.filter((x) => x !== id) : [...s, id]
  ));

  const create = async () => {
    const name = newTag.trim();
    if (!name || busy) return;
    setBusy(true);
    // addTag trả về tag đã tồn tại nếu trùng tên, nên gõ trùng không sinh bản sao
    const tag = await onAddTag?.(name);
    setBusy(false);
    if (!tag) return;
    setNewTag('');
    setTagIds((s) => (s.includes(tag.id) ? s : [...s, tag.id]));
  };

  return (
    <div className="acc-tagedit">
      <div className="acc-tagedit__cap">Tags</div>

      {tags.length > 0 && (
        <div className="acc-tagedit__row">
          {tags.map((t) => (
            <button key={t.id} type="button"
              className={`acc-chip${tagIds.includes(t.id) ? ' acc-chip--on' : ''}`}
              aria-pressed={tagIds.includes(t.id)}
              onClick={() => toggle(t.id)}
            >#{t.name}</button>
          ))}
        </div>
      )}

      <div className="acc-tagedit__new">
        <input {...NO_AUTOFILL} className="acc-input" value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }}
          placeholder={tags.length ? 'Or create a new tag…' : 'Create your first tag…'}
          aria-label="New tag name" />
        <button className="acc-act" onClick={create} disabled={!newTag.trim() || busy}>
          {busy ? 'Adding…' : '+ Create'}
        </button>
      </div>
    </div>
  );
}

/* ══ Group picker ════════════════════════════════════════════════
   Combobox chọn hoặc gõ nhóm nhanh với SearchSelect. Hỗ trợ hiển thị
   nhóm cha/con phân cấp đẹp mắt, có icon nhóm trực quan, gõ tìm kiếm
   hoặc gõ tạo nhóm mới tuỳ ý mà không cần nhảy thêm ô input phụ.
   Dùng chung với thanh Move to group (AccountsPage). */
export function GroupPicker({ value = '', onChange, paths = [], startCustom = false, onEnter }) {
  const tops = useMemo(
    () => [...new Map(paths.map((p) => [groupKey(p.split('/')[0]), p.split('/')[0]])).values()],
    [paths],
  );

  const groupOptions = useMemo(() => {
    const list = [];
    tops.forEach((top) => {
      const subs = paths.filter((p) => groupKey(p).startsWith(`${groupKey(top)}/`));
      if (!subs.length) {
        list.push({
          value: top,
          label: top,
          icon: groupIcon(top, GROUP_ICONS),
        });
      } else {
        list.push({
          value: top,
          label: top,
          icon: groupIcon(top, GROUP_ICONS),
        });
        subs.forEach((subPath) => {
          const subName = subPath.split('/')[1] || subPath;
          list.push({
            value: subPath,
            label: `${top} › ${subName}`,
            sub: subPath, // chỉ để tìm: gõ "Tài chính/Ngân" vẫn khớp
            icon: groupIcon(subPath, GROUP_ICONS),
          });
        });
      }
    });
    return list;
  }, [paths, tops]);

  return (
    <SearchSelect
      allowCustom
      allowCreate="New group"
      value={value}
      onChange={(v) => onChange?.(v || '')}
      options={groupOptions}
      placeholder="Ungrouped"
      noResultsText="No matching group"
      size="sm"
      className="acc-grouppicker"
      clearable
      onEnter={onEnter}
      ariaLabel="Group"
      // autoFocus chỉ khi user chủ động mở (+ New group), không giành focus của ô tiêu đề
      inputProps={{ ...NO_AUTOFILL, autoFocus: startCustom }}
      renderOption={(opt, { isSelected }) => (
        <>
          <div className="search-select__option-main">
            {opt.icon && <AppIcon name={opt.icon} size={14} />}
            <span className="search-select__option-label">{opt.label}</span>
          </div>
          {isSelected && <AppIcon name="check" size={14} />}
        </>
      )}
    />
  );
}

/* ══ Card preview ════════════════════════════════════════════════ */
function CardPreview({ item, revealed }) {
  const field = (label) => {
    const f = item.fields.find((x) => x.label === label);
    return f ? (f.type === 'multi' ? (f.values || [])[0] || '' : f.value || '') : '';
  };
  const numField = item.fields.find((x) => x.label === 'Card number');
  const raw = (numField?.value || '').replace(/\s/g, '');
  const open = numField && revealed[numField.id];
  const shownNum = !raw ? '•••• •••• •••• ••••'
    : open ? raw.replace(/(.{4})/g, '$1 ').trim()
      : `•••• •••• •••• ${raw.slice(-4)}`;

  return (
    <div className="acc-cardview">
      <div className="acc-cardview__top">
        <span>{field('Issuer') || 'CARD'}</span>
        <span>{field('Brand')}</span>
      </div>
      <div className="acc-cardview__num">{shownNum}</div>
      <div className="acc-cardview__bot">
        <span>{field('Cardholder') || '—'}</span>
        <span>{field('Expires') || '—'}</span>
      </div>
    </div>
  );
}

/* ══ Một dòng "Depends on this" ══════════════════════════════════
   Đọc như một field: cột trái là ô của item kia đã trỏ tới / trùng giá trị với
   đây ("Bank login", "Username"), cột giữa là item đó. `depth` > 1 thụt vào theo
   cấp — dòng thuộc về item ngay phía trên nó. "Details" xổ giá trị NGAY TẠI CHỖ — link kiểu này hầu hết
   dùng để liếc ("thẻ nào của bank này, hết hạn bao giờ"), mà nhảy sang item rồi
   quay lại thì mất chỗ đang đứng.

   Giá trị lấy qua linkableValues: nó đã là nơi duy nhất định nghĩa "cái gì được
   phép hiện ra ngoài mà không cần Reveal" (secret bị loại) — tự duyệt fields ở
   đây là mở một đường rò thứ hai. */
function BacklinkRow({ src, via, depth = 1, onOpen }) {
  const [open, setOpen] = useState(false);
  const tpl = TPL_BY_KEY.get(src.tpl);
  const detail = linkableValues(src);

  return (
    <div className={`acc-field${depth > 1 ? ' acc-field--nested' : ''}`} style={{ '--depth': depth - 1 }}>
      <div className="acc-field__label">{via}</div>

      <div className="acc-field__col">
        <button className="acc-link" onClick={() => onOpen(src.id)}>
          <span className="acc-link__code">{tpl?.code || '···'}</span>
          <span className="acc-link__title">{src.title}</span>
          <span className="acc-link__sub">{itemSubtitle(src, tpl?.name || '')}</span>
          <span className="acc-link__arrow" aria-hidden="true">↗</span>
        </button>

        {open && (
          <dl className="acc-backdetail">
            {detail.map((d) => (
              <div className="acc-backdetail__row" key={`${d.field}:${d.value}`}>
                <dt>{d.field}</dt>
                <dd>{d.value}</dd>
              </div>
            ))}
            {!detail.length && (
              <div className="acc-backdetail__row acc-backdetail__row--empty">
                Nothing to show — that item only holds secrets.
              </div>
            )}
          </dl>
        )}
      </div>

      <div className="acc-field__acts">
        <button className="acc-act" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'Hide' : 'Details'}
        </button>
      </div>
    </div>
  );
}

/* ══ Một dòng field ══════════════════════════════════════════════ */
function FieldRow({ field: f, idx, totalFields, editing, items, ownerId, revealed, copied,
  onCopy, onToggleReveal, onOpen, patch, onMoveField,
  isDragging, isDragOver, onDragStart, onDragOver, onDragEnd, onDrop }) {
  const secret = isSecretType(f.type);

  const setType = (v) => patch((d) => {
    const fd = d.fields[idx];
    // Đổi SANG multi thì gieo mảng từ giá trị scalar đang có (đặc tả)
    if (v === 'multi' && !(fd.values || []).length) fd.values = fd.value ? [fd.value] : [''];
    if (v !== 'link') fd.links = [];
    fd.type = v;
  });

  return (
    <div
      className={`acc-field${editing ? ' acc-field--edit' : ''}${isDragging ? ' acc-field--dragging' : ''}${isDragOver ? ' acc-field--dragover' : ''}`}
      onDragOver={editing ? onDragOver : undefined}
      onDragEnd={editing ? onDragEnd : undefined}
      onDrop={editing ? onDrop : undefined}
    >
      {/* Cột 0 (chế độ sửa): MỘT grip lo cả chuột và bàn phím.
          Trước đây là handle + 2 nút mũi tên = 3 icon, chiếm gần hết cột nhãn.
          Grip là <button> nên tab tới được, và ↑/↓ khi đang focus cũng đổi vị trí
          → bỏ 2 nút mà không mất đường dùng bàn phím.

          `draggable` nằm ở ĐÚNG grip, KHÔNG ở cả row: row chứa input, mà draggable
          trên ancestor thì cướp luôn thao tác bôi đen text bằng chuột
          (Firefox/Safari) và biến mọi cú kéo text thành lệnh đổi thứ tự. */}
      {editing && (
        <button
          type="button"
          className="acc-field__drag-handle"
          draggable
          onDragStart={onDragStart}
          title={`Kéo để sắp xếp, hoặc dùng ↑ ↓ (${idx + 1}/${totalFields})`}
          aria-label={`Sắp xếp trường ${f.label || 'không tên'}, vị trí ${idx + 1} trên ${totalFields}. Kéo, hoặc dùng mũi tên lên xuống.`}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            onMoveField(idx, e.key === 'ArrowUp' ? idx - 1 : idx + 1);
          }}
        >
          <AppIcon name="dotsSix" size={16} />
        </button>
      )}

      {/* Cột 1: nhãn */}
      <div className="acc-field__label">
        {editing ? (
          <>
            <input {...NO_AUTOFILL} className="acc-input" value={f.label}
              onChange={(e) => patch((d) => { d.fields[idx].label = e.target.value; })}
              placeholder="Field name" aria-label="Field name" />
            {/* Nhãn loại — chỉ hiện với 4 loại có hành vi cần nói rõ */}
            {TYPE_HINT[f.type] && (
              <div className="acc-field__typenote">{TYPE_LABEL[f.type]}</div>
            )}
          </>
        ) : (
          <>
            {f.label}
            {/* Nói rõ loại liên kết ngay ở chế độ xem: → đăng nhập, ⇒ tiền */}
            {f.type === 'link' && (f.links || []).length > 0 && (
              <div className={`acc-field__typenote${linkKind(f) === 'money' ? ' acc-field__typenote--money' : ''}`}>
                {linkKind(f) === 'money' ? '⇒ Money link' : '→ Sign-in link'}
              </div>
            )}
          </>
        )}
      </div>

      {/* Cột 2: giá trị */}
      <div className="acc-field__col">
        {editing
          ? <EditValue field={f} idx={idx} items={items} ownerId={ownerId} patch={patch} />
          : <ViewValue field={f} items={items} revealed={revealed} copied={copied}
            onCopy={onCopy} onOpen={onOpen} />}
      </div>

      {/* Cột 3: hành động */}
      <div className="acc-field__acts">
        {!editing && secret && f.value && (
          <button className="acc-act" onClick={() => onToggleReveal(f.id)}>
            {revealed ? 'Hide' : 'Reveal'}
          </button>
        )}
        {!editing && f.value && f.type !== 'multi' && (
          <button className="acc-act" onClick={() => onCopy(f.value, f.id)}>
            <AppIcon name={copied === f.id ? 'check' : 'copy'} size={14} /> {copied === f.id ? 'Copied' : 'Copy'}
          </button>
        )}
        {editing && f.type === 'password' && (
          <button className="acc-act" onClick={() => patch((d) => {
            d.fields[idx].value = generatePassword();
          })}>
            Generate
          </button>
        )}
        {editing && (
          <select className="acc-select acc-select--type" value={f.type}
            onChange={(e) => setType(e.target.value)} aria-label="Field type">
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        )}
        {editing && (
          <button className="acc-act acc-act--x" title="Remove field" aria-label="Xóa trường"
            onClick={() => patch((d) => { d.fields.splice(idx, 1); })}><AppIcon name="x" size={14} /></button>
        )}
      </div>
    </div>
  );
}

/* ── Giá trị field ở chế độ XEM ── */
function ViewValue({ field: f, items, revealed, copied, onCopy, onOpen }) {
  if (f.type === 'multi') {
    const values = (f.values || []).filter(Boolean);
    if (!values.length) return <span className="acc-field__val acc-field__val--empty">—</span>;
    return (
      <div className="acc-multi">
        {values.map((v, i) => (
          <div className="acc-multi__row" key={`${f.id}:${i}`}>
            {/* index 0 là giá trị chính — đặc tả gọi nó là primary */}
            <span className={`acc-badge${i === 0 ? '' : ' acc-badge--alt'}`}>
              {i === 0 ? 'PRIMARY' : 'ALT'}
            </span>
            <span className="acc-multi__val">{v}</span>
            <button className="acc-act acc-act--mini" onClick={() => onCopy(v, `${f.id}:${i}`)}>
              <AppIcon name={copied === `${f.id}:${i}` ? 'check' : 'copy'} size={14} /> {copied === `${f.id}:${i}` ? '' : 'Copy'}
            </button>
          </div>
        ))}
      </div>
    );
  }

  if (f.type === 'link') {
    const links = f.links || [];
    if (!links.length) {
      return (
        <span className={`acc-field__val${f.value ? '' : ' acc-field__val--empty'}`}>
          {f.value || '—'}
        </span>
      );
    }
    return (
      <div className="acc-links">
        {links.map((L) => {
          const target = items.find((x) => x.id === L.itemId);
          if (!target) {
            // Item đích đã bị xoá. `links` là jsonb không có FK nên con trỏ còn
            // đó mà đích thì không — đúng hành vi đặc tả, xem migration §2.
            return (
              <span key={L.id} className="acc-link acc-link--dead">
                <span className="acc-link__code">···</span>
                <span className="acc-link__title">Missing item</span>
                <span className="acc-link__sub">link broken</span>
              </span>
            );
          }
          const t = TPL_BY_KEY.get(target.tpl);
          return (
            <button key={L.id} className="acc-link" onClick={() => onOpen(target.id)}>
              <span className="acc-link__code">{t?.code || '···'}</span>
              <span className="acc-link__title">{target.title}</span>
              <span className="acc-link__sub">{itemSubtitle(target, t?.name || '')}</span>
              <span className="acc-link__arrow" aria-hidden="true">↗</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (isSecretType(f.type)) {
    if (!f.value) return <span className="acc-field__val acc-field__val--empty">—</span>;
    return (
      <>
        <div className={`acc-field__val acc-field__val--mask${revealed ? ' acc-field__val--open' : ''}`}>
          {revealed ? f.value : '•'.repeat(12)}
        </div>
        {/* Chỉ `password` được tính điểm. `secret` (PIN, CVV, số giấy tờ) thì
            điểm mạnh/yếu vô nghĩa — PIN 6 số luôn "weak", nói ra không giúp gì.
            Đây là lý do 2 type này không được gộp. */}
        {f.type === 'password' && <Strength value={f.value} />}
      </>
    );
  }

  if (!f.value) return <span className="acc-field__val acc-field__val--empty">—</span>;

  if (f.type === 'url') {
    // normalizeUrl thêm https:// khi user gõ "google.com" VÀ chặn scheme lạ
    // (javascript:/data:/file:) — chuỗi này đi thẳng vào href. noreferrer để
    // không rò domain trong vault qua header Referer.
    const href = normalizeUrl(f.value);
    return (
      <div className="acc-field__val">
        {href
          ? <a href={href} target="_blank" rel="noreferrer noopener">{f.value} ↗</a>
          : f.value}
      </div>
    );
  }
  if (f.type === 'email') {
    return <div className="acc-field__val"><a href={`mailto:${f.value}`}>{f.value}</a></div>;
  }
  if (f.type === 'phone') {
    return (
      <div className="acc-field__val">
        <a href={`tel:${f.value.replace(/\s/g, '')}`}>{f.value}</a>
      </div>
    );
  }
  return <div className="acc-field__val">{f.value}</div>;
}

/* ── Giá trị field ở chế độ SỬA ── */
function EditValue({ field: f, idx, items, ownerId, patch }) {
  const [showSensitive, setShowSensitive] = useState(false);

  if (f.type === 'multi') {
    const values = f.values || [];
    return (
      <div className="acc-multi acc-multi--edit">
        {values.map((v, vi) => (
          <div className="acc-multi__row" key={vi}>
            <input {...NO_AUTOFILL} className="acc-input" value={v}
              onChange={(e) => patch((d) => { d.fields[idx].values[vi] = e.target.value; })}
              placeholder={placeholderFor(f.type)} aria-label="Value" />
            <button className={`acc-act acc-act--star${vi === 0 ? ' acc-act--on' : ''}`}
              title="Make primary"
              onClick={() => patch((d) => { const a = d.fields[idx].values; a.unshift(a.splice(vi, 1)[0]); })}
              aria-label="Đánh dấu giá trị chính"><AppIcon name="star" size={14} weight={vi === 0 ? 'fill' : 'regular'} /></button>
            <button className="acc-act acc-act--x" title="Remove value" aria-label="Xóa giá trị"
              onClick={() => patch((d) => { d.fields[idx].values.splice(vi, 1); })}><AppIcon name="x" size={14} /></button>
          </div>
        ))}
        <button className="acc-act acc-addrow"
          onClick={() => patch((d) => { d.fields[idx].values.push(''); })}>+ Add value</button>
      </div>
    );
  }

  if (f.type === 'link') {
    return (
      <>
        <LinkEditor field={f} idx={idx} items={items} ownerId={ownerId} patch={patch} />
        {(f.links || []).length > 0 && <LinkKindPicker field={f} idx={idx} patch={patch} />}
      </>
    );
  }

  const sensitive = isSecretType(f.type);
  // Secret che bằng CSS (`-webkit-text-security`, .acc-input--masked) thay vì
  // type="password": trình quản lý mật khẩu của trình duyệt chỉ bắt ô password,
  // nên không còn đòi lưu secret của vault — xem NO_AUTOFILL.
  const masked = sensitive && !showSensitive;
  const type = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
  // Field `Brand` của template card: gợi ý tổ chức thẻ qua <datalist> native —
  // chọn từ list nhưng vẫn gõ được brand ngoài list, khác <select> đóng cứng.
  const suggest = f.label === 'Brand' && f.type === 'text';
  return (
    <div className="acc-editvalue">
      <input
        className={`acc-input${masked ? ' acc-input--masked' : ''}`} type={type}
        value={f.value}
        onChange={(e) => patch((d) => { d.fields[idx].value = e.target.value; })}
        placeholder={suggest ? 'Visa, Mastercard …' : placeholderFor(f.type)}
        aria-label="Field value"
        list={suggest ? 'acc-brands' : undefined}
        inputMode={f.type === 'phone' ? 'tel' : f.type === 'url' ? 'url' : f.type === 'email' ? 'email' : undefined}
        {...NO_AUTOFILL}
        autoCorrect={sensitive ? 'off' : undefined}
        autoCapitalize={sensitive ? 'none' : undefined}
        spellCheck={sensitive ? false : undefined}
      />
      {suggest && (
        <datalist id="acc-brands">
          {CARD_BRANDS.map((b) => <option key={b} value={b} />)}
        </datalist>
      )}
      {sensitive && (
        <button type="button" className="acc-act" onClick={() => setShowSensitive((value) => !value)}>
          {showSensitive ? 'Hide' : 'Reveal'}
        </button>
      )}
    </div>
  );
}

/* ── Editor cho field link (nhiều link) ── */
function LinkEditor({ field: f, idx, items, ownerId, patch }) {
  const links = f.links || [];
  // Loại chính item đang mở khỏi danh sách chọn — không cho tự-link
  const linkOptions = useMemo(() => items.filter((x) => x.id !== ownerId), [items, ownerId]);

  // Kèm subtitle (username/email nhận diện) — chỉ `code · title` thì nhiều tài khoản cùng
  // dịch vụ ra mấy dòng GIỐNG HỆT nhau. itemSubtitle chỉ đọc SUBTITLE_LABELS nên không bao
  // giờ lôi giá trị secret vào đây.
  const selectOptions = useMemo(() => linkOptions.map((it) => {
    const t = TPL_BY_KEY.get(it.tpl);
    const sub = itemSubtitle(it);
    return {
      value: it.id,
      label: it.title,
      badge: t?.code || '···',
      sub: sub || undefined,
    };
  }), [linkOptions]);

  return (
    <div className="acc-multi acc-multi--edit">
      {links.map((L, li) => {
        return (
          <div className="acc-linkedit" key={L.id}>
            <SearchSelect
              value={L.itemId || ''}
              onChange={(val) => patch((d) => {
                d.fields[idx].links[li].itemId = val || null;
              })}
              options={selectOptions}
              placeholder="— choose an item —"
              searchPlaceholder="Search items…"
              noResultsText="No matching item"
              clearable
              size="sm"
              ariaLabel="Linked item"
            />
            <button className="acc-act acc-act--x" title="Remove link" aria-label="Xóa liên kết"
              onClick={() => patch((d) => { d.fields[idx].links.splice(li, 1); })}><AppIcon name="x" size={14} /></button>
          </div>
        );
      })}

      {/* Chưa có link: một ô vừa gợi ý item (khớp tên + subtitle, gõ SĐT/email là ra item đó) vừa nhận
          giá trị thường — chọn gợi ý thì thành link, gõ tự do thì giữ làm value không link. */}
      {links.length === 0 && (
        <SearchSelect
          allowCustom
          value={f.value || ''}
          onChange={(val, opt) => patch((d) => {
            const fd = d.fields[idx];
            if (opt) {
              (fd.links ||= []).push({ id: newId(), itemId: val });
              fd.value = '';
            } else {
              fd.value = val;
            }
          })}
          options={selectOptions}
          placeholder="Pick an item, or type a plain value (not linked)"
          noResultsText="No matching item — kept as a plain value"
          ariaLabel="Linked item or plain value"
          inputProps={NO_AUTOFILL}
        />
      )}

      {links.length > 0 && (
        <button className="acc-act acc-addrow" disabled={linkOptions.length === 0}
          onClick={() => patch((d) => {
            const other = linkOptions[0];
            d.fields[idx].links.push({ id: newId(), itemId: other ? other.id : null });
            d.fields[idx].value = '';
          })}>+ Link another item</button>
      )}
    </div>
  );
}

/* ── Loại liên kết của field link ────────────────────────────────
   Hai chip bật/tắt (aria-pressed), không phải radio: radio đòi điều hướng bằng
   phím mũi tên mà 2 lựa chọn thì không đáng. Một dòng chú thích cho loại đang
   chọn; chưa chọn tay → loại đoán theo nhãn (guessLinkKind) và nói rõ là đoán. */
function LinkKindPicker({ field: f, idx, patch }) {
  const kind = linkKind(f);
  const set = (k) => patch((d) => { d.fields[idx].kind = k; });
  const opt = (k, arrow, label) => (
    <button type="button" aria-pressed={kind === k} onClick={() => set(k)}
      className={`acc-chip${kind === k ? ' acc-chip--on' : ''}`}>
      <span aria-hidden="true" className={k === 'money' ? 'acc-linkkind__money' : undefined}>{arrow}</span> {label}
    </button>
  );
  return (
    <div className="acc-linkkind" role="group" aria-label="Link kind">
      {opt('signin', '→', 'Sign-in')}
      {opt('money', '⇒', 'Money')}
      <span className="acc-linkkind__hint">
        {kind === 'money' ? 'This item can move money out of the linked one' : 'This item is lost if the linked one is'}
        {!f.kind && ' · guessed from the field name'}
      </span>
    </div>
  );
}

/* ══ Thanh độ mạnh (chỉ xem, chỉ password) ══════════════════════ */
function Strength({ value }) {
  const s = scorePassword(value);
  return (
    <div className="acc-strength">
      <div className="acc-strength__track">
        <div className="acc-strength__fill" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
      </div>
      <span className="acc-strength__label">{s.label}</span>
    </div>
  );
}

/* ══ Panel thêm field tuỳ ý (chỉ sửa) ═══════════════════════════ */
function AddFieldPanel({ patch }) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState('text');

  const add = () => {
    patch((d) => d.fields.push({
      id: newId(), label: label.trim() || 'Untitled field', type,
      value: '', values: type === 'multi' ? [''] : [], links: [],
    }));
    setLabel('');
  };

  return (
    <div className="acc-box acc-box--addfield">
      <div className="acc-fieldgrp acc-fieldgrp--name">
        <label htmlFor="acc-newfield">Custom field name</label>
        <input {...NO_AUTOFILL} id="acc-newfield" className="acc-input" value={label}
          onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Recovery email" />
      </div>
      <div className="acc-fieldgrp acc-fieldgrp--type">
        <label htmlFor="acc-newtype">Type</label>
        <select id="acc-newtype" className="acc-select" value={type}
          onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <button className="acc-btn" onClick={add}>+ Add field</button>
      <div className="acc-box__hint">
        {TYPE_HINT[type] || 'Any field can be renamed, retyped or removed later.'}
      </div>
    </div>
  );
}

/* ══ Một dòng phương thức đăng nhập ══════════════════════════════ */
function AuthRow({ auth: a, idx, editing, accountId, onSetAuthState, patch }) {
  const k = AUTH_KINDS[a.kind] || { label: a.kind, code: '···' };
  const off = a.state === 'off';
  const badge = a.state === 'primary' ? 'PRIMARY' : off ? 'OFF' : 'ENABLED';

  const toggle = () => {
    const next = off ? 'on' : 'off';
    if (editing) patch((d) => { d.auth[idx].state = next; });
    else onSetAuthState(accountId, a.id, next);
  };
  const promote = () => {
    if (editing) patch((d) => d.auth.forEach((x, xi) => {
      x.state = xi === idx ? 'primary' : (x.state === 'primary' ? 'on' : x.state);
    }));
    else onSetAuthState(accountId, a.id, 'primary');
  };

  return (
    <div className={`acc-authrow${off ? ' acc-authrow--off' : ''}`}>
      <span className={`acc-code${a.state === 'primary' ? ' acc-code--on' : ''}${off ? ' acc-code--dim' : ''}`}>
        {k.code}
      </span>
      <div className="acc-authrow__body">
        <div className="acc-authrow__top">
          <span className="acc-authrow__label">{k.label}</span>
          <span className={`acc-badge${a.state === 'primary' ? '' : ' acc-badge--alt'}${off ? ' acc-badge--off' : ''}`}>
            {badge}
          </span>
        </div>
        {editing ? (
          <input {...NO_AUTOFILL} className="acc-input" value={a.note || ''}
            onChange={(e) => patch((d) => { d.auth[idx].note = e.target.value; })}
            placeholder="Device, number or detail" aria-label="Method detail" />
        ) : a.note ? <div className="acc-authrow__note">{a.note}</div> : null}
      </div>
      <div className="acc-field__acts">
        {a.state !== 'primary' && !off && (
          <button className="acc-act" onClick={promote}>Make primary</button>
        )}
        <button className="acc-act" onClick={toggle}>{off ? 'Turn on' : 'Turn off'}</button>
        {editing && (
          <button className="acc-act acc-act--x" title="Remove method" aria-label="Xóa phương thức đăng nhập"
            onClick={() => patch((d) => { d.auth.splice(idx, 1); })}><AppIcon name="x" size={14} /></button>
        )}
      </div>
    </div>
  );
}

/* ══ Sheet mã dự phòng ═══════════════════════════════════════════ */
function CodeSheet({ codes, editing, accountId, revealed, onReveal, copied, onCopy,
  onSetCodeUsed, patch }) {
  const unused = codes.filter((c) => !c.used).length;

  const clickCode = (c, ci) => {
    if (editing) patch((d) => { d.codes[ci].used = !d.codes[ci].used; });
    else onSetCodeUsed(accountId, c.id, !c.used);
  };

  return (
    <section className="acc-sect">
      <div className="acc-sect__head">
        <h3 className="acc-sect__title">Single-use codes</h3>
        <div className="acc-sect__tools">
          <span className="acc-sect__meta">{unused} of {codes.length} unused</span>
          <button className="acc-act" onClick={onReveal}>
            {revealed ? 'Hide codes' : 'Reveal codes'}
          </button>
          <button className="acc-act" onClick={() => onCopy(codes.map((c) => c.code).join('\n'), 'codes')}>
            <AppIcon name={copied === 'codes' ? 'check' : 'copy'} size={14} /> {copied === 'codes' ? 'Copied' : 'Copy sheet'}
          </button>
          {editing && (
            <button className="acc-act"
              onClick={() => patch((d) => { d.codes = codeSheet(Math.max((d.codes || []).length, 10)); })}>
              Regenerate
            </button>
          )}
          {/* Xoá ✕ ở dòng auth `codes` chỉ bỏ PHƯƠNG THỨC; section vẫn hiện vì
              `showCodes` còn thấy `codes.length > 0`. Không có nút này thì sheet mã
              (kể cả 10 mã do template cũ tự sinh) không có đường nào xoá. */}
          {editing && codes.length > 0 && (
            <button className="acc-act acc-act--x" title="Clear the whole sheet"
              aria-label="Xoá toàn bộ mã dự phòng"
              onClick={() => patch((d) => { d.codes = []; })}>
              <AppIcon name="x" size={14} /> Clear sheet
            </button>
          )}
        </div>
      </div>

      {codes.length > 0 && (
        <>
          <div className="acc-codes">
            {codes.map((c, ci) => (
              <button key={c.id} className={`acc-codecell${c.used ? ' acc-codecell--used' : ''}`}
                onClick={() => clickCode(c, ci)}>
                <span className="acc-codecell__idx">{String(ci + 1).padStart(2, '0')}</span>
                <span className="acc-codecell__code">
                  {revealed ? c.code : '••••-••••'}
                  <i className="acc-codecell__strike" aria-hidden="true" />
                </span>
                <span className="acc-codecell__state">{c.used ? 'USED' : 'READY'}</span>
              </button>
            ))}
          </div>
          <div className="acc-codes__hint">Click a code to mark it used — it is logged below.</div>
        </>
      )}

      {editing && <PasteImport patch={patch} />}
    </section>
  );
}

/* ══ Nhập mã bằng cách dán (chỉ sửa) ════════════════════════════ */
function PasteImport({ patch }) {
  const [text, setText] = useState('');
  const n = parseCodes(text).length;
  const label = text.trim()
    ? (n ? `${n} code${n === 1 ? '' : 's'} detected` : 'nothing recognised yet')
    : 'One code per line. Spaces inside a code are kept.';

  return (
    <div className="acc-box acc-box--paste">
      <div className="acc-box__cap">Paste codes from your provider</div>
      <textarea {...NO_AUTOFILL} className="acc-textarea acc-paste" value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'1234 5678\n2345 6789\n3456 7890'} />
      <div className="acc-box__row">
        <button className="acc-btn" disabled={!n}
          onClick={() => { patch((d) => { d.codes = parseCodes(text); }); setText(''); }}>
          Replace sheet
        </button>
        <button className="acc-act" disabled={!n}
          onClick={() => { patch((d) => { d.codes = (d.codes || []).concat(parseCodes(text)); }); setText(''); }}>
          Append
        </button>
        <span className="acc-box__hint">{label}</span>
      </div>
    </div>
  );
}

function placeholderFor(type) {
  switch (type) {
    case 'url': return 'example.com';
    case 'email': return 'name@example.com';
    case 'phone': return '+84 …';
    case 'date': return 'YYYY-MM-DD';
    default: return '—';
  }
}
