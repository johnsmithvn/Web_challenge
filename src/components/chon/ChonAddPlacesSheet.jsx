import { useMemo, useState } from 'react';
import AppIcon from '../AppIcon';
import ChonSheet from './ChonSheet';
import { kindOf } from './chonData';
import { filterPlaces, placeState } from '../../utils/placeLogic';
import { tripDayCount, dayDate } from '../../utils/tripLogic';
import { shortDay } from '../../utils/placeLogic';
import { normalizeVi } from '../../utils/kbDeriveUtils';

/**
 * Thêm chốn có sẵn vào chuyến (mockup 2E "Thêm từ Muốn đến"): tìm, tích nhiều chốn, chọn ngày rồi thêm.
 * Chốn cùng vùng với chuyến lên đầu; chốn đã trong chuyến không hiện.
 *
 * @param {(placeIds: string[], dayIndex: number|null) => Promise<boolean>} onAdd
 */
export default function ChonAddPlacesSheet({ trip, places, onAdd, onClose }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState([]);
  const [day, setDay] = useState('');
  const [busy, setBusy] = useState(false);
  const n = tripDayCount(trip);

  const list = useMemo(() => {
    const inTrip = new Set((trip.trip_places || []).map(r => r.place_id));
    const region = normalizeVi(trip.region || '').trim();
    const sameRegion = p => region && (normalizeVi(p.area).includes(region) || normalizeVi(p.address).includes(region)) ? 1 : 0;
    return filterPlaces(places, { query })
      .filter(p => !inTrip.has(p.id) && p.id !== trip.place_id)
      .sort((a, b) => sameRegion(b) - sameRegion(a) || String(b.created_at).localeCompare(String(a.created_at)));
  }, [places, trip, query]);

  const toggle = id => setPicked(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const add = async () => {
    if (!picked.length || busy) return;
    setBusy(true);
    const ok = await onAdd(picked, day ? Number(day) : null);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <ChonSheet
      title="Thêm chốn vào chuyến"
      subtitle={trip.title}
      onClose={onClose}
      size="md"
      footer={(
        <>
          <label className="chon-day-select">
            <span className="chon-sr">Xếp vào ngày</span>
            <select className="chon-input" value={day} onChange={e => setDay(e.target.value)}>
              <option value="">Chưa xếp ngày</option>
              {Array.from({ length: n || 10 }, (_, i) => i + 1).map(d => (
                <option key={d} value={d}>Ngày {d}{dayDate(trip, d) ? ` · ${shortDay(dayDate(trip, d))}` : ''}</option>
              ))}
            </select>
          </label>
          <button type="button" className="chon-btn chon-btn--lamp chon-btn--grow" onClick={add} disabled={!picked.length || busy}>
            <AppIcon name="plus" size={16} weight="bold" />Thêm {picked.length || ''} chốn
          </button>
        </>
      )}
    >
      <label className="chon-input-icon">
        <AppIcon name="search" size={15} />
        <input className="chon-input chon-input--bare" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Tìm chốn đã lưu…" aria-label="Tìm chốn" data-autofocus />
      </label>
      {list.length === 0 ? (
        <p className="chon-hint chon-pad-y">{places.length ? 'Không còn chốn nào khớp.' : 'Chưa lưu chốn nào — lưu ở tab Muốn đến trước.'}</p>
      ) : (
        <ul className="chon-pick-list">
          {list.map(p => {
            const k = kindOf(p.kind);
            const on = picked.includes(p.id);
            const lit = placeState(p).state === 'visited';
            return (
              <li key={p.id}>
                <label className={`chon-pick${on ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(p.id)} />
                  <span className={`chon-near__icon chon-kind--${k.id}`} aria-hidden="true"><AppIcon name={k.icon} size={16} /></span>
                  <span className="chon-near__text">
                    <span className="chon-near__name">{p.name}</span>
                    <span className="chon-near__sub">{[k.label, p.area, lit && 'đã đến'].filter(Boolean).join(' · ')}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </ChonSheet>
  );
}
