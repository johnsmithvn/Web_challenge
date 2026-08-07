/**
 * Self-check cho src/utils/vaultLogic.js — Account Vault v2.
 * Chạy: node src/__tests__/vaultLogic.test.js  (đã nối vào `npm test`)
 *
 * Không framework, chỉ node:assert — cùng style dateUtils.test.js.
 * Chỉ test hàm THUẦN. Phần gọi Supabase (useAccounts) test tay theo quy ước
 * hiện có của repo.
 */

import assert from 'node:assert/strict';
import {
  TYPES, isSecretType, maskValue, scorePassword, parseCodes, codeSheet,
  linkableValues, matchesQuery, itemSubtitle, diffLog, formatStamp, relativeUpdated,
  normalizeUrl, urlHost, itemUrl, faviconCandidates, avatarHue, avatarLetter,
} from '../utils/vaultLogic.js';

/* ── TYPES phải khớp CHECK constraint trong migration ──────────────────── */
// Gõ lệch danh sách này với data/migration_v5.2.0_vault.sql là insert fail
// lúc runtime, không phải lúc build — nên khoá cứng ở đây.
assert.deepEqual(
  TYPES.map(t => t.value),
  ['text', 'password', 'secret', 'url', 'email', 'phone', 'multi', 'link', 'number', 'date']
);

/* ── isSecretType ─────────────────────────────────────────────────────── */
assert.equal(isSecretType('password'), true);
assert.equal(isSecretType('secret'), true);
assert.equal(isSecretType('text'), false);
assert.equal(isSecretType('multi'), false);
// `number` cũng không phải secret dù người ta hay để số thẻ ở đó
assert.equal(isSecretType('number'), false);

/* ── maskValue ────────────────────────────────────────────────────────── */
assert.equal(maskValue('abcde'), '•••••');
assert.equal(maskValue(''), '(empty)');
assert.equal(maskValue(null), '(empty)');
assert.equal(maskValue(undefined), '(empty)');
// Trần 24 ký tự: mật khẩu 40 ký tự không được để lộ ĐỘ DÀI thật qua số bullet
assert.equal(maskValue('a'.repeat(40)).length, 24);
assert.equal(maskValue('a'.repeat(24)), maskValue('a'.repeat(99)));

/* ── scorePassword ────────────────────────────────────────────────────── */
assert.deepEqual(scorePassword(''), { pct: 0, label: 'empty', color: 'var(--color-neutral-400)' });
// Sàn 8: 3 ký tự → 7.8 điểm nhưng thanh không bao giờ mỏng hơn 8%
assert.equal(scorePassword('abc').pct, 8);
assert.equal(scorePassword('abc').label, 'weak');
// Biên weak/fair đúng ở 45 (45 KHÔNG còn là weak)
const fair = scorePassword('Abcdefghij1'); // 11*2.6=28.6 +8 (hoa) +8 (số) = 44.6 → 45
assert.equal(fair.pct, 45);
assert.equal(fair.label, 'fair');
// Trần độ dài 24: dài hơn nữa không cộng thêm điểm
assert.equal(scorePassword('a'.repeat(24)).pct, scorePassword('a'.repeat(60)).pct);
// Đủ 3 lớp ký tự
assert.equal(scorePassword('Kh4i-Ph0ng!2026#mesh').label, 'strong');   // 20 ký tự → 82
assert.equal(scorePassword('Abcdefghijklmnopqrstuv1!').label, 'excellent'); // 24 ký tự → 92
// Trần thật của công thức là 92, KHÔNG phải 100: 24*2.6 + 8 + 8 + 14 = 92.4.
// Nghĩa là thanh strength không bao giờ đầy 100% — đúng như prototype, giữ
// nguyên. Nhánh clamp 100 là chốt an toàn, không phải mức đạt được.
assert.equal(scorePassword('A1!'.repeat(30)).pct, 92);
assert.equal(scorePassword('A1!'.repeat(30)).label, 'excellent');

/* ── parseCodes ───────────────────────────────────────────────────────── */
const codes = (raw) => parseCodes(raw).map(c => c.code);

// Mỗi mã một dòng
assert.deepEqual(codes('abcd\nefgh\nijkl'), ['abcd', 'efgh', 'ijkl']);
// Phẩy và chấm phẩy cũng là dấu tách
assert.deepEqual(codes('abcd,efgh;ijkl'), ['abcd', 'efgh', 'ijkl']);
// Gỡ số thứ tự và gạch đầu dòng
assert.deepEqual(
  codes('1. abcd\n2) efgh\n- ijkl\n* mnop\n• qrst'),
  ['abcd', 'efgh', 'ijkl', 'mnop', 'qrst']
);
// Token không đủ 4 ký tự chữ-số bị bỏ, không thành mã rỗng
assert.deepEqual(codes('abcd\n\nxy\n---\nefgh'), ['abcd', 'efgh']);
// ⚠️ Ca quan trọng nhất: Google phát `1234 5678` — MỘT mã, không phải hai.
assert.deepEqual(codes('1234 5678\n9012 3456'), ['1234 5678', '9012 3456']);
// Đúng 2 ứng viên trên một dòng thì VẪN là một mã (chính là ca Google ở trên
// khi user chỉ dán được 1 dòng)
assert.deepEqual(codes('1234 5678'), ['1234 5678']);
// Hơn 2 ứng viên trên một dòng duy nhất → người dán cả hàng ngang, mới tách
assert.deepEqual(codes('abcd efgh ijkl mnop'), ['abcd', 'efgh', 'ijkl', 'mnop']);
// Mã nhập vào luôn ở trạng thái chưa dùng
assert.equal(parseCodes('abcd\nefgh').every(c => c.used === false), true);
assert.deepEqual(codes(''), []);
assert.deepEqual(codes('   \n  '), []);

/* ── codeSheet ────────────────────────────────────────────────────────── */
const sheet = codeSheet(10);
assert.equal(sheet.length, 10);
assert.equal(sheet.every(c => /^[0-9a-f]{4}-[0-9a-f]{4}$/.test(c.code)), true);
assert.equal(sheet.every(c => c.used === false), true);
// id phải khác nhau, không thì React key trùng và đánh dấu "đã dùng" sai ô
assert.equal(new Set(sheet.map(c => c.id)).size, 10);

/* ── linkableValues ───────────────────────────────────────────────────── */
const target = {
  id: 'i1',
  fields: [
    { id: 'f1', label: 'Username', type: 'text', value: 'tao' },
    { id: 'f2', label: 'Password', type: 'password', value: 'hunter2-not-in-list' },
    { id: 'f3', label: 'PIN', type: 'secret', value: '4471' },
    { id: 'f4', label: 'Emails', type: 'multi', values: ['a@x.com', '', 'b@y.com'] },
    { id: 'f5', label: 'Website', type: 'url', value: 'x.com' },
    { id: 'f6', label: 'Port', type: 'number', value: '5432' },
    { id: 'f7', label: 'Opened', type: 'date', value: '2026-01-01' },
    { id: 'f8', label: 'Blank', type: 'text', value: '' },
  ],
};
const opts = linkableValues(target);
assert.deepEqual(opts[0], { value: '', label: '— whole item —' });
assert.deepEqual(opts.slice(1).map(o => o.label), [
  'Username: tao',
  'Emails: a@x.com',
  'Emails: b@y.com',
  'Website: x.com',
]);
// ⚠️ Bất biến: secret KHÔNG BAO GIỜ được chào làm giá trị link (link chip hiện
//    giá trị ra ở chế độ xem, không có bước reveal nào).
const optBlob = JSON.stringify(opts);
assert.equal(optBlob.includes('hunter2-not-in-list'), false);
assert.equal(optBlob.includes('4471'), false);
// number/date bị loại vì mượn ra ngoài không nói lên gì; giá trị rỗng cũng vậy
assert.equal(optBlob.includes('5432'), false);
assert.equal(optBlob.includes('Blank'), false);
assert.deepEqual(linkableValues(null), [{ value: '', label: '— whole item —' }]);

/* ── matchesQuery ─────────────────────────────────────────────────────── */
const item = {
  id: 'i2', tpl: 'login', title: 'Figma', notes: 'Team seat billed annually',
  tags: ['work', 'design'],
  fields: [
    { id: 'f1', label: 'Username', type: 'text', value: 'tao@studio.vn' },
    { id: 'f2', label: 'Password', type: 'password', value: 'r1dge-Pl4te-8821' },
    { id: 'f3', label: 'Emails', type: 'multi', values: ['alt@studio.vn'] },
  ],
};
assert.equal(matchesQuery(item, ''), true);        // rỗng = không lọc
assert.equal(matchesQuery(item, 'figma'), true);   // tiêu đề, không phân biệt hoa thường
assert.equal(matchesQuery(item, 'design'), true);  // tag
assert.equal(matchesQuery(item, 'annually'), true);// ghi chú
assert.equal(matchesQuery(item, 'username'), true);// nhãn field
assert.equal(matchesQuery(item, 'tao@studio'), true);  // giá trị field
assert.equal(matchesQuery(item, 'alt@studio'), true);  // giá trị trong multi
assert.equal(matchesQuery(item, 'notion'), false);
// ⚠️ Bất biến: giá trị secret bị loại khỏi vùng tìm. Gõ đúng mật khẩu vào ô
//    search rồi thấy item hiện ra là một đường xác nhận mật khẩu không cần reveal.
assert.equal(matchesQuery(item, 'r1dge-Pl4te-8821'), false);
assert.equal(matchesQuery(item, '8821'), false);
// Nhãn của field secret thì vẫn tìm được — nhãn không phải secret
assert.equal(matchesQuery(item, 'password'), true);
// tag đến từ hook là object {id,name,color}, đến từ test/seed là chuỗi — nhận cả hai
assert.equal(matchesQuery({ ...item, tags: [{ id: 't1', name: 'design', color: '#fff' }] }, 'design'), true);
assert.equal(matchesQuery({ ...item, tags: [{ id: 't1', name: 'design', color: '#fff' }] }, 'object'), false);

/* ── normalizeUrl / urlHost ───────────────────────────────────────────── */
assert.equal(normalizeUrl('google.com'), 'https://google.com/');
assert.equal(normalizeUrl('  shopee.vn  '), 'https://shopee.vn/');
assert.equal(normalizeUrl('http://x.com/a?b=1'), 'http://x.com/a?b=1');
assert.equal(normalizeUrl('HTTPS://X.COM'), 'https://x.com/');
assert.equal(normalizeUrl(''), null);
assert.equal(normalizeUrl(null), null);
// "abc" không có dấu chấm → không phải domain
assert.equal(normalizeUrl('abc'), null);
// ⚠️ Bất biến: chuỗi này đi thẳng vào href VÀ dùng để dựng origin favicon, nên
//    mọi scheme không phải http(s) phải bị chặn ở đây, không phải ở component.
assert.equal(normalizeUrl('javascript:alert(1)'), null);
assert.equal(normalizeUrl('JavaScript:alert(1)'), null);
assert.equal(normalizeUrl('data:text/html,<script>x</script>'), null);
assert.equal(normalizeUrl('file:///etc/passwd'), null);
assert.equal(normalizeUrl('vbscript:msgbox'), null);

assert.equal(urlHost('https://www.google.com/x'), 'google.com');
assert.equal(urlHost('shopee.vn'), 'shopee.vn');
assert.equal(urlHost('javascript:alert(1)'), '');
assert.equal(urlHost(''), '');

/* ── itemUrl / faviconCandidates ──────────────────────────────────────── */
// Lấy field type='url' ĐẦU TIÊN có giá trị, bỏ qua field rỗng
assert.equal(itemUrl({
  fields: [
    { type: 'text', value: 'not-a-url.com' },
    { type: 'url', value: '   ' },
    { type: 'url', value: 'figma.com' },
    { type: 'url', value: 'later.com' },
  ],
}), 'https://figma.com/');
assert.equal(itemUrl({ fields: [{ type: 'text', value: 'x.com' }] }), null);
assert.equal(itemUrl({ fields: [] }), null);
assert.equal(itemUrl(null), null);

assert.deepEqual(faviconCandidates('figma.com'), [
  'https://figma.com/apple-touch-icon.png',
  'https://figma.com/favicon.ico',
]);
// Origin bỏ path/query — favicon nằm ở gốc site, không nằm cạnh trang con
assert.deepEqual(faviconCandidates('https://www.bank.com/login?a=1'), [
  'https://www.bank.com/apple-touch-icon.png',
  'https://www.bank.com/favicon.ico',
]);
assert.deepEqual(faviconCandidates('javascript:alert(1)'), []);
assert.deepEqual(faviconCandidates(''), []);

/* ── avatarHue / avatarLetter ─────────────────────────────────────────── */
// Ổn định: cùng tên luôn ra cùng hue ở mọi máy, mọi lần chạy
assert.equal(avatarHue('Google'), avatarHue('Google'));
assert.equal(typeof avatarHue('Google'), 'number');
assert.ok(avatarHue('Techcombank') >= 0 && avatarHue('Techcombank') < 360);
assert.notEqual(avatarHue('Google'), avatarHue('Figma'));
assert.equal(avatarHue(''), 0);

assert.equal(avatarLetter('Figma'), 'F');
assert.equal(avatarLetter('  google'), 'G');
// Bỏ ký tự không phải chữ/số ở đầu
assert.equal(avatarLetter('@acme'), 'A');
assert.equal(avatarLetter('1Password'), '1');
// Có dấu tiếng Việt vẫn ra chữ, không ra '?'
assert.equal(avatarLetter('Điện lực'), 'Đ');
assert.equal(avatarLetter(''), '?');
assert.equal(avatarLetter('—'), '?');

/* ── formatStamp / relativeUpdated ────────────────────────────────────── */
// Dựng bằng constructor local (không parse chuỗi ISO) để test không phụ thuộc
// múi giờ của máy chạy CI.
assert.equal(formatStamp(new Date(2026, 7, 4, 9, 12)), '04 Aug 2026 · 09:12');
assert.equal(formatStamp(new Date(2026, 11, 31, 23, 5)), '31 Dec 2026 · 23:05');
assert.equal(formatStamp('không phải ngày'), '');

const NOW = new Date(2026, 7, 5, 22, 0);
assert.equal(relativeUpdated(new Date(2026, 7, 5, 21, 59, 30), NOW), 'just now');
assert.equal(relativeUpdated(new Date(2026, 7, 5, 8, 0), NOW), 'today');
// Mốc quan trọng: 23:50 hôm qua cách 22:00 hôm nay 22 tiếng — vẫn phải là
// 'yesterday', không phải 'today'. So theo mốc NGÀY, không theo số giờ.
assert.equal(relativeUpdated(new Date(2026, 7, 4, 23, 50), NOW), 'yesterday');
assert.equal(relativeUpdated(new Date(2026, 7, 2, 10, 0), NOW), '3 days ago');
assert.equal(relativeUpdated(new Date(2026, 6, 1, 10, 0), NOW), '01 Jul 2026 · 10:00');
assert.equal(relativeUpdated('không phải ngày', NOW), '');

/* ── itemSubtitle ─────────────────────────────────────────────────────── */
assert.equal(itemSubtitle(item, 'Website login'), 'tao@studio.vn'); // Username
// Ưu tiên theo thứ tự nhãn: Primary email trước Username
assert.equal(itemSubtitle({
  tpl: 'account',
  fields: [
    { label: 'Username', type: 'text', value: 'u' },
    { label: 'Primary email', type: 'multi', values: ['p@x.com'] },
  ],
}, 'fb'), 'p@x.com');
// Thẻ: 4 số cuối đã mask, bỏ khoảng trắng người ta gõ giữa các nhóm
assert.equal(itemSubtitle({
  tpl: 'card',
  fields: [{ label: 'Card number', type: 'password', value: '4024 0071 8823 3316' }],
}, 'Credit card'), '•••• 3316');
// Thẻ chưa có số → rơi về tên template, KHÔNG hiện '•••• '
assert.equal(itemSubtitle({ tpl: 'card', fields: [] }, 'Credit card'), 'Credit card');
// Không có nhãn nào khớp → tên template
assert.equal(itemSubtitle({ tpl: 'note', fields: [] }, 'Secure note'), 'Secure note');

/* ── diffLog — hành vi cốt lõi ────────────────────────────────────────── */
const PASS_BEFORE = 'abcdefgh';            // 8 ký tự
const PASS_AFTER = 'zzzzzzzzzzzz';         // 12 ký tự
const PIN_NEW = '4471';

const before = {
  title: 'Figma',
  notes: 'old note',
  fields: [
    { id: 'f1', label: 'Website', type: 'url', value: 'figma.com' },
    { id: 'f2', label: 'Password', type: 'password', value: PASS_BEFORE },
    { id: 'f3', label: 'Emails', type: 'multi', values: ['a@x.com'] },
    { id: 'f4', label: 'Recovery email', type: 'link', value: '', links: [{ id: 'L1', itemId: 'i9', value: 'a@x.com' }] },
    { id: 'f5', label: 'Old field', type: 'text', value: 'gone' },
  ],
  auth: [
    { id: 'a1', kind: 'password', note: 'n1', state: 'primary' },
    { id: 'a2', kind: 'oauth', note: 'n2', state: 'on' },
    { id: 'a3', kind: 'sms', note: 'n3', state: 'on' },
  ],
  codes: [{ id: 'c1', code: 'aaaa-bbbb', used: false }],
};

const after = {
  title: 'Figma Team',
  notes: 'new note',
  fields: [
    { id: 'f1', label: 'Site', type: 'url', value: 'figma.com' },              // chỉ đổi tên
    { id: 'f2', label: 'Password', type: 'password', value: PASS_AFTER },      // secret đổi
    { id: 'f3', label: 'Emails', type: 'multi', values: ['a@x.com', 'b@y.com'] },
    { id: 'f4', label: 'Recovery email', type: 'link', value: '', links: [] }, // bỏ hết link
    { id: 'f6', label: 'PIN', type: 'secret', value: PIN_NEW },                // field mới
  ],
  auth: [
    { id: 'a1', kind: 'password', note: 'n1', state: 'on' },       // primary → on
    { id: 'a2', kind: 'oauth', note: 'n2b', state: 'on' },         // chỉ đổi ghi chú
    { id: 'a4', kind: 'passkey', note: 'n4', state: 'primary' },   // thêm mới
  ],
  codes: [
    { id: 'c9', code: 'cccc-dddd', used: false },
    { id: 'c10', code: 'eeee-ffff', used: false },
  ],
};

const ctx = {
  itemTitles: { i9: 'Google — personal' },
  authLabels: { password: 'Password', oauth: 'Sign in with…', sms: 'SMS code', passkey: 'Passkey' },
};

const log = diffLog(before, after, ctx);

// Thứ tự phát ra là thứ tự đọc, khoá cứng cả danh sách chứ không chỉ đếm số dòng.
assert.deepEqual(log, [
  { text: 'Title changed', detail: 'Figma → Figma Team' },
  { text: 'Notes edited', detail: '' },
  { text: 'Field renamed', detail: 'Website → Site' },
  { text: 'Password changed', detail: '•••••••• → ••••••••••••' },
  { text: 'Emails updated', detail: 'a@x.com → a@x.com, b@y.com' },
  { text: 'Recovery email links changed', detail: 'Google — personal · a@x.com → (none)' },
  { text: 'Field added', detail: 'PIN · secret' },
  { text: 'Field removed', detail: 'Old field' },
  { text: 'Password enabled', detail: 'n1' },
  { text: 'Sign in with… detail edited', detail: 'n2 → n2b' },
  { text: 'Passkey added', detail: 'n4' },
  { text: 'SMS code removed', detail: '' },
  { text: 'Single-use codes regenerated', detail: '2 fresh codes' },
]);

// ⚠️ BẤT BIẾN QUAN TRỌNG NHẤT CỦA MODULE: không một giá trị secret thật nào
//    được ghi vào log. Test cả cụm log ở dạng chuỗi, không chỉ dòng password —
//    một field secret MỚI THÊM cũng không được để lộ giá trị.
const logBlob = JSON.stringify(log);
for (const leak of [PASS_BEFORE, PASS_AFTER, PIN_NEW]) {
  assert.equal(logBlob.includes(leak), false, `log để lộ secret: ${leak}`);
}
// Số bullet phản ánh độ dài thật (tới trần 24) — đó là chủ ý, để đọc log thấy
// được "mật khẩu đã dài ra", nhưng không đọc được nó là gì.
assert.equal(log[3].detail, `${'•'.repeat(8)} → ${'•'.repeat(12)}`);

// Không đổi gì → không có dòng log nào. Lưu mà không sửa không được ghi lịch sử.
assert.deepEqual(diffLog(before, JSON.parse(JSON.stringify(before)), ctx), []);

// Field ghép đôi theo id chứ không theo vị trí: đổi chỗ 2 field không sinh log.
const swapped = JSON.parse(JSON.stringify(before));
swapped.fields = [swapped.fields[1], swapped.fields[0], ...swapped.fields.slice(2)];
assert.deepEqual(diffLog(before, swapped, ctx), []);

// Đổi loại field thì log riêng một dòng, dùng nhãn MỚI
const retyped = JSON.parse(JSON.stringify(before));
retyped.fields[1].type = 'secret';
assert.deepEqual(diffLog(before, retyped, ctx), [
  { text: 'Password type changed', detail: 'password → secret' },
]);

// Giá trị rỗng in ra '(empty)', không in chuỗi trống gây log vô nghĩa
const emptied = JSON.parse(JSON.stringify(before));
emptied.fields[0].value = '';
assert.deepEqual(diffLog(before, emptied, ctx), [
  { text: 'Website updated', detail: 'figma.com → (empty)' },
]);

// multi rỗng cả hai chiều cũng phải ra '(empty)'
const multiEmptied = JSON.parse(JSON.stringify(before));
multiEmptied.fields[2].values = [];
assert.deepEqual(diffLog(before, multiEmptied, ctx), [
  { text: 'Emails updated', detail: 'a@x.com → (empty)' },
]);

// Link tới item đã bị xoá (không có trong itemTitles) → 'linked item', không undefined
const orphan = JSON.parse(JSON.stringify(before));
orphan.fields[3].links = [{ id: 'L2', itemId: 'gone', value: '' }];
assert.deepEqual(diffLog(before, orphan, ctx), [
  { text: 'Recovery email links changed', detail: 'Google — personal · a@x.com → linked item' },
]);

// kind lạ (JSON template thêm kiểu mới mà DB không có CHECK) → in ra chính key,
// không nổ TypeError
assert.deepEqual(
  diffLog(
    { title: 't', notes: '', fields: [], auth: [], codes: [] },
    { title: 't', notes: '', fields: [], auth: [{ id: 'x', kind: 'webauthn2', note: '', state: 'on' }], codes: [] },
    ctx
  ),
  [{ text: 'webauthn2 added', detail: '' }]
);

// Sinh lại sheet ĐÚNG BẰNG số mã cũ vẫn phải được ghi log (so cả mã đầu tiên,
// không chỉ so độ dài)
const regen = JSON.parse(JSON.stringify(before));
regen.codes = [{ id: 'cz', code: 'zzzz-yyyy', used: false }];
assert.deepEqual(diffLog(before, regen, ctx), [
  { text: 'Single-use codes regenerated', detail: '1 fresh codes' },
]);

// Đánh dấu một mã đã dùng KHÔNG đi qua diffLog (nó được log ngay lúc bấm,
// ngoài chế độ sửa) → `used` cố ý không được so
const usedFlipped = JSON.parse(JSON.stringify(before));
usedFlipped.codes[0].used = true;
assert.deepEqual(diffLog(before, usedFlipped, ctx), []);

console.log('vaultLogic check: OK');
