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
  normalizeUrl, avatarHue, avatarLetter,
  generatePassword,
  normalizeGroup, groupKey, inGroup, groupTree,
  normalizeIdent, identifiersOf, dependentsOf, isPasswordOnly,
  rootsOf, upstreamOf, chainTo, untrackedIdentifiers, rootKind,
  guessLinkKind, linkKind, moneyLinksOf, moneyReach, moneyMatrix, moneySourcesOf,
  mailboxTitle, titleSuggestions,
} from '../../utils/vaultLogic.js';

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

const generatedPassword = generatePassword();
assert.equal(generatedPassword.length, 20);
assert.match(generatedPassword, /[A-Z]/);
assert.match(generatedPassword, /[a-z]/);
assert.match(generatedPassword, /[0-9]/);
assert.match(generatedPassword, /[^A-Za-z0-9]/);
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
  id: 'i2', tpl: 'account', title: 'Figma', notes: 'Team seat billed annually',
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

/* ── normalizeUrl ───────────────────────────────────────────── */
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
assert.equal(itemSubtitle(item, 'Account'), 'tao@studio.vn'); // Username
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

/* ── Nhóm ─────────────────────────────────────────────────────────────── */
assert.equal(normalizeGroup('  Tài chính  /  Ngân   hàng '), 'Tài chính/Ngân hàng');
assert.equal(normalizeGroup('A//B'), 'A/B', 'đoạn rỗng bị bỏ');
assert.equal(normalizeGroup('A/B/C'), 'A/B', 'tối đa 2 cấp');
assert.equal(normalizeGroup(undefined), '');
assert.equal(groupKey('TÀI CHÍNH/Ngân hàng'), groupKey('tài chính/ngân hàng'));

const grouped = [
  { id: 'g1', group: 'Tài chính/Ngân hàng' },
  { id: 'g2', group: 'tài chính/ngân hàng' },   // khác hoa thường → cùng nhóm
  { id: 'g3', group: 'Tài chính/Thẻ' },
  { id: 'g4', group: 'Email' },
  { id: 'g5', group: '' },
  { id: 'g6' },
];
const tree = groupTree(grouped);
assert.equal(tree.ungrouped, 2);
assert.deepEqual(tree.groups.map((g) => [g.name, g.count]), [['Email', 1], ['Tài chính', 3]]);
assert.deepEqual(
  tree.groups[1].children.map((c) => [c.name, c.count, c.path]),
  [['Ngân hàng', 2, 'Tài chính/Ngân hàng'], ['Thẻ', 1, 'Tài chính/Thẻ']],
  'tên hiển thị theo cách viết gặp đầu tiên'
);
assert.equal(inGroup(grouped[2], groupKey('Tài chính')), true, 'nhóm cha gồm cả nhóm con');
assert.equal(inGroup(grouped[2], groupKey('Tài chính/Ngân hàng')), false);
assert.equal(inGroup({ group: 'Tài chính 2' }, groupKey('Tài chính')), false, 'tiền tố tên không tính');

assert.equal(matchesQuery({ title: 'VIB', group: 'Tài chính/Ngân hàng' }, 'ngân hàng'), true);
assert.deepEqual(
  diffLog({ title: 'x', group: '' }, { title: 'x', group: 'Email' }),
  [{ text: 'Group changed', detail: 'Ungrouped → Email' }]
);
assert.deepEqual(diffLog({ title: 'x', group: 'Email' }, { title: 'x', group: ' Email ' }), [],
  'chỉ khác khoảng trắng thì không phải đổi nhóm');

/* ── Định danh + chuỗi phụ thuộc ──────────────────────────────────────── */
assert.equal(normalizeIdent('+84 327 279 292'), '0327279292');
assert.equal(normalizeIdent('84327279292'), '0327279292');
assert.equal(normalizeIdent('0327.279.292'), '0327279292');
assert.equal(normalizeIdent(' Tung@Gmail.com '), 'tung@gmail.com');
assert.equal(normalizeIdent('VIB'), '');
assert.equal(normalizeIdent('1234'), '', 'quá ngắn để là SĐT');

const f = (label, value, type = 'text') => ({ id: `${label}-${value}`, label, type, value, values: [], links: [] });
const linkTo = (label, itemId) => ({ id: `${label}-${itemId}`, label, type: 'link', value: '', values: [], links: [{ id: 'L', itemId, value: '' }] });

const phone = { id: 'phone', tpl: 'identity', title: 'Phone',
  fields: [{ id: 'pn', label: 'Phone numbers', type: 'multi', value: '', values: ['0327 279 292'], links: [] }] };
const gmail = { id: 'gmail', tpl: 'account', title: 'tunghnhn9x@gmail.com',
  fields: [f('Username', 'tunghnhn9x@gmail.com'), f('Recovery phone', '+84327279292', 'phone')] };
const vib = { id: 'vib', tpl: 'account', title: 'VIB',
  fields: [f('Username', '0327279292'), linkTo('Recovery email', 'gmail')] };
const bidv = { id: 'bidv', tpl: 'account', title: 'BIDV', fields: [f('Username', '0327279292')] };
const tcb = { id: 'tcb', tpl: 'account', title: 'Techcombank',
  fields: [f('Username', '0327279292'), linkTo('Recovery email', 'gmail'), f('Password', '0327279292', 'password')] };
// 'Bank login' trên thẻ là liên kết TIỀN (thẻ tiêu tiền của tài khoản) → không vào cây đăng nhập.
// Cây 2 cấp được kiểm bằng 'Owner account' — một liên kết đăng nhập.
const card = { id: 'card', tpl: 'card', title: 'TCB - VISA', fields: [linkTo('Bank login', 'tcb')] };
const app = { id: 'app', tpl: 'account', title: 'TCB app', fields: [linkTo('Owner account', 'tcb')] };
const vault = [phone, gmail, vib, bidv, tcb, card, app];

assert.deepEqual([...identifiersOf(phone)], ['0327279292']);
assert.deepEqual([...identifiersOf(gmail)], ['tunghnhn9x@gmail.com'], 'chỉ tiêu đề — field Recovery phone không biến Gmail thành gốc của SĐT');
assert.equal(identifiersOf(vib).size, 0, 'VIB không đại diện cho SĐT dù username là SĐT');

const fromGmail = dependentsOf(vault, 'gmail');
assert.deepEqual(
  fromGmail.map((d) => [d.item.id, d.via, d.depth]),
  [['vib', 'Recovery email', 1], ['tcb', 'Recovery email', 1], ['app', 'Owner account', 2]],
  'cha trước, con ngay dưới'
);

const fromPhone = dependentsOf(vault, 'phone');
assert.deepEqual(
  fromPhone.filter((d) => d.depth === 1).map((d) => [d.item.id, d.via]),
  [['gmail', 'Recovery phone'], ['vib', 'Username'], ['bidv', 'Username'], ['tcb', 'Username']],
  '+84 khớp 0…; field password trùng giá trị KHÔNG được tính'
);
assert.equal(fromPhone.filter((d) => d.item.id === 'vib').length, 1,
  'VIB tới được qua cả SĐT lẫn Gmail nhưng chỉ hiện một lần, ở đường ngắn nhất');
assert.deepEqual(dependentsOf(vault, 'bidv'), [], 'không ai phụ thuộc BIDV');
assert.equal(dependentsOf(vault, 'card').length, 0);
assert.deepEqual(dependentsOf(vault, 'missing'), []);

// Vòng link A ↔ B không lặp vô hạn
const a = { id: 'a', title: 'A', fields: [linkTo('x', 'b')] };
const b = { id: 'b', title: 'B', fields: [linkTo('y', 'a')] };
assert.deepEqual(dependentsOf([a, b], 'a').map((d) => d.item.id), ['b']);

// maxDepth chặn cây
assert.deepEqual(dependentsOf(vault, 'gmail', 1).map((d) => d.item.id), ['vib', 'tcb']);

assert.equal(isPasswordOnly({ auth: [{ kind: 'password', state: 'primary' }] }), true);
assert.equal(isPasswordOnly({ auth: [{ kind: 'password', state: 'primary' }, { kind: 'totp', state: 'on' }] }), false);
assert.equal(isPasswordOnly({ auth: [{ kind: 'password', state: 'primary' }, { kind: 'totp', state: 'off' }] }), true,
  'phương thức đã tắt không tính');
assert.equal(isPasswordOnly({ auth: [] }), false, 'chưa ghi phương thức nào ≠ chỉ có mật khẩu');

/* ── Roots ────────────────────────────────────────────────────────────── */
assert.deepEqual(fromGmail.map((d) => d.parentId), ['gmail', 'gmail', 'tcb'], 'parentId nối cây');

const roots = rootsOf(vault);
assert.deepEqual(roots.map((r) => r.item.id), ['phone', 'gmail'], 'chỉ item đại diện định danh, nhiều phụ thuộc trước');
assert.deepEqual([roots[0].deps.length, roots[0].direct, roots[0].depth], [5, 4, 2]);
assert.deepEqual([roots[1].deps.length, roots[1].direct, roots[1].depth], [3, 2, 2]);

assert.deepEqual([rootKind(gmail), rootKind(phone), rootKind({ title: '+84 327 279 292' })], ['email', 'identity', 'phone']);
assert.deepEqual(upstreamOf(vault, 'gmail').map((u) => [u.item.id, u.via]), [['phone', 'Recovery phone']]);
assert.deepEqual(upstreamOf(vault, 'app').map((u) => u.item.id), ['tcb']);
assert.deepEqual(upstreamOf(vault, 'card'), [], 'liên kết tiền không phải "dựa vào"');
assert.deepEqual(upstreamOf(vault, 'phone'), [], 'không ai giữ mục Phone');
assert.deepEqual(upstreamOf(vault, 'missing'), []);

assert.deepEqual(chainTo(fromGmail, 'app').map((i) => i.id), ['tcb', 'app']);
assert.deepEqual(chainTo(fromGmail, 'vib').map((i) => i.id), ['vib']);
assert.deepEqual(chainTo(fromGmail).map((i) => i.id), ['tcb', 'app'], 'mặc định: tới nút sâu nhất');
assert.deepEqual(chainTo(fromGmail, 'không-có').map((i) => i.id), ['tcb', 'app']);
assert.deepEqual(chainTo([]), []);

// kuroemon98 là username của 2 item nhưng không item nào đại diện cho nó
const ms = { id: 'ms', title: 'Microsoft', fields: [f('Username', 'Kuroemon98@gmail.com'), f('Password', 'kuroemon98@gmail.com', 'password')] };
const apple = { id: 'apple', title: 'AppleID', fields: [f('Username', 'kuroemon98@gmail.com')] };
const lone = { id: 'lone', title: 'Lone', fields: [f('Username', 'only.once@gmail.com')] };
const untracked = untrackedIdentifiers([...vault, ms, apple, lone]);
assert.deepEqual(untracked.map((u) => [u.ident, u.value, u.items.map((i) => i.id)]),
  [['kuroemon98@gmail.com', 'Kuroemon98@gmail.com', ['ms', 'apple']]],
  'đã có gốc (SĐT, tunghnhn9x) không tính; dùng 1 lần không tính; field password không quét');
assert.deepEqual(untrackedIdentifiers([...vault, ms, apple, { id: 'k', title: 'kuroemon98@gmail.com', fields: [] }]), [],
  'có item tiêu đề là email đó thì không còn là "chưa có trong vault"');

/* ── Loại liên kết + liên kết tiền ────────────────────────────────────── */
assert.equal(guessLinkKind('Linked bank'), 'money');
assert.equal(guessLinkKind('Bank login'), 'money');
assert.equal(guessLinkKind('Nguồn tiền'), 'money');
assert.equal(guessLinkKind('Recovery email'), 'signin');
assert.equal(guessLinkKind('Owner account'), 'signin');
assert.equal(guessLinkKind(undefined), 'signin', 'không đoán được → đăng nhập như trước');
assert.equal(linkKind({ label: 'Linked bank', kind: 'signin' }), 'signin', 'chọn tay thắng đoán');
assert.equal(linkKind({ label: 'Linked bank', kind: 'lạ' }), 'money', 'kind rác → đoán theo nhãn');

assert.deepEqual(dependentsOf(vault, 'tcb').map((d) => d.item.id), ['app'],
  'thẻ nối "Bank login" không còn là phụ thuộc đăng nhập của ngân hàng');

const linksTo = (label, ids, kind) => ({
  id: `${label}-${ids.join()}`, label, type: 'link', value: '', values: [], kind,
  links: ids.map((itemId, i) => ({ id: `L${i}`, itemId, value: '' })),
});
const zalo = { id: 'zalo', title: 'ZaloPay', fields: [f('Username', '0327279292'), linksTo('Linked bank', ['vib', 'bidv', 'tcb', 'gone', 'vib'])] };
const momo = { id: 'momo', title: 'MoMo', fields: [linksTo('Nguồn tiền', ['vib', 'tcb'])] };
const odd = { id: 'odd', title: 'Odd', fields: [linksTo('Linked bank', ['vib'], 'signin')] };
const wallets = [...vault, zalo, momo, odd];

assert.deepEqual(moneyLinksOf(wallets, zalo).map((l) => [l.item.id, l.via]),
  [['vib', 'Linked bank'], ['bidv', 'Linked bank'], ['tcb', 'Linked bank']],
  'link tới item đã xoá bị bỏ, trùng đích chỉ một lần');
assert.deepEqual(moneyLinksOf(wallets, odd), [], 'chọn tay "signin" thì không phải liên kết tiền');
assert.ok(dependentsOf(wallets, 'vib').some((d) => d.item.id === 'odd'), '...mà là phụ thuộc đăng nhập');
assert.ok(!dependentsOf(wallets, 'vib').some((d) => d.item.id === 'zalo'), 'ví rút tiền từ VIB KHÔNG phụ thuộc VIB');

// Mất SĐT → ZaloPay (username) → tiền ở 3 ngân hàng; thẻ nối TCB không phải phụ thuộc của SĐT
const phoneDeps = dependentsOf(wallets, 'phone');
const reach = moneyReach(wallets, phone, phoneDeps);
assert.deepEqual(reach.groups.map((g) => [g.source.id, g.targets.map((t) => t.item.id)]),
  [['zalo', ['vib', 'bidv', 'tcb']]]);
assert.deepEqual(reach.banks.map((b) => b.id), ['vib', 'bidv', 'tcb']);
assert.deepEqual(moneyReach(wallets, gmail, dependentsOf(wallets, 'gmail')).banks, [], 'Gmail không có ví nào phía dưới');
assert.deepEqual(rootsOf(wallets).find((r) => r.item.id === 'phone').money.banks.length, 3);

const matrix = moneyMatrix(wallets);
assert.deepEqual(matrix.rows.map((r) => r.item.id), ['momo', 'card', 'zalo'], 'hàng theo tên');
assert.deepEqual(matrix.cols.map((c) => [c.item.id, c.sources.length]), [['tcb', 3], ['vib', 2], ['bidv', 1]],
  'cột nhiều nguồn nhất trước');
assert.equal(matrix.cells, 6);
assert.deepEqual(moneySourcesOf(wallets, 'tcb').map((s) => [s.item.id, s.via]),
  [['card', 'Bank login'], ['zalo', 'Linked bank'], ['momo', 'Nguồn tiền']]);
assert.deepEqual(moneySourcesOf(wallets, 'zalo'), []);
assert.deepEqual(moneyMatrix(vault.filter((i) => i.id !== 'card')), { rows: [], cols: [], cells: 0 });

const kindBefore = { title: 'x', fields: [linksTo('Linked bank', ['vib'])] };
const kindAfter = { title: 'x', fields: [{ ...linksTo('Linked bank', ['vib']), kind: 'signin' }] };
assert.deepEqual(diffLog(kindBefore, kindAfter), [{ text: 'Linked bank link kind changed', detail: 'money → signin' }]);
assert.deepEqual(diffLog(kindBefore, { title: 'x', fields: [{ ...linksTo('Linked bank', ['vib']), kind: 'money' }] }), [],
  'chọn tay đúng như đoán thì không đổi gì');

/* ── Email account (EML) + dòng phụ Identity ──────────────────────────── */
// Tiêu đề tự do: gốc nhận theo field email đầu tiên, không theo tiêu đề
const mailbox = { id: 'mb', tpl: 'email', title: 'Gmail', fields: [
  f('Email address', 'Kuroemon98@gmail.com', 'email'),
  f('Backup', 'other@gmail.com', 'email'),
  f('Recovery phone', '0327279292', 'phone'),
] };
assert.deepEqual([...identifiersOf(mailbox)], ['kuroemon98@gmail.com'],
  'chỉ email đầu tiên — Recovery phone không biến hộp thư thành gốc của SĐT');
assert.equal(rootKind(mailbox), 'email');
const withMailbox = [...vault, ms, apple, mailbox];
assert.deepEqual(dependentsOf(withMailbox, 'mb').map((d) => [d.item.id, d.via]), [['ms', 'Username'], ['apple', 'Username']]);
assert.ok(dependentsOf(withMailbox, 'phone').some((d) => d.item.id === 'mb' && d.via === 'Recovery phone'),
  'hộp thư phụ thuộc SĐT khôi phục của nó');
assert.deepEqual(untrackedIdentifiers(withMailbox), [], 'đã có Email account → không còn "chưa có trong vault"');
assert.deepEqual(identifiersOf({ tpl: 'email', title: 'Gmail', fields: [f('Email address', '', 'email')] }).size, 0,
  'chưa điền địa chỉ thì chưa là gốc');
// Đổi loại Account → Email account rồi đổi tiêu đề thành "Gmail": địa chỉ ở Username (text)
const converted = { tpl: 'email', title: 'Gmail', fields: [
  f('Website', 'gmail.com', 'url'),
  f('Username', 'kuroemon98@gmail.com'),
  f('Password', 'a@b.co', 'password'),
  { ...linkTo('Recovery email', 'gmail'), value: 'other@gmail.com' },
] };
assert.deepEqual([...identifiersOf(converted)], ['kuroemon98@gmail.com'],
  'lấy Username có giá trị là email; bỏ qua password và field link');
assert.deepEqual([...identifiersOf({ ...converted, fields: [f('Username', 'x@gmail.com'), f('Email address', 'y@gmail.com', 'email')] })],
  ['y@gmail.com'], 'có field kiểu email thì nó thắng');

assert.equal(mailboxTitle('a@gmail.com'), 'Gmail');
assert.equal(mailboxTitle('a@Hotmail.com'), 'Outlook');
assert.equal(mailboxTitle('a@outlook.com.vn'), 'Outlook');
assert.equal(mailboxTitle('a@icloud.com'), 'iCloud Mail');
assert.equal(mailboxTitle('a@company.vn'), 'company.vn', 'lạ thì dùng tên miền');
assert.equal(mailboxTitle(''), 'Email');

/* ── Gợi ý tiêu đề ────────────────────────────────────────────────────── */
const sugg = titleSuggestions(
  [{ title: 'VIB', group: 'Tài chính/Ngân hàng' }, { title: 'kuroemon98@gmail.com' }, { title: 'New account' }, { title: 'Zalo' }],
  { 'Tài chính/Ngân hàng': ['Vietcombank', 'vib'], 'Mạng xã hội': ['Facebook', 'zalo'], Email: ['Gmail'], _note: ['x'] },
  ['Gmail'],
);
assert.deepEqual(sugg.map((s) => [s.title, s.group]), [
  ['Gmail', 'Email'],
  ['VIB', 'Tài chính/Ngân hàng'],
  ['Zalo', 'Mạng xã hội'],
  ['Vietcombank', 'Tài chính/Ngân hàng'],
  ['Facebook', 'Mạng xã hội'],
], 'extra → tên trong vault (giữ cách viết; chưa có nhóm thì mượn nhóm preset) → preset; bỏ email, "New …", trùng, khoá _');

assert.equal(itemSubtitle(phone, 'Identity'), '0327 279 292', 'Identity chỉ có SĐT → dòng phụ là SĐT');
assert.equal(itemSubtitle(mailbox, 'Email account'), 'Kuroemon98@gmail.com');

console.log('vaultLogic check: OK');
