/**
 * placeLogic.js — logic thuần của module Chốn (docs/PLAN_CHON.md §4).
 *
 * Không Supabase, không React, không import JSON (danh mục loại chốn nằm ở src/data/place-kinds.json,
 * test đối chiếu id hai bên). Một chốn (`place`) là dòng `places` kèm `place_sources` và `place_visits`
 * do usePlaces nạp. "Muốn đến" / "Đã đến" không lưu: đã đến = có ít nhất một lần đến.
 */
import { normalizeVi } from './kbDeriveUtils.js';
import { normalizeHttpUrl } from './mediaUtils.js';

const DAY_MS = 86400000;

// Khớp CHECK trong supabase/migrations/20261119000000_places_v6_38_0.sql.
export const PLACE_KIND_IDS = ['food', 'cafe', 'outing', 'travel', 'stay', 'other'];
export const OCCASION_IDS = ['friends', 'date', 'family', 'solo'];
export const REVISIT_IDS = ['yes', 'maybe', 'no'];
export const PLATFORM_IDS = ['tiktok', 'facebook', 'instagram', 'youtube', 'threads', 'google_maps', 'web', 'friend', 'other'];

export const MAX_MUST_TRY = 20;
export const MAX_DISHES = 30;

/* ── Trạng thái ─────────────────────────────────────────────── */

/** Lần đến mới nhất trước (cùng ngày thì ghi sau trước). */
export function sortedVisits(place) {
  return [...(place?.place_visits || [])].sort((a, b) =>
    String(b.visited_on).localeCompare(String(a.visited_on))
    || String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

/**
 * @returns {{ state: 'want'|'visited', lastVisit: object|null, visitCount: number, rating: number|null }}
 * rating = điểm của lần gần nhất có chấm.
 */
export function placeState(place) {
  const visits = sortedVisits(place);
  const rated = visits.find(v => v.rating != null);
  return {
    state: visits.length ? 'visited' : 'want',
    lastVisit: visits[0] || null,
    visitCount: visits.length,
    rating: rated ? rated.rating : null,
  };
}

/* ── Tìm & lọc ──────────────────────────────────────────────── */

/** Toàn bộ chữ tìm được của một chốn, đã bỏ dấu. */
export function placeSearchText(place) {
  const parts = [
    place.name, place.area, place.address, place.note, place.hours_note,
    ...(place.must_try || []),
    ...(place.place_sources || []).flatMap(s => [s.author, s.quote]),
    ...(place.place_visits || []).flatMap(v => [v.note, ...(v.dishes || [])]),
  ];
  return normalizeVi(parts.filter(Boolean).join(' \n '));
}

/**
 * @param {object[]} places
 * @param {{ tab?: 'want'|'visited'|'all', kind?: string, area?: string, occasion?: string, query?: string }} f
 */
export function filterPlaces(places, { tab = 'all', kind = '', area = '', occasion = '', query = '' } = {}) {
  const words = normalizeVi(query).split(/\s+/).filter(Boolean);
  const areaKey = normalizeVi(area).trim();
  return (places || []).filter(p => {
    if (p.archived_at) return false;
    if (tab !== 'all' && placeState(p).state !== tab) return false;
    if (kind && p.kind !== kind) return false;
    if (areaKey && normalizeVi(p.area).trim() !== areaKey) return false;
    if (occasion && !(p.occasions || []).includes(occasion)) return false;
    if (words.length) {
      const text = placeSearchText(p);
      if (!words.every(w => text.includes(w))) return false;
    }
    return true;
  });
}

/** Đếm theo loại / khu vực trong một tập (cho viên đếm của thanh lọc). Khu vực xếp nhiều trước. */
export function countBy(places, key) {
  const map = new Map();
  for (const p of places || []) {
    const k = key === 'area' ? (p.area || '').trim() : p[key];
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

/** Khu vực đã dùng, gộp cách viết khác hoa thường / dấu ("quận 4" = "Quận 4"), nhiều chốn trước. */
export function areaOptions(places) {
  const map = new Map();
  for (const p of places || []) {
    const name = (p.area || '').trim();
    if (p.archived_at || !name) continue;
    const k = normalizeVi(name);
    const cur = map.get(k) || { name, count: 0 };
    cur.count += 1;
    map.set(k, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));
}

/* ── Khoảng cách ────────────────────────────────────────────── */

export function hasCoords(p) {
  return p != null && Number.isFinite(p.lat) && Number.isFinite(p.lng);
}

/** Haversine, mét. */
export function distanceM(a, b) {
  const R = 6371000;
  const rad = d => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "650 m", "2,1 km", "68 km" (dấu phẩy thập phân kiểu Việt). */
export function formatDistance(m) {
  if (!Number.isFinite(m)) return '';
  if (m < 1000) return `${Math.max(0, Math.round(m / 50) * 50)} m`;
  if (m < 10000) return `${(Math.round(m / 100) / 10).toFixed(1).replace('.', ',')} km`;
  return `${Math.round(m / 1000)} km`;
}

/**
 * @param {'recent'|'near'|'rating'} mode
 * @param {{lat:number,lng:number}|null} origin — vị trí của tôi (cho 'near')
 */
export function sortPlaces(list, mode = 'recent', origin = null) {
  const byRecent = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''));
  const arr = [...(list || [])];
  if (mode === 'near' && hasCoords(origin)) {
    const d = p => (hasCoords(p) ? distanceM(origin, p) : Infinity);
    return arr.sort((a, b) => d(a) - d(b) || byRecent(a, b));
  }
  if (mode === 'rating') {
    const r = p => placeState(p).rating ?? -1;
    return arr.sort((a, b) => r(b) - r(a) || byRecent(a, b));
  }
  return arr.sort(byRecent);
}

/**
 * Gom chốn gần nhau (gợi ý "một tối đi 3 chỗ"). Tham lam: chọn chốn có nhiều hàng xóm trong
 * `radiusM` nhất làm tâm, lấy nó + hàng xóm thành một cụm, bỏ khỏi tập, lặp lại. Mỗi chốn thuộc
 * tối đa một cụm. Cụm nhỏ hơn `minSize` không tính.
 * @returns {{ places: object[], center: {lat,lng}, area: string, spanM: number }[]} cụm lớn trước
 */
export function nearbyClusters(places, { radiusM = 1000, minSize = 3 } = {}) {
  let pool = (places || []).filter(p => !p.archived_at && hasCoords(p));
  const clusters = [];
  for (;;) {
    let best = null;
    for (const seed of pool) {
      const members = pool.filter(p => p === seed || distanceM(seed, p) <= radiusM);
      if (!best || members.length > best.members.length
        || (members.length === best.members.length && String(seed.id) < String(best.seed.id))) {
        best = { seed, members };
      }
    }
    if (!best || best.members.length < minSize) break;
    const ms = best.members;
    const center = {
      lat: ms.reduce((s, p) => s + p.lat, 0) / ms.length,
      lng: ms.reduce((s, p) => s + p.lng, 0) / ms.length,
    };
    const areaCount = countBy(ms, 'area');
    const area = [...areaCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    let spanM = 0;
    for (let i = 0; i < ms.length; i++) {
      for (let j = i + 1; j < ms.length; j++) spanM = Math.max(spanM, distanceM(ms[i], ms[j]));
    }
    clusters.push({ places: ms, center, area, spanM });
    pool = pool.filter(p => !ms.includes(p));
  }
  return clusters;
}

/** Chốn muốn đến khác trong bán kính, gần trước (khối "Gần đây cũng muốn đến"). */
export function nearbyWant(place, places, { radiusM = 1000, limit = 3 } = {}) {
  if (!hasCoords(place)) return [];
  return (places || [])
    .filter(p => p.id !== place.id && !p.archived_at && hasCoords(p) && placeState(p).state === 'want')
    .map(p => ({ place: p, distance: distanceM(place, p) }))
    .filter(x => x.distance <= radiusM)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

/* ── Link ───────────────────────────────────────────────────── */

const num = s => (s == null ? NaN : Number(s));
const validLatLng = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng)
  && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * Đọc toạ độ / tên từ link Google Maps đầy đủ (không gọi mạng).
 * @returns {{lat?:number,lng?:number,name?:string}|{short:true}|null}
 *   short = link rút gọn (maps.app.goo.gl, goo.gl/maps): phải mở link rồi chép link đầy đủ.
 */
export function parseMapsUrl(raw) {
  const href = normalizeHttpUrl(raw);
  if (!href) return null;
  const u = new URL(href);
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && u.pathname.startsWith('/maps'))) return { short: true };
  const isGoogle = /(^|\.)google\.[a-z.]+$/.test(host) && (host.startsWith('maps.') || u.pathname.startsWith('/maps'));
  if (!isGoogle) return null;

  const text = decodeURIComponent(u.href);
  let lat = NaN, lng = NaN;
  const pin = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);   // ghim của địa điểm
  const view = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);      // tâm khung nhìn
  const q = ['q', 'query', 'll', 'destination', 'center']
    .map(k => u.searchParams.get(k)).find(v => v && /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(v));
  if (pin) [lat, lng] = [num(pin[1]), num(pin[2])];
  else if (q) [lat, lng] = q.split(',').map(num);
  else if (view) [lat, lng] = [num(view[1]), num(view[2])];

  const out = {};
  if (validLatLng(lat, lng)) Object.assign(out, { lat, lng });
  const placeName = u.pathname.match(/\/place\/([^/]+)/);
  if (placeName) {
    const name = decodeURIComponent(placeName[1]).replace(/\+/g, ' ').trim();
    if (name && !/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(name)) out.name = name;
  }
  return Object.keys(out).length ? out : null;
}

/** Nền tảng của link nguồn; không phải link hợp lệ → 'other'. */
export function detectPlatform(raw) {
  const href = normalizeHttpUrl(raw);
  if (!href) return 'other';
  const host = new URL(href).hostname.replace(/^(www|m|vt|vm)\./, '');
  if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
  if (/(^|\.)(facebook\.com|fb\.com|fb\.watch)$/.test(host)) return 'facebook';
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return 'youtube';
  if (/(^|\.)threads\.(net|com)$/.test(host)) return 'threads';
  if (host === 'maps.app.goo.gl' || host === 'goo.gl' || parseMapsUrl(href)) return 'google_maps';
  return 'web';
}

/** Link "Chỉ đường": link Maps đã lưu → toạ độ → tìm theo tên + địa chỉ. */
export function directionsUrl(place) {
  if (place.maps_url) return place.maps_url;
  if (hasCoords(place)) return `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
  const q = [place.name, place.address, place.area].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/* ── Gộp trùng ──────────────────────────────────────────────── */

const nameKey = s => normalizeVi(s).replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Chốn đã có trùng tên (bỏ dấu, bỏ ký tự lạ) và cùng khu vực. Một bên chưa ghi khu vực vẫn tính là
 * trùng; hai khu vực khác nhau thì không.
 */
export function findDuplicatePlace(places, { name, area = '' }, excludeId = null) {
  const key = nameKey(name);
  if (!key) return null;
  const a = nameKey(area);
  return (places || []).find(p => p.id !== excludeId && !p.archived_at && nameKey(p.name) === key
    && (!a || !nameKey(p.area) || nameKey(p.area) === a)) || null;
}

/* ── Món ────────────────────────────────────────────────────── */

/** Bỏ trống, bỏ trùng (không phân biệt dấu / hoa thường), giữ thứ tự gặp đầu. */
export function cleanList(list, max = MAX_MUST_TRY, maxLen = 60) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const s = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
    const k = normalizeVi(s);
    if (!s || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Món được nhắc bao nhiêu lần: món nên thử (1) + mỗi lần đến có gọi (1). Nhiều trước.
 * @returns {{ name: string, count: number, liked: boolean }[]}
 */
export function dishMentions(place) {
  const map = new Map();
  const bump = (name, liked = false) => {
    const k = normalizeVi(String(name).trim());
    if (!k) return;
    const cur = map.get(k) || { name: String(name).trim(), count: 0, liked: false };
    cur.count += 1;
    cur.liked = cur.liked || liked;
    map.set(k, cur);
  };
  (place?.must_try || []).forEach(d => bump(d));
  for (const v of place?.place_visits || []) {
    const liked = new Set((v.liked_dishes || []).map(d => normalizeVi(d)));
    (v.dishes || []).forEach(d => bump(d, liked.has(normalizeVi(d))));
  }
  return [...map.values()].sort((a, b) => b.count - a.count || Number(b.liked) - Number(a.liked));
}

/* ── Nhãn ───────────────────────────────────────────────────── */

const RATING_LABELS = { 1: 'Không hợp', 2: 'Tạm', 3: 'Được', 4: 'Ngon, đáng đi', 5: 'Phải quay lại' };
export function ratingLabel(n) {
  return RATING_LABELS[n] || '';
}

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const ymdToUtc = s => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));

/** "T6 22/11" từ 'yyyy-mm-dd'. */
export function shortDay(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(ymd || '')) return '';
  const d = new Date(ymdToUtc(ymd));
  return `${WEEKDAYS[d.getUTCDay()]} ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

/**
 * Viên hẹn trên thẻ từ việc gắn bên Nhiệm vụ.
 * @param {{ due_date?: string|null, completed?: boolean }|null} task
 * @param {string} today 'yyyy-mm-dd'
 * @returns {{ label: string, overdue: boolean }|null}
 */
export function planBadge(task, today) {
  if (!task || task.completed) return null;
  if (!task.due_date) return { label: 'Đã hẹn', overdue: false };
  const diff = Math.round((ymdToUtc(task.due_date) - ymdToUtc(today)) / DAY_MS);
  if (diff < 0) return { label: `Quá hẹn ${-diff} ngày`, overdue: true };
  if (diff === 0) return { label: 'Hẹn hôm nay', overdue: false };
  if (diff === 1) return { label: 'Hẹn mai', overdue: false };
  return { label: `Hẹn ${shortDay(task.due_date)}`, overdue: false };
}

/** "hôm nay", "hôm qua", "5 ngày trước", "3 tuần trước", "2 tháng trước", "1 năm trước". */
export function timeAgo(iso, now = new Date()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const startOf = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const days = Math.round((startOf(now.getTime()) - startOf(t)) / DAY_MS);
  if (days <= 0) return 'hôm nay';
  if (days === 1) return 'hôm qua';
  if (days < 7) return `${days} ngày trước`;
  if (days < 30) return `${Math.floor(days / 7)} tuần trước`;
  if (days < 365) return `${Math.floor(days / 30)} tháng trước`;
  return `${Math.floor(days / 365)} năm trước`;
}

/** "120k", "1,2tr" — giá gọn cho viên. */
export function formatPriceShort(vnd) {
  if (!Number.isFinite(vnd) || vnd <= 0) return '';
  if (vnd < 1000000) return `${Math.round(vnd / 1000)}k`;
  return `${(Math.round(vnd / 100000) / 10).toString().replace('.', ',')}tr`;
}

/* ── Kiểm dữ liệu form ──────────────────────────────────────── */

const trimTo = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Chuẩn hoá form Lưu / Sửa chốn thành dòng `places`.
 * @returns {{ value: object }|{ error: string }}
 */
export function cleanPlace(f = {}) {
  const name = trimTo(f.name, 200);
  if (!name) return { error: 'Ghi tên chốn.' };
  if (name.length > 120) return { error: 'Tên chốn quá dài (tối đa 120 ký tự).' };
  const kind = PLACE_KIND_IDS.includes(f.kind) ? f.kind : 'other';

  const lat = f.lat === '' || f.lat == null ? null : Number(f.lat);
  const lng = f.lng === '' || f.lng == null ? null : Number(f.lng);
  if ((lat == null) !== (lng == null)) return { error: 'Toạ độ thiếu một nửa — ghim lại vị trí.' };
  if (lat != null && !validLatLng(lat, lng)) return { error: 'Toạ độ không hợp lệ.' };

  let maps_url = null;
  if (String(f.maps_url ?? '').trim()) {
    maps_url = normalizeHttpUrl(f.maps_url);
    if (!maps_url) return { error: 'Link Google Maps không hợp lệ.' };
  }

  let price = null;
  if (f.price_per_person !== '' && f.price_per_person != null) {
    price = Math.round(Number(f.price_per_person));
    if (!Number.isFinite(price) || price < 0 || price > 2000000000) return { error: 'Giá không hợp lệ.' };
  }

  const note = String(f.note ?? '').trim();
  if (note.length > 2000) return { error: 'Ghi chú quá dài (tối đa 2000 ký tự).' };

  return {
    value: {
      name,
      kind,
      area: trimTo(f.area, 60),
      address: trimTo(f.address, 240),
      lat,
      lng,
      maps_url,
      price_per_person: price,
      hours_note: trimTo(f.hours_note, 80),
      must_try: cleanList(f.must_try, MAX_MUST_TRY),
      occasions: OCCASION_IDS.filter(o => (f.occasions || []).includes(o)),
      note,
    },
  };
}

/**
 * Chuẩn hoá một lời giới thiệu. Trống hết → `{ value: null }` (không tạo nguồn).
 * @returns {{ value: object|null }|{ error: string }}
 */
export function cleanSource(f = {}) {
  const rawUrl = String(f.url ?? '').trim();
  const url = rawUrl ? normalizeHttpUrl(rawUrl) : '';
  if (rawUrl && !url) return { error: 'Link giới thiệu không hợp lệ.' };
  const author = trimTo(f.author, 80);
  const quote = String(f.quote ?? '').trim().slice(0, 500);
  const collection_id = f.collection_id || null;
  if (!url && !author && !quote && !collection_id) return { value: null };
  const platform = PLATFORM_IDS.includes(f.platform) && f.platform !== 'other'
    ? f.platform
    : (url ? detectPlatform(url) : (author ? 'friend' : 'other'));
  return { value: { platform, url: url || null, author, quote, collection_id } };
}

/**
 * Chuẩn hoá form Thắp đèn thành tham số RPC light_place (trừ phần Tài chính).
 * @returns {{ value: object }|{ error: string }}
 */
export function cleanVisit(f = {}, today) {
  const visited_on = f.visited_on || today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visited_on || '')) return { error: 'Ngày đến không hợp lệ.' };
  if (today && visited_on > today) return { error: 'Ngày đến không được sau hôm nay.' };
  const rating = f.rating == null || f.rating === '' ? null : Number(f.rating);
  if (rating != null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) return { error: 'Điểm từ 1 đến 5 sao.' };
  const revisit = REVISIT_IDS.includes(f.revisit) ? f.revisit : null;
  const dishes = cleanList(f.dishes, MAX_DISHES);
  const likedKeys = new Set((f.liked_dishes || []).map(d => normalizeVi(String(d).trim())));
  const liked_dishes = dishes.filter(d => likedKeys.has(normalizeVi(d)));
  const party = f.party_size == null || f.party_size === '' ? null : Number(f.party_size);
  if (party != null && !(Number.isInteger(party) && party >= 1 && party <= 50)) return { error: 'Số người từ 1 đến 50.' };
  const note = String(f.note ?? '').trim();
  if (note.length > 4000) return { error: 'Cảm nhận quá dài (tối đa 4000 ký tự).' };
  const spent = f.spent == null || f.spent === '' ? null : Math.round(Number(f.spent));
  if (spent != null && !(Number.isFinite(spent) && spent >= 0)) return { error: 'Chi phí không hợp lệ.' };
  const photos = (f.photos || []).filter(Boolean).slice(0, 10);
  return { value: { visited_on, rating, revisit, dishes, liked_dishes, party_size: party, note, photos, spent } };
}
