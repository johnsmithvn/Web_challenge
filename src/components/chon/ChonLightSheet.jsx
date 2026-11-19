import { useMemo, useRef, useState } from 'react';
import AppIcon from '../AppIcon';
import ChonSheet from './ChonSheet';
import DatePickerPopover from '../DatePickerPopover';
import { REVISITS, financeFor } from './chonData';
import { cleanVisit, cleanList, dishMentions, placeState, ratingLabel, shortDay, MAX_DISHES } from '../../utils/placeLogic';
import { parseCurrencyInput, formatVND } from '../../utils/currencyUtils';
import { toDateStr } from '../../utils/dateUtils';

/**
 * Thắp đèn & cảm nhận (mockup 2D). Ngày đến (mặc định hôm nay, đổi được), 5 sao + nhãn, Sẽ quay lại /
 * Có thể / Một lần thôi, Món đã gọi (chip từ món nên thử, chạm = ngon ♥), cảm nhận, số người, chi phí +
 * công tắc ghi vào Tài chính. "Để sau" đóng không lưu. Lưu = RPC light_place (một transaction).
 *
 * @param {(visit, finance|null) => Promise<boolean>} onSave
 */
export default function ChonLightSheet({ place, onSave, onClose }) {
  const today = toDateStr();
  const st = placeState(place);
  const fin = useMemo(() => financeFor(place.kind), [place.kind]);
  const suggested = useMemo(() => dishMentions(place).map(d => d.name).slice(0, 12), [place]);

  const [visitedOn, setVisitedOn] = useState(today);
  const [pickDate, setPickDate] = useState(false);
  const [rating, setRating] = useState(null);
  const [revisit, setRevisit] = useState(null);
  const [dishes, setDishes] = useState(suggested);   // món hiện trên màn (gợi ý + tự thêm)
  const [ordered, setOrdered] = useState([]);        // đã gọi
  const [liked, setLiked] = useState([]);            // ngon (luôn nằm trong đã gọi)
  const [dish, setDish] = useState('');
  const [note, setNote] = useState('');
  const [party, setParty] = useState('');
  const [spent, setSpent] = useState('');
  const [toFinance, setToFinance] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dateBtnRef = useRef(null);

  const spentNum = spent ? parseCurrencyInput(spent) : 0;
  const writeFinance = toFinance && spentNum > 0;

  // Chạm món: chưa gọi → đã gọi + ngon; ngon → chỉ đã gọi; đã gọi → bỏ.
  const cycleDish = (d) => {
    const isOrdered = ordered.includes(d);
    const isLiked = liked.includes(d);
    if (!isOrdered) { setOrdered(o => [...o, d]); setLiked(l => [...l, d]); }
    else if (isLiked) setLiked(l => l.filter(x => x !== d));
    else setOrdered(o => o.filter(x => x !== d));
  };
  const addDish = () => {
    const name = dish.trim();
    if (!name) return;
    const next = cleanList([...dishes, name], MAX_DISHES);
    const added = next.find(x => x.toLowerCase() === name.toLowerCase()) || name;
    setDishes(next);
    if (!ordered.includes(added)) { setOrdered(o => [...o, added]); setLiked(l => [...l, added]); }
    setDish('');
  };

  const submit = async () => {
    if (busy) return;
    const res = cleanVisit({
      visited_on: visitedOn, rating, revisit, dishes: ordered, liked_dishes: liked,
      party_size: party, note, spent: spentNum || null,
    }, today);
    if (res.error) { setError(res.error); return; }
    setError('');
    setBusy(true);
    const ok = await onSave(res.value, writeFinance ? fin : null);
    setBusy(false);
    if (ok) onClose();
  };

  const dayLabel = visitedOn === today ? 'hôm nay' : shortDay(visitedOn);
  const nth = st.visitCount === 0 ? 'lần đầu' : `lần thứ ${st.visitCount + 1}`;

  return (
    <ChonSheet
      hideHeader
      label={`Thắp đèn ${place.name}`}
      title={place.name}
      onClose={onClose}
      size="sm"
      className="chon-light"
      footer={(
        <button type="button" className="chon-btn chon-btn--lamp chon-btn--grow chon-btn--lg" onClick={submit} disabled={busy}>
          <AppIcon name="check" size={18} weight="bold" />Lưu cảm nhận
        </button>
      )}
    >
      <div className="chon-light__top">
        <button type="button" className="chon-icon-btn" onClick={onClose} aria-label="Đóng"><AppIcon name="x" size={18} /></button>
        <button type="button" className="chon-btn chon-btn--text" onClick={onClose}>Để sau</button>
      </div>

      <div className="chon-light__hero">
        <span className="chon-light__glow" aria-hidden="true" />
        <svg className="chon-light__lamp" viewBox="0 0 80 110" width="64" height="88" role="img" aria-label="Đèn đã thắp">
          <path d="M34 5h12M40 5v7" className="l-line" />
          <rect x="29" y="11" width="22" height="6" rx="2" className="l-cap" />
          <rect x="15" y="16" width="50" height="60" rx="25" className="l-body" />
          <ellipse cx="40" cy="46" rx="15" ry="21" className="l-core" />
          <path d="M29 18c-5 12-5 44 0 56M51 18c5 12 5 44 0 56M40 17v58" className="l-rib" />
          <rect x="29" y="75" width="22" height="6" rx="2" className="l-cap" />
          <path d="M40 81v12" className="l-line" />
          <path d="M36 94l-1.5 11M40 94v12M44 94l1.5 11" className="l-tassel" />
        </svg>
        <h2 className="chon-light__name">{place.name}</h2>
        <p className="chon-light__when">
          Đã đến {dayLabel} · {nth} ·{' '}
          <span className="chon-pop-anchor">
            <button type="button" ref={dateBtnRef} className="chon-link" onClick={() => setPickDate(v => !v)} aria-expanded={pickDate}>
              Đổi ngày
            </button>
            {pickDate && (
              <DatePickerPopover
                value={visitedOn}
                onChange={d => d && setVisitedOn(d > today ? today : d)}
                onClose={() => setPickDate(false)}
                hideTime
                max={today}
                label="Ngày đến"
                style={{ top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 6 }}
              />
            )}
          </span>
        </p>
      </div>

      <div className="chon-light__body">
        <div className="chon-panel">
          <div className="chon-light__rate">
            <div className="chon-stars" role="radiogroup" aria-label="Chấm điểm">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sao`}
                  className={`chon-star${rating != null && n <= rating ? ' is-on' : ''}`}
                  onClick={() => setRating(rating === n ? null : n)}>
                  <AppIcon name="star" size={26} weight={rating != null && n <= rating ? 'fill' : 'regular'} />
                </button>
              ))}
            </div>
            <span className="chon-light__rlabel" aria-live="polite">{ratingLabel(rating)}</span>
          </div>
          <div className="chon-seg chon-seg--full" role="radiogroup" aria-label="Có quay lại không">
            {REVISITS.map(r => (
              <button key={r.id} type="button" role="radio" aria-checked={revisit === r.id}
                className={`chon-seg__btn${revisit === r.id ? ' is-on is-solid' : ''}`}
                onClick={() => setRevisit(revisit === r.id ? null : r.id)}>
                {r.id === 'yes' && <AppIcon name="refresh" size={14} />}{r.label}
              </button>
            ))}
          </div>
        </div>

        <section className="chon-field">
          <p className="chon-field__label">Món đã gọi <span className="chon-field__opt">· chạm một lần = ngon, lần nữa = gọi thường</span></p>
          <div className="chon-chips">
            {dishes.map(d => {
              const isOrdered = ordered.includes(d);
              const isLiked = liked.includes(d);
              return (
                <button key={d} type="button" className={`chon-chip chon-chip--dish${isOrdered ? ' is-on' : ''}`}
                  aria-pressed={isOrdered} aria-label={`${d}${isLiked ? ', ngon' : isOrdered ? ', đã gọi' : ''}`}
                  onClick={() => cycleDish(d)}>
                  <AppIcon name="heart" size={14} weight={isLiked ? 'fill' : 'regular'} className={isLiked ? 'chon-heart is-on' : 'chon-heart'} />
                  {d}
                </button>
              );
            })}
            <input className="chon-input chon-input--chip" value={dish} onChange={e => setDish(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDish(); } }}
              onBlur={addDish} placeholder="+ Thêm món" aria-label="Thêm món đã gọi" maxLength={60} />
          </div>
        </section>

        <section className="chon-field">
          <label className="chon-field__label" htmlFor="chon-light-note">Cảm nhận</label>
          <div className="chon-note-box">
            <textarea id="chon-light-note" className="chon-input chon-textarea chon-input--bare" rows={3} maxLength={4000}
              value={note} onChange={e => setNote(e.target.value)} data-autofocus
              placeholder="Ngon gì, dở gì, mẹo cho lần sau…" />
            <div className="chon-note-box__tools">
              <label className="chon-mini-field">
                <AppIcon name="users" size={14} />
                Đi
                <input className="chon-input chon-input--tiny" value={party} onChange={e => setParty(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  inputMode="numeric" aria-label="Số người đi cùng" placeholder="–" />
                người
              </label>
            </div>
          </div>
        </section>

        <div className="chon-panel chon-spend">
          <span className="chon-spend__icon" aria-hidden="true"><AppIcon name="wallet" size={17} /></span>
          <div className="chon-spend__main">
            <input className="chon-input chon-input--bare chon-spend__input" value={spent} onChange={e => setSpent(e.target.value)}
              inputMode="decimal" placeholder="Chi phí: 360k" aria-label="Chi phí" />
            <span className="chon-spend__hint">
              {spentNum > 0 ? formatVND(spentNum) : 'Tổng cả nhóm, gõ 360k hoặc 360.000'}
              {writeFinance ? ` · sẽ ghi vào Tài chính · ${fin.label}` : spentNum > 0 ? ' · không ghi Tài chính' : ''}
            </span>
          </div>
          <button type="button" role="switch" aria-checked={toFinance} aria-label="Ghi vào Tài chính"
            className={`chon-switch${toFinance ? ' is-on' : ''}`} onClick={() => setToFinance(v => !v)}>
            <span aria-hidden="true" />
          </button>
        </div>

        {error && <p className="chon-error" role="alert">{error}</p>}
      </div>
    </ChonSheet>
  );
}
