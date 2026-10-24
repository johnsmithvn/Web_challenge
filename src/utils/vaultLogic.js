/**
 * vaultLogic — logic thuần của Account Vault v2 (thiết kế Keyplate).
 *
 * Tách khỏi React/Supabase để chạy test bằng node:assert (xem
 * src/__tests__/vaultLogic.test.js), cùng lý do như taskFields.js.
 * KHÔNG import JSON, KHÔNG import React — file này phải chạy được bằng `node`.
 *
 * Shape dữ liệu ở đây là shape của ĐẶC TẢ, không phải shape của DB:
 *   Item  { id, tpl, title, group, fields[], notes, tags[], favorite, updated, auth[], codes[], log[] }
 *   Field { id, label, type, value, values[], links[], kind? }   kind: 'signin' | 'money' (chỉ field link)
 *   Link  { id, itemId, value }
 *   Auth  { id, kind, note, state: 'primary'|'on'|'off' }
 *   Code  { id, code, used }
 *   Log   { id, at, text, detail }
 * `useAccounts` maps each encrypted `accounts` row to/from this payload shape.
 * Components never depend on the ciphertext envelope or database columns.
 */

/**
 * 10 loại field. `value` là giá trị máy dùng, `label` là chữ hiển thị.
 *
 * This is the payload/UI contract; v6.2 no longer stores field types in a
 * plaintext table or database CHECK constraint.
 *
 * `password` vs `secret` là phân biệt mà sản phẩm dựa vào, KHÔNG gộp:
 * cả hai cùng mask + reveal được, nhưng chỉ `password` được tính điểm mạnh/yếu
 * và (sau này) sinh tự động. `secret` dành cho secret có định dạng cố định —
 * PIN ngân hàng, CVV, số giấy tờ — nơi điểm mạnh/yếu là vô nghĩa.
 */
export const TYPES = [
  { value: 'text',     label: 'Text' },
  { value: 'password', label: 'Password' },
  { value: 'secret',   label: 'Hidden text' },
  { value: 'url',      label: 'URL' },
  { value: 'email',    label: 'Email' },
  { value: 'phone',    label: 'Phone' },
  { value: 'multi',    label: 'Multi-value' },
  { value: 'link',     label: 'Linked item' },
  { value: 'number',   label: 'Number' },
  { value: 'date',     label: 'Date' },
];

/** Dòng gợi ý dưới ô "Add custom field", đổi theo loại đang chọn. */
export const TYPE_HINT = {
  multi: 'Multi-value holds several emails or numbers in one field; the starred one is primary.',
  link: 'Linked item can point at several other entries in this vault — or fall back to plain text.',
  secret: 'Hidden text is masked like a password but is not scored or generated — use it for PINs and document numbers.',
  password: 'Password fields are masked, scored and can be generated.',
};

/**
 * Nhãn field được ưu tiên lấy làm dòng phụ của item trong danh sách, theo thứ
 * tự. Hết danh sách thì rơi về tên template.
 */
// 'Phone numbers': Identity chỉ giữ một SĐT (gốc của Roots) trước đây hiện dòng phụ "Identity"
const SUBTITLE_LABELS = [
  'Email address', 'Primary email', 'Username', 'Emails', 'Phone numbers', 'Email',
  'Network (SSID)', 'Service', 'Full name', 'Host', 'Product',
];

/**
 * Thuộc tính cho MỌI ô nhập nội dung vault (không áp cho ô passphrase mở khoá):
 * - autoComplete off: tắt lịch sử nhập của trình duyệt — nó chen vào <datalist>
 *   gợi ý của app và làm lộ giá trị cũ ngay dưới ô.
 * - data-*-ignore: 1Password / LastPass / Bitwarden / Dashlane bỏ qua ô này.
 * Ô secret còn không dùng type="password" (xem EditValue) — Chrome coi mọi ô
 * password biến mất sau khi gõ là "vừa đăng nhập" và đòi lưu vào Google Password
 * Manager, tức chép secret của vault ra một kho thứ hai.
 */
export const NO_AUTOFILL = {
  autoComplete: 'off',
  'data-1p-ignore': 'true',
  'data-lpignore': 'true',
  'data-bwignore': 'true',
  'data-form-type': 'other',
};

/** Loại nào là secret: mask khi xem, loại khỏi tìm kiếm, không bao giờ làm giá trị link. */
export function isSecretType(type) {
  return type === 'password' || type === 'secret';
}

/**
 * Mask một giá trị để ghi vào log. `•` × min(len, 24).
 *
 * ⚠️ BẤT BIẾN CỦA MODULE: giá trị secret thật KHÔNG BAO GIỜ được ghi vào log.
 *    Mọi đường ghi log của field password/secret phải đi qua hàm này.
 *    Có test khẳng định trong src/__tests__/vaultLogic.test.js.
 */
export function maskValue(v) {
  return v ? '•'.repeat(Math.min(String(v).length, 24)) : '(empty)';
}

/** id tạm cho dòng draft chưa lưu (dòng đã lưu dùng uuid của Postgres). */
export function newId() {
  return crypto.randomUUID();
}

/**
 * Điểm mạnh của password. CHỈ dùng cho type='password' — `secret` không tính
 * điểm (PIN 6 số luôn "weak", nói ra không giúp được gì).
 *
 * Công thức thô có chủ ý: dài là yếu tố nặng nhất, mỗi lớp ký tự cộng thêm một
 * ít. Không phải zxcvbn, không đo được từ trong từ điển — đủ để phân 4 mức.
 *
 * @return {{pct: number, label: string, color: string}} pct đã clamp 8–100
 */
export function scorePassword(v) {
  if (!v) return { pct: 0, label: 'empty', color: 'var(--color-neutral-400)' };

  let s = Math.min(v.length, 24) * 2.6;
  if (/[A-Z]/.test(v)) s += 8;
  if (/[0-9]/.test(v)) s += 8;
  if (/[^A-Za-z0-9]/.test(v)) s += 14;

  const pct = Math.max(8, Math.min(100, Math.round(s)));
  return {
    pct,
    label: pct < 45 ? 'weak' : pct < 72 ? 'fair' : pct < 90 ? 'strong' : 'excellent',
    color: pct < 45 ? 'var(--color-neutral-500)'
      : pct < 72 ? 'var(--color-accent-400)'
        : 'var(--color-accent)',
  };
}

/** Generate a password from browser CSPRNG and guarantee the four common classes. */
export function generatePassword(length = 20) {
  const size = Math.max(12, Math.min(128, Math.trunc(length) || 20));
  const groups = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnopqrstuvwxyz',
    '23456789',
    '!@#$%^&*_-+=',
  ];
  const alphabet = groups.join('');
  const randomIndex = (max) => {
    const limit = 256 - (256 % max);
    const byte = new Uint8Array(1);
    do crypto.getRandomValues(byte); while (byte[0] >= limit);
    return byte[0] % max;
  };
  const chars = groups.map((group) => group[randomIndex(group.length)]);
  while (chars.length < size) chars.push(alphabet[randomIndex(alphabet.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/**
 * Bóc danh sách mã dự phòng từ khối text user dán nguyên từ nhà cung cấp.
 *
 * Tách theo dòng / phẩy / chấm phẩy, gỡ số thứ tự và gạch đầu dòng
 * (`1.` `2)` `-` `*` `•`), giữ token nào chứa >= 4 ký tự chữ-số.
 *
 * KHOẢNG TRẮNG BÊN TRONG MỘT MÃ ĐƯỢC GIỮ: Google phát mã dạng `1234 5678` —
 * đó là MỘT mã, không phải hai. Chỉ khi cả khối dán ra đúng 1 token mà token
 * đó chứa hơn 2 ứng viên cách nhau bằng khoảng trắng thì mới tách theo khoảng
 * trắng (người dán cả hàng ngang: "abcd efgh ijkl mnop").
 *
 * @return {Array<{id: string, code: string, used: boolean}>} mã nhập vào luôn chưa dùng
 */
export function parseCodes(raw) {
  const ok = (s) => /[0-9a-z]{4}/i.test(s);

  let parts = String(raw)
    .split(/[\n,;]+/)
    .map((s) => s.replace(/^\s*(?:[-*•]|\d{1,2}[.)])\s*/, '').trim())
    .filter(ok);

  if (parts.length === 1) {
    const toks = parts[0].split(/\s+/).filter(ok);
    if (toks.length > 2) parts = toks;
  }

  return parts.map((code) => ({ id: newId(), code, used: false }));
}

/**
 * Sinh sheet n mã dạng `a1b2-c3d4`.
 * Dùng crypto.getRandomValues chứ không Math.random: mã dự phòng là thứ dùng
 * để vào lại tài khoản, không lấy từ nguồn ngẫu nhiên đoán được.
 */
export function codeSheet(n) {
  const hex = '0123456789abcdef';
  const bytes = new Uint8Array(8 * n);
  crypto.getRandomValues(bytes);

  const out = [];
  for (let i = 0; i < n; i++) {
    let c = '';
    for (let j = 0; j < 8; j++) {
      if (j === 4) c += '-';
      c += hex[bytes[i * 8 + j] % 16];
    }
    out.push({ id: newId(), code: c, used: false });
  }
  return out;
}

/**
 * Giá trị của item đích mà một link được phép "mượn" để hiển thị.
 *
 * ⚠️ SECRET KHÔNG BAO GIỜ được chào làm giá trị link — link chip hiện giá trị
 *    đó ra ngoài, ở chế độ xem, không có bước reveal nào.
 *
 * Chỉ nhận multi + text/email/phone/url có giá trị. `number`/`date` bị loại vì
 * mượn chúng ra ngoài không nói lên điều gì ("Port: 5432" trên một chip link).
 *
 * `field` là nhãn của field nguồn, tách riêng cho nơi nào muốn dựng hai cột
 * (khối "Depends on this") thay vì đọc nguyên chuỗi `label` của một <option>.
 *
 * @return {Array<{value: string, label: string, field?: string}>} phần tử đầu luôn là "— whole item —"
 */
export function linkableValues(target) {
  const out = [{ value: '', label: '— whole item —' }];
  if (!target) return out;

  for (const f of target.fields || []) {
    if (isSecretType(f.type)) continue;

    if (f.type === 'multi') {
      for (const v of f.values || []) {
        if (v) out.push({ value: v, label: `${f.label}: ${v}`, field: f.label });
      }
    } else if (f.value && ['email', 'phone', 'text', 'url'].includes(f.type)) {
      out.push({ value: f.value, label: `${f.label}: ${f.value}`, field: f.label });
    }
  }
  return out;
}

/* ══ Nhóm ════════════════════════════════════════════════════════════════
   Nhóm là MỘT chuỗi đường dẫn trên item (`group: "Tài chính/Ngân hàng"`), nằm
   trong payload mã hoá như tag. Không có bảng/danh sách nhóm riêng: cây nhóm suy
   ra từ item (cùng cách usedTags). Hệ quả có chủ ý: nhóm rỗng không tồn tại, và
   đổi tên nhóm = ghi lại từng item. Rỗng = Ungrouped. */

/** Tối đa 2 cấp — cấp thứ 3 trở đi bị bỏ; gộp khoảng trắng, bỏ đoạn rỗng. */
export function normalizeGroup(input) {
  return String(input || '')
    .split('/')
    .map((s) => s.trim().replace(/\s+/g, ' ').slice(0, 60))
    .filter(Boolean)
    .slice(0, 2)
    .join('/');
}

/** Khoá so sánh: không phân biệt hoa thường, để "tài chính" và "Tài chính" là một nhóm. */
export function groupKey(input) {
  return normalizeGroup(input).toLocaleLowerCase('vi');
}

/** Item thuộc nhóm `key` hoặc một nhóm con của nó. */
export function inGroup(item, key) {
  const k = groupKey(item.group);
  return k === key || k.startsWith(`${key}/`);
}

/**
 * Cây nhóm 2 cấp kèm số đếm (nhóm cha đếm cả item của nhóm con). Tên hiển thị
 * lấy theo cách viết gặp đầu tiên. Sắp theo tên tiếng Việt.
 *
 * @return {{groups: Array<{key, name, path, count, children: Array<{key, name, path, count}>}>, ungrouped: number}}
 */
export function groupTree(items) {
  const top = new Map();
  let ungrouped = 0;

  for (const it of items) {
    const path = normalizeGroup(it.group);
    if (!path) { ungrouped++; continue; }
    const [a, b] = path.split('/');
    const ka = a.toLocaleLowerCase('vi');
    let node = top.get(ka);
    if (!node) top.set(ka, (node = { key: ka, name: a, path: a, count: 0, children: new Map() }));
    node.count++;
    if (b) {
      const kb = `${ka}/${b.toLocaleLowerCase('vi')}`;
      let child = node.children.get(kb);
      if (!child) node.children.set(kb, (child = { key: kb, name: b, path: `${node.name}/${b}`, count: 0 }));
      child.count++;
    }
  }

  const byName = (x, y) => x.name.localeCompare(y.name, 'vi');
  return {
    groups: [...top.values()].sort(byName)
      .map((n) => ({ ...n, children: [...n.children.values()].sort(byName) })),
    ungrouped,
  };
}

/**
 * Gợi ý cho ô Group: nhóm đã dùng trong vault trước (đúng cách viết của user), rồi
 * bộ nhóm chuẩn (`groupPresets` trong account-templates.json). Trùng không phân
 * biệt hoa thường chỉ giữ một.
 */
export function groupSuggestions(items, presets = []) {
  const seen = new Set();
  const out = [];
  const push = (p) => {
    const n = normalizeGroup(p);
    const k = n.toLocaleLowerCase('vi');
    if (!n || seen.has(k)) return;
    seen.add(k);
    out.push(n);
  };
  groupTree(items).groups.forEach((g) => { push(g.path); g.children.forEach((c) => push(c.path)); });
  presets.forEach(push);
  return out;
}

/* ══ Chuỗi phụ thuộc ("Depends on this") ═════════════════════════════════
   Ai sẽ bị kéo theo nếu item này mất/bị chiếm. Hai nguồn cạnh:
   1. Link thật: field `link` của item khác trỏ tới item này.
   2. Ghép theo giá trị: field không-secret của item khác BẰNG một định danh của
      item này (username ngân hàng = số điện thoại). Có cái này thì SĐT/Gmail
      làm gốc được mà không phải link tay từng mục.
   Chỉ item ĐẠI DIỆN cho định danh mới có định danh: tiêu đề chính là email/SĐT,
   hoặc là Identity. Không có luật này thì VIB và BIDV — cùng username 0327… —
   thành phụ thuộc lẫn nhau. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email → chữ thường; SĐT → chỉ chữ số, +84 / 84 quy về 0. Không phải hai loại đó → ''. */
export function normalizeIdent(value) {
  const s = String(value || '').trim();
  if (EMAIL_RE.test(s)) return s.toLowerCase();
  const digits = s.replace(/[\s.\-()]/g, '');
  if (!/^\+?\d{8,15}$/.test(digits)) return '';
  const d = digits.replace(/^\+/, '');
  return d.startsWith('84') && d.length === 11 ? `0${d.slice(2)}` : d;
}

/* ══ Loại liên kết: đăng nhập vs tiền ══════════════════════════════════
   Hai loại rủi ro đi NGƯỢC chiều nhau nên không được trộn trong một cây:
   - 'signin' (Recovery email, Owner account…): mất mục được trỏ tới → mất mục
     này. Đây là cạnh của dependentsOf / Roots.
   - 'money' (Linked bank, Pays from…): mục này rút được tiền từ mục được trỏ
     tới. Mất ví → tiền ở ngân hàng đi; mất ngân hàng không đụng được ví. Không
     vào cây phụ thuộc — đi vào ma trận Money links và "Money reachable".
   `field.kind` lưu trong payload mã hoá, tuỳ chọn: thiếu thì đoán theo nhãn. Ghép
   theo giá trị (username = SĐT) luôn là 'signin' — nó không có field link. */
export const LINK_KINDS = ['signin', 'money'];
const MONEY_LABEL_RE = /linked bank|bank login|bank account|pays? from|funding|auto.?debit|top.?up|ngân hàng liên kết|liên kết ngân hàng|nguồn tiền|trích nợ|nạp tiền/i;

export function guessLinkKind(label) {
  return MONEY_LABEL_RE.test(String(label || '')) ? 'money' : 'signin';
}

/** Loại của một field link: user chọn tay thì theo đó, không thì đoán theo nhãn. */
export function linkKind(field) {
  return LINK_KINDS.includes(field.kind) ? field.kind : guessLinkKind(field.label);
}

const IDENT_TYPES = ['text', 'email', 'phone', 'multi'];
const fieldValues = (f) => (f.type === 'multi' ? f.values || [] : [f.value]);

/**
 * Định danh item này đại diện cho (xem luật ở trên):
 * - tiêu đề chính là email/SĐT (luật cũ, giữ để item đang có không mất gốc);
 * - Identity: mọi giá trị text/email/phone/multi;
 * - Email account: field email ĐẦU TIÊN có giá trị ("Email address") — chỉ một,
 *   để "Recovery phone" (type phone) hay một email phụ không biến hộp thư thành
 *   gốc của SĐT / hộp thư khác.
 */
export function identifiersOf(item) {
  const ids = new Set();
  const add = (v) => { const n = normalizeIdent(v); if (n) ids.add(n); };
  add(item.title);
  if (item.tpl === 'identity') {
    for (const f of item.fields || []) {
      if (IDENT_TYPES.includes(f.type)) fieldValues(f).forEach(add);
    }
  }
  if (item.tpl === 'email') {
    // Ưu tiên field kiểu email. Item đổi loại từ Account sang (đổi loại không thêm/
    // bớt field) thì địa chỉ nằm ở "Username" kiểu text → lấy field không-secret đầu
    // tiên có giá trị là email. Field link (Recovery email) không bao giờ được lấy.
    const fields = item.fields || [];
    const address = fields.find((f) => f.type === 'email' && f.value)
      || fields.find((f) => !isSecretType(f.type) && f.type !== 'link' && EMAIL_RE.test(String(f.value || '').trim()));
    if (address) add(address.value);
  }
  return ids;
}

const MAIL_PROVIDERS = [
  [/^(gmail|googlemail)\.com$/, 'Gmail'],
  [/^(outlook|hotmail|live|msn)\.[a-z.]+$/, 'Outlook'],
  [/^(yahoo|ymail)\.[a-z.]+$/, 'Yahoo Mail'],
  [/^(icloud|me|mac)\.com$/, 'iCloud Mail'],
  [/^(proton\.me|protonmail\.(com|ch)|pm\.me)$/, 'Proton Mail'],
];

/**
 * Gợi ý cho ô tiêu đề (tiêu đề = tên dịch vụ). Thứ tự: `extra` (vd tên hộp thư suy
 * từ địa chỉ) → tên đã dùng trong vault, kèm nhóm của chính item đó → danh sách
 * dịch vụ hay dùng. Trùng (không phân biệt hoa thường) chỉ giữ cái đứng trước.
 * Bỏ tên là email/SĐT và tên mặc định "New …" — gợi ý chúng chỉ là rác.
 *
 * Quy chuẩn tên (để không có cả "Gmail" lẫn "Google" cho cùng một thứ):
 * hộp thư của mình ở nhà cung cấp (Email account) → tên hộp thư: Gmail, Outlook…;
 * tài khoản ở nhà cung cấp đăng nhập bằng email khác (Account) → tên công ty:
 * Google, Microsoft, Apple ID. `mailbox` = đang đặt tên cho một Email account: KHÔNG
 * gợi ý tiêu đề của item khác (mỗi hộp thư một tên riêng, chép tên hộp thư khác vô
 * ích — và đó là đường "Google" lọt vào khi user lỡ đặt). Đã biết địa chỉ (`extra`)
 * thì chỉ gợi ý đúng tên đó; chưa biết thì liệt kê nhà cung cấp (nhóm preset "Email").
 * Ngược lại (item khác) thì bỏ tên hộp thư.
 *
 * @param {Object<string,string[]>} presets { [nhóm]: [tên dịch vụ] }
 * @param {string[]} extra
 * @param {{mailbox?: boolean}} [opts]
 * @return {Array<{title: string, group: string}>} group '' = không gợi ý nhóm
 */
export function titleSuggestions(items, presets = {}, extra = [], { mailbox = false } = {}) {
  const isMailGroup = (g) => { const k = groupKey(g); return k === 'email' || k.startsWith('email/'); };
  const out = [];
  const seen = new Set();
  const push = (title, group = '') => {
    const t = String(title || '').trim();
    const k = t.toLocaleLowerCase('vi');
    if (!t || seen.has(k) || normalizeIdent(t) || /^new\s/i.test(t)) return;
    seen.add(k);
    out.push({ title: t, group });
  };
  const presetGroup = new Map();
  for (const [group, titles] of Object.entries(presets)) {
    if (group.startsWith('_')) continue;
    titles.forEach((t) => presetGroup.set(String(t).trim().toLocaleLowerCase('vi'), normalizeGroup(group)));
  }
  const groupOf = (t) => presetGroup.get(String(t || '').trim().toLocaleLowerCase('vi')) || '';
  extra.forEach((t) => push(t, groupOf(t)));
  if (mailbox) {
    if (!out.length) {
      for (const [group, titles] of Object.entries(presets)) {
        if (!group.startsWith('_') && isMailGroup(group)) titles.forEach((t) => push(t, normalizeGroup(group)));
      }
    }
    return out;
  }
  // Item trong vault chưa có nhóm thì mượn nhóm của preset cùng tên (Zalo → Mạng xã hội)
  [...items]
    .filter((it) => it.tpl !== 'email')
    .sort((a, b) => a.title.localeCompare(b.title, 'vi'))
    .forEach((it) => push(it.title, normalizeGroup(it.group) || groupOf(it.title)));
  for (const [group, titles] of Object.entries(presets)) {
    if (!group.startsWith('_') && !isMailGroup(group)) titles.forEach((t) => push(t, normalizeGroup(group)));
  }
  return out;
}

/** Tiêu đề gợi ý cho một hộp thư: tên dịch vụ theo tên miền, lạ thì chính tên miền. */
export function mailboxTitle(address) {
  const domain = (String(address || '').trim().split('@')[1] || '').toLowerCase();
  return MAIL_PROVIDERS.find(([re]) => re.test(domain))?.[1] || domain || 'Email';
}

/** Các item phụ thuộc TRỰC TIẾP vào `target`, mỗi item một dòng, `via` = nhãn field. */
function directDependents(items, target) {
  const ids = identifiersOf(target);
  const out = [];
  for (const it of items) {
    if (it.id === target.id) continue;
    const via = [];
    for (const f of it.fields || []) {
      // Liên kết tiền không làm `it` phụ thuộc vào `target` — xem LINK_KINDS
      const linked = f.type === 'link' && linkKind(f) === 'signin'
        && (f.links || []).some((L) => L.itemId === target.id);
      const matched = ids.size > 0 && !isSecretType(f.type) && f.type !== 'link'
        && fieldValues(f).some((v) => ids.has(normalizeIdent(v)));
      if ((linked || matched) && !via.includes(f.label)) via.push(f.label);
    }
    if (via.length) out.push({ item: it, via: via.join(', ') });
  }
  return out;
}

/**
 * Cây phụ thuộc của item `rootId`, trải phẳng theo thứ tự đọc (cha trước, con
 * ngay dưới). BFS để mỗi item nằm ở đường NGẮN nhất tới gốc và chỉ xuất hiện một
 * lần — vòng link A↔B không lặp vô hạn. Gốc không nằm trong kết quả.
 *
 * ponytail: O(n² · số field) — đủ cho vault cá nhân vài trăm mục, cần index ngược
 * nếu vault lên hàng nghìn.
 *
 * @return {Array<{item, via: string, depth: number, parentId: string}>} depth 1 = trực tiếp;
 *   parentId = item ngay phía trên trong cây (gốc với depth 1)
 */
export function dependentsOf(items, rootId, maxDepth = 3) {
  const root = items.find((i) => i.id === rootId);
  if (!root) return [];

  const seen = new Set([rootId]);
  const children = new Map();          // id → [{item, via}]
  let frontier = [root];
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next = [];
    for (const node of frontier) {
      const kids = directDependents(items, node).filter((d) => !seen.has(d.item.id));
      kids.forEach((d) => { seen.add(d.item.id); next.push(d.item); });
      children.set(node.id, kids);
    }
    frontier = next;
  }

  const out = [];
  const walk = (id, depth) => {
    for (const d of children.get(id) || []) {
      out.push({ ...d, depth, parentId: id });
      walk(d.item.id, depth + 1);
    }
  };
  walk(rootId, 1);
  return out;
}

/* ══ Liên kết tiền ═════════════════════════════════════════════════════ */

/**
 * Các item mà `item` rút được tiền từ đó (field link loại 'money'), mỗi đích một
 * lần. Link tới item đã xoá bị bỏ qua. `byId` truyền vào được khi gọi lặp.
 *
 * @return {Array<{item, via: string}>} via = nhãn field ("Linked bank")
 */
export function moneyLinksOf(items, item, byId = new Map(items.map((i) => [i.id, i]))) {
  const out = [];
  for (const f of item.fields || []) {
    if (f.type !== 'link' || linkKind(f) !== 'money') continue;
    for (const L of f.links || []) {
      const t = byId.get(L.itemId);
      if (t && t.id !== item.id && !out.some((o) => o.item.id === t.id)) out.push({ item: t, via: f.label });
    }
  }
  return out;
}

/** Chiều ngược của moneyLinksOf: những item rút được tiền TỪ item `id`. */
export function moneySourcesOf(items, id) {
  const byId = new Map(items.map((i) => [i.id, i]));
  return items.flatMap((it) => {
    const hit = it.id === id ? null : moneyLinksOf(items, it, byId).find((l) => l.item.id === id);
    return hit ? [{ item: it, via: hit.via }] : [];
  });
}

/**
 * Tiền bị kéo theo khi mất một gốc: liên kết tiền của chính gốc và của mọi item
 * phụ thuộc đăng nhập vào nó (Email B → ZaloPay ⇒ Ngân hàng A · B · C).
 *
 * @param {Array} deps kết quả dependentsOf(items, root.id)
 * @return {{groups: Array<{source, targets: Array<{item, via}>}>, banks: Array<object>}}
 *   banks = các đích khác nhau
 */
export function moneyReach(items, root, deps) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const groups = [];
  const banks = new Map();
  for (const source of [root, ...deps.map((d) => d.item)]) {
    const targets = moneyLinksOf(items, source, byId);
    if (!targets.length) continue;
    groups.push({ source, targets });
    for (const t of targets) banks.set(t.item.id, t.item);
  }
  return { groups, banks: [...banks.values()] };
}

/**
 * Ma trận Money links: hàng = item có ≥1 liên kết tiền (ví, thẻ), cột = item bị
 * trỏ tới (ngân hàng), cột nhiều nguồn nhất đứng trước. `cells` = số liên kết.
 *
 * @return {{rows: Array<{item, links, targets: Set<string>}>, cols: Array<{item, sources: Array}>, cells: number}}
 */
export function moneyMatrix(items) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const rows = [];
  const cols = new Map();
  for (const it of items) {
    const links = moneyLinksOf(items, it, byId);
    if (!links.length) continue;
    rows.push({ item: it, links, targets: new Set(links.map((l) => l.item.id)) });
    for (const l of links) {
      if (!cols.has(l.item.id)) cols.set(l.item.id, { item: l.item, sources: [] });
      cols.get(l.item.id).sources.push(it);
    }
  }
  const byTitle = (a, b) => a.item.title.localeCompare(b.item.title, 'vi');
  return {
    rows: rows.sort(byTitle),
    cols: [...cols.values()].sort((a, b) => b.sources.length - a.sources.length || byTitle(a, b)),
    cells: rows.reduce((n, r) => n + r.targets.size, 0),
  };
}

/* ══ Roots (bản đồ gốc định danh) ═══════════════════════════════════════ */

/**
 * Mọi gốc định danh (luật ở identifiersOf) kèm cây phụ thuộc, sắp theo số item
 * phụ thuộc giảm dần rồi theo tên. Gốc không ai dựa vào vẫn có trong danh sách
 * (UI làm mờ) — nó vẫn là một mailbox / số điện thoại thật.
 *
 * @return {Array<{item, deps: Array, direct: number, depth: number, money: object}>}
 *   money = moneyReach của gốc
 */
export function rootsOf(items) {
  return items
    .filter((it) => identifiersOf(it).size > 0)
    .map((item) => {
      const deps = dependentsOf(items, item.id);
      return {
        item,
        deps,
        direct: deps.filter((d) => d.depth === 1).length,
        depth: deps.reduce((m, d) => Math.max(m, d.depth), 0),
        money: moneyReach(items, item, deps),
      };
    })
    .sort((a, b) => b.deps.length - a.deps.length || a.item.title.localeCompare(b.item.title, 'vi'));
}

/** Gốc là gì: Email account hoặc tiêu đề là email → 'email', tiêu đề là SĐT → 'phone', còn lại (Identity) → 'identity'. */
export function rootKind(item) {
  if (item.tpl === 'email') return 'email';
  const ident = normalizeIdent(item.title);
  if (!ident) return 'identity';
  return ident.includes('@') ? 'email' : 'phone';
}

/**
 * Chiều ngược của dependentsOf, một cấp: item này dựa vào những item nào
 * (Gmail ← mục Phone vì field "Recovery phone" của Gmail trùng số đó).
 * `via` = nhãn field CỦA ITEM NÀY đã nối sang bên kia.
 *
 * @return {Array<{item, via: string}>}
 */
export function upstreamOf(items, id) {
  const self = items.find((i) => i.id === id);
  if (!self) return [];
  const out = [];
  for (const other of items) {
    if (other.id === id) continue;
    const hit = directDependents(items, other).find((d) => d.item.id === id);
    if (hit) out.push({ item: other, via: hit.via });
  }
  return out;
}

/**
 * Đường từ gốc xuống `targetId` trong cây dependentsOf (gốc KHÔNG nằm trong kết
 * quả). Không có target hoặc target không thuộc cây → đường tới nút SÂU nhất,
 * vì đó là chuỗi dài nhất người dùng cần thấy.
 *
 * @param {Array<{item, depth, parentId}>} deps kết quả của dependentsOf
 * @return {Array<object>} các item, cấp 1 trước
 */
export function chainTo(deps, targetId) {
  if (!deps.length) return [];
  const byId = new Map(deps.map((d) => [d.item.id, d]));
  let node = byId.get(targetId)
    || deps.reduce((best, d) => (d.depth > best.depth ? d : best), deps[0]);
  const path = [];
  while (node) {
    path.unshift(node.item);
    node = byId.get(node.parentId);
  }
  return path;
}

/**
 * Email / SĐT làm giá trị cho ≥2 item nhưng chưa item nào ĐẠI DIỆN cho nó (xem
 * identifiersOf) — mailbox thật mà mật khẩu + 2 bước của chính nó không ai theo
 * dõi. `value` là cách viết gặp đầu tiên (để điền sẵn khi tạo item).
 * Secret không bao giờ được quét: trùng mật khẩu không phải là "dùng chung email".
 *
 * @return {Array<{ident: string, value: string, items: Array}>} nhiều item trước
 */
export function untrackedIdentifiers(items) {
  const owned = new Set(items.flatMap((it) => [...identifiersOf(it)]));
  const seen = new Map();          // ident → { value, items: Map(id → item) }
  for (const it of items) {
    for (const f of it.fields || []) {
      if (isSecretType(f.type) || f.type === 'link') continue;
      for (const v of fieldValues(f)) {
        const ident = normalizeIdent(v);
        if (!ident || owned.has(ident)) continue;
        if (!seen.has(ident)) seen.set(ident, { value: String(v).trim(), items: new Map() });
        seen.get(ident).items.set(it.id, it);
      }
    }
  }
  return [...seen.entries()]
    .map(([ident, s]) => ({ ident, value: s.value, items: [...s.items.values()] }))
    .filter((x) => x.items.length >= 2)
    .sort((a, b) => b.items.length - a.items.length || a.ident.localeCompare(b.ident));
}

/** Đang đăng nhập chỉ bằng mật khẩu: có ít nhất một phương thức bật, và tất cả đều là password. */
export function isPasswordOnly(item) {
  const active = (item.auth || []).filter((a) => a.state !== 'off');
  return active.length > 0 && active.every((a) => a.kind === 'password');
}

/**
 * Item có khớp chuỗi tìm kiếm hay không. Tìm trong tiêu đề, tag, ghi chú, nhãn
 * field và giá trị field KHÔNG phải secret.
 *
 * ⚠️ Giá trị secret bị loại khỏi vùng tìm: gõ đúng mật khẩu vào ô search rồi
 *    thấy item hiện ra là một đường xác nhận mật khẩu mà không cần reveal.
 */
export function matchesQuery(item, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;

  const hay = [
    item.title,
    // "Tài chính/Ngân hàng" → gõ "ngân hàng" cũng ra
    normalizeGroup(item.group).replace('/', ' '),
    // tag là object {id,name,color} khi đến từ hook, là chuỗi khi đến từ test /
    // seed — nhận cả hai để không phải giữ hai bản danh sách tag trên item.
    (item.tags || []).map((t) => t?.name ?? t).join(' '),
    item.notes || '',
    ...(item.fields || []).map((f) => {
      if (isSecretType(f.type)) return f.label;
      const v = f.type === 'multi' ? (f.values || []).join(' ') : (f.value || '');
      return `${f.label} ${v}`;
    }),
  ].join(' ').toLowerCase();

  return hay.includes(q);
}

/**
 * Dòng phụ của item trong danh sách.
 * Item loại thẻ hiện 4 số cuối đã mask; còn lại lấy field nhận diện đầu tiên
 * theo SUBTITLE_LABELS. Không có gì thì rơi về `fallback` (tên template).
 */
export function itemSubtitle(item, fallback = '') {
  const val = (f) => (f.type === 'multi' ? (f.values || [])[0] || '' : f.value || '');

  if (item.tpl === 'card') {
    const f = (item.fields || []).find((x) => x.label === 'Card number');
    return f && f.value ? `•••• ${f.value.replace(/\s/g, '').slice(-4)}` : fallback;
  }

  for (const label of SUBTITLE_LABELS) {
    const f = (item.fields || []).find((x) => x.label === label);
    if (f && val(f)) return val(f);
  }
  return fallback;
}

/**
 * Chuẩn hoá URL user gõ: "google.com" → "https://google.com".
 * Trả null nếu rỗng hoặc không phải http(s) — chặn luôn `javascript:`/`data:`/
 * `file:`. Chuỗi này đi vào `href` thật VÀ được dùng để suy ra origin của
 * favicon, nên phải lọc scheme ở tầng util, không phải ở component.
 */
export function normalizeUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.')) return null; // "abc" không phải domain
    return u.toString();
  } catch {
    return null;
  }
}

/* `itemUrl`, `faviconCandidates` và `urlHost` đã XOÁ (2026-08-11). Logo item giờ là data URI
   PNG 48×48 nằm trong encrypted payload, chọn tay ở chế độ Edit — không còn tầng
   nào gọi mạng. Lý do đầy đủ xem comment đầu `AccountAvatar.jsx`. Đừng dựng lại
   favicon aggregator: nó tiết lộ danh sách dịch vụ user có tài khoản. */

/**
 * Hue 0–359 suy từ tên, để cùng một dịch vụ luôn ra cùng một màu ở mọi máy.
 * Trả HUE chứ không trả màu hoàn chỉnh: độ sáng/độ đậm do CSS quyết theo theme
 * (chữ trên nền tối và trên nền sáng cần lightness khác nhau).
 */
export function avatarHue(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

/** Chữ cái đại diện. Bỏ ký tự không phải chữ/số ở đầu ("@acme" → "A"). */
export function avatarLetter(name = '') {
  const m = String(name).match(/[\p{L}\p{N}]/u);
  return m ? m[0].toUpperCase() : '?';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Dấu thời gian của một dòng log: `04 Aug 2026 · 09:12`.
 * Định dạng của đặc tả, KHÔNG dùng formatDate/formatDateTime của dateUtils —
 * hai hàm đó theo quy ước Việt Nam, còn UI vault giữ tiếng Anh.
 * Đọc theo giờ địa phương (không phải UTC): dòng log ghi lúc 00:30 GMT+7 phải
 * hiện đúng ngày hôm đó.
 */
export function formatStamp(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    + ` · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Chữ "Updated <when>" ở chân trang chi tiết.
 * Dưới 1 phút → 'just now'; cùng ngày → 'today'; hôm trước → 'yesterday';
 * dưới 7 ngày → 'N days ago'; xa hơn → dấu thời gian đầy đủ.
 *
 * `now` truyền vào được để test không phụ thuộc đồng hồ máy.
 */
export function relativeUpdated(input, now = new Date()) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';

  if (now - d < 60_000) return 'just now';

  // So theo MỐC NGÀY địa phương, không theo số giờ chênh lệch: 23:50 hôm qua
  // cách 22:00 hôm nay 22 tiếng nhưng phải đọc là 'yesterday', không phải 'today'.
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);

  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatStamp(d);
}

/**
 * Sinh các dòng log từ chênh lệch giữa item gốc và bản draft đã sửa.
 * Đây là HÀNH VI CỐT LÕI của module: không có gì được âm thầm đổi mà không có
 * một dòng log.
 *
 * Thứ tự phát ra là thứ tự đọc, không phải thứ tự tuỳ ý:
 *   tiêu đề → ghi chú → từng field theo thứ tự MỚI (thêm / đổi tên / đổi loại
 *   / đổi giá trị) → field bị xoá → phương thức đăng nhập (thêm / đổi trạng
 *   thái / sửa ghi chú) → phương thức bị xoá → sheet mã được sinh lại.
 *
 * Field được ghép đôi theo `id`, không theo vị trí — đổi chỗ 2 field không sinh
 * ra hai dòng "updated" sai.
 *
 * @param {object} before  item gốc
 * @param {object} after   draft
 * @param {object} [ctx]
 * @param {Object<string,string>} [ctx.itemTitles]  { [itemId]: title } để tả link
 * @param {Object<string,string>} [ctx.authLabels]  { [kind]: label } nhãn phương thức
 * @return {Array<{text: string, detail: string}>}
 */
export function diffLog(before, after, { itemTitles = {}, authLabels = {} } = {}) {
  const out = [];
  const authLabel = (kind) => authLabels[kind] || kind;

  if (before.title !== after.title) {
    out.push({ text: 'Title changed', detail: `${before.title} → ${after.title}` });
  }
  if (before.notes !== after.notes) {
    out.push({ text: 'Notes edited', detail: '' });
  }
  // Đổi type là đổi NHÃN, không đổi field — nhưng vẫn phải vào log, nếu không
  // item tự nhiên đổi mã/chip mà History không giải thích được vì sao.
  if (before.tpl !== after.tpl) {
    out.push({ text: 'Item type changed', detail: `${before.tpl} → ${after.tpl}` });
  }
  const bg = normalizeGroup(before.group);
  const ag = normalizeGroup(after.group);
  if (bg !== ag) {
    out.push({ text: 'Group changed', detail: `${bg || 'Ungrouped'} → ${ag || 'Ungrouped'}` });
  }

  // ── Field ──
  const beforeFields = before.fields || [];
  const afterFields = after.fields || [];
  const fieldById = new Map(beforeFields.map((f) => [f.id, f]));

  // Mô tả một field link thành chuỗi đọc được, để so trước/sau bằng 1 phép ===
  const linkDesc = (f) => ((f.links || []).length
    ? f.links.map((L) => (itemTitles[L.itemId] || 'linked item') + (L.value ? ` · ${L.value}` : '')).join(', ')
    : (f.value || '(none)'));

  for (const f of afterFields) {
    const b = fieldById.get(f.id);

    if (!b) {
      out.push({ text: 'Field added', detail: `${f.label} · ${f.type}` });
      continue;
    }
    if (b.label !== f.label) {
      out.push({ text: 'Field renamed', detail: `${b.label} → ${f.label}` });
    }
    if (b.type !== f.type) {
      out.push({ text: `${f.label} type changed`, detail: `${b.type} → ${f.type}` });
    }

    if (f.type === 'multi') {
      const bv = (b.values || []).join(', ');
      const av = (f.values || []).join(', ');
      if (bv !== av) {
        out.push({ text: `${f.label} updated`, detail: `${bv || '(empty)'} → ${av || '(empty)'}` });
      }
    } else if (f.type === 'link') {
      if (linkDesc(b) !== linkDesc(f)) {
        out.push({ text: `${f.label} links changed`, detail: `${linkDesc(b)} → ${linkDesc(f)}` });
      }
      // Đổi loại liên kết đổi cả Roots lẫn Money links → phải có dòng log
      if (b.type === 'link' && linkKind(b) !== linkKind(f)) {
        out.push({ text: `${f.label} link kind changed`, detail: `${linkKind(b)} → ${linkKind(f)}` });
      }
    } else if (b.value !== f.value) {
      const secret = isSecretType(f.type);
      out.push({
        text: `${f.label}${secret ? ' changed' : ' updated'}`,
        detail: secret
          ? `${maskValue(b.value)} → ${maskValue(f.value)}`
          : `${b.value || '(empty)'} → ${f.value || '(empty)'}`,
      });
    }
  }

  const afterFieldIds = new Set(afterFields.map((f) => f.id));
  for (const f of beforeFields) {
    if (!afterFieldIds.has(f.id)) out.push({ text: 'Field removed', detail: f.label });
  }

  // ── Phương thức đăng nhập ──
  const beforeAuth = before.auth || [];
  const afterAuth = after.auth || [];
  const authById = new Map(beforeAuth.map((a) => [a.id, a]));

  for (const a of afterAuth) {
    const b = authById.get(a.id);

    if (!b) {
      out.push({ text: `${authLabel(a.kind)} added`, detail: a.note || '' });
      continue;
    }
    if (b.state !== a.state) {
      const verb = a.state === 'off' ? 'disabled' : a.state === 'primary' ? 'made primary' : 'enabled';
      out.push({ text: `${authLabel(a.kind)} ${verb}`, detail: a.note || '' });
    } else if (b.note !== a.note) {
      out.push({ text: `${authLabel(a.kind)} detail edited`, detail: `${b.note || ''} → ${a.note || ''}` });
    }
  }

  const afterAuthIds = new Set(afterAuth.map((a) => a.id));
  for (const a of beforeAuth) {
    if (!afterAuthIds.has(a.id)) out.push({ text: `${authLabel(a.kind)} removed`, detail: '' });
  }

  // ── Sheet mã ──
  // So số lượng, và so mã đầu tiên để bắt trường hợp sinh lại đúng bằng số cũ.
  // Đánh dấu một mã đã dùng KHÔNG chạy qua đây (nó được log ngay lúc bấm, ngoài
  // chế độ sửa) nên `used` cố ý không được so.
  const bc = before.codes || [];
  const ac = after.codes || [];
  if (bc.length !== ac.length || (ac[0] && bc[0] && ac[0].code !== bc[0].code)) {
    out.push({ text: 'Single-use codes regenerated', detail: `${ac.length} fresh codes` });
  }

  return out;
}
