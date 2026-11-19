import { useState } from 'react';
import AppIcon from '../AppIcon';
import ChonSheet from './ChonSheet';
import { cleanOption, parseQuote } from '../../utils/tripLogic';
import { cleanList } from '../../utils/placeLogic';
import { formatVND, parseCurrencyInput } from '../../utils/currencyUtils';

/** Danh sách chip có ô thêm (Enter) — dùng cho Gồm / Chưa gồm. */
function ChipList({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    if (!draft.trim()) return;
    onChange(cleanList([...items, draft], 30, 120));
    setDraft('');
  };
  return (
    <div className="chon-field">
      <span className="chon-field__label">{label}</span>
      <div className="chon-chips">
        {items.map(it => (
          <button key={it} type="button" className="chon-chip chon-chip--dish is-on" onClick={() => onChange(items.filter(x => x !== it))}
            aria-label={`Bỏ ${it}`}>
            {it}<AppIcon name="x" size={12} />
          </button>
        ))}
        <input className="chon-input chon-input--chip" value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); add(); } }}
          onBlur={add} placeholder={placeholder} aria-label={`Thêm vào ${label}`} maxLength={120} />
      </div>
    </div>
  );
}

/**
 * Thêm / sửa một lựa chọn tour (một cột của bảng so sánh, mockup 2E). "Dán báo giá" tách giá + gồm / chưa gồm
 * từ chữ dán vào (parseQuote, không gọi server) rồi điền sẵn — user sửa tay. Ctrl+Enter lưu.
 *
 * @param {(fields) => Promise<boolean>} onSave
 */
export default function ChonOptionSheet({ option = null, letter, startWithQuote = false, onSave, onClose }) {
  const [f, setF] = useState(() => ({
    name: option?.name ?? '',
    provider: option?.provider ?? '',
    price: option?.price_per_person ? String(option.price_per_person) : '',
    price_note: option?.price_note ?? '',
    schedule: option?.schedule ?? '',
    schedule_note: option?.schedule_note ?? '',
    includes: option?.includes ?? [],
    excludes: option?.excludes ?? [],
    source_url: option?.source_url ?? '',
    source_note: option?.source_note ?? '',
    pros: option?.pros ?? '',
    cons: option?.cons ?? '',
    my_note: option?.my_note ?? '',
  }));
  const [quoteOpen, setQuoteOpen] = useState(startWithQuote);
  const [quote, setQuote] = useState('');
  const [quoteMsg, setQuoteMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));

  const applyQuote = () => {
    const q = parseQuote(quote);
    const got = [];
    setF(prev => ({
      ...prev,
      price: q.price ? String(q.price) : prev.price,
      includes: cleanList([...prev.includes, ...q.includes], 30, 120),
      excludes: cleanList([...prev.excludes, ...q.excludes], 30, 120),
      my_note: prev.my_note || '',
    }));
    if (q.price) got.push(`giá ${formatVND(q.price)}`);
    if (q.includes.length) got.push(`${q.includes.length} mục gồm`);
    if (q.excludes.length) got.push(`${q.excludes.length} mục chưa gồm`);
    setQuoteMsg(got.length ? `Đã tách: ${got.join(', ')}. Kiểm lại bên dưới.` : 'Không tách được gì — nhập tay bên dưới.');
    if (got.length) setQuoteOpen(false);
  };

  const submit = async () => {
    if (busy) return;
    const res = cleanOption({ ...f, price_per_person: f.price });
    if (res.error) { setError(res.error); return; }
    setError('');
    setBusy(true);
    const ok = await onSave(res.value);
    setBusy(false);
    if (ok) onClose();
  };

  const priceNum = f.price ? parseCurrencyInput(f.price) : 0;

  return (
    <ChonSheet
      title={option ? `Sửa lựa chọn ${letter}` : `Thêm lựa chọn ${letter}`}
      subtitle="Mỗi lựa chọn là một cột trong bảng so sánh."
      onClose={onClose}
      size="md"
      footer={(
        <button type="button" className="chon-btn chon-btn--lamp chon-btn--grow" onClick={submit} disabled={busy}>
          <AppIcon name="check" size={17} weight="bold" />{option ? 'Lưu thay đổi' : 'Thêm vào bảng so sánh'}
        </button>
      )}
    >
      <form className="chon-form" onSubmit={e => { e.preventDefault(); submit(); }}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}>
        {quoteOpen ? (
          <div className="chon-panel">
            <label className="chon-field">
              <span className="chon-field__label">Dán báo giá <span className="chon-field__opt">· từ Zalo, Facebook, web</span></span>
              <textarea className="chon-input chon-textarea" rows={5} value={quote} onChange={e => setQuote(e.target.value)} data-autofocus
                placeholder={'Giá: 3.200.000đ/khách\nBao gồm:\n- Xe máy + người lái\n- 6 bữa ăn\nKhông bao gồm:\n- Xe khách Hà Nội ⇄ Hà Giang'} />
            </label>
            <div className="chon-form__row-end">
              <button type="button" className="chon-btn chon-btn--text chon-btn--sm" onClick={() => setQuoteOpen(false)}>Thôi</button>
              <button type="button" className="chon-btn chon-btn--soft chon-btn--sm" onClick={applyQuote} disabled={!quote.trim()}>Tách giá &amp; mục</button>
            </div>
          </div>
        ) : (
          <button type="button" className="chon-more-btn" onClick={() => setQuoteOpen(true)}>
            <AppIcon name="clipboard" size={15} />Dán báo giá để tự tách giá, gồm / chưa gồm
          </button>
        )}
        {quoteMsg && <p className="chon-hint" role="status">{quoteMsg}</p>}

        <div className="chon-row2">
          <label className="chon-field">
            <span className="chon-field__label">Tên lựa chọn</span>
            <input className="chon-input" value={f.name} onChange={e => set('name', e.target.value)}
              placeholder="Easy rider · Tự túc…" maxLength={80} data-autofocus={quoteOpen ? undefined : true} required />
          </label>
          <label className="chon-field">
            <span className="chon-field__label">Bên cung cấp</span>
            <input className="chon-input" value={f.provider} onChange={e => set('provider', e.target.value)}
              placeholder="Mây Trắng Travel · có người lái" maxLength={120} />
          </label>
        </div>
        <div className="chon-row2">
          <label className="chon-field">
            <span className="chon-field__label">Giá / người</span>
            <input className="chon-input" value={f.price} onChange={e => set('price', e.target.value)} placeholder="3.2tr" inputMode="decimal" />
            {priceNum > 0 && <span className="chon-hint">{formatVND(priceNum)}</span>}
          </label>
          <label className="chon-field">
            <span className="chon-field__label">Ghi chú giá</span>
            <input className="chon-input" value={f.price_note} onChange={e => set('price_note', e.target.value)} placeholder="trọn gói / chưa gồm xăng" maxLength={80} />
          </label>
        </div>
        <div className="chon-row2">
          <label className="chon-field">
            <span className="chon-field__label">Lịch</span>
            <input className="chon-input" value={f.schedule} onChange={e => set('schedule', e.target.value)} placeholder="T6 27/11 → T2 30/11" maxLength={120} />
          </label>
          <label className="chon-field">
            <span className="chon-field__label">Ghi chú lịch</span>
            <input className="chon-input" value={f.schedule_note} onChange={e => set('schedule_note', e.target.value)} placeholder="đoàn 8–10 người" maxLength={120} />
          </label>
        </div>

        <ChipList label="Gồm" items={f.includes} onChange={v => set('includes', v)} placeholder="+ Thêm, Enter" />
        <ChipList label="Chưa gồm" items={f.excludes} onChange={v => set('excludes', v)} placeholder="+ Thêm, Enter" />

        <div className="chon-row2">
          <label className="chon-field">
            <span className="chon-field__label">Ưu</span>
            <textarea className="chon-input chon-textarea" rows={2} value={f.pros} onChange={e => set('pros', e.target.value)} maxLength={500} placeholder="Không phải lái đèo" />
          </label>
          <label className="chon-field">
            <span className="chon-field__label">Nhược</span>
            <textarea className="chon-input chon-textarea" rows={2} value={f.cons} onChange={e => set('cons', e.target.value)} maxLength={500} placeholder="Đắt nhất" />
          </label>
        </div>
        <div className="chon-row2">
          <label className="chon-field">
            <span className="chon-field__label">Link nguồn</span>
            <input className="chon-input" value={f.source_url} onChange={e => set('source_url', e.target.value)} placeholder="Bài group FB, Zalo…" inputMode="url" />
          </label>
          <label className="chon-field">
            <span className="chon-field__label">Về nguồn</span>
            <input className="chon-input" value={f.source_note} onChange={e => set('source_note', e.target.value)} placeholder="Linh đi tháng 10, khen trưởng đoàn" maxLength={200} />
          </label>
        </div>
        <label className="chon-field">
          <span className="chon-field__label">Ghi chú của tôi</span>
          <textarea className="chon-input chon-textarea" rows={2} value={f.my_note} onChange={e => set('my_note', e.target.value)} maxLength={1000} placeholder="Cọc 30% trước 22/11" />
        </label>

        {error && <p className="chon-error" role="alert">{error}</p>}
      </form>
    </ChonSheet>
  );
}
