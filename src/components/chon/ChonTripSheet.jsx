import { useState } from 'react';
import AppIcon from '../AppIcon';
import ChonSheet from './ChonSheet';
import SearchSelect from '../SearchSelect';
import DatePickerPopover from '../DatePickerPopover';
import { cleanTrip, formatTripRange } from '../../utils/tripLogic';
import { parseCurrencyInput, formatVND } from '../../utils/currencyUtils';

/**
 * Tạo / sửa chuyến đi: tên (+ dòng nhấn in nghiêng), vùng, ngày đi → về (lịch chọn khoảng), số người,
 * chốn đích (vd thẻ "Hà Giang loop" trong Muốn đến), chi phí khác cho ước tính (máy bay, xe…), ghi chú.
 * Ctrl+Enter lưu, Esc đóng.
 *
 * @param {object|null} trip — có = Sửa
 * @param {object} prefill — { title, region, place_id } khi lên chuyến từ một chốn
 * @param {(fields) => Promise<boolean>} onSave
 */
export default function ChonTripSheet({ trip = null, prefill = {}, places, onSave, onClose }) {
  const [f, setF] = useState(() => ({
    title: trip?.title ?? prefill.title ?? '',
    tagline: trip?.tagline ?? '',
    region: trip?.region ?? prefill.region ?? '',
    start_date: trip?.start_date ?? '',
    end_date: trip?.end_date ?? '',
    people: trip?.people ?? 2,
    place_id: trip?.place_id ?? prefill.place_id ?? '',
    note: trip?.note ?? '',
  }));
  const [costs, setCosts] = useState(() => (trip?.extra_costs || []).map(c => ({ label: c.label, amount: String(c.amount) })));
  const [pickDates, setPickDates] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }));
  const setCost = (i, k, v) => setCosts(cs => cs.map((c, j) => (j === i ? { ...c, [k]: v } : c)));

  const submit = async () => {
    if (busy) return;
    const res = cleanTrip({
      ...f,
      extra_costs: costs.map(c => ({ label: c.label, amount: parseCurrencyInput(c.amount) })),
    });
    if (res.error) { setError(res.error); return; }
    setError('');
    setBusy(true);
    const ok = await onSave(res.value);
    setBusy(false);
    if (ok) onClose();
  };

  const rangeLabel = f.start_date ? formatTripRange(f) : 'Chọn ngày đi → về';

  return (
    <ChonSheet
      title={trip ? 'Sửa chuyến đi' : 'Lên chuyến đi'}
      subtitle="So các lựa chọn tour, xếp chốn theo ngày, chuẩn bị đồ."
      onClose={onClose}
      size="md"
      footer={(
        <button type="button" className="chon-btn chon-btn--lamp chon-btn--grow" onClick={submit} disabled={busy}>
          <AppIcon name="flag" size={17} />{trip ? 'Lưu thay đổi' : 'Tạo chuyến đi'}
        </button>
      )}
    >
      <form className="chon-form" onSubmit={e => { e.preventDefault(); submit(); }}
        onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}>
        <label className="chon-field">
          <span className="chon-field__label">Tên chuyến</span>
          <input className="chon-input chon-input--title" value={f.title} onChange={e => set('title', e.target.value)}
            placeholder="Hà Giang loop" maxLength={120} data-autofocus required />
        </label>
        <div className="chon-row2">
          <label className="chon-field">
            <span className="chon-field__label">Dòng nhấn <span className="chon-field__opt">tuỳ chọn</span></span>
            <input className="chon-input" value={f.tagline} onChange={e => set('tagline', e.target.value)}
              placeholder="mùa tam giác mạch" maxLength={80} />
          </label>
          <label className="chon-field">
            <span className="chon-field__label">Vùng</span>
            <input className="chon-input" value={f.region} onChange={e => set('region', e.target.value)}
              placeholder="Hà Giang" maxLength={60} />
          </label>
        </div>

        <div className="chon-row2">
          <div className="chon-field">
            <span className="chon-field__label">Ngày đi → về</span>
            <span className="chon-pop-anchor chon-pop-anchor--block">
              <button type="button" className="chon-input chon-input--btn" onClick={() => setPickDates(v => !v)} aria-expanded={pickDates}>
                <AppIcon name="calendar" size={16} />{rangeLabel}
              </button>
              {pickDates && (
                <DatePickerPopover
                  mode="range"
                  value={{ from: f.start_date || '', to: f.end_date || '' }}
                  onChange={({ from, to }) => setF(prev => ({ ...prev, start_date: from || '', end_date: to || from || '' }))}
                  onClose={() => setPickDates(false)}
                  style={{ top: '100%', left: 0, marginTop: 6 }}
                />
              )}
            </span>
            {f.start_date && (
              <button type="button" className="chon-link chon-hint" onClick={() => setF(prev => ({ ...prev, start_date: '', end_date: '' }))}>
                Bỏ ngày
              </button>
            )}
          </div>
          <div className="chon-field">
            <span className="chon-field__label" id="chon-trip-people">Số người</span>
            <div className="chon-stepper" role="group" aria-labelledby="chon-trip-people">
              <button type="button" className="chon-icon-btn" aria-label="Bớt một người" onClick={() => set('people', Math.max(1, Number(f.people) - 1))}>
                <AppIcon name="minus" size={16} />
              </button>
              <input className="chon-input chon-input--tiny" value={f.people} inputMode="numeric" aria-label="Số người"
                onChange={e => set('people', e.target.value.replace(/\D/g, '').slice(0, 2))} />
              <button type="button" className="chon-icon-btn" aria-label="Thêm một người" onClick={() => set('people', Math.min(50, Number(f.people || 0) + 1))}>
                <AppIcon name="plus" size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="chon-field">
          <span className="chon-field__label">Chốn đích <span className="chon-field__opt">tuỳ chọn · nối với một chốn trong Muốn đến</span></span>
          <SearchSelect
            options={places.map(p => ({ value: p.id, label: p.name, sub: p.area || undefined }))}
            value={f.place_id}
            onChange={v => set('place_id', v || '')}
            placeholder="Chọn chốn (vd Hà Giang loop)"
            ariaLabel="Chốn đích của chuyến"
            clearable
          />
        </div>

        <div className="chon-field">
          <span className="chon-field__label">Chi phí khác <span className="chon-field__opt">· cộng vào ước tính (máy bay, xe khách…)</span></span>
          {costs.map((c, i) => (
            <div key={i} className="chon-cost-row">
              <input className="chon-input" value={c.label} onChange={e => setCost(i, 'label', e.target.value)}
                placeholder="Máy bay SG ⇄ Hà Nội" maxLength={60} aria-label={`Khoản ${i + 1}`} />
              <input className="chon-input chon-cost-row__amt" value={c.amount} onChange={e => setCost(i, 'amount', e.target.value)}
                placeholder="3.6tr" inputMode="decimal" aria-label={`Số tiền khoản ${i + 1}`} />
              <button type="button" className="chon-icon-btn" aria-label={`Bỏ khoản ${i + 1}`} onClick={() => setCosts(cs => cs.filter((_, j) => j !== i))}>
                <AppIcon name="x" size={15} />
              </button>
              {parseCurrencyInput(c.amount) > 0 && <span className="chon-hint chon-cost-row__hint">{formatVND(parseCurrencyInput(c.amount))}</span>}
            </div>
          ))}
          {costs.length < 30 && (
            <button type="button" className="chon-btn chon-btn--dashed chon-btn--sm chon-self-start" onClick={() => setCosts(cs => [...cs, { label: '', amount: '' }])}>
              <AppIcon name="plus" size={14} />Thêm khoản
            </button>
          )}
        </div>

        <label className="chon-field">
          <span className="chon-field__label">Ghi chú</span>
          <textarea className="chon-input chon-textarea" rows={2} value={f.note} maxLength={2000}
            onChange={e => set('note', e.target.value)} placeholder="Đi mùa nào đẹp, ai rủ được…" />
        </label>

        {error && <p className="chon-error" role="alert">{error}</p>}
      </form>
    </ChonSheet>
  );
}
