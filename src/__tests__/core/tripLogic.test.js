/**
 * tripLogic.test.js — Chuyến đi (Chốn G2): ngày, đếm ngược, lựa chọn, ước tính, chốn theo ngày, chuẩn bị,
 * gợi ý lần trước, dán báo giá, kiểm form.
 *
 * Run: node src/__tests__/core/tripLogic.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRIP_STATUS, tripDayCount, dayDate, formatTripRange, countdown, sortOptions, optionLetter, pickedOption,
  nextSortOrder, tripEstimate, groupTripPlaces, prepProgress, addPrepItem, prepDueDate, pastTripHint, parseQuote,
  cleanTrip, cleanOption,
} from '../../utils/tripLogic.js';

const trip = (extra = {}) => ({
  id: 't1', title: 'Hà Giang loop', region: 'Hà Giang', start_date: '2026-11-27', end_date: '2026-11-30', people: 2,
  status: 'planning', extra_costs: [], trip_options: [], trip_places: [], archived_at: null, ...extra,
});
const opt = (id, extra = {}) => ({ id, name: id, sort_order: 0, created_at: '2026-11-01T00:00:00Z', pick: null, price_per_person: null, ...extra });

// Trạng thái khớp CHECK của migration
{
  const mig = readFileSync(new URL('../../../supabase/migrations/20261119010000_trips_v6_39_0.sql', import.meta.url), 'utf8');
  for (const s of TRIP_STATUS) assert.ok(mig.includes(`'${s}'`), `migration phải cho trạng thái ${s}`);
}

// Ngày
assert.equal(tripDayCount(trip()), 4);
assert.equal(tripDayCount(trip({ end_date: '2026-11-27' })), 1);
assert.equal(tripDayCount(trip({ end_date: null })), null);
assert.equal(dayDate(trip(), 1), '2026-11-27');
assert.equal(dayDate(trip(), 4), '2026-11-30');
assert.equal(dayDate(trip({ start_date: '2026-12-31' }), 2), '2027-01-01', 'qua năm');
assert.equal(dayDate(trip({ start_date: null }), 1), null);
assert.equal(formatTripRange(trip()), 'T6 27/11 → T2 30/11 · 4 ngày 3 đêm');
assert.equal(formatTripRange(trip({ end_date: '2026-11-27' })), 'T6 27/11 → T6 27/11 · đi trong ngày');
assert.equal(formatTripRange(trip({ end_date: null })), 'T6 27/11');
assert.equal(formatTripRange(trip({ start_date: null, end_date: null })), 'Chưa chọn ngày');
assert.equal(countdown(trip(), '2026-11-19'), 'còn 8 ngày');
assert.equal(countdown(trip(), '2026-11-26'), 'mai đi');
assert.equal(countdown(trip(), '2026-11-27'), 'hôm nay đi');
assert.equal(countdown(trip(), '2026-11-29'), 'đang đi');
assert.equal(countdown(trip(), '2026-12-01'), null, 'đã về');
assert.equal(countdown(trip({ start_date: null }), '2026-11-19'), null);

// Lựa chọn
{
  const opts = [opt('c', { sort_order: 2 }), opt('a', { sort_order: 1, created_at: '2026-11-02T00:00:00Z' }), opt('b', { sort_order: 1, created_at: '2026-11-03T00:00:00Z' })];
  assert.deepEqual(sortOptions(opts).map(o => o.id), ['a', 'b', 'c']);
  assert.deepEqual([0, 1, 2].map(optionLetter), ['A', 'B', 'C']);
  assert.equal(nextSortOrder(opts), 3);
  assert.equal(nextSortOrder([]), 1);
  assert.equal(pickedOption(trip({ trip_options: opts })), null);
  assert.equal(pickedOption(trip({ trip_options: [opt('x', { pick: 'leaning' }), opt('y')] })).id, 'x');
  assert.equal(pickedOption(trip({ trip_options: [opt('x', { pick: 'leaning' }), opt('y', { pick: 'chosen' })] })).id, 'y', 'đã chốt thắng nghiêng về');
}

// Ước tính
{
  const t = trip({
    trip_options: [opt('B', { name: 'Tự lái theo đoàn', pick: 'leaning', price_per_person: 2450000 })],
    extra_costs: [{ label: 'Máy bay SG ⇄ Hà Nội', amount: 3600000 }, { label: 'Xe khách, xăng', amount: 1600000 }, { label: '', amount: 5 }, { label: 'Âm', amount: -1 }],
  });
  const e = tripEstimate(t);
  assert.deepEqual(e.lines.map(l => l.amount), [4900000, 3600000, 1600000]);
  assert.equal(e.lines[0].label, 'Tự lái theo đoàn × 2');
  assert.equal(e.total, 10100000, 'đúng con số của mockup 2E');
  assert.equal(e.hasUnknown, false);
  const noPrice = tripEstimate(trip({ trip_options: [opt('C', { pick: 'leaning' })] }));
  assert.deepEqual(noPrice, { lines: [], total: 0, hasUnknown: true });
  assert.deepEqual(tripEstimate(trip()), { lines: [], total: 0, hasUnknown: false }, 'chưa chọn gì');
}

// Chốn theo ngày
{
  const places = new Map([['p1', { id: 'p1' }], ['p2', { id: 'p2' }], ['p3', { id: 'p3' }], ['p4', { id: 'p4' }]]);
  const t = trip({ trip_places: [
    { place_id: 'p2', day_index: 1, sort_order: 2 },
    { place_id: 'p1', day_index: 1, sort_order: 1 },
    { place_id: 'p3', day_index: null, sort_order: 0 },
    { place_id: 'p4', day_index: 9, sort_order: 0 },   // ngoài số ngày (chuyến bị rút ngắn) → chưa xếp
    { place_id: 'gone', day_index: 2, sort_order: 0 }, // chốn đã xoá
  ] });
  const g = groupTripPlaces(t, places);
  assert.equal(g.days.length, 4, 'đủ 4 ngày kể cả ngày trống');
  assert.deepEqual(g.days[0], { day: 1, date: '2026-11-27', places: [{ id: 'p1' }, { id: 'p2' }] });
  assert.deepEqual(g.days[1].places, []);
  assert.deepEqual(g.unscheduled.map(p => p.id), ['p3', 'p4']);
  const noDates = groupTripPlaces(trip({ start_date: null, end_date: null, trip_places: [{ place_id: 'p1', day_index: 3 }] }), places);
  assert.deepEqual(noDates.days, [{ day: 3, date: null, places: [{ id: 'p1' }] }], 'chưa có ngày: chỉ các ngày có chốn');
}

// Chuẩn bị
{
  let n = 0;
  const id = () => `i${++n}`;
  let items = addPrepItem([], '  Áo ấm,  áo mưa ', id);
  items = addPrepItem(items, 'ao am, ao mua', id);
  items = addPrepItem(items, '   ', id);
  items = addPrepItem(items, 'Bằng lái A1', id);
  assert.deepEqual(items, [{ id: 'i1', text: 'Áo ấm, áo mưa', done: false }, { id: 'i2', text: 'Bằng lái A1', done: false }]);
  assert.deepEqual(prepProgress([{ done: true }, { done: false }]), { done: 1, total: 2 });
  assert.deepEqual(prepProgress(null), { done: 0, total: 0 });
  assert.equal(prepDueDate(trip(), '2026-11-19'), '2026-11-26', 'trước ngày đi một ngày');
  assert.equal(prepDueDate(trip(), '2026-11-27'), '2026-11-27', 'không lùi về quá khứ');
  assert.equal(prepDueDate(trip({ start_date: null }), '2026-11-19'), null);
}

// Gợi ý lần trước
{
  const mocChau = trip({ id: 'm', title: 'Mộc Châu', region: 'Mộc Châu', status: 'done', end_date: '2026-03-10', start_date: '2026-03-08',
    trip_options: [opt('tt', { name: 'Tự túc', pick: 'chosen', rating: 3 })], review: 'lần sau đi tour cho đỡ mệt' });
  const hgOld = trip({ id: 'h', title: 'Hà Giang 2024', status: 'done', start_date: '2024-10-01', end_date: '2024-10-04', rating: 4 });
  const planning = trip({ id: 'p', status: 'planning', rating: 5 });
  const noRating = trip({ id: 'x', status: 'done', region: 'Sapa', end_date: '2026-10-01' });
  assert.equal(pastTripHint([mocChau, hgOld, planning, noRating], trip()).trip.id, 'h', 'cùng vùng thắng mới hơn');
  const h = pastTripHint([mocChau, planning, noRating], trip());
  assert.equal(h.trip.id, 'm');
  assert.equal(h.option.name, 'Tự túc');
  assert.equal(h.rating, 3, 'điểm của lựa chọn đã chốt');
  assert.equal(pastTripHint([planning], trip()), null);
  assert.equal(pastTripHint([trip({ status: 'done', rating: 5 })], trip()), null, 'bỏ chính nó');
}

// Dán báo giá
{
  const q = parseQuote([
    'Tour Hà Giang 4N3Đ - Easy rider',
    'Giá: 3.200.000đ/khách, trọn gói',
    'Giá tour bao gồm:',
    '- Xe máy + người lái',
    '• 6 bữa ăn',
    '✓ Vé tham quan',
    'Không bao gồm:',
    '- Xe khách Hà Nội ⇄ Hà Giang',
    '- Chi phí cá nhân',
  ].join('\n'));
  assert.equal(q.price, 3200000);
  assert.deepEqual(q.includes, ['Xe máy + người lái', '6 bữa ăn', 'Vé tham quan']);
  assert.deepEqual(q.excludes, ['Xe khách Hà Nội ⇄ Hà Giang', 'Chi phí cá nhân']);
  assert.deepEqual(parseQuote('Giá 2tr450 không gồm xăng'), { price: 2000000, includes: [], excludes: [] },
    'chỉ lấy phần số + đơn vị đầu; dòng không phải tiêu đề mục thì không đổi mục');
  assert.deepEqual(parseQuote('Chưa gồm: bảo hiểm, sửa xe\nGồm: thuê xe 250k/ngày').excludes, ['bảo hiểm', 'sửa xe']);
  assert.deepEqual(parseQuote('Chưa gồm: bảo hiểm, sửa xe\nGồm: thuê xe 250k/ngày').includes, ['thuê xe 250k/ngày']);
  assert.equal(parseQuote('Chưa gồm: bảo hiểm\nGồm: thuê xe 250k/ngày').price, 250000);
  assert.deepEqual(parseQuote(''), { price: null, includes: [], excludes: [] });
  assert.deepEqual(parseQuote('- dòng lẻ không có mục').includes, [], 'gạch đầu dòng trước tiêu đề mục: bỏ');
}

// cleanTrip
assert.deepEqual(cleanTrip({ title: ' ' }), { error: 'Ghi tên chuyến đi.' });
assert.match(cleanTrip({ title: 'A', start_date: '2026-11-27', end_date: '2026-11-26' }).error, /Ngày về/);
assert.match(cleanTrip({ title: 'A', people: 0 }).error, /1 đến 50/);
{
  const { value } = cleanTrip({ title: ' Hà Giang  loop ', people: '2', start_date: '2026-11-27', end_date: '',
    extra_costs: [{ label: ' Máy bay ', amount: '3600000' }, { label: '', amount: 1 }, { label: 'x', amount: 0 }] });
  assert.equal(value.title, 'Hà Giang loop');
  assert.equal(value.people, 2);
  assert.equal(value.end_date, null);
  assert.deepEqual(value.extra_costs, [{ label: 'Máy bay', amount: 3600000 }]);
  assert.equal(cleanTrip({ title: 'A' }).value.people, 1);
}

// cleanOption
assert.match(cleanOption({}).error, /Ghi tên/);
assert.match(cleanOption({ name: 'A', source_url: 'javascript:1' }).error, /Link/);
{
  const { value } = cleanOption({ name: ' Easy rider ', price_per_person: '3.2tr', includes: ['Vé', 'vé', ''], source_url: 'zalo.me/x' });
  assert.equal(value.name, 'Easy rider');
  assert.equal(value.price_per_person, 3200000);
  assert.deepEqual(value.includes, ['Vé']);
  assert.equal(value.source_url, 'https://zalo.me/x');
  assert.equal(cleanOption({ name: 'A', price_per_person: '' }).value.price_per_person, null);
  assert.equal(cleanOption({ name: 'A', price_per_person: 0 }).value.price_per_person, null, '0 = chưa biết giá');
}

console.log('Trip logic check: OK');
