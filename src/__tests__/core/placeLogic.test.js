/**
 * placeLogic.test.js — Chốn: trạng thái, lọc / tìm không dấu, khoảng cách, cụm, link Maps, nền tảng,
 * gộp trùng, món, nhãn hẹn, kiểm form.
 *
 * Run: node src/__tests__/core/placeLogic.test.js
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PLACE_KIND_IDS, OCCASION_IDS, REVISIT_IDS, PLATFORM_IDS,
  placeState, filterPlaces, areaOptions, distanceM, formatDistance, sortPlaces, nearbyClusters, nearbyWant,
  parseMapsUrl, detectPlatform, directionsUrl, findDuplicatePlace, cleanList, dishMentions, ratingLabel,
  shortDay, planBadge, timeAgo, formatPriceShort, cleanPlace, cleanSource, cleanVisit,
} from '../../utils/placeLogic.js';

const p = (id, name, extra = {}) => ({
  id, name, kind: 'food', area: '', address: '', note: '', hours_note: '', must_try: [], occasions: [],
  lat: null, lng: null, archived_at: null, created_at: '2026-11-01T00:00:00Z', place_sources: [], place_visits: [],
  ...extra,
});
const v = (visited_on, extra = {}) => ({ visited_on, created_at: `${visited_on}T10:00:00Z`, rating: null, dishes: [], liked_dishes: [], ...extra });

// id trong place-kinds.json khớp hằng số (= CHECK của migration)
{
  const data = JSON.parse(readFileSync(new URL('../../data/place-kinds.json', import.meta.url), 'utf8'));
  assert.deepEqual(data.kinds.map(k => k.id), PLACE_KIND_IDS);
  assert.deepEqual(data.occasions.map(k => k.id), OCCASION_IDS);
  assert.deepEqual(data.revisit.map(k => k.id), REVISIT_IDS);
  assert.deepEqual(data.platforms.map(k => k.id), PLATFORM_IDS);
  const cats = JSON.parse(readFileSync(new URL('../../data/finance-categories.json', import.meta.url), 'utf8'));
  const groups = new Set(cats.expenseGroups.map(g => g.key));
  const subs = new Set(cats.expenseGroups.flatMap(g => g.subs.map(s => s.key)));
  for (const k of data.kinds) {
    assert.ok(groups.has(k.finance.category), `nhóm Tài chính của ${k.id} phải tồn tại`);
    if (k.finance.sub) assert.ok(subs.has(k.finance.sub), `danh mục con của ${k.id} phải tồn tại`);
  }
  const mig = readFileSync(new URL('../../../supabase/migrations/20261119000000_places_v6_38_0.sql', import.meta.url), 'utf8');
  for (const id of PLACE_KIND_IDS) assert.ok(mig.includes(`'${id}'`), `migration phải cho loại ${id}`);
}

// placeState
assert.deepEqual(placeState(p(1, 'A')), { state: 'want', lastVisit: null, visitCount: 0, rating: null });
{
  const s = placeState(p(1, 'A', { place_visits: [v('2026-10-01', { rating: 3 }), v('2026-11-02'), v('2026-11-02', { created_at: '2026-11-02T09:00:00Z', rating: 5 })] }));
  assert.equal(s.state, 'visited');
  assert.equal(s.visitCount, 3);
  assert.equal(s.lastVisit.created_at, '2026-11-02T10:00:00Z', 'cùng ngày: ghi sau đứng trước');
  assert.equal(s.rating, 5, 'điểm = lần gần nhất có chấm');
}

// filterPlaces: tab, loại, khu vực, dịp, tìm không dấu, thùng rác
{
  const list = [
    p(1, 'Ốc đêm hẻm 200', { area: 'Quận 4', must_try: ['Ốc hương rang muối'], occasions: ['friends'] }),
    p(2, 'Gác Xép Coffee', { kind: 'cafe', area: 'Quận 1', place_visits: [v('2026-11-10')] }),
    p(3, 'Chè đêm Bà Tư', { area: 'quận 4 ', place_sources: [{ author: '@angi.dau', quote: 'Chè sầu' }] }),
    p(4, 'Bỏ rồi', { archived_at: '2026-11-11T00:00:00Z' }),
  ];
  assert.deepEqual(filterPlaces(list).map(x => x.id), [1, 2, 3], 'thùng rác bị loại');
  assert.deepEqual(filterPlaces(list, { tab: 'want' }).map(x => x.id), [1, 3]);
  assert.deepEqual(filterPlaces(list, { tab: 'visited' }).map(x => x.id), [2]);
  assert.deepEqual(filterPlaces(list, { kind: 'cafe' }).map(x => x.id), [2]);
  assert.deepEqual(filterPlaces(list, { area: 'Quan 4' }).map(x => x.id), [1, 3], 'khu vực không dấu, bỏ khoảng trắng');
  assert.deepEqual(filterPlaces(list, { occasion: 'friends' }).map(x => x.id), [1]);
  assert.deepEqual(filterPlaces(list, { query: 'oc dem' }).map(x => x.id), [1]);
  assert.deepEqual(filterPlaces(list, { query: 'rang muoi' }).map(x => x.id), [1], 'tìm trong món nên thử');
  assert.deepEqual(filterPlaces(list, { query: 'ANGI' }).map(x => x.id), [3], 'tìm theo người giới thiệu');
  assert.deepEqual(filterPlaces(list, { query: 'dem' }).map(x => x.id), [1, 3]);
  assert.deepEqual(areaOptions(list), [{ name: 'Quận 4', count: 2 }, { name: 'Quận 1', count: 1 }],
    'gộp "quận 4" vào "Quận 4", bỏ chốn trong thùng rác và chốn chưa ghi khu vực');
}

// distance / format
{
  const a = { lat: 10.7626, lng: 106.6602 };
  assert.equal(distanceM(a, a), 0);
  const d = distanceM({ lat: 10.0, lng: 106.0 }, { lat: 10.01, lng: 106.0 });
  assert.ok(Math.abs(d - 1112) < 3, `0.01 độ vĩ ≈ 1,11 km (được ${d})`);
  assert.equal(formatDistance(0), '0 m');
  assert.equal(formatDistance(640), '650 m');
  assert.equal(formatDistance(2140), '2,1 km');
  assert.equal(formatDistance(68400), '68 km');
  assert.equal(formatDistance(NaN), '');
}

// sortPlaces
{
  const origin = { lat: 10, lng: 106 };
  const list = [
    p('a', 'Xa', { lat: 10.05, lng: 106, created_at: '2026-11-03T00:00:00Z' }),
    p('b', 'Không toạ độ', { created_at: '2026-11-05T00:00:00Z' }),
    p('c', 'Gần', { lat: 10.001, lng: 106, created_at: '2026-11-01T00:00:00Z', place_visits: [v('2026-11-02', { rating: 4 })] }),
  ];
  assert.deepEqual(sortPlaces(list).map(x => x.id), ['b', 'a', 'c']);
  assert.deepEqual(sortPlaces(list, 'near', origin).map(x => x.id), ['c', 'a', 'b'], 'không toạ độ xếp cuối');
  assert.deepEqual(sortPlaces(list, 'near', null).map(x => x.id), ['b', 'a', 'c'], 'chưa có vị trí → mới lưu');
  assert.deepEqual(sortPlaces(list, 'rating').map(x => x.id), ['c', 'b', 'a']);
}

// nearbyClusters + nearbyWant
{
  const at = (id, lat, lng, extra) => p(id, id, { lat, lng, area: 'Quận 4', ...extra });
  const list = [
    at('a', 10.7570, 106.7000), at('b', 10.7575, 106.7040), at('c', 10.7600, 106.7020),
    at('d', 10.7610, 106.7060),                      // cũng gần → cụm 4
    at('far1', 10.80, 106.65), at('far2', 10.8005, 106.6505),   // cặp 2 chốn: không đủ cụm
    p('nocoord', 'x'),
    at('trash', 10.7571, 106.7001, { archived_at: '2026-11-01T00:00:00Z' }),
  ];
  const cs = nearbyClusters(list);
  assert.equal(cs.length, 1);
  assert.deepEqual(cs[0].places.map(x => x.id).sort(), ['a', 'b', 'c', 'd']);
  assert.equal(cs[0].area, 'Quận 4');
  assert.ok(cs[0].spanM < 1500);
  assert.deepEqual(nearbyClusters(list, { minSize: 2 }).map(c => c.places.length), [4, 2], 'mỗi chốn chỉ thuộc một cụm');
  assert.deepEqual(nearbyClusters([]), []);
  const near = nearbyWant(list[0], [...list, at('seen', 10.7572, 106.7002, { place_visits: [v('2026-11-01')] })]);
  // a→c ≈ 400 m, a→b ≈ 440 m, a→d ≈ 720 m
  assert.deepEqual(near.map(x => x.place.id), ['c', 'b', 'd'], 'bỏ chính nó, chốn đã đến, thùng rác; gần trước, tối đa 3');
  assert.deepEqual(nearbyWant(p('z', 'z'), list), []);
}

// parseMapsUrl
assert.deepEqual(
  parseMapsUrl('https://www.google.com/maps/place/%E1%BB%90c+%C4%91%C3%AAm+h%E1%BA%BBm+200/@10.7577,106.6998,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d10.7581!4d106.7012'),
  { lat: 10.7581, lng: 106.7012, name: 'Ốc đêm hẻm 200' }, 'ghim !3d!4d thắng tâm khung nhìn @');
assert.deepEqual(parseMapsUrl('https://www.google.com/maps/@10.77,106.69,15z'), { lat: 10.77, lng: 106.69 });
assert.deepEqual(parseMapsUrl('https://maps.google.com/?q=10.5,106.25'), { lat: 10.5, lng: 106.25 });
assert.deepEqual(parseMapsUrl('https://www.google.com/maps/search/?api=1&query=-33.86,151.2'), { lat: -33.86, lng: 151.2 });
assert.deepEqual(parseMapsUrl('https://maps.app.goo.gl/AbCd123'), { short: true });
assert.deepEqual(parseMapsUrl('goo.gl/maps/xyz'), { short: true });
assert.equal(parseMapsUrl('https://www.google.com/search?q=10.5,106.2'), null, 'không phải link Maps');
assert.equal(parseMapsUrl('https://www.google.com/maps/@95,200,15z'), null, 'toạ độ ngoài phạm vi');
assert.equal(parseMapsUrl('not a url ::'), null);
assert.equal(parseMapsUrl(''), null);

// detectPlatform
assert.equal(detectPlatform('https://vt.tiktok.com/ZSjq8rK2/'), 'tiktok');
assert.equal(detectPlatform('https://www.tiktok.com/@angi.dau/video/1'), 'tiktok');
assert.equal(detectPlatform('https://fb.watch/abc'), 'facebook');
assert.equal(detectPlatform('https://m.facebook.com/reel/1'), 'facebook');
assert.equal(detectPlatform('youtu.be/xyz'), 'youtube');
assert.equal(detectPlatform('https://www.threads.net/@a/post/1'), 'threads');
assert.equal(detectPlatform('https://instagram.com/p/1'), 'instagram');
assert.equal(detectPlatform('https://maps.app.goo.gl/x'), 'google_maps');
assert.equal(detectPlatform('https://www.google.com/maps/@10.7,106.6,15z'), 'google_maps');
assert.equal(detectPlatform('https://foody.vn/x'), 'web');
assert.equal(detectPlatform('javascript:alert(1)'), 'other');
assert.equal(detectPlatform(''), 'other');

// directionsUrl
assert.equal(directionsUrl(p(1, 'A', { maps_url: 'https://maps.app.goo.gl/x' })), 'https://maps.app.goo.gl/x');
assert.equal(directionsUrl(p(1, 'A', { lat: 10.5, lng: 106.25 })), 'https://www.google.com/maps/dir/?api=1&destination=10.5,106.25');
assert.equal(directionsUrl(p(1, 'Ốc', { area: 'Quận 4' })), `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Ốc, Quận 4')}`);

// findDuplicatePlace
{
  const list = [p(1, 'Ốc đêm hẻm 200', { area: 'Quận 4' }), p(2, 'Bún bò Cô Ba'), p(3, 'Gác Xép', { archived_at: 'x' })];
  assert.equal(findDuplicatePlace(list, { name: '  oc dem  HEM 200!', area: 'quan 4' })?.id, 1);
  assert.equal(findDuplicatePlace(list, { name: 'Ốc đêm hẻm 200' })?.id, 1, 'chưa ghi khu vực vẫn gợi ý');
  assert.equal(findDuplicatePlace(list, { name: 'Ốc đêm hẻm 200', area: 'Quận 7' }), null, 'khác khu vực → không trùng');
  assert.equal(findDuplicatePlace(list, { name: 'Bún bò Cô Ba', area: 'Quận 3' })?.id, 2, 'chốn cũ chưa ghi khu vực');
  assert.equal(findDuplicatePlace(list, { name: 'Gác Xép' }), null, 'thùng rác không tính');
  assert.equal(findDuplicatePlace(list, { name: 'Ốc đêm hẻm 200' }, 1), null, 'bỏ chính nó khi sửa');
  assert.equal(findDuplicatePlace(list, { name: '  ' }), null);
}

// cleanList + dishMentions
assert.deepEqual(cleanList([' Ốc  len ', 'ốc len', '', null, 'Sò điệp']), ['Ốc len', 'Sò điệp']);
assert.equal(cleanList(Array.from({ length: 30 }, (_, i) => `m${i}`)).length, 20);
assert.deepEqual(dishMentions(p(1, 'A', {
  must_try: ['Ốc hương rang muối', 'Sò điệp'],
  place_visits: [v('2026-11-01', { dishes: ['ốc hương rang muối', 'Ốc len xào dừa'], liked_dishes: ['Ốc len xào dừa'] })],
})), [
  { name: 'Ốc hương rang muối', count: 2, liked: false },
  { name: 'Ốc len xào dừa', count: 1, liked: true },
  { name: 'Sò điệp', count: 1, liked: false },
]);
assert.deepEqual(dishMentions(null), []);

// nhãn
assert.equal(ratingLabel(4), 'Ngon, đáng đi');
assert.equal(ratingLabel(null), '');
assert.equal(shortDay('2026-11-27'), 'T6 27/11');
assert.equal(shortDay('2026-11-29'), 'CN 29/11');
assert.equal(shortDay(''), '');
assert.equal(planBadge(null, '2026-11-19'), null);
assert.equal(planBadge({ due_date: '2026-11-18', completed: true }, '2026-11-19'), null, 'việc đã xong thì thôi');
assert.deepEqual(planBadge({ due_date: null }, '2026-11-19'), { label: 'Đã hẹn', overdue: false });
assert.deepEqual(planBadge({ due_date: '2026-11-17' }, '2026-11-19'), { label: 'Quá hẹn 2 ngày', overdue: true });
assert.deepEqual(planBadge({ due_date: '2026-11-19' }, '2026-11-19'), { label: 'Hẹn hôm nay', overdue: false });
assert.deepEqual(planBadge({ due_date: '2026-11-20' }, '2026-11-19'), { label: 'Hẹn mai', overdue: false });
assert.deepEqual(planBadge({ due_date: '2026-11-27' }, '2026-11-19'), { label: 'Hẹn T6 27/11', overdue: false });
{
  const now = new Date(2026, 10, 19, 15, 0);
  assert.equal(timeAgo(new Date(2026, 10, 19, 1, 0).toISOString(), now), 'hôm nay');
  assert.equal(timeAgo(new Date(2026, 10, 18, 23, 0).toISOString(), now), 'hôm qua');
  assert.equal(timeAgo(new Date(2026, 10, 14).toISOString(), now), '5 ngày trước');
  assert.equal(timeAgo(new Date(2026, 9, 29).toISOString(), now), '3 tuần trước');
  assert.equal(timeAgo(new Date(2026, 8, 1).toISOString(), now), '2 tháng trước');
  assert.equal(timeAgo(new Date(2025, 9, 1).toISOString(), now), '1 năm trước');
  assert.equal(timeAgo('xx', now), '');
}
assert.equal(formatPriceShort(120000), '120k');
assert.equal(formatPriceShort(1250000), '1,3tr');
assert.equal(formatPriceShort(0), '');

// cleanPlace
assert.deepEqual(cleanPlace({ name: '  ' }), { error: 'Ghi tên chốn.' });
assert.match(cleanPlace({ name: 'x'.repeat(121) }).error, /quá dài/);
assert.match(cleanPlace({ name: 'A', lat: 10 }).error, /thiếu một nửa/);
assert.match(cleanPlace({ name: 'A', lat: 91, lng: 1 }).error, /không hợp lệ/);
assert.match(cleanPlace({ name: 'A', maps_url: 'javascript:x' }).error, /Google Maps/);
assert.match(cleanPlace({ name: 'A', price_per_person: -1 }).error, /Giá/);
{
  const { value } = cleanPlace({
    name: '  Ốc   đêm ', kind: 'nope', area: ' Quận 4 ', lat: '10.5', lng: '106.2', maps_url: 'maps.google.com/?q=1,2',
    price_per_person: '120000', must_try: ['a', 'A', ' '], occasions: ['solo', 'bogus', 'friends'],
  });
  assert.equal(value.name, 'Ốc đêm');
  assert.equal(value.kind, 'other', 'loại lạ → Khác');
  assert.equal(value.area, 'Quận 4');
  assert.deepEqual([value.lat, value.lng], [10.5, 106.2]);
  assert.equal(value.maps_url, 'https://maps.google.com/?q=1,2');
  assert.equal(value.price_per_person, 120000);
  assert.deepEqual(value.must_try, ['a']);
  assert.deepEqual(value.occasions, ['friends', 'solo'], 'giữ thứ tự chuẩn, bỏ dịp lạ');
  assert.equal(cleanPlace({ name: 'A', lat: '', lng: '' }).value.lat, null);
}

// cleanSource
assert.deepEqual(cleanSource({}), { value: null });
assert.match(cleanSource({ url: 'javascript:x' }).error, /không hợp lệ/);
assert.deepEqual(cleanSource({ url: 'vt.tiktok.com/Z', quote: ' Ngon ' }).value,
  { platform: 'tiktok', url: 'https://vt.tiktok.com/Z', author: '', quote: 'Ngon', collection_id: null });
assert.equal(cleanSource({ author: 'Minh' }).value.platform, 'friend', 'không link, có người kể → Bạn kể');
assert.equal(cleanSource({ url: 'https://foody.vn/x', platform: 'friend' }).value.platform, 'friend', 'user chọn tay thắng');

// cleanVisit
{
  const today = '2026-11-19';
  assert.match(cleanVisit({ visited_on: '2026-11-20' }, today).error, /sau hôm nay/);
  assert.match(cleanVisit({ rating: 6 }, today).error, /1 đến 5/);
  assert.match(cleanVisit({ party_size: 0 }, today).error, /1 đến 50/);
  const { value } = cleanVisit({ rating: '4', revisit: 'yes', dishes: ['Ốc len', 'ốc len', 'Sò'], liked_dishes: ['OC LEN', 'không gọi'], spent: '360000' }, today);
  assert.equal(value.visited_on, today, 'mặc định hôm nay');
  assert.equal(value.rating, 4);
  assert.deepEqual(value.dishes, ['Ốc len', 'Sò']);
  assert.deepEqual(value.liked_dishes, ['Ốc len'], 'món ngon phải nằm trong món đã gọi');
  assert.equal(value.spent, 360000);
  assert.equal(cleanVisit({ revisit: 'x' }, today).value.revisit, null);
}

console.log('Place logic check: OK');
