# DESIGN — Account Vault Module (Hồ Sơ Tài Khoản Cá Nhân)

**Trạng thái:** 🧊 Backlog — đã chốt ý tưởng + kiến trúc, **CHƯA code**.
**Ngày chốt ý tưởng:** 2026-08-01 · **Review lần 2:** 2026-08-01 (envelope encryption, AAD) ·
**Review lần 3:** 2026-08-01 (xem cấu trúc Excel thật → thu hẹp phạm vi v1, xem Phần A)
**Điều kiện bắt đầu triển khai:** Xem mục 0.

> File này là bản ghi đầy đủ ý tưởng + quyết định kiến trúc cho module mới, để không mất
> ngữ cảnh giữa lúc chốt ý tưởng và lúc thật sự bắt tay code. Không phải tài liệu mô tả
> tính năng đã tồn tại — khác với `FEATURES.md`/`ARCHITECTURE.md`/`DATABASE.md` (mô tả
> trạng thái hiện tại của app).
>
> **Cấu trúc file:** Phần A là bản **sắp triển khai thật** (đơn giản, không crypto). Phần B
> là bản **vault đầy đủ, giai đoạn sau** (mã hoá client-side) — giữ nguyên thiết kế đã review
> kỹ ở lần 2, chỉ lùi lịch, không bỏ.

---

## 0. Điều kiện bắt đầu triển khai

Chưa code cho tới khi xong hết các việc đang ưu tiên hơn (theo `docs/TASKS.md` tại thời điểm
viết file này):

- [ ] Subtask (`parent_id`) — 6 chỗ vỡ đã liệt kê ở `TASKS.md` v4.27.0/v4.28.0
- [ ] `task_tags` UI (TagPicker trên task card)
- [ ] Chạy xong migration SQL v4.28.0 + v5.0.0 (B0→B6)
- [ ] Chốt các `TODO: decision needed` còn treo (P2-7 gộp `knowledge_groups`, xoá fallback
      migration, retry `spawnRecurringTask`)
- [ ] Dọn dead code / lỗi hiện có trong Task + Knowledge Base

Lý do: quyết định chiến lược 2026-07-29 đã chốt thu hẹp trọng tâm về Inbox → Knowledge →
Tasks → Finance. Account Vault là mở rộng phạm vi có chủ đích (nhu cầu thật, không phải
feature creep), nhưng vẫn xếp sau, không chen ngang việc đang dở. Điều kiện này áp dụng cho
cả Phần A (đơn giản) — dù rủi ro thấp hơn nhiều, vẫn không chen ngang việc đang làm.

---

## 1. Bối cảnh & lịch sử quyết định

Nhu cầu gốc: **không phải password manager thuần** — là một nơi quản lý "hồ sơ số" của từng
tài khoản (không chỉ user/pass): email/SĐT khôi phục, câu hỏi bảo mật, ngày tháng, lịch sử
mật khẩu, liên kết giữa các tài khoản, nhắc nhở đăng nhập, dùng được trên điện thoại.

**Phương án đã cân nhắc và loại bỏ** (giữ lại lý do, để không đề xuất lại):

| Phương án | Vì sao loại |
|---|---|
| Bitwarden (secrets) + Baserow tự host qua Tailscale (metadata) | Đúng nhưng cần 2 app + hạ tầng riêng (VPS/Docker/Tailscale). User muốn 1 app duy nhất, không muốn phụ thuộc thêm hệ thống ngoài. |
| Mã hoá "cho có" — key giải mã giữ ở server (Vercel env var) | Chỉ chống được kịch bản "DB leak ra ngoài mà server không bị đụng", **không** chống được server/API bị compromise. Không đạt mức Bitwarden dù nhìn giống. |
| Đồng bộ app riêng với Vaultwarden qua API | Bitwarden **cố tình không có API đọc secret cho personal vault**. Cố lách qua export/CLI tái tạo đúng vấn đề "2 nguồn sự thật" đã bị loại ở tài liệu gốc. |
| Clone code Bitwarden | Crypto của họ gắn chặt vào model tài khoản/tổ chức riêng, tách ra tốn công hơn tự viết theo pattern chuẩn. Dính license GPL/AGPL. |
| Schema cột cứng cho account (login_url, login_identifier, has_2fa, two_fa_type... cố định) | **Loại ở review lần 3** — xem Excel thật của user cho thấy field thực tế đa dạng hơn nhiều (số tài khoản ngân hàng, số thẻ, mã dự phòng dạng list, ghi chú tự do...), enum cố định liên tục phải ALTER thêm loại mới. |
| Làm crypto đầy đủ (envelope encryption/AAD/rotate/export) ngay từ v1 | **Loại ở review lần 3** — user tự nhận xét thiết kế đang "phức tạp quá" so với nhu cầu hiện tại (chỉ cần tổ chức/search/nhắc nhở). Giữ lại thiết kế (đã review kỹ, không sai) nhưng lùi sang Phần B, làm sau khi Phần A chứng minh hữu ích. |

**Review lần 3 (2026-08-01) — sau khi xem cấu trúc Excel thật của user:** nhu cầu hiện tại chỉ
là lưu + phân loại + search + nhắc nhở, KHÔNG phải vault mã hoá hoàn chỉnh ngay. Quyết định:
tách thành 2 phần độc lập, triển khai Phần A trước, Phần B để dành khi nào thật sự cần "1 app
duy nhất giữ cả secret thật".

---

# PHẦN A — V1: Bản tổ chức đơn giản (không crypto, sắp triển khai trước)

## A.1. Quyết định thu hẹp phạm vi

Từ Excel thật của user, quan sát được:
- 1 dịch vụ (vd "Google", "Milion Live") thường có **nhiều account** xếp cạnh nhau, phân biệt
  bằng 1 nhãn ngắn ("Acc phụ"/"Acc 1", hay theo ngôn ngữ "jp"/"eng").
- Field mỗi account **không cố định**: có account chỉ Tài khoản/Pass/Email, có account thêm
  Số tài khoản ngân hàng, PIN Smart OTP, Mã dự phòng (danh sách dài), ghi chú tự do.
- Liên kết giữa các dịch vụ hiện chỉ ghi bằng chữ ("Email: của github").
- Nhóm nền tảng (vd "Android") chỉ là 1 lớp phân loại, không phải field riêng của account.

**Quyết định:**
1. Bỏ enum field cố định (`login_url`, `two_fa_type`,...) → thay bằng **danh sách field tự do**
   (label + value) theo từng account, đúng cách user đang gõ trong Excel.
2. Thêm `account_label` để phân biệt nhiều account cùng 1 `service_name`.
3. Nhóm nền tảng/danh mục → dùng `tags` có sẵn, không thêm cột.
4. **Field bí mật thật (mật khẩu, PIN ngân hàng, số thẻ, mã dự phòng, câu trả lời bảo mật)
   KHÔNG vào Supabase ở v1** — vẫn giữ ở Excel/Bitwarden như hiện tại, chưa migrate. Quyết
   định này do user chọn (không phải Claude tự quyết) sau khi được giải thích RLS chỉ chặn
   "người khác đọc trộm", không chặn được session của chính user bị chiếm, DB bị lộ trực
   tiếp, hay app có bug — 3 kịch bản khiến plaintext trong Supabase thành rủi ro thật.
5. `is_secret` trên field vẫn có trong schema (cho tương lai), nhưng ở v1 **chỉ là cờ ẩn/hiện
   UI** (vd tránh lộ khi chia sẻ màn hình), **không mã hoá gì cả** — không dùng cờ này để tự
   trấn an rằng field đó "đã an toàn". Không nhập mật khẩu/PIN ngân hàng thật vào field có
   `is_secret=true` ở giai đoạn này.

## A.2. Schema v1

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,   -- "Google", "Milion Live", "AZU Lane", "TP Bank"...
  account_label TEXT,           -- phân biệt nhiều account cùng service: "Acc phụ", "Acc 1", "jp", "eng"
  status TEXT NOT NULL DEFAULT 'active', -- active / rarely / closed
  required_cycle_days INT,      -- để trống nếu không có hạn — vd "cần đăng nhập mỗi" trong Excel
  last_login_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_accounts_user ON accounts (user_id);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
-- 4 policy select/insert/update/delete, user_id = auth.uid() — pattern y hệt `subscriptions`

CREATE TABLE IF NOT EXISTS account_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,          -- tự đặt: "Email khôi phục", "Điện thoại", "Số tài khoản", "Ghi chú"...
  value TEXT,                   -- plaintext — KHÔNG dùng cho secret thật (xem A.1 mục 4)
  is_secret BOOLEAN NOT NULL DEFAULT false, -- chỉ ẩn/hiện UI ở v1, KHÔNG mã hoá (xem A.1 mục 5)
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_account_fields_account ON account_fields (account_id);
ALTER TABLE account_fields ENABLE ROW LEVEL SECURITY;
-- 4 policy select/insert/update/delete, user_id = auth.uid()

-- account_relationships: giữ nguyên từ thiết kế gốc, thuần metadata, không phải secret —
-- xem B.2 để không lặp lại, đưa vào Phần A vì không cần crypto để dùng được.
```

Danh mục/nền tảng (vd "Android", "Ngân hàng", "MXH") → tag qua `tags` + `account_tags`
(junction đúng pattern `expense_tags`/`collection_tags`), không thêm cột.

## A.3. UI/UX v1

- Route `/accounts`, lazy-load như `/tasks`.
- List: card theo `service_name` + `account_label`, filter theo tag, search theo
  `service_name`/`account_label`/field không secret.
- Form thêm/sửa account: `service_name`, `account_label`, tag, `required_cycle_days`,
  `last_login_date`, `notes` — dùng `CustomSelect`/`DatePickerPopover`/`TagPicker` có sẵn.
- Form field tự do: danh sách dòng `label + value + checkbox is_secret`, nút "+ Thêm dòng" —
  đúng cách user gõ Excel, không giới hạn số field, không enum cố định.
- Field `is_secret=true` hiển thị dạng ẩn (••••, bấm để hiện) — chỉ để tránh lộ khi
  screenshot/share màn hình, không phải bảo vệ thật.
- Nhắc nhở: widget `AccountAlert.jsx` rập `SubAlert.jsx` (xem `src/hooks/useSubscriptions.js`
  làm mẫu) — "N tài khoản cần đăng nhập lại" dựa trên `required_cycle_days`/`last_login_date`.
  Tuỳ chọn: nút tạo Task nhắc qua `useUserTasks().addTask()` có sẵn (`recurrence_rule` weekly,
  tận dụng Service Worker push đã có ở `public/sw.js`) — nội dung task chỉ ghi tên dịch vụ.
- Trang chi tiết account: hiện field tự do + quan hệ (`account_relationships`, xem B.2) 2
  chiều.

## A.4. Cố ý KHÔNG làm ở Phần A

- Bất kỳ hình thức mã hoá nào (đó là Phần B).
- Nhập secret thật (mật khẩu, PIN, số thẻ, mã dự phòng, câu trả lời bảo mật) — giữ nguyên ở
  Excel/Bitwarden.
- File đính kèm.
- Chia sẻ/phân quyền nhiều người, autofill/browser extension, push notification ngoài SW sẵn có.

---

# PHẦN B — Vault đầy đủ (mã hoá client-side, giai đoạn sau)

> Chỉ làm khi user chủ động quyết định đưa secret thật vào app (thay Bitwarden hẳn), sau khi
> Phần A đã chứng minh hữu ích trong dùng thực tế. Thiết kế dưới đây đã qua review lần 2,
> **giữ nguyên**, không phải làm lại — chỉ lùi lịch.

## B.1. Nguyên tắc kiến trúc cốt lõi

1. **2 lớp dữ liệu, xử lý khác nhau, cùng nằm trong Web_Update:**
   - Lớp **metadata** (Phần A, không nhạy cảm) → plaintext.
   - Lớp **secret** (nhạy cảm) → mã hoá **client-side** trước khi gửi lên Supabase. Server
     không bao giờ thấy plaintext, không giữ key giải mã. Đây là zero-knowledge **đối với
     database/server** — không phải tuyên bố tương đương Bitwarden về tổng thể.

2. **Envelope encryption (KEK/DEK) — không mã hoá trực tiếp bằng key derive từ passphrase:**

   ```
   Vault passphrase
       ↓ KDF (Argon2id hoặc PBKDF2 — xem B.5)
   KEK — Key Encryption Key
       ↓ unwrap
   Vault Key (DEK) — random, sinh 1 lần lúc setup vault
       ↓ encrypt
   Toàn bộ secret
   ```

   Lý do: nếu mã hoá thẳng bằng key derive từ passphrase, đổi passphrase phải giải mã + mã
   hoá lại toàn bộ password/PIN/recovery code/lịch sử. Với envelope encryption, đổi passphrase
   chỉ cần unwrap DEK bằng KEK cũ, derive KEK mới, wrap lại cùng DEK — không đụng tới secret
   nào.

3. **Vault passphrase riêng** — khác hẳn mật khẩu đăng nhập Supabase Auth. Không bao giờ gửi
   lên server dưới bất kỳ hình thức nào.

4. **Không có cách khôi phục nếu quên vault passphrase** — chấp nhận rủi ro này, giống hệt
   cách Bitwarden xử lý mất master password. Khác với "**nghi bị lộ** DEK" — trường hợp đó
   cần rotate DEK (mã hoá lại toàn bộ secret bằng DEK mới), một quy trình tốn kém hơn và tách
   biệt khỏi việc đổi passphrase.

5. **Mỗi lần mã hoá phải có AAD (additional authenticated data), không chỉ nonce.** AES-GCM
   là AEAD cipher — dùng `additionalData` để gắn ciphertext vào đúng bản ghi
   (`user_id|account_id|secret_id|secret_type|encryption_version`). Không có AAD thì kẻ tấn
   công tráo ciphertext giữa 2 record khác nhau vẫn "giải mã thành công" — chỉ mở ra sai
   secret ở sai vị trí thay vì báo lỗi. AAD không cần lưu riêng — tái tạo được từ chính các
   cột của row lúc encrypt/decrypt.

6. **Không thêm dependency bắt buộc cho phần Web Crypto cơ bản.** `crypto.subtle` có sẵn
   trong mọi trình duyệt hiện đại, hỗ trợ trực tiếp `PBKDF2` + `AES-256-GCM`. Riêng KDF có
   thể cần 1 dependency nhỏ nếu chọn Argon2id thay PBKDF2 (OWASP khuyến nghị Argon2id cho ứng
   dụng mới nhờ memory-hardness chống GPU tốt hơn — xem B.5, quyết định lúc bắt đầu code).

7. **Session unlock, không phải luôn-mở:** DEK sau khi unwrap chỉ tồn tại trong memory (React
   context) cho phiên hiện tại. Khi khoá lại, app bỏ mọi reference tới key và secret đã giải
   mã, đồng thời khoá UI. **Không hứa "xoá sạch khỏi RAM"** — JavaScript không đảm bảo
   zero-out bộ nhớ vật lý. Đây là best-effort ở tầng ứng dụng.

## B.2. Data model bổ sung cho secret

### `account_relationships` — quan hệ giữa các account (dùng được ngay ở Phần A, không cần crypto)

Một account có thể đăng nhập bằng Google **và** khôi phục bằng Outlook **và** phụ thuộc nhiều
tài khoản khác cùng lúc — cần bảng quan hệ M:N, không phải 1 cột tự trỏ đơn.

```sql
CREATE TABLE IF NOT EXISTS account_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL, -- login_via | recovery_via_account | owner | linked_service | billing_account
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (source_account_id <> target_account_id),
  UNIQUE (source_account_id, target_account_id, relationship_type)
);
CREATE INDEX idx_account_rel_source ON account_relationships (source_account_id);
CREATE INDEX idx_account_rel_target ON account_relationships (target_account_id);
ALTER TABLE account_relationships ENABLE ROW LEVEL SECURITY;
-- 4 policy select/insert/update/delete, user_id = auth.uid()
```

Chỉ dùng cho quan hệ **account-to-account thật** (cả 2 đầu đều là 1 row trong `accounts`, vd
"GitHub đăng nhập bằng Google chính"). Giá trị email/SĐT khôi phục không phải account đang
track thì vào `account_secrets` (dưới đây), không tạo "account giả" ở bảng này.

### `account_secrets` — secret, mã hoá client-side

```sql
CREATE TABLE IF NOT EXISTS account_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  secret_type TEXT NOT NULL,       -- password | pin | recovery_code | security_qa | recovery_email | recovery_phone | api_key
  ciphertext TEXT NOT NULL,        -- base64, AES-256-GCM output
  nonce TEXT NOT NULL,             -- base64, PHẢI unique mỗi lần encrypt
  encryption_version SMALLINT NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true, -- false = bản lịch sử cũ (chỉ ràng buộc unique với secret_type='password')
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_account_secrets_account ON account_secrets (account_id);

CREATE UNIQUE INDEX unique_current_password_per_account
  ON account_secrets (account_id)
  WHERE secret_type = 'password' AND is_current = true;

ALTER TABLE account_secrets ENABLE ROW LEVEL SECURITY;
-- 4 policy select/insert/update/delete, user_id = auth.uid()
```

**AAD:** build lại lúc encrypt/decrypt: `v{encryption_version}|{user_id}|{account_id}|{id}|{secret_type}`,
truyền vào `additionalData` của `crypto.subtle.encrypt`/`decrypt`.

**Đổi mật khẩu phải chạy atomic (transaction)** — gói trong 1 Postgres function gọi qua
`supabase.rpc(...)`, không phải 3 lời gọi `.update()`/`.insert()` riêng lẻ từ client:
1. Mark bản cũ `is_current = false`
2. Insert ciphertext mới `is_current = true`
3. Update `accounts.last_password_change_date` (chuyển field này từ `account_fields` sang cột
   riêng khi tới Phần B, vì cần tính toán/nhắc nhở)

**Di chuyển field từ Phần A sang Phần B:** field nào ở `account_fields` đang `is_secret=true`
và user muốn mã hoá thật, giá trị được chuyển sang `account_secrets` (mã hoá), rồi xoá giá trị
plaintext ở `account_fields` (chỉ giữ `label` làm placeholder tham chiếu).

### `vault_config` — envelope encryption + xác thực passphrase

```sql
CREATE TABLE IF NOT EXISTS vault_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kdf_algorithm TEXT NOT NULL DEFAULT 'PBKDF2',  -- 'PBKDF2' | 'Argon2id' — xem B.5
  kdf_params JSONB NOT NULL,
  kdf_salt TEXT NOT NULL,
  wrapped_vault_key TEXT NOT NULL,
  wrapped_vault_key_nonce TEXT NOT NULL,
  verifier_ciphertext TEXT NOT NULL,
  verifier_nonce TEXT NOT NULL,
  encryption_version SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vault_config ENABLE ROW LEVEL SECURITY;
-- 4 policy select/insert/update/delete, user_id = auth.uid()
```

**Unlock:** nhập passphrase → derive KEK → thử giải mã `verifier_ciphertext` → đúng → unwrap
`wrapped_vault_key` → có DEK → giữ trong memory cho session.

**Đổi passphrase (rẻ):** unwrap DEK bằng KEK cũ → derive KEK mới → wrap lại cùng DEK. Không
đụng `account_secrets`.

**Rotate DEK khi nghi bị lộ (đắt):** sinh DEK mới → giải mã toàn bộ bằng DEK cũ, mã hoá lại
bằng DEK mới → wrap bằng KEK hiện tại → cập nhật mọi row `account_secrets` + `vault_config`.

## B.3. Bảng phân loại field — plaintext vs encrypted

| Field | Xử lý | Ghi chú |
|---|---|---|
| Tên dịch vụ, nhãn account, URL, danh mục, trạng thái, chu kỳ, ngày login cuối, ghi chú | Plaintext (`accounts`, Phần A) | |
| `login_identifier`/username đăng nhập cho dịch vụ đó | **Plaintext, có chủ đích** | Cross-link risk thấp hơn recovery contact, cần browse nhanh không unlock |
| Cờ 2FA + loại | Plaintext | Chỉ flag, không lưu seed thật |
| **Câu hỏi VÀ câu trả lời bảo mật** | **Encrypted** (`secret_type='security_qa'`) | Biết câu hỏi nào đang set cũng là tín hiệu trinh sát — encrypt cả 2 |
| **Email/SĐT khôi phục là giá trị thô** | **Encrypted** (`recovery_email`/`recovery_phone`) | Kèm hint mask hiển thị không cần unlock |
| Email khôi phục CHÍNH LÀ 1 account khác đang track | `account_relationships` | `relationship_type='recovery_via_account'` |
| **Mật khẩu hiện tại + lịch sử, PIN, recovery code, API key** | **Encrypted** | |
| File đính kèm chứa secret | Chưa thiết kế | Hoãn xa hơn nữa |
| Cookie/token sống | Không làm | YAGNI |

## B.4. Rủi ro đã xác nhận với user

- Tự viết + tự bảo trì lõi mã hoá — không có "hàng triệu người soi bug" như Bitwarden, chưa
  có audit độc lập.
- Quên vault passphrase = mất toàn bộ secret vĩnh viễn, không có nút khôi phục.
- Nonce reuse hoặc thiếu AAD là lỗi **im lặng** — bắt buộc self-check/test tối thiểu (bao gồm
  test tráo ciphertext giữa 2 record) trước khi tin dùng thật.
- Rủi ro còn lại ngoài tầm kiểm soát (giới hạn kiến trúc web-app cùng-origin): XSS ở tính năng
  khác trong Web_Update lúc vault đang mở, dependency bị chèn mã độc, deploy frontend bị thay
  đổi ác ý ghi lại phím gõ passphrase. Đây là lý do không tuyên bố "tương đương Bitwarden".
- **Chưa sẵn sàng cho secret thật cho tới khi có đủ vault operability** (xem Phase 2b, mục 10):
  export/restore, đổi passphrase, rotate DEK, migration `encryption_version`, phát hiện record
  hỏng.

## B.5. Câu hỏi còn treo — quyết định lúc bắt đầu Phần B

- `TODO: decision needed` — PBKDF2-SHA256 ≥600k vòng (0 dependency) hay Argon2id (memory-hard,
  OWASP khuyến nghị cho ứng dụng mới, cần 1 thư viện WASM nhỏ)? Đề xuất nghiêng Argon2id.
- `TODO: decision needed` — Thời gian tự khoá vault sau bao lâu không thao tác? (đề xuất 15 phút)
- `TODO: version decision needed` — MINOR hay MAJOR theo `RULES.md` §9?

---

## 10. Trình tự triển khai tổng thể

- **Phase A1** — Bảng `accounts` (schema v1, mục A.2) + `account_fields` + `account_relationships`
  + hook `useAccounts.js` (rập `useSubscriptions.js`) + UI CRUD (mục A.3). Không crypto.
- **Phase A2** — `AccountAlert` widget + tích hợp nút tạo Task nhắc nhở.
- *(Dừng ở đây cho tới khi user quyết định muốn Phần B)*
- **Phase B1 — Crypto core:** `vault_config` + Web Crypto layer (KDF + AES-GCM + AAD) +
  `account_secrets` + `VaultUnlockModal`/`VaultProvider`/`SecretField`. Có self-check/test.
- **Phase B2 — Vault operability (bắt buộc trước khi nhập secret thật):** export vault đã mã
  hoá, restore, đổi passphrase, rotate DEK, migration `encryption_version`, phát hiện record
  hỏng.
- **Phase B3** — UI duyệt quan hệ 2 chiều, UI lịch sử mật khẩu.
- **Phase B4** (sau, tuỳ nhu cầu thật) — File đính kèm mã hoá.

Mỗi phase = 1 commit độc lập, `npm run build` xanh trước khi qua phase sau. **Không nhập dữ
liệu secret thật vào Supabase ở bất kỳ Phase A nào — chỉ dữ liệu giả để verify UI**, đúng như
user đã xác nhận (dùng dữ liệu test, chờ hoàn thành mới paste dữ liệu thật).
