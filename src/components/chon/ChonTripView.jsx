import { useMemo, useState } from 'react';
import AppIcon from '../AppIcon';
import ActionMenu from '../ActionMenu';
import ChonLayer from './ChonLayer';
import ChonTripPrep from './ChonTripPrep';
import ChonOptionSheet from './ChonOptionSheet';
import ChonChooseDialog from './ChonChooseDialog';
import ChonAddPlacesSheet from './ChonAddPlacesSheet';
import { kindOf } from './chonData';
import {
  sortOptions, optionLetter, pickedOption, nextSortOrder, tripEstimate, groupTripPlaces, formatTripRange, countdown,
  pastTripHint, tripDayCount, TRIP_STATUS_LABEL,
} from '../../utils/tripLogic';
import { placeState, shortDay } from '../../utils/placeLogic';
import { formatVND } from '../../utils/currencyUtils';

const ROWS = [
  ['price', 'Giá / người'],
  ['schedule', 'Lịch'],
  ['includes', 'Gồm'],
  ['excludes', 'Chưa gồm'],
  ['source', 'Nguồn'],
  ['pros', 'Ưu'],
  ['cons', 'Nhược'],
  ['my_note', 'Ghi chú của tôi'],
];

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'link'; } };

/** Năm sao chọn được (sau chuyến). */
function Stars({ value, onChange, label }) {
  return (
    <div className="chon-stars chon-stars--sm" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} sao`}
          className={`chon-star${value != null && n <= value ? ' is-on' : ''}`} onClick={() => onChange(value === n ? null : n)}>
          <AppIcon name="star" size={20} weight={value != null && n <= value ? 'fill' : 'regular'} />
        </button>
      ))}
    </div>
  );
}

/** Ô của bảng so sánh theo dòng. */
function Cell({ row, o, cheapest }) {
  switch (row) {
    case 'price':
      return o.price_per_person ? (
        <>
          <span className="chon-cmp__big">{formatVND(o.price_per_person)}</span>
          {(o.price_note || cheapest) && (
            <span className="chon-cmp__sub">{[o.price_note, cheapest && 'rẻ nhất'].filter(Boolean).join(' · ')}</span>
          )}
        </>
      ) : <span className="chon-cmp__none">Chưa có giá</span>;
    case 'schedule':
      return o.schedule || o.schedule_note ? (
        <>
          {o.schedule && <span>{o.schedule}</span>}
          {o.schedule_note && <span className="chon-cmp__sub">{o.schedule_note}</span>}
        </>
      ) : <span className="chon-cmp__none">—</span>;
    case 'includes':
    case 'excludes': {
      const list = o[row] || [];
      return list.length ? (
        <ul className={`chon-cmp__list chon-cmp__list--${row}`}>
          {list.map(it => <li key={it}>{it}</li>)}
        </ul>
      ) : <span className="chon-cmp__none">—</span>;
    }
    case 'source':
      return o.source_url || o.source_note ? (
        <>
          {o.source_url && (
            <a className="chon-link" href={o.source_url} target="_blank" rel="noopener noreferrer">
              <AppIcon name="external" size={12} />{hostOf(o.source_url)}
            </a>
          )}
          {o.source_note && <span className="chon-cmp__sub">{o.source_note}</span>}
        </>
      ) : <span className="chon-cmp__none">—</span>;
    case 'my_note':
      return o.my_note ? <span className="chon-cmp__quote">“{o.my_note}”</span> : <span className="chon-cmp__none">Chưa có</span>;
    default:
      return o[row] ? <span>{o[row]}</span> : <span className="chon-cmp__none">—</span>;
  }
}

/**
 * Chuyến đi (mockup 2E, máy tính; điện thoại xếp dọc, bảng so sánh cuộn ngang trong khung):
 * gợi ý lần trước · bảng so sánh lựa chọn (cùng thứ tự dòng, Chốt) · chốn theo ngày (thắp đèn tại chỗ) ·
 * chuẩn bị (đẩy sang Nhiệm vụ) · ước tính · sau chuyến (chấm điểm).
 */
export default function ChonTripView({
  trip, trips, places, today, api, onBack, onEdit, onTrash, onShare, onOpenPlace, onLightPlace, onToast,
}) {
  const [optSheet, setOptSheet] = useState(null);    // { option?, quote? }
  const [choosing, setChoosing] = useState(null);    // option
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(null);            // { at, items, label }
  const [review, setReview] = useState(trip.review || '');

  const options = useMemo(() => sortOptions(trip.trip_options), [trip.trip_options]);
  const letterOf = id => optionLetter(options.findIndex(o => o.id === id));
  const picked = pickedOption(trip);
  const est = tripEstimate(trip, picked);
  const placeById = useMemo(() => new Map(places.map(p => [p.id, p])), [places]);
  const grouped = groupTripPlaces(trip, placeById);
  const allTripPlaces = [...grouped.days.flatMap(d => d.places), ...grouped.unscheduled];
  const litCount = allTripPlaces.filter(p => placeState(p).state === 'visited').length;
  const hint = pastTripHint(trips, trip);
  const dest = trip.place_id ? placeById.get(trip.place_id) : null;
  const priced = options.filter(o => o.price_per_person > 0);
  const cheapestId = priced.length > 1 ? priced.reduce((m, o) => (o.price_per_person < m.price_per_person ? o : m)).id : null;
  const nDays = tripDayCount(trip);
  const left = countdown(trip, today);
  const tripOver = trip.status === 'done' || (trip.end_date && trip.end_date < today);

  const report = r => { if (r?.error) onToast(r.error); return !r?.error; };

  const saveOption = async (fields) => {
    if (optSheet?.option) return report(await api.updateOption(trip.id, optSheet.option.id, fields));
    return report(await api.addOption(trip.id, fields, nextSortOrder(options)));
  };

  const openOptionMenu = (o, e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({
      at: { x: Math.max(8, r.right - 210), y: r.bottom + 4 },
      label: `Thao tác với lựa chọn ${letterOf(o.id)}`,
      items: [
        { key: 'edit', icon: 'pencil', label: 'Sửa', onSelect: () => setOptSheet({ option: o }) },
        o.pick === 'chosen' ? null : {
          key: 'lean', icon: 'flag', label: o.pick === 'leaning' ? 'Bỏ “đang nghiêng về”' : 'Đang nghiêng về',
          onSelect: async () => report(await api.setLeaning(trip.id, o.pick === 'leaning' ? null : o.id)),
        },
        { key: 'del', icon: 'trash', label: 'Xoá lựa chọn', danger: true, divider: true,
          onSelect: async () => report(await api.deleteOption(trip.id, o.id)) },
      ].filter(Boolean),
    });
  };

  const openTripMenu = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const setStatus = status => async () => report(await api.updateTrip(trip.id, { status }));
    setMenu({
      at: { x: Math.max(8, r.right - 220), y: r.bottom + 4 },
      label: 'Thao tác với chuyến đi',
      items: [
        { key: 'edit', icon: 'pencil', label: 'Sửa chuyến', onSelect: onEdit },
        trip.status !== 'done' && { key: 'done', icon: 'checkCircle', label: 'Đánh dấu đã đi', onSelect: setStatus('done') },
        trip.status !== 'planning' && { key: 'plan', icon: 'refresh', label: 'Quay lại đang chọn', onSelect: setStatus('planning') },
        trip.status !== 'cancelled' && { key: 'cancel', icon: 'prohibit', label: 'Huỷ chuyến', onSelect: setStatus('cancelled') },
        { key: 'trash', icon: 'trash', label: 'Bỏ vào thùng rác', danger: true, divider: true, onSelect: onTrash },
      ].filter(Boolean),
    });
  };

  const placeRow = (p) => {
    const k = kindOf(p.kind);
    const lit = placeState(p).state === 'visited';
    const row = (trip.trip_places || []).find(r => r.place_id === p.id);
    return (
      <li key={p.id} className="chon-day__place">
        <button type="button" className={`chon-lamp-mini${lit ? ' is-lit' : ''}`} onClick={() => onLightPlace(p)}
          aria-label={lit ? `Thắp thêm một lần: ${p.name}` : `Thắp đèn: đã đến ${p.name}`}>
          <AppIcon name="lantern" size={15} weight={lit ? 'fill' : 'regular'} />
        </button>
        <button type="button" className="chon-day__name" onClick={() => onOpenPlace(p)}>
          <span className={`chon-day__kind chon-kind--${k.id}`} aria-hidden="true"><AppIcon name={k.icon} size={13} /></span>
          {p.name}
        </button>
        <select className="chon-day__move" value={row?.day_index || ''} aria-label={`Đổi ngày của ${p.name}`}
          onChange={async e => report(await api.moveTripPlace(trip.id, p.id, e.target.value ? Number(e.target.value) : null))}>
          <option value="">–</option>
          {Array.from({ length: nDays || Math.max(4, grouped.days.length + 1) }, (_, i) => i + 1).map(d => <option key={d} value={d}>N{d}</option>)}
        </select>
        <button type="button" className="chon-icon-btn chon-icon-btn--sm" aria-label={`Bỏ ${p.name} khỏi chuyến`}
          onClick={async () => report(await api.removeTripPlace(trip.id, p.id))}>
          <AppIcon name="x" size={13} />
        </button>
      </li>
    );
  };

  return (
    <div className="chon-trip">
      <header className="chon-trip__head">
        <div className="chon-trip__titles">
          <button type="button" className="chon-link chon-trip__back" onClick={onBack}>
            <AppIcon name="caretLeft" size={14} />Chuyến đi{trip.region ? ` · ${trip.region}` : ''}
          </button>
          <h1 className="chon-trip__title">
            {trip.title}{trip.tagline && <> <em>{trip.tagline}</em></>}
          </h1>
          <div className="chon-chips">
            <span className="chon-pill"><AppIcon name="calendar" size={13} />{formatTripRange(trip)}</span>
            <span className="chon-pill"><AppIcon name="users" size={13} />{trip.people} người</span>
            <span className={`chon-pill chon-pill--status is-${trip.status}`}><i aria-hidden="true" />{TRIP_STATUS_LABEL[trip.status]}{left ? ` · ${left}` : ''}</span>
            {dest && (
              <button type="button" className="chon-pill chon-pill--link" onClick={() => onOpenPlace(dest)}>
                <AppIcon name="lantern" size={13} />{dest.name}
              </button>
            )}
          </div>
        </div>
        <div className="chon-trip__actions">
          <button type="button" className="chon-btn chon-btn--ghost" onClick={onShare}><AppIcon name="share" size={16} />Rủ bạn đi cùng</button>
          <button type="button" className="chon-icon-btn chon-icon-btn--box" aria-label="Thao tác với chuyến đi" onClick={openTripMenu}>
            <AppIcon name="dots" size={18} weight="bold" />
          </button>
        </div>
      </header>

      <div className="chon-trip__grid">
        <div className="chon-trip__main">
          {hint && (
            <div className="chon-hint-card">
              <span className="chon-hint-card__icon" aria-hidden="true"><AppIcon name="history" size={18} /></span>
              <p>
                Lần trước ở <strong>{hint.trip.region || hint.trip.title}{hint.trip.start_date ? ` · ${hint.trip.start_date.slice(5, 7)}/${hint.trip.start_date.slice(0, 4)}` : ''}</strong>
                {hint.option ? ` bạn chọn ${hint.option.name.toLowerCase()}` : ''}
                {hint.rating != null ? `, chấm ${hint.rating}/5` : ''}
                {hint.review ? <>: <em>“{hint.review}”</em></> : '.'}
              </p>
            </div>
          )}

          <section className="chon-trip-box" aria-labelledby="chon-cmp-h">
            <div className="chon-sec-head chon-sec-head--wrap">
              <div>
                <h2 id="chon-cmp-h" className="chon-h2">So sánh lựa chọn</h2>
                <p className="chon-faint chon-m0">{options.length ? `${options.length} lựa chọn · cùng thứ tự dòng để so bằng mắt` : 'Thêm các tour / cách đi bạn đang cân nhắc'}</p>
              </div>
              <div className="chon-sec-actions">
                <button type="button" className="chon-btn chon-btn--ghost chon-btn--sm" onClick={() => setOptSheet({ quote: true })}>
                  <AppIcon name="clipboard" size={14} />Dán báo giá
                </button>
                <button type="button" className="chon-btn chon-btn--soft chon-btn--sm" onClick={() => setOptSheet({})}>
                  <AppIcon name="plus" size={14} />Thêm lựa chọn
                </button>
              </div>
            </div>

            {options.length === 0 ? (
              <div className="chon-empty chon-empty--tight">
                <p>Chưa có lựa chọn nào.</p>
                <p className="chon-faint">Dán báo giá của nhà tour, hoặc thêm “Tự túc” để so.</p>
              </div>
            ) : (
              <div className="chon-cmp-scroll" tabIndex={0} role="region" aria-label="Bảng so sánh lựa chọn, cuộn ngang được">
                <table className="chon-cmp" style={{ '--cols': options.length }}>
                  <thead>
                    <tr>
                      <th scope="col" className="chon-cmp__rowh"><span className="chon-sr">Tiêu chí</span></th>
                      {options.map((o, i) => (
                        <th key={o.id} scope="col" className={`chon-cmp__col${o.pick ? ` is-${o.pick}` : ''}`}>
                          {o.pick === 'leaning' && <span className="chon-cmp__flag">Đang nghiêng về</span>}
                          {o.pick === 'chosen' && <span className="chon-cmp__flag is-chosen"><AppIcon name="check" size={11} weight="bold" />Đã chốt</span>}
                          <span className="chon-cmp__name">
                            <span className="chon-cmp__letter" aria-hidden="true">{optionLetter(i)}</span>
                            <span>{o.name}</span>
                            <button type="button" className="chon-icon-btn chon-icon-btn--sm chon-cmp__more"
                              aria-label={`Thao tác với lựa chọn ${optionLetter(i)}`} onClick={e => openOptionMenu(o, e)}>
                              <AppIcon name="dots" size={15} weight="bold" />
                            </button>
                          </span>
                          {o.provider && <span className="chon-cmp__sub">{o.provider}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map(([row, label]) => (
                      <tr key={row}>
                        <th scope="row" className="chon-cmp__rowh">{label}</th>
                        {options.map(o => (
                          <td key={o.id} className={`chon-cmp__cell chon-cmp__cell--${row}${o.pick ? ` is-${o.pick}` : ''}`}>
                            <Cell row={row} o={o} cheapest={o.id === cheapestId} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="chon-cmp__foot">
                      <th scope="row" className="chon-cmp__rowh">{tripOver ? 'Chấm sau chuyến' : <span className="chon-sr">Chốt</span>}</th>
                      {options.map((o, i) => (
                        <td key={o.id} className={`chon-cmp__cell${o.pick ? ` is-${o.pick}` : ''}`}>
                          {tripOver && o.pick === 'chosen' ? (
                            <Stars value={o.rating ?? null} label={`Chấm lựa chọn ${optionLetter(i)}`}
                              onChange={async v => report(await api.updateOption(trip.id, o.id, { rating: v }))} />
                          ) : o.pick === 'chosen' ? (
                            <span className="chon-cmp__chosen"><AppIcon name="checkCircle" size={16} weight="fill" />Đã chốt {optionLetter(i)}</span>
                          ) : (
                            <button type="button" className={`chon-btn chon-btn--sm ${o.pick === 'leaning' ? 'chon-btn--lamp' : 'chon-btn--outline'}`}
                              onClick={() => setChoosing(o)}>
                              Chốt lựa chọn {optionLetter(i)}
                            </button>
                          )}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {tripOver && (
            <section className="chon-trip-box" aria-labelledby="chon-after-h">
              <h2 id="chon-after-h" className="chon-h2">Sau chuyến</h2>
              {trip.status !== 'done' && (
                <p className="chon-hint">Chuyến đã qua ngày về.{' '}
                  <button type="button" className="chon-link" onClick={async () => report(await api.updateTrip(trip.id, { status: 'done' }))}>Đánh dấu đã đi</button>
                </p>
              )}
              <div className="chon-after">
                <span className="chon-field__label">Cả chuyến</span>
                <Stars value={trip.rating ?? null} label="Chấm cả chuyến"
                  onChange={async v => report(await api.updateTrip(trip.id, { rating: v }))} />
              </div>
              <textarea className="chon-input chon-textarea" rows={3} value={review} maxLength={4000}
                onChange={e => setReview(e.target.value)} aria-label="Nhận xét sau chuyến"
                placeholder="Lần sau nên đi tour hay tự túc, mùa nào đẹp, nhớ mang gì…" />
              <button type="button" className="chon-btn chon-btn--soft chon-btn--sm chon-self-start"
                disabled={review === (trip.review || '')}
                onClick={async () => { if (report(await api.updateTrip(trip.id, { review: review.trim() }))) onToast('Đã lưu nhận xét — lần sau lên chuyến cùng vùng sẽ thấy lại.'); }}>
                Lưu nhận xét
              </button>
              <p className="chon-faint chon-m0">Thắp đèn từng chốn ở cột bên để ghi cảm nhận riêng từng nơi.</p>
            </section>
          )}
        </div>

        <aside className="chon-trip__side" aria-label="Kế hoạch chuyến">
          <section className="chon-trip-box" aria-labelledby="chon-days-h">
            <div className="chon-sec-head">
              <h2 id="chon-days-h" className="chon-h2">Chốn trong chuyến</h2>
              <span className="chon-faint">
                {allTripPlaces.length ? `${allTripPlaces.length} chốn · ${litCount ? `${litCount} đèn đã thắp` : 'đèn chưa thắp'}` : ''}
              </span>
            </div>
            {grouped.days.length > 0 && (
              <ol className="chon-days">
                {grouped.days.map(d => (
                  <li key={d.day} className={`chon-day${d.places.length ? '' : ' is-empty'}`}>
                    <p className="chon-day__label">Ngày {d.day}{d.date ? ` · ${shortDay(d.date)}` : ''}</p>
                    {d.places.length ? <ul className="chon-day__list">{d.places.map(placeRow)}</ul> : <p className="chon-faint chon-m0">Chưa có chốn</p>}
                  </li>
                ))}
              </ol>
            )}
            {grouped.unscheduled.length > 0 && (
              <div className="chon-day">
                <p className="chon-day__label">Chưa xếp ngày</p>
                <ul className="chon-day__list">{grouped.unscheduled.map(placeRow)}</ul>
              </div>
            )}
            <button type="button" className="chon-btn chon-btn--dashed chon-btn--sm chon-self-start" onClick={() => setAdding(true)}>
              <AppIcon name="plus" size={14} />Thêm từ Muốn đến
            </button>
          </section>

          <ChonTripPrep trip={trip} today={today} onUpdateTrip={(patch, extra) => api.updateTrip(trip.id, patch, extra)} onToast={onToast} />

          <section className="chon-trip-box" aria-labelledby="chon-est-h">
            <h2 id="chon-est-h" className="chon-h2">Ước tính · {trip.people} người</h2>
            {est.lines.length ? (
              <dl className="chon-est">
                {est.lines.map((l, i) => (
                  <div key={i} className="chon-est__row"><dt>{l.label}</dt><dd>{formatVND(l.amount)}</dd></div>
                ))}
                <div className="chon-est__row chon-est__total"><dt>Tổng</dt><dd>≈ {formatVND(est.total)}</dd></div>
              </dl>
            ) : (
              <p className="chon-faint chon-m0">Chọn “đang nghiêng về” một lựa chọn có giá, hoặc thêm chi phí khác trong Sửa chuyến.</p>
            )}
            {est.hasUnknown && picked && <p className="chon-hint">Lựa chọn {letterOf(picked.id)} chưa có giá — tổng chỉ gồm phần đã biết.</p>}
            <p className="chon-faint chon-m0">
              {trip.finance_tx_id ? 'Đã ghi vào Tài chính · Du lịch khi chốt.' : 'Chốt một lựa chọn để ghi vào Tài chính · Du lịch.'}
            </p>
            <button type="button" className="chon-link chon-self-start" onClick={onEdit}>Sửa chi phí khác</button>
          </section>
        </aside>
      </div>

      {(optSheet || choosing || adding || menu) && (
        <ChonLayer>
          {menu && <ActionMenu at={menu.at} items={menu.items} label={menu.label} onClose={() => setMenu(null)} />}
          {optSheet && (
            <ChonOptionSheet
              option={optSheet.option || null}
              letter={optSheet.option ? letterOf(optSheet.option.id) : optionLetter(options.length)}
              startWithQuote={!!optSheet.quote}
              onSave={saveOption}
              onClose={() => setOptSheet(null)}
            />
          )}
          {choosing && (
            <ChonChooseDialog
              trip={trip}
              option={choosing}
              letter={letterOf(choosing.id)}
              onConfirm={async (finance) => {
                const ok = report(await api.chooseOption(trip.id, choosing.id, finance));
                if (ok) onToast(finance ? `Đã chốt ${choosing.name} · ghi ${formatVND(finance.amount)} vào Tài chính` : `Đã chốt ${choosing.name}`);
                return ok;
              }}
              onClose={() => setChoosing(null)}
            />
          )}
          {adding && (
            <ChonAddPlacesSheet
              trip={trip}
              places={places}
              onAdd={async (ids, day) => {
                const base = (trip.trip_places || []).reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0);
                return report(await api.addTripPlaces(trip.id, ids.map((place_id, i) => ({ place_id, day_index: day, sort_order: base + i + 1 }))));
              }}
              onClose={() => setAdding(false)}
            />
          )}
        </ChonLayer>
      )}
    </div>
  );
}
