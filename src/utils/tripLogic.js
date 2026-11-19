/**
 * tripLogic.js — logic thuần của Chuyến đi trong module Chốn (docs/PLAN_CHON.md §3.2, mockup 2E).
 * Không Supabase, không React. Một chuyến (`trip`) là dòng `trips` kèm `trip_options[]` và `trip_places[]`
 * do usePlaces nạp.
 */
import { normalizeVi } from './kbDeriveUtils.js';
import { normalizeHttpUrl } from './mediaUtils.js';
import { parseCurrencyInput } from './currencyUtils.js';
import { cleanList, shortDay } from './placeLogic.js';

const DAY_MS = 86400000;
const ymdToUtc = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const utcToYmd = ms => new Date(ms).toISOString().slice(0, 10);
const isYmd = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

export const TRIP_STATUS = ['planning', 'booked', 'done', 'cancelled'];
export const TRIP_STATUS_LABEL = { planning: 'Đang chọn', booked: 'Đã chốt', done: 'Đã đi', cancelled: 'Đã huỷ' };
export const MAX_OPTIONS = 8;
export const MAX_PREP = 60;

/* ── Ngày ───────────────────────────────────────────────────── */

/** Số ngày của chuyến (đi + về tính cả hai), null khi thiếu ngày. */
export function tripDayCount(trip) {
  if (!isYmd(trip?.start_date) || !isYmd(trip?.end_date)) return null;
  return Math.round((ymdToUtc(trip.end_date) - ymdToUtc(trip.start_date)) / DAY_MS) + 1;
}

/** 'yyyy-mm-dd' của ngày thứ `dayIndex` (1 = ngày đi), null khi chưa có ngày đi. */
export function dayDate(trip, dayIndex) {
  if (!isYmd(trip?.start_date) || !dayIndex) return null;
  return utcToYmd(ymdToUtc(trip.start_date) + (dayIndex - 1) * DAY_MS);
}

/** "T6 27/11 → T2 30/11 · 4 ngày 3 đêm" / "T6 27/11" / "Chưa chọn ngày". */
export function formatTripRange(trip) {
  const n = tripDayCount(trip);
  if (n) {
    const span = n === 1 ? 'đi trong ngày' : `${n} ngày ${n - 1} đêm`;
    return `${shortDay(trip.start_date)} → ${shortDay(trip.end_date)} · ${span}`;
  }
  if (isYmd(trip?.start_date)) return shortDay(trip.start_date);
  return 'Chưa chọn ngày';
}

/** Còn bao lâu tới ngày đi: "còn 8 ngày", "mai đi", "đang đi", null khi chưa có ngày / đã qua. */
export function countdown(trip, today) {
  if (!isYmd(trip?.start_date) || !isYmd(today)) return null;
  const d = Math.round((ymdToUtc(trip.start_date) - ymdToUtc(today)) / DAY_MS);
  if (d > 1) return `còn ${d} ngày`;
  if (d === 1) return 'mai đi';
  if (d === 0) return 'hôm nay đi';
  const end = isYmd(trip.end_date) ? trip.end_date : trip.start_date;
  return ymdToUtc(end) >= ymdToUtc(today) ? 'đang đi' : null;
}

/* ── Lựa chọn ───────────────────────────────────────────────── */

/** Thứ tự cột so sánh: sort_order rồi ngày tạo. */
export function sortOptions(options) {
  return [...(options || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    || String(a.created_at || '').localeCompare(String(b.created_at || '')));
}

/** Nhãn cột: A, B, C… */
export function optionLetter(index) {
  return String.fromCharCode(65 + (index % 26));
}

/** Lựa chọn đang dùng để ước tính: đã chốt, không thì đang nghiêng về. */
export function pickedOption(trip) {
  const opts = trip?.trip_options || [];
  return opts.find(o => o.pick === 'chosen') || opts.find(o => o.pick === 'leaning') || null;
}

/** sort_order cho lựa chọn mới (cuối hàng). */
export function nextSortOrder(options) {
  return (options || []).reduce((m, o) => Math.max(m, o.sort_order ?? 0), 0) + 1;
}

/* ── Ước tính ───────────────────────────────────────────────── */

/**
 * Ước tính cho cả nhóm: lựa chọn đang dùng × số người + chi phí khác.
 * @returns {{ lines: {label, amount}[], total: number, hasUnknown: boolean }}
 *   hasUnknown = lựa chọn chưa có giá (tổng chỉ là phần đã biết).
 */
export function tripEstimate(trip, option = pickedOption(trip)) {
  const people = Math.max(1, trip?.people || 1);
  const lines = [];
  let hasUnknown = false;
  if (option) {
    if (Number.isFinite(option.price_per_person) && option.price_per_person > 0) {
      lines.push({ label: `${option.name} × ${people}`, amount: option.price_per_person * people });
    } else hasUnknown = true;
  }
  for (const c of trip?.extra_costs || []) {
    const amount = Number(c?.amount);
    if (c?.label && Number.isFinite(amount) && amount > 0) lines.push({ label: c.label, amount });
  }
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0), hasUnknown };
}

/* ── Chốn trong chuyến ──────────────────────────────────────── */

/**
 * Xếp chốn theo ngày.
 * @param {object} trip — có trip_places [{ place_id, day_index, sort_order }]
 * @param {Map<string, object>} placeById
 * @returns {{ days: { day, date, places }[], unscheduled: object[] }}
 *   Có số ngày → đủ các ngày kể cả ngày trống; không thì chỉ các ngày có chốn.
 *   Chốn đã bị xoá (không còn trong placeById) bị bỏ qua.
 */
export function groupTripPlaces(trip, placeById) {
  const rows = [...(trip?.trip_places || [])]
    .filter(r => placeById.has(r.place_id))
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
  const n = tripDayCount(trip);
  const byDay = new Map();
  const unscheduled = [];
  for (const r of rows) {
    const p = placeById.get(r.place_id);
    if (!r.day_index || (n && r.day_index > n)) { unscheduled.push(p); continue; }
    if (!byDay.has(r.day_index)) byDay.set(r.day_index, []);
    byDay.get(r.day_index).push(p);
  }
  const dayNums = n ? Array.from({ length: n }, (_, i) => i + 1) : [...byDay.keys()].sort((a, b) => a - b);
  return {
    days: dayNums.map(day => ({ day, date: dayDate(trip, day), places: byDay.get(day) || [] })),
    unscheduled,
  };
}

/* ── Chuẩn bị ───────────────────────────────────────────────── */

export function prepProgress(items) {
  const list = Array.isArray(items) ? items : [];
  return { done: list.filter(i => i?.done).length, total: list.length };
}

/** Thêm một mục chuẩn bị (bỏ trống, bỏ trùng không dấu). `makeId` tiêm vào để test. */
export function addPrepItem(items, text, makeId = () => crypto.randomUUID()) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const list = Array.isArray(items) ? items : [];
  if (!t || list.length >= MAX_PREP || list.some(i => normalizeVi(i.text) === normalizeVi(t))) return list;
  return [...list, { id: makeId(), text: t, done: false }];
}

/** Hạn mặc định của việc "Chuẩn bị …": trước ngày đi một ngày; chưa có ngày đi → null. */
export function prepDueDate(trip, today) {
  if (!isYmd(trip?.start_date)) return null;
  const d = utcToYmd(ymdToUtc(trip.start_date) - DAY_MS);
  return isYmd(today) && d < today ? today : d;
}

/* ── Lần trước ──────────────────────────────────────────────── */

/**
 * Gợi ý từ chuyến đã đi: ưu tiên cùng vùng, rồi mới nhất. Chỉ lấy chuyến đã đi có chấm điểm
 * (chuyến hoặc lựa chọn đã chốt) hoặc có nhận xét.
 * @returns {{ trip, option, rating, review }|null}
 */
export function pastTripHint(trips, current) {
  const region = normalizeVi(current?.region || '').trim();
  const done = (trips || []).filter(t => t.id !== current?.id && !t.archived_at && t.status === 'done')
    .map(t => {
      const option = (t.trip_options || []).find(o => o.pick === 'chosen') || null;
      return { trip: t, option, rating: option?.rating ?? t.rating ?? null, review: t.review || '' };
    })
    .filter(h => h.rating != null || h.review);
  if (!done.length) return null;
  const when = h => h.trip.end_date || h.trip.start_date || '';
  done.sort((a, b) => {
    const sa = region && normalizeVi(a.trip.region).trim() === region ? 1 : 0;
    const sb = region && normalizeVi(b.trip.region).trim() === region ? 1 : 0;
    return sb - sa || String(when(b)).localeCompare(String(when(a)));
  });
  return done[0];
}

/* ── Dán báo giá ────────────────────────────────────────────── */

const BULLET = /^\s*(?:[-*•+–—✓✔☑]|\d+[.)])\s*/;
// So trên chữ đã bỏ dấu (normalizeVi): "Không bao gồm", "Chưa gồm", "Ko bao gồm" / "Giá tour bao gồm", "Gồm có"
const EXCL_HEAD = /^(khong|chua|ko)\s*(bao\s*)?gom\b/;
const INCL_HEAD = /^(gia\s*)?(tour\s*)?(bao\s*gom|gom\s*co|gom)\b/;
// Không dính chữ phía trước: "4N3Đ" (4 ngày 3 đêm) không phải 3đ
const MONEY = /(?<![\p{L}\d.,])\d[\d.,]*\s*(k|nghìn|ngàn|tr|triệu|m|đ|vnđ|vnd|₫)(?![\p{L}])/iu;

/**
 * Tách báo giá dán từ Zalo / FB: giá (số tiền đầu tiên có đơn vị), các dòng gạch đầu dòng sau "Bao gồm" vào
 * `includes`, sau "Không / Chưa bao gồm" vào `excludes`. Không chắc thì để trống — user sửa tay.
 * @returns {{ price: number|null, includes: string[], excludes: string[] }}
 */
export function parseQuote(text) {
  const includes = [];
  const excludes = [];
  let price = null;
  let section = null;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const head = normalizeVi(line.replace(BULLET, '')).trim();
    const isExcl = EXCL_HEAD.test(head);
    const isIncl = !isExcl && INCL_HEAD.test(head);
    // Giá = số tiền đầu tiên, trừ phần "không gồm" (tiền ở đó là thứ phải trả THÊM, không phải giá tour)
    if (price == null && !isExcl && !(section === 'ex' && !isIncl)) {
      const m = line.match(MONEY);
      if (m) { const v = parseCurrencyInput(m[0].replace(/(đ|vnđ|vnd|₫)$/i, '')); if (v > 0) price = v; }
    }
    if (isExcl || isIncl) {
      section = isExcl ? 'ex' : 'in';
      const rest = line.split(/[:：]/).slice(1).join(':').trim();
      if (rest) rest.split(/[,;]/).forEach(s => (isExcl ? excludes : includes).push(s));
      continue;
    }
    if (section && BULLET.test(raw)) (section === 'ex' ? excludes : includes).push(line.replace(BULLET, ''));
  }
  return { price, includes: cleanList(includes, 30, 120), excludes: cleanList(excludes, 30, 120) };
}

/* ── Kiểm dữ liệu form ──────────────────────────────────────── */

const trimTo = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Form chuyến đi → dòng `trips`. @returns {{ value }|{ error }} */
export function cleanTrip(f = {}) {
  const title = trimTo(f.title, 200);
  if (!title) return { error: 'Ghi tên chuyến đi.' };
  if (title.length > 120) return { error: 'Tên chuyến quá dài (tối đa 120 ký tự).' };
  const start = f.start_date || null;
  const end = f.end_date || null;
  if (start && !isYmd(start)) return { error: 'Ngày đi không hợp lệ.' };
  if (end && !isYmd(end)) return { error: 'Ngày về không hợp lệ.' };
  if (start && end && end < start) return { error: 'Ngày về phải sau hoặc trùng ngày đi.' };
  const people = f.people === '' || f.people == null ? 1 : Number(f.people);
  if (!(Number.isInteger(people) && people >= 1 && people <= 50)) return { error: 'Số người từ 1 đến 50.' };
  const extra = (f.extra_costs || [])
    .map(c => ({ label: trimTo(c?.label, 60), amount: Math.round(Number(c?.amount) || 0) }))
    .filter(c => c.label && c.amount > 0)
    .slice(0, 30);
  return {
    value: {
      title,
      tagline: trimTo(f.tagline, 80),
      region: trimTo(f.region, 60),
      start_date: start,
      end_date: end,
      people,
      place_id: f.place_id || null,
      extra_costs: extra,
      note: String(f.note ?? '').trim().slice(0, 2000),
    },
  };
}

/** Form lựa chọn tour → dòng `trip_options` (không gồm trip_id / sort_order). */
export function cleanOption(f = {}) {
  const name = trimTo(f.name, 200);
  if (!name) return { error: 'Ghi tên lựa chọn (vd Easy rider, Tự túc).' };
  if (name.length > 80) return { error: 'Tên lựa chọn quá dài (tối đa 80 ký tự).' };
  let price = null;
  if (f.price_per_person !== '' && f.price_per_person != null) {
    price = typeof f.price_per_person === 'number' ? Math.round(f.price_per_person) : parseCurrencyInput(f.price_per_person);
    if (!Number.isFinite(price) || price < 0) return { error: 'Giá không hợp lệ.' };
    if (price === 0) price = null;
  }
  let source_url = null;
  if (String(f.source_url ?? '').trim()) {
    source_url = normalizeHttpUrl(f.source_url);
    if (!source_url) return { error: 'Link nguồn không hợp lệ.' };
  }
  return {
    value: {
      name,
      provider: trimTo(f.provider, 120),
      price_per_person: price,
      price_note: trimTo(f.price_note, 80),
      schedule: trimTo(f.schedule, 120),
      schedule_note: trimTo(f.schedule_note, 120),
      includes: cleanList(f.includes, 30, 120),
      excludes: cleanList(f.excludes, 30, 120),
      source_url,
      source_note: trimTo(f.source_note, 200),
      pros: String(f.pros ?? '').trim().slice(0, 500),
      cons: String(f.cons ?? '').trim().slice(0, 500),
      my_note: String(f.my_note ?? '').trim().slice(0, 1000),
    },
  };
}
