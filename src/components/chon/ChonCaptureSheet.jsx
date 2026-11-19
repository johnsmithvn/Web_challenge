import { useMemo, useState } from 'react';
import AppIcon from '../AppIcon';
import ChonSheet from './ChonSheet';
import ChonMap from './ChonMap';
import { KINDS, OCCASIONS, PLATFORMS } from './chonData';
import { cleanPlace, cleanSource, parseMapsUrl, detectPlatform, findDuplicatePlace, cleanList, MAX_MUST_TRY } from '../../utils/placeLogic';
import { parseCurrencyInput } from '../../utils/currencyUtils';

const toForm = (place, prefill = {}) => ({
  name: place?.name ?? prefill.name ?? '',
  kind: place?.kind ?? 'food',
  area: place?.area ?? '',
  address: place?.address ?? '',
  lat: place?.lat ?? null,
  lng: place?.lng ?? null,
  maps_url: place?.maps_url ?? '',
  price: place?.price_per_person ? String(place.price_per_person) : '',
  hours_note: place?.hours_note ?? '',
  must_try: place?.must_try ?? [],
  occasions: place?.occasions ?? [],
  note: place?.note ?? '',
});

/**
 * Lưu chốn / Sửa chốn (mockup 2B). Thứ tự: Tên → Loại → Ở đâu → Ai giới thiệu, phần còn lại gập dưới
 * "Thêm chi tiết" để lưu nhanh. Dán link Google Maps đầy đủ → tự điền toạ độ (và tên nếu trống).
 * Trùng tên + khu vực với chốn có sẵn → gợi ý thêm lời giới thiệu vào chốn đó thay vì tạo mới.
 * Ctrl+Enter lưu, Esc đóng.
 *
 * @param {object|null} place — có = Sửa (không hiện phần nguồn: nguồn sửa ở trang chi tiết)
 * @param {{ name?, url?, quote? }} prefill — từ Chia sẻ Android
 * @param {(fields, source, { plan }) => Promise<boolean>} onSave
 * @param {(existing, source) => Promise<boolean>} onMerge
 */
export default function ChonCaptureSheet({ place = null, prefill = {}, places, onSave, onMerge, onClose }) {
  const editing = !!place;
  const [f, setF] = useState(() => toForm(place, prefill));
  const [src, setSrc] = useState({ url: prefill.url || '', author: '', quote: prefill.quote || '', platform: '' });
  const [mapsInput, setMapsInput] = useState('');
  const [mapsMsg, setMapsMsg] = useState('');
  const [dish, setDish] = useState('');
  const [more, setMore] = useState(editing);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mergeDismissed, setMergeDismissed] = useState(false);

  const set = (k, val) => setF(prev => ({ ...prev, [k]: val }));
  const toggleIn = (k, id) => setF(prev => ({
    ...prev, [k]: prev[k].includes(id) ? prev[k].filter(x => x !== id) : [...prev[k], id],
  }));

  const duplicate = useMemo(
    () => (editing || mergeDismissed ? null : findDuplicatePlace(places, { name: f.name, area: f.area })),
    [editing, mergeDismissed, places, f.name, f.area],
  );
  const srcPlatform = src.platform || (src.url ? detectPlatform(src.url) : (src.author ? 'friend' : ''));

  const applyMaps = (raw) => {
    setMapsInput(raw);
    if (!raw.trim()) { setMapsMsg(''); return; }
    const r = parseMapsUrl(raw);
    if (!r) { setMapsMsg('Không đọc được link này. Dán link Google Maps đầy đủ.'); return; }
    if (r.short) {
      setMapsMsg('Link rút gọn chưa có toạ độ: mở link trong trình duyệt rồi chép lại link đầy đủ trên thanh địa chỉ.');
      set('maps_url', raw.trim());
      return;
    }
    setF(prev => ({
      ...prev,
      maps_url: raw.trim(),
      lat: r.lat ?? prev.lat,
      lng: r.lng ?? prev.lng,
      name: prev.name.trim() ? prev.name : (r.name || prev.name),
    }));
    setMapsMsg(r.lat != null ? 'Đã lấy vị trí từ link.' : 'Đã lưu link (link này không có toạ độ).');
  };

  const addDish = () => {
    const next = cleanList([...f.must_try, dish], MAX_MUST_TRY);
    set('must_try', next);
    setDish('');
  };

  const build = () => {
    const placeRes = cleanPlace({ ...f, price_per_person: f.price ? parseCurrencyInput(f.price) : '' });
    if (placeRes.error) return { error: placeRes.error };
    const sourceRes = editing ? { value: null } : cleanSource({ ...src, platform: src.platform || undefined });
    if (sourceRes.error) return { error: sourceRes.error };
    return { fields: placeRes.value, source: sourceRes.value };
  };

  const submit = async (opts = {}) => {
    if (busy) return;
    const b = build();
    if (b.error) { setError(b.error); return; }
    setError('');
    setBusy(true);
    const ok = await onSave(b.fields, b.source, opts);
    setBusy(false);
    if (ok) onClose();
  };

  const merge = async () => {
    const s = cleanSource({ ...src, platform: src.platform || undefined });
    if (s.error) { setError(s.error); return; }
    setBusy(true);
    const ok = await onMerge(duplicate, s.value);
    setBusy(false);
    if (ok) onClose();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
  };

  const subtitle = editing ? 'Sửa thông tin chốn'
    : prefill.url ? <><AppIcon name="share" size={14} />Nhận từ Chia sẻ{srcPlatform && srcPlatform !== 'web' ? ` · ${PLATFORMS.find(p => p.id === srcPlatform)?.label}` : ''}</>
    : 'Nơi bạn muốn đến — ghi tên là đủ, còn lại tuỳ.';

  return (
    <ChonSheet
      title={editing ? 'Sửa chốn' : 'Lưu chốn'}
      subtitle={subtitle}
      onClose={onClose}
      size="md"
      footer={(
        <>
          {!editing && (
            <button type="button" className="chon-btn chon-btn--ghost" onClick={() => submit({ plan: true })} disabled={busy}>
              <AppIcon name="calendar" size={17} />Hẹn ngày
            </button>
          )}
          <button type="button" className="chon-btn chon-btn--lamp chon-btn--grow" onClick={() => submit()} disabled={busy}>
            <AppIcon name="lantern" size={18} />{editing ? 'Lưu thay đổi' : 'Lưu vào Muốn đến'}
          </button>
        </>
      )}
    >
      <form className="chon-form" onKeyDown={onKeyDown} onSubmit={e => { e.preventDefault(); submit(); }}>
        <label className="chon-field">
          <span className="chon-field__label">Tên chốn</span>
          <input
            className="chon-input chon-input--title"
            value={f.name}
            onChange={e => set('name', e.target.value)}
            placeholder="Ốc đêm hẻm 200"
            maxLength={120}
            data-autofocus
            required
          />
        </label>

        {duplicate && (
          <div className="chon-merge" role="status">
            <AppIcon name="lantern" size={18} />
            <p>Đã có <strong>{duplicate.name}</strong>{duplicate.area ? ` · ${duplicate.area}` : ''}. Thêm lời giới thiệu này vào chốn đó?</p>
            <div className="chon-merge__actions">
              <button type="button" className="chon-btn chon-btn--soft chon-btn--sm" onClick={merge} disabled={busy}>Gộp vào</button>
              <button type="button" className="chon-btn chon-btn--text chon-btn--sm" onClick={() => setMergeDismissed(true)}>Vẫn tạo mới</button>
            </div>
          </div>
        )}

        <fieldset className="chon-field">
          <legend className="chon-field__label">Loại</legend>
          <div className="chon-kind-grid" role="radiogroup" aria-label="Loại chốn">
            {KINDS.filter(k => k.id !== 'other' || f.kind === 'other').map(k => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={f.kind === k.id}
                className={`chon-kind-opt chon-kind--${k.id}${f.kind === k.id ? ' is-on' : ''}`}
                onClick={() => set('kind', k.id)}
              >
                <AppIcon name={k.icon} size={20} />{k.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="chon-field">
          <span className="chon-field__label">Ở đâu</span>
          <div className="chon-row2">
            <input className="chon-input" value={f.area} onChange={e => set('area', e.target.value)}
              placeholder="Khu vực: Quận 4, Đà Lạt…" maxLength={60} aria-label="Khu vực" />
            <input className="chon-input" value={f.address} onChange={e => set('address', e.target.value)}
              placeholder="Địa chỉ (tuỳ chọn)" maxLength={240} aria-label="Địa chỉ" />
          </div>
          <label className="chon-input-icon">
            <AppIcon name="link" size={15} />
            <input
              className="chon-input chon-input--bare"
              value={mapsInput}
              onChange={e => applyMaps(e.target.value)}
              placeholder={f.maps_url ? 'Đã có link Google Maps — dán link khác để thay' : 'Dán link Google Maps để lấy vị trí'}
              aria-label="Link Google Maps"
              inputMode="url"
            />
          </label>
          {mapsMsg && <p className="chon-hint" role="status">{mapsMsg}</p>}
          <ChonMap
            mini
            places={[]}
            pin={f.lat != null ? { lat: f.lat, lng: f.lng } : null}
            onPinChange={({ lat, lng }) => setF(prev => ({ ...prev, lat, lng }))}
          />
          <p className="chon-hint">
            {f.lat != null
              ? <>Kéo ghim cho đúng chỗ · <button type="button" className="chon-link" onClick={() => setF(prev => ({ ...prev, lat: null, lng: null }))}>Bỏ vị trí</button></>
              : 'Chạm vào bản đồ để cắm ghim (tuỳ chọn).'}
          </p>
        </div>

        {!editing && (
          <div className="chon-field">
            <span className="chon-field__label">Ai giới thiệu <span className="chon-field__opt">tuỳ chọn</span></span>
            <label className="chon-input-icon">
              <AppIcon name="link" size={15} />
              <input className="chon-input chon-input--bare" value={src.url} onChange={e => setSrc(s => ({ ...s, url: e.target.value }))}
                placeholder="Link TikTok, Facebook, YouTube…" aria-label="Link giới thiệu" inputMode="url" />
              {srcPlatform && srcPlatform !== 'other' && (
                <span className="chon-pill">{PLATFORMS.find(p => p.id === srcPlatform)?.label}</span>
              )}
            </label>
            <div className="chon-row2">
              <input className="chon-input" value={src.author} onChange={e => setSrc(s => ({ ...s, author: e.target.value }))}
                placeholder="Ai: @angi.dau, Minh…" maxLength={80} aria-label="Người giới thiệu" />
              <button type="button" className={`chon-chip${src.platform === 'friend' ? ' is-on' : ''}`}
                aria-pressed={src.platform === 'friend'}
                onClick={() => setSrc(s => ({ ...s, platform: s.platform === 'friend' ? '' : 'friend' }))}>
                <AppIcon name="users" size={14} />Bạn kể
              </button>
            </div>
            <textarea className="chon-input chon-textarea" rows={2} value={src.quote} maxLength={500}
              onChange={e => setSrc(s => ({ ...s, quote: e.target.value }))}
              placeholder="Lời giới thiệu: “Ốc hương rang muối ớt, đi nhóm 4 là vừa.”" aria-label="Lời giới thiệu" />
          </div>
        )}

        {!more ? (
          <button type="button" className="chon-more-btn" onClick={() => setMore(true)} aria-expanded="false">
            <AppIcon name="plus" size={15} />Thêm chi tiết: món nên thử, hợp với ai, giá, giờ mở
          </button>
        ) : (
          <>
            <div className="chon-field">
              <span className="chon-field__label">Món nên thử</span>
              <div className="chon-chips">
                {f.must_try.map(d => (
                  <button key={d} type="button" className="chon-chip chon-chip--dish is-on"
                    onClick={() => set('must_try', f.must_try.filter(x => x !== d))} aria-label={`Bỏ món ${d}`}>
                    <AppIcon name="check" size={13} weight="bold" />{d}
                  </button>
                ))}
                {f.must_try.length < MAX_MUST_TRY && (
                  <input className="chon-input chon-input--chip" value={dish} onChange={e => setDish(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); addDish(); } }}
                    onBlur={() => dish.trim() && addDish()}
                    placeholder="+ Thêm món, Enter" aria-label="Thêm món nên thử" maxLength={60} />
                )}
              </div>
            </div>

            <fieldset className="chon-field">
              <legend className="chon-field__label">Hợp với</legend>
              <div className="chon-chips" role="group" aria-label="Hợp với dịp nào">
                {OCCASIONS.map(o => (
                  <button key={o.id} type="button" className={`chon-chip${f.occasions.includes(o.id) ? ' is-on' : ''}`}
                    aria-pressed={f.occasions.includes(o.id)} onClick={() => toggleIn('occasions', o.id)}>
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="chon-row2">
              <label className="chon-field">
                <span className="chon-field__label">Giá / người</span>
                <input className="chon-input" value={f.price} onChange={e => set('price', e.target.value)}
                  placeholder="120k" inputMode="decimal" />
              </label>
              <label className="chon-field">
                <span className="chon-field__label">Giờ mở</span>
                <input className="chon-input" value={f.hours_note} onChange={e => set('hours_note', e.target.value)}
                  placeholder="17:00–02:00 · nghỉ thứ Hai" maxLength={80} />
              </label>
            </div>

            <label className="chon-field">
              <span className="chon-field__label">Ghi chú riêng</span>
              <textarea className="chon-input chon-textarea" rows={2} value={f.note} maxLength={2000}
                onChange={e => set('note', e.target.value)} placeholder="Nên tới sau 21h, gửi xe đầu hẻm…" />
            </label>
          </>
        )}

        {error && <p className="chon-error" role="alert">{error}</p>}
        <p className="chon-hint chon-hint--keys"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> để lưu · <kbd>Esc</kbd> để đóng</p>
      </form>
    </ChonSheet>
  );
}
