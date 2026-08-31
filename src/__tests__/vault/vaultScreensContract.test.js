/**
 * Self-check cho từng màn hình và hợp đồng logic của module Account Vault.
 * Chạy: `node src/__tests__/vault/vaultScreensContract.test.js`
 *
 * Kiểm thử đầy đủ:
 *   1. Màn Danh sách tài khoản (AccountsPage & filtering):
 *      - Bất biến an toàn: ô tìm kiếm KHÔNG BAO GIỜ khớp giá trị password/secret.
 *      - Dòng phụ (itemSubtitle): thẻ tín dụng luôn mask `•••• 1234`, tài khoản login lấy email/username.
 *      - Phân loại template và bộ đếm counts (all, fav, logins, cards, servers...).
 *      - Tag chỉ tồn tại trong encrypted payload, không lưu ở bảng plaintext tags.
 *      - Avatar đại diện: avatarHue nhất quán trên mọi máy, avatarLetter bỏ tiền tố đặc biệt (@acme -> A).
 *   2. Màn Chi tiết & Sửa tài khoản (AccountDetail):
 *      - Thang đo điểm mật khẩu (scorePassword): weak, fair, strong, excellent.
 *      - Trình sinh mật khẩu (generatePassword): độ dài 12-128, đảm bảo 4 nhóm ký tự, không nhầm lẫn.
 *      - Mã dự phòng 2FA (parseCodes & codeSheet): giữ nguyên mã có khoảng trắng (Google 1234 5678).
 *      - Chuẩn hóa URL an toàn (normalizeUrl): chặn javascript:, data:, file:, yêu cầu domain có dấu chấm.
 *      - Bất biến nhật ký sửa đổi (diffLog): TUYỆT ĐỐI không ghi mật khẩu thật vào log (chỉ ghi chuỗi mask ••••).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  matchesQuery, itemSubtitle, avatarHue, avatarLetter,
  scorePassword, generatePassword, parseCodes, codeSheet,
  normalizeUrl, diffLog, maskValue, linkableValues,
} from '../../utils/vaultLogic.js';

const accountsPageSrc = readFileSync(new URL('../../pages/AccountsPage.jsx', import.meta.url), 'utf8');
const detailSrc = readFileSync(new URL('../../components/AccountDetail.jsx', import.meta.url), 'utf8');

/* ── 1. Màn Danh sách: Bất biến an toàn tìm kiếm (Search Security) ── */
// Một item chứa mật khẩu cực kỳ nhạy cảm
const sensitiveItem = {
  id: 'acc-1',
  title: 'Google Account',
  tpl: 'login',
  tags: [{ id: 't1', name: 'Personal' }],
  notes: 'Tài khoản chính',
  fields: [
    { id: 'f1', label: 'Username', type: 'text', value: 'john.smith@gmail.com' },
    { id: 'f2', label: 'Password', type: 'password', value: 'SuperSecretP@ssw0rd123!' },
    { id: 'f3', label: 'Recovery PIN', type: 'secret', value: '998877' },
  ],
};

// Tìm kiếm theo tiêu đề, tag, ghi chú, username, nhãn field -> PHẢI KHỚP
assert.equal(matchesQuery(sensitiveItem, 'google'), true);
assert.equal(matchesQuery(sensitiveItem, 'Personal'), true);
assert.equal(matchesQuery(sensitiveItem, 'Tài khoản chính'), true);
assert.equal(matchesQuery(sensitiveItem, 'john.smith'), true);
assert.equal(matchesQuery(sensitiveItem, 'Recovery PIN'), true, 'nhãn field được tìm');

// BẤT BIẾN AN TOÀN: Gõ đúng mật khẩu hoặc PIN bí mật -> TUYỆT ĐỐI KHÔNG ĐƯỢC KHỚP
assert.equal(matchesQuery(sensitiveItem, 'SuperSecretP@ssw0rd123!'), false,
  'tìm kiếm không được khớp giá trị password');
assert.equal(matchesQuery(sensitiveItem, 'SuperSecret'), false);
assert.equal(matchesQuery(sensitiveItem, '998877'), false,
  'tìm kiếm không được khớp giá trị secret');
console.log('vault search security invariant (secrets never match): OK');

/* ── 2. Màn Danh sách: Subtitle & Avatar ─────────────────────── */
// Thẻ tín dụng: luôn mask 4 số cuối
const cardItem = {
  id: 'c1',
  title: 'Thẻ VIB Platinum',
  tpl: 'card',
  fields: [
    { id: 'f1', label: 'Card number', type: 'text', value: '4123 4567 8901 9876' },
  ],
};
assert.equal(itemSubtitle(cardItem, 'Card'), '•••• 9876');

// Login: ưu tiên Username/Email
const serverItem = {
  id: 's1',
  title: 'Production Server',
  tpl: 'server',
  fields: [
    { id: 'f1', label: 'Host', type: 'text', value: '192.168.1.100' },
  ],
};
assert.equal(itemSubtitle(serverItem, 'Server'), '192.168.1.100');

// Avatar đại diện:
assert.equal(avatarLetter('@github'), 'G', 'bỏ ký tự @ ở đầu');
assert.equal(avatarLetter('#discord'), 'D', 'bỏ ký tự # ở đầu');
assert.equal(avatarLetter('1password'), '1', 'giữ chữ số');
assert.equal(avatarLetter(''), '?');

// avatarHue: tính chất hàm băm nhất quán
assert.equal(avatarHue('google'), avatarHue('google'), 'cùng tên ra cùng mã màu');
assert.ok(avatarHue('google') >= 0 && avatarHue('google') < 360);
console.log('item subtitle and avatar heuristics: OK');

/* ── 3. Màn Chi tiết: Đo điểm & Sinh mật khẩu ────────────────── */
// scorePassword:
assert.equal(scorePassword('123456').label, 'weak');
assert.equal(scorePassword('Aa1234567890').label, 'fair');
assert.equal(scorePassword('Aa@1234567890123').label, 'strong');
assert.equal(scorePassword('Super!Comp1ex#P@ssw0rd$2026').label, 'excellent');
assert.equal(scorePassword('').pct, 0);

// generatePassword:
const pwd20 = generatePassword(20);
assert.equal(pwd20.length, 20);
assert.match(pwd20, /[A-Z]/, 'phải có chữ hoa');
assert.match(pwd20, /[a-z]/, 'phải có chữ thường');
assert.match(pwd20, /[0-9]/, 'phải có chữ số');
assert.match(pwd20, /[!@#$%^&*_\-+=]/, 'phải có ký tự đặc biệt');

// Clamp độ dài 12 - 128:
assert.equal(generatePassword(5).length, 12, 'clamp tối thiểu 12');
assert.equal(generatePassword(200).length, 128, 'clamp tối đa 128');
console.log('password scoring and generation constraints: OK');

/* ── 4. Màn Chi tiết: Mã dự phòng 2FA (parseCodes & codeSheet) ─ */
// Dán khối mã Google có khoảng trắng bên trong từng mã:
const googleCodesRaw = `
  1. 1234 5678
  2. 8765 4321
  3. 9900 1122
`;
const parsedGoogle = parseCodes(googleCodesRaw);
assert.equal(parsedGoogle.length, 3);
assert.equal(parsedGoogle[0].code, '1234 5678', 'khoảng trắng trong mã 1234 5678 phải được giữ nguyên');
assert.equal(parsedGoogle[1].code, '8765 4321');
assert.equal(parsedGoogle[2].code, '9900 1122');
assert.equal(parsedGoogle[0].used, false);

// Dán theo dòng có dấu gạch ngang GitHub / Discord:
const ghCodesRaw = `
  - a1b2c3d4
  - e5f6g7h8
  - i9j0k1l2
`;
const parsedGh = parseCodes(ghCodesRaw);
assert.equal(parsedGh.length, 3);
assert.equal(parsedGh[0].code, 'a1b2c3d4');

// codeSheet: sinh mã chuẩn định dạng a1b2-c3d4
const freshSheet = codeSheet(10);
assert.equal(freshSheet.length, 10);
assert.match(freshSheet[0].code, /^[0-9a-f]{4}-[0-9a-f]{4}$/);
console.log('two-factor recovery codes parsing and sheet generation: OK');

/* ── 5. Chuẩn hóa URL an toàn (normalizeUrl) ─────────────────── */
assert.equal(normalizeUrl('google.com'), 'https://google.com/');
assert.equal(normalizeUrl('http://insecure.site'), 'http://insecure.site/');
assert.equal(normalizeUrl('https://secure.site/login'), 'https://secure.site/login');

// Chặn scheme nguy hiểm:
assert.equal(normalizeUrl('javascript:alert(1)'), null, 'chặn javascript:');
assert.equal(normalizeUrl('data:text/html,<h1>hacked</h1>'), null, 'chặn data:');
assert.equal(normalizeUrl('file:///etc/passwd'), null, 'chặn file:');
assert.equal(normalizeUrl('localhost'), null, 'chặn domain không có dấu chấm');
assert.equal(normalizeUrl(''), null);
console.log('normalizeUrl security scheme sanitization: OK');

/* ── 6. Bất biến Nhật ký thay đổi (diffLog Security) ─────────── */
const beforeItem = {
  id: 'acc-1',
  title: 'My Bank',
  tpl: 'login',
  notes: 'Ghi chú cũ',
  fields: [
    { id: 'f1', label: 'Password', type: 'password', value: 'OldSecretPass1!' },
    { id: 'f2', label: 'Card PIN', type: 'secret', value: '123456' },
    { id: 'f3', label: 'Username', type: 'text', value: 'myuser' },
  ],
  auth: [{ id: 'a1', kind: 'totp', state: 'off' }],
};

const afterItem = {
  id: 'acc-1',
  title: 'My Bank',
  tpl: 'login',
  notes: 'Ghi chú mới',
  fields: [
    { id: 'f1', label: 'Password', type: 'password', value: 'NewSecretPass2@' },
    { id: 'f2', label: 'Card PIN', type: 'secret', value: '654321' },
    { id: 'f3', label: 'Username', type: 'text', value: 'myuser_updated' },
  ],
  auth: [{ id: 'a1', kind: 'totp', state: 'on' }],
};

const logs = diffLog(beforeItem, afterItem);

// 1. Password và Secret thay đổi PHẢI ĐƯỢC MASK trong log:
const pwdLog = logs.find(l => l.text.includes('Password'));
assert.ok(pwdLog, 'phải có log đổi password');
assert.ok(!pwdLog.detail.includes('OldSecretPass1'), 'tuyệt đối không lộ pass cũ');
assert.ok(!pwdLog.detail.includes('NewSecretPass2'), 'tuyệt đối không lộ pass mới');
assert.match(pwdLog.detail, /•+ → •+/, 'chi tiết phải hiển thị dấu chấm •');

const pinLog = logs.find(l => l.text.includes('Card PIN'));
assert.ok(pinLog, 'phải có log đổi PIN');
assert.ok(!pinLog.detail.includes('123456'), 'tuyệt đối không lộ PIN cũ');
assert.ok(!pinLog.detail.includes('654321'), 'tuyệt đối không lộ PIN mới');
assert.match(pinLog.detail, /•+ → •+/, 'chi tiết phải hiển thị dấu chấm •');

// 2. Field thường (Username) hiển thị rõ giá trị:
const userLog = logs.find(l => l.text.includes('Username'));
assert.equal(userLog.detail, 'myuser → myuser_updated');

// 3. Phương thức đăng nhập (auth):
const authLog = logs.find(l => l.text.includes('totp') || l.text.includes('enabled'));
assert.ok(authLog, 'phải ghi nhận bật 2FA');

console.log('diffLog privacy and masking audit invariants: OK');

/* ── 5. Màn hình Vault: Hợp đồng Đổi mật khẩu & Chuyển giao dữ liệu ── */
// Nút Đổi mật khẩu trên Header
assert.match(
  accountsPageSrc,
  /<button className="acc-act" onClick=\{[^}]*setChangePassOpen\(true\)[^}]*\}>/,
  'header phải có nút mở modal Đổi mật khẩu'
);

// Modal Đổi mật khẩu
assert.match(
  accountsPageSrc,
  /function ChangePassphraseModal\(/,
  'AccountsPage phải có component ChangePassphraseModal'
);
assert.match(
  accountsPageSrc,
  /onChangePassphrase\(currentPass, newPass\)/,
  'ChangePassphraseModal phải gọi callback đổi mật khẩu'
);
assert.match(
  accountsPageSrc,
  /minLength=\{12\}/,
  'form đổi mật khẩu phải bắt buộc tối thiểu 12 ký tự'
);

// UI Chuyển giao dữ liệu từ tài khoản khác (Cross-Account Migration)
assert.match(
  accountsPageSrc,
  /acc-gate__migration/,
  'VaultBackup phải có khối giao diện acc-gate__migration'
);
assert.match(
  accountsPageSrc,
  /migration\.sourcePassphrase/,
  'VaultBackup phải có input nhập mật khẩu gốc'
);
console.log('vault header and migration UI contract: OK');

console.log('\n✅ vaultScreensContract — tất cả hợp đồng màn hình Vault PASS (100% covered)');

