/**
 * vaultLogic — logic thuần của Account Vault v2 (thiết kế Keyplate).
 *
 * Tách khỏi React/Supabase để chạy test bằng node:assert (xem
 * src/__tests__/vaultLogic.test.js), cùng lý do như taskFields.js.
 * KHÔNG import JSON, KHÔNG import React — file này phải chạy được bằng `node`.
 *
 * Shape dữ liệu ở đây là shape của ĐẶC TẢ, không phải shape của DB:
 *   Item  { id, tpl, title, fields[], notes, tags[], favorite, updated, auth[], codes[], log[] }
 *   Field { id, label, type, value, values[], links[] }
 *   Link  { id, itemId, value }
 *   Auth  { id, kind, note, state: 'primary'|'on'|'off' }
 *   Code  { id, code, used }
 *   Log   { id, at, text, detail }
 * Tầng hook (useAccounts) chịu trách nhiệm map DB ↔ shape này:
 *   accounts.service_name → title · account_fields.multi_values → values
 *   account_logs.logged_at → at
 * Làm vậy để mọi component và mọi hàm dưới đây trùng khít đặc tả, đổi lại 1
 * hàm map duy nhất nằm trong hook — rẻ hơn là để shape lệch nhau ở 8 chỗ.
 */

/**
 * 10 loại field. `value` là giá trị máy dùng, `label` là chữ hiển thị.
 *
 * ⚠️ NGUỒN DUY NHẤT của danh sách này. Phải khớp CHECK constraint
 *    `account_fields_type_check` trong data/migration_v5.2.0_vault.sql —
 *    gõ lệch là insert fail lúc runtime.
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
const SUBTITLE_LABELS = [
  'Primary email', 'Username', 'Emails', 'Email',
  'Network (SSID)', 'Service', 'Full name', 'Host', 'Product',
];

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
 * @return {Array<{value: string, label: string}>} phần tử đầu luôn là "— whole item —"
 */
export function linkableValues(target) {
  const out = [{ value: '', label: '— whole item —' }];
  if (!target) return out;

  for (const f of target.fields || []) {
    if (isSecretType(f.type)) continue;

    if (f.type === 'multi') {
      for (const v of f.values || []) {
        if (v) out.push({ value: v, label: `${f.label}: ${v}` });
      }
    } else if (f.value && ['email', 'phone', 'text', 'url'].includes(f.type)) {
      out.push({ value: f.value, label: `${f.label}: ${f.value}` });
    }
  }
  return out;
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

/** Hostname gọn để hiển thị: "https://www.google.com/x" → "google.com". */
export function urlHost(input) {
  const url = normalizeUrl(input);
  return url ? new URL(url).hostname.replace(/^www\./, '') : '';
}

/**
 * URL của một item = field `url` đầu tiên có giá trị (template login/account có
 * field "Website"). Không cần cột riêng trên `accounts`.
 */
export function itemUrl(item) {
  const f = (item?.fields || []).find((x) => x.type === 'url' && x.value?.trim());
  return f ? normalizeUrl(f.value) : null;
}

/**
 * Ứng viên icon của website, thử theo thứ tự chất lượng giảm dần.
 *
 * ⚠️ CỐ Ý chỉ gọi trực tiếp domain của chính dịch vụ đó — KHÔNG dùng
 *    google.com/s2/favicons, icons.duckduckgo.com, Clearbit hay logo.dev:
 *    đây là vault, gửi danh sách domain mình có tài khoản cho MỘT bên thứ ba là
 *    tự khai mình dùng dịch vụ nào (ngân hàng nào, sàn crypto nào).
 *    Gọi trực tiếp thì domain đó chỉ biết IP này xin favicon của họ — mà họ vốn
 *    đã biết IP này vào site họ.
 *
 * Đổi lại: nhiều site không có `apple-touch-icon.png` → rơi về `favicon.ico` →
 * rơi về plate chữ cái. **Ảnh hỏng là trạng thái bình thường, không phải lỗi.**
 */
export function faviconCandidates(input) {
  const url = normalizeUrl(input);
  if (!url) return [];
  const { origin } = new URL(url);
  return [`${origin}/apple-touch-icon.png`, `${origin}/favicon.ico`];
}

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
