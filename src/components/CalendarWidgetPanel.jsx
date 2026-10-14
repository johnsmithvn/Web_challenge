import { useEffect, useMemo, useState } from 'react';
import {
  solarToLunar,
  lunarLabel,
  getCanChiYear,
  getCanChiMonth,
  getCanChiDay,
  getZodiacHours,
  getNextGoodHour,
  getUpcomingEvents,
  getSolarTerm,
  moonPhaseName,
} from '../utils/lunarUtils';
import { holidayDot } from '../utils/calendarTimeUtils';
import { toDateStr } from '../utils/dateUtils';
import HOLIDAYS from '../data/holidays.json';
import AppIcon from './AppIcon';

/**
 * Bảng "Lịch & sự kiện" của trang Nhiệm vụ — theo mockup "Nhiệm vụ - Kanban tối và sáng" / "Rừng tiên".
 * Tab Lịch vạn niên: dương/âm hôm nay + can chi + tiết khí, sự kiện hôm nay, giờ hoàng đạo, lịch tháng nhỏ
 * (bấm ngày → chế độ xem Ngày), bật/tắt các lịch hiển thị trên bảng (+ thêm ngày kỷ niệm riêng).
 * Tab Sự kiện: lọc theo lịch, nhóm Hôm nay / 7 ngày tới / Sau đó, tạo việc từ sự kiện.
 * Màu lấy token --tk-* (tasks-aurora.css / tasks-elf.css) nên tự đổi theo sáng/tối và kiểu Rừng tiên.
 */
const DSHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DFULL = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
// [khoá bật/tắt hiện có, tên trong mockup]
const CALS = [['solar', 'Ngày lễ Việt Nam'], ['lunar', 'Ngày lễ Âm lịch'], ['international', 'Ngày lễ Quốc tế'], ['japan', 'Ngày lễ Nhật Bản'], ['custom', 'Kỷ niệm'], ['fun', 'Geek']];
const UPCOMING_DAYS = 90;
const p2 = (n) => String(n).padStart(2, '0');
const rangeLbl = (r) => r.replace('-', '–');
const ANNIV_ICONS = ['💖', '🎂', '💍', '🕊️', '⭐', '🎉'];

// Cùng quy ước mặc định với getUpcomingEvents: Nhật Bản / Geek phải bật rõ ràng, còn lại mặc định bật
const isOn = (toggles, k) => (k === 'japan' || k === 'fun' ? !!toggles?.[k] : toggles?.[k] !== false);

function AnnivForm({ onSave, onCancel }) {
  const [title, setTitle] = useState('');
  const [calType, setCalType] = useState('solar');
  const [day, setDay] = useState(1);
  const [month, setMonth] = useState(1);
  const [year, setYear] = useState('');
  const [icon, setIcon] = useState(ANNIV_ICONS[0]);
  const save = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({ id: `anniv-${Date.now()}`, title: title.trim(), calType, day: Number(day), month: Number(month), year: year ? Number(year) : null, icon });
  };
  return (
    <form className="tk-ut-anniv" onSubmit={save}>
      <input className="tk-ut-anniv__input" placeholder="Tên kỷ niệm (vd: Ngày cưới, Ngày giỗ…)" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
      <div className="tk-ut-anniv__row">
        <div className="tk-ut-tabs">
          {[['solar', 'Dương lịch'], ['lunar', 'Âm lịch']].map(([k, n]) => (
            <button key={k} type="button" className={`tk-ut-tab${calType === k ? ' is-on' : ''}`} onClick={() => setCalType(k)}>{n}</button>
          ))}
        </div>
        <select className="tk-ut-anniv__select" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Ngày">
          {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>Ngày {i + 1}</option>)}
        </select>
        <select className="tk-ut-anniv__select" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Tháng">
          {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Tháng {i + 1}</option>)}
        </select>
      </div>
      <div className="tk-ut-anniv__row">
        <div className="tk-ut-anniv__icons">
          {ANNIV_ICONS.map((ic) => (
            <button key={ic} type="button" className={`tk-ut-anniv__icon${icon === ic ? ' is-on' : ''}`} onClick={() => setIcon(ic)} aria-label={`Biểu tượng ${ic}`}>{ic}</button>
          ))}
        </div>
        <input className="tk-ut-anniv__input tk-ut-anniv__year" type="number" min="1900" max="2100" placeholder="Năm (tuỳ chọn)" value={year} onChange={(e) => setYear(e.target.value)} />
      </div>
      <div className="tk-ut-anniv__actions">
        <button type="button" className="tk-ut-anniv__btn" onClick={onCancel}>Huỷ</button>
        <button type="submit" className="tk-ut-anniv__btn is-primary" disabled={!title.trim()}>Lưu kỷ niệm</button>
      </div>
    </form>
  );
}

export default function CalendarWidgetPanel({
  isOpen = true,
  onClose,
  tasks = [],
  onSelectEventDate,
  holidayToggles = { solar: true, lunar: true, international: true, japan: false, fun: true, custom: true },
  onToggleHolidayType,
  customAnniversaries = [],
  onAddCustomAnniversary,
  onDeleteCustomAnniversary,
  onCreateTaskFromEvent,
  isEventTaskAdded,
}) {
  const [tab, setTab] = useState('today'); // 'today' | 'events'
  const [fil, setFil] = useState('all');
  const [showAnniv, setShowAnniv] = useState(false);
  // Giờ hiện tại cập nhật mỗi phút (giờ hoàng đạo, "còn N phút")
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isOpen) return undefined;
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, [isOpen]);
  const today = toDateStr(now);
  const [mon, setMon] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }));

  const info = useMemo(() => {
    const d = now.getDate(), m = now.getMonth() + 1, y = now.getFullYear();
    const lunar = solarToLunar(d, m, y);
    return {
      d, m, y, lunar, dow: now.getDay(),
      chips: [`Năm ${getCanChiYear(lunar.year)}`, `Tháng ${getCanChiMonth(lunar.year, lunar.month)}`, `Ngày ${getCanChiDay(d, m, y).full}`, `Tiết ${getSolarTerm(d, m, y)}`],
    };
  }, [now]);

  const hours = useMemo(() => getZodiacHours(info.d, info.m, info.y, now.getHours()), [info, now]);
  const cur = hours.find((h) => h.isNow);
  const next = cur && !cur.isHoangDao ? getNextGoodHour(now) : null;
  const nextLbl = !cur || cur.isHoangDao ? 'Đang trong giờ tốt' : next
    ? `Giờ tốt kế tiếp: ${next.name} ${rangeLbl(next.range)}h, còn ${Math.floor(next.minutesUntil / 60) ? `${Math.floor(next.minutesUntil / 60)} giờ ` : ''}${next.minutesUntil % 60} phút`
    : '';

  // Sự kiện sắp tới (tôn trọng bật/tắt) — dùng cho tab Sự kiện + "Hôm nay có"
  const upcoming = useMemo(
    () => getUpcomingEvents(new Date(`${today}T00:00:00`), HOLIDAYS, UPCOMING_DAYS, holidayToggles, customAnniversaries),
    [today, holidayToggles, customAnniversaries]
  );
  const todayEvents = upcoming.filter((e) => e.dateStr === today);
  const dueToday = tasks.filter((t) => !t.completed && t.due_date === today).length;

  // Lịch tháng nhỏ: tuần bắt đầu Chủ nhật như mockup; chấm = tối đa 2 sự kiện + 1 chấm việc đến hạn
  const month = useMemo(() => {
    const first = new Date(mon.y, mon.m, 1);
    const days = new Date(mon.y, mon.m + 1, 0).getDate();
    const total = Math.ceil((first.getDay() + days) / 7) * 7;
    const start = new Date(mon.y, mon.m, 1 - first.getDay());
    const evBy = {};
    for (const e of getUpcomingEvents(start, HOLIDAYS, total - 1, holidayToggles, customAnniversaries)) (evBy[e.dateStr] = evBy[e.dateStr] || []).push(e);
    const dueBy = {};
    for (const t of tasks) if (!t.completed && t.due_date) dueBy[t.due_date] = (dueBy[t.due_date] || 0) + 1;
    return Array.from({ length: total }, (_, i) => {
      const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const v = toDateStr(dt), evs = evBy[v] || [], nT = dueBy[v] || 0;
      return {
        v, dt, n: dt.getDate(), inM: dt.getMonth() === mon.m, isT: v === today, sun: dt.getDay() === 0,
        lun: lunarLabel(solarToLunar(dt.getDate(), dt.getMonth() + 1, dt.getFullYear())),
        dots: [...evs.slice(0, 2).map((e) => holidayDot(e.type)), ...(nT ? ['var(--tk-seg-on-fg)'] : [])],
        tip: [...evs.map((e) => e.title), nT ? `${nT} việc` : ''].filter(Boolean).join(' · '),
      };
    });
  }, [mon, today, tasks, holidayToggles, customAnniversaries]);

  const counts = useMemo(() => Object.fromEntries(CALS.map(([k]) => [k, k === 'custom' ? customAnniversaries.length : Object.keys(HOLIDAYS[k] || {}).length])), [customAnniversaries]);

  const shown = upcoming.filter((e) => fil === 'all' || e.type === fil);
  const groups = [['Hôm nay', (e) => e.diffDays === 0], ['7 ngày tới', (e) => e.diffDays > 0 && e.diffDays <= 7], ['Sau đó', (e) => e.diffDays > 7]]
    .map(([n, f]) => ({ n, items: shown.filter(f) }))
    .filter((g) => g.items.length);

  if (!isOpen) return null;

  return (
    <aside className="cal-widget-panel tk-ut" aria-label="Lịch vạn niên và sự kiện">
      <div className="tk-ut__head">
        <div className="tk-ut-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'today'} className={`tk-ut-tab${tab === 'today' ? ' is-on' : ''}`} onClick={() => setTab('today')}>
            <AppIcon name="moonStars" size={14} />Lịch vạn niên
          </button>
          <button type="button" role="tab" aria-selected={tab === 'events'} className={`tk-ut-tab${tab === 'events' ? ' is-on' : ''}`} onClick={() => setTab('events')}>
            <AppIcon name="bellSimple" size={14} />Sự kiện · {upcoming.length}
          </button>
        </div>
        <button type="button" className="tk-ut__close" onClick={onClose} title="Đóng" aria-label="Đóng">
          <AppIcon name="x" size={15} />
        </button>
      </div>

      {tab === 'today' ? (
        <div className="tk-ut__body">
          {/* Dương lịch | Âm lịch + can chi, tiết khí */}
          <div className="tk-ut-hero">
            <div className="tk-ut-hero__grid">
              <div className="tk-ut-hero__col">
                <span className="tk-ut-label">DƯƠNG LỊCH</span>
                <span className="tk-ut-hero__num">{info.d}</span>
                <span className="tk-ut-hero__dow">{DFULL[info.dow]}</span>
                <span className="tk-ut-hero__sub">Tháng {info.m}, {info.y}</span>
              </div>
              <span className="tk-ut-hero__sep" />
              <div className="tk-ut-hero__col">
                <span className="tk-ut-label">ÂM LỊCH</span>
                <span className="tk-ut-hero__num is-lunar">{info.lunar.day}</span>
                <span className="tk-ut-hero__mon">Tháng {info.lunar.month}{info.lunar.leap ? ' nhuận' : ''}</span>
                <span className="tk-ut-hero__sub"><AppIcon name="moon" size={12} />{moonPhaseName(info.lunar.day)}</span>
              </div>
            </div>
            <div className="tk-ut-hero__chips">
              {info.chips.map((c) => <span key={c} className="tk-ut-chip">{c}</span>)}
            </div>
          </div>

          <div className="tk-ut-sec">
            <span className="tk-ut-label">HÔM NAY CÓ</span>
            {todayEvents.map((e, i) => (
              <div key={`${e.type}-${i}`} className="tk-ut-row">
                <span className="tk-ut-dot" style={{ background: holidayDot(e.type) }} />
                <span className="tk-ut-row__text">{e.title}</span>
              </div>
            ))}
            <button type="button" className="tk-ut-row is-link" onClick={() => onSelectEventDate?.(new Date(`${today}T00:00:00`))}>
              <AppIcon name="checkSquare" size={15} />
              {dueToday} việc đến hạn hôm nay
              <AppIcon name="arrowRight" size={13} className="tk-ut-row__end" />
            </button>
          </div>

          <div className="tk-ut-sec is-hd">
            <div className="tk-ut-sec__head">
              <span className="tk-ut-label">GIỜ HOÀNG ĐẠO</span>
              <span className="tk-ut-sec__aside">6 giờ tốt / ngày</span>
            </div>
            <div className="tk-ut-hd">
              {hours.map((h) => (
                <div key={h.name} className={`tk-ut-hd__seg${h.isHoangDao ? ' is-good' : ''}${h.isNow ? ' is-now' : ''}`} title={`Giờ ${h.name} ${rangeLbl(h.range)} · ${h.isHoangDao ? 'hoàng đạo' : 'hắc đạo'}`}>
                  <span className="tk-ut-hd__bar" />
                  <span className="tk-ut-hd__name">{h.name}</span>
                </div>
              ))}
            </div>
            {cur && (
              <div className="tk-ut-now">
                <span className="tk-ut-now__main">Bây giờ: giờ {cur.name} ({rangeLbl(cur.range)}h) · {cur.isHoangDao ? 'hoàng đạo' : 'hắc đạo'}</span>
                <span className="tk-ut-now__sub">{nextLbl}</span>
              </div>
            )}
          </div>

          <div className="tk-ut-sec">
            <div className="tk-ut-sec__head">
              <span className="tk-ut-label">THÁNG {mon.m + 1}, {mon.y}</span>
              <button type="button" className="tk-ut-nav" onClick={() => setMon((x) => ({ y: x.m ? x.y : x.y - 1, m: x.m ? x.m - 1 : 11 }))} aria-label="Tháng trước">
                <AppIcon name="caretLeft" size={12} />
              </button>
              <button type="button" className="tk-ut-nav" onClick={() => setMon((x) => ({ y: x.m === 11 ? x.y + 1 : x.y, m: x.m === 11 ? 0 : x.m + 1 }))} aria-label="Tháng sau">
                <AppIcon name="caretRight" size={12} />
              </button>
            </div>
            <div className="tk-ut-cal">
              {DSHORT.map((n, i) => <span key={n} className={`tk-ut-cal__dow${i === 0 ? ' is-sun' : ''}`}>{n}</span>)}
              {month.map((c) => (
                <button
                  key={c.v}
                  type="button"
                  className={`tk-ut-cal__cell${c.isT ? ' is-today' : ''}${!c.inM ? ' is-out' : c.sun ? ' is-sun' : ''}`}
                  title={c.tip || undefined}
                  onClick={() => onSelectEventDate?.(c.dt)}
                >
                  <span className="tk-ut-cal__n">{c.n}</span>
                  <span className="tk-ut-cal__lun">{c.lun}</span>
                  <span className="tk-ut-cal__dots">{c.dots.map((bg, j) => <span key={j} style={{ background: bg }} />)}</span>
                </button>
              ))}
            </div>
            <span className="tk-ut-hint">Bấm một ngày để mở chế độ xem Ngày.</span>
          </div>

          <div className="tk-ut-sec is-cals">
            <span className="tk-ut-label">LỊCH HIỂN THỊ TRÊN BẢNG</span>
            {CALS.map(([k, n]) => {
              const on = isOn(holidayToggles, k);
              return (
                <div key={k} className="tk-ut-cal-row" role="switch" aria-checked={on} tabIndex={0} onClick={() => onToggleHolidayType?.(k)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleHolidayType?.(k); } }}>
                  <span className="tk-ut-dot" style={{ background: holidayDot(k) }} />
                  <span className="tk-ut-cal-row__name">{n}</span>
                  {/* Thêm ngày kỷ niệm riêng (không có trong mockup — giữ tính năng cũ) */}
                  {k === 'custom' && onAddCustomAnniversary && (
                    <button type="button" className="tk-ut-cal-row__add" title="Thêm ngày kỷ niệm, sinh nhật, ngày giỗ…" onClick={(e) => { e.stopPropagation(); setShowAnniv((v) => !v); }}>
                      <AppIcon name={showAnniv ? 'x' : 'plus'} size={12} />
                    </button>
                  )}
                  <span className="tk-ut-cal-row__cnt">{counts[k]}</span>
                  <span className={`tk-ut-switch${on ? ' is-on' : ''}`} style={on ? { background: holidayDot(k) } : undefined}><span /></span>
                </div>
              );
            })}
            {showAnniv && (
              <AnnivForm
                onSave={(item) => { onAddCustomAnniversary?.(item); setShowAnniv(false); }}
                onCancel={() => setShowAnniv(false)}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="tk-ut__events">
          <div className="tk-ut-fils">
            {[['all', 'Tất cả'], ...CALS.map(([k, n]) => [k, n.replace('Ngày lễ ', '')])].map(([k, n]) => (
              <button key={k} type="button" className={`tk-ut-fil${fil === k ? ' is-on' : ''}`} onClick={() => setFil(k)}>
                <span className="tk-ut-fil__dot" style={{ background: k === 'all' ? 'var(--tk-ut-mute)' : holidayDot(k) }} />
                {n}
                <span className="tk-ut-fil__cnt">{k === 'all' ? upcoming.length : upcoming.filter((e) => e.type === k).length}</span>
              </button>
            ))}
          </div>
          <div className="tk-ut__body is-events">
            {groups.map((g) => (
              <div key={g.n} className="tk-ut-group">
                <span className="tk-ut-label tk-ut-group__name">{g.n}</span>
                {g.items.map((ev, i) => {
                  const dt = ev.targetDate, l = solarToLunar(dt.getDate(), dt.getMonth() + 1, dt.getFullYear());
                  const added = !!isEventTaskAdded?.(ev);
                  return (
                    <div key={`${ev.dateStr}-${ev.type}-${i}`} className="tk-ut-ev" onClick={() => onSelectEventDate?.(dt)} title="Xem trên lịch">
                      <span className="tk-ut-dot tk-ut-ev__dot" style={{ background: holidayDot(ev.type) }} />
                      <div className="tk-ut-ev__text">
                        <span className="tk-ut-ev__name">{ev.title}</span>
                        <span className="tk-ut-ev__date">{DSHORT[dt.getDay()]}, {p2(dt.getDate())}/{p2(dt.getMonth() + 1)}/{dt.getFullYear()} · {l.day}/{l.month} ÂL</span>
                      </div>
                      <div className="tk-ut-ev__side">
                        <span className={`tk-ut-cd${ev.diffDays <= 3 ? ' is-hot' : ''}`}>{ev.diffDays === 0 ? 'Hôm nay' : `Còn ${ev.diffDays} ngày`}</span>
                        <div className="tk-ut-ev__acts">
                          {onCreateTaskFromEvent && (
                            <button type="button" className={`tk-ut-ev__add${added ? ' is-added' : ''}`} title="Tạo việc vào ngày này" disabled={added} onClick={(e) => { e.stopPropagation(); onCreateTaskFromEvent(ev); }}>
                              <AppIcon name={added ? 'check' : 'plus'} size={11} />{added ? 'Đã thêm' : 'Tạo việc'}
                            </button>
                          )}
                          {ev.isCustom && onDeleteCustomAnniversary && (
                            <button type="button" className="tk-ut-ev__del" title="Xoá ngày kỷ niệm này" aria-label="Xoá ngày kỷ niệm này" onClick={(e) => { e.stopPropagation(); onDeleteCustomAnniversary(ev.id); }}>
                              <AppIcon name="trash" size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {!groups.length && <span className="tk-ut-empty">Không có sự kiện sắp tới trong nhóm này.</span>}
          </div>
        </div>
      )}
    </aside>
  );
}
