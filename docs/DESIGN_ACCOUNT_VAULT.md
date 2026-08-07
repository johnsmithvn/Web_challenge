# DESIGN — Vault: mã hoá client-side (việc tương lai)

**Trạng thái:** 🧊 Backlog — thiết kế đã review kỹ, **CHƯA code**.

> **Phạm vi file này CHỈ còn phần mã hoá.** UI + metadata của vault đã làm xong ở v5.2.0 theo
> **bản thiết kế Keyplate** (bundle `design_handoff_keyplate_vault`) — mô tả trạng thái hiện tại ở
> `FEATURES.md §29`, `DATABASE.md`, `DESIGN.md § "Account vault"`. Phần thiết kế Account Vault
> "Phase A" cũ (bản tổ chức đơn giản, `account_relationships`, cột cứng, nhắc hạn đăng nhập) đã
> **bỏ khỏi file này** vì lỗi thời — nó tả một module chưa từng deploy và đã bị thay hoàn toàn.
>
> Giữ lại: thiết kế **envelope encryption** dưới đây — vẫn đúng, chỉ chưa tới lượt làm. Đây là mục
> "Not in the prototype" số một của bản handoff Keyplate: prototype không có persistence, mã hoá
> hay màn khoá.

---

## 0. Vì sao không dùng sẵn giải pháp có sẵn

Giữ lại để không đề xuất lại:

| Phương án | Vì sao loại |
|---|---|
| Bitwarden (secret) + Baserow tự host qua Tailscale (metadata) | Đúng nhưng cần 2 app + hạ tầng riêng (VPS/Docker/Tailscale). User muốn 1 app duy nhất. |
| Mã hoá "cho có" — key giải mã ở server (Vercel env) | Chỉ chống "DB leak mà server không bị đụng", **không** chống server/API bị compromise. |
| Đồng bộ với Vaultwarden qua API | Bitwarden **cố tình không có API đọc secret cho personal vault**; lách qua export/CLI = 2 nguồn sự thật. |
| Clone crypto của Bitwarden | Gắn chặt vào model tài khoản/tổ chức của họ; dính license GPL/AGPL. |

Kết luận: tự viết lõi mã hoá theo pattern chuẩn (`crypto.subtle`), zero-knowledge **đối với
database/server** — không tuyên bố tương đương Bitwarden về tổng thể (xem §4 rủi ro).

---

## 1. Nguyên tắc kiến trúc cốt lõi

1. **2 lớp dữ liệu, xử lý khác nhau, cùng trong Web_Update:**
   - **Metadata** (đang có ở v5.2.0: `account_fields.value` plaintext) → không nhạy cảm, để nguyên.
   - **Secret** (nhạy cảm) → mã hoá **client-side** trước khi gửi Supabase. Server không bao giờ
     thấy plaintext, không giữ key giải mã.

2. **Envelope encryption (KEK/DEK)** — không mã hoá thẳng bằng key derive từ passphrase:

   ```
   Vault passphrase
       ↓ KDF (Argon2id hoặc PBKDF2 — xem §5)
   KEK — Key Encryption Key
       ↓ unwrap
   Vault Key (DEK) — random, sinh 1 lần lúc setup
       ↓ encrypt
   Toàn bộ secret
   ```

   Lý do: đổi passphrase chỉ cần unwrap DEK bằng KEK cũ → derive KEK mới → wrap lại cùng DEK, không
   phải giải mã + mã hoá lại toàn bộ secret.

3. **Vault passphrase riêng** — khác mật khẩu đăng nhập Supabase Auth, không bao giờ gửi lên server.

4. **Không có cách khôi phục nếu quên passphrase** — chấp nhận, giống Bitwarden mất master password.
   Khác với "nghi bị lộ DEK" → phải rotate DEK (đắt hơn, tách khỏi việc đổi passphrase).

5. **Mỗi lần mã hoá phải có AAD, không chỉ nonce.** AES-GCM là AEAD — dùng `additionalData` gắn
   ciphertext vào đúng bản ghi (`user_id|account_id|secret_id|secret_type|encryption_version`).
   Thiếu AAD thì tráo ciphertext giữa 2 record vẫn "giải mã thành công" ở sai vị trí. AAD tái tạo
   được từ các cột của row, không lưu riêng.

6. **Không thêm dependency cho Web Crypto cơ bản.** `crypto.subtle` có sẵn, hỗ trợ `PBKDF2` +
   `AES-256-GCM`. Chỉ cần 1 thư viện WASM nhỏ nếu chọn Argon2id (xem §5).

7. **Session unlock, không luôn-mở.** DEK sau khi unwrap chỉ ở memory (React context) cho phiên
   hiện tại. Khoá lại = bỏ mọi reference + khoá UI. **Không hứa "xoá sạch khỏi RAM"** — JS không
   đảm bảo zero-out; best-effort ở tầng ứng dụng. (Header hiện ghi "no auto-lock yet".)

---

## 2. Data model bổ sung cho secret

Ở v5.2.0, giá trị secret nằm ở `account_fields.value` (plaintext, type `password`/`secret`). Khi
làm mã hoá, giá trị secret **chuyển sang bảng mã hoá riêng**, `account_fields` chỉ giữ `label` +
`type` làm placeholder tham chiếu (giá trị plaintext bị xoá).

### `account_secrets`

```sql
CREATE TABLE IF NOT EXISTS account_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  field_id UUID REFERENCES account_fields(id) ON DELETE CASCADE, -- field placeholder tương ứng
  secret_type TEXT NOT NULL,       -- password | secret | recovery_code | ...
  ciphertext TEXT NOT NULL,        -- base64, AES-256-GCM
  nonce TEXT NOT NULL,             -- base64, PHẢI unique mỗi lần encrypt
  encryption_version SMALLINT NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT true, -- false = bản lịch sử (chỉ ràng buộc với password)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_account_secrets_account ON account_secrets (account_id);
CREATE UNIQUE INDEX unique_current_password_per_field
  ON account_secrets (field_id)
  WHERE secret_type = 'password' AND is_current = true;
ALTER TABLE account_secrets ENABLE ROW LEVEL SECURITY;
-- 4 policy select/insert/update/delete, user_id = auth.uid()
```

**AAD:** build lại lúc encrypt/decrypt: `v{encryption_version}|{user_id}|{account_id}|{id}|{secret_type}`.

**Đổi mật khẩu chạy atomic** (Postgres function qua `supabase.rpc`, không 3 lời gọi client rời):
mark bản cũ `is_current=false` → insert ciphertext mới `is_current=true`. Lịch sử mật khẩu là các
dòng `is_current=false` — khớp với khối History append-only đã có (`account_logs`).

### `vault_config`

```sql
CREATE TABLE IF NOT EXISTS vault_config (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  kdf_algorithm TEXT NOT NULL DEFAULT 'PBKDF2',  -- 'PBKDF2' | 'Argon2id' — xem §5
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

**Unlock:** nhập passphrase → derive KEK → giải mã `verifier_ciphertext` → đúng → unwrap
`wrapped_vault_key` → có DEK → giữ trong memory cho session.
**Đổi passphrase (rẻ):** unwrap DEK bằng KEK cũ → derive KEK mới → wrap lại. Không đụng `account_secrets`.
**Rotate DEK khi nghi lộ (đắt):** sinh DEK mới → giải mã toàn bộ bằng DEK cũ → mã hoá lại bằng DEK mới.

---

## 3. Bảng phân loại field — plaintext vs encrypted

| Field | Xử lý |
|---|---|
| Tiêu đề item, nhãn field, URL, tag, ghi chú | Plaintext (`accounts`/`account_fields`) |
| Username / định danh đăng nhập | **Plaintext, có chủ đích** — cross-link risk thấp, cần browse nhanh không unlock |
| Cờ / loại phương thức đăng nhập (`account_auth`) | Plaintext — chỉ flag, không lưu seed thật |
| Câu hỏi **và** trả lời bảo mật | **Encrypted** — biết câu hỏi nào đang set cũng là trinh sát |
| Email/SĐT khôi phục là giá trị thô | **Encrypted** (kèm hint mask hiển thị không cần unlock) |
| Email khôi phục CHÍNH LÀ 1 item khác đang track | Là 1 **link** (`account_fields.links`), không phải secret |
| Mật khẩu + lịch sử, PIN, CVV, recovery code, API key | **Encrypted** |

---

## 4. Rủi ro đã xác nhận với user

- Tự viết + tự bảo trì lõi mã hoá — không có "hàng triệu người soi bug", chưa audit độc lập.
- Quên passphrase = mất toàn bộ secret vĩnh viễn, không nút khôi phục.
- Nonce reuse / thiếu AAD là lỗi **im lặng** — bắt buộc self-check (gồm test tráo ciphertext giữa 2
  record) trước khi tin dùng thật.
- Rủi ro ngoài tầm kiểm soát (giới hạn web-app cùng-origin): XSS ở tính năng khác lúc vault đang mở,
  dependency bị chèn mã độc, deploy frontend bị thay đổi ác ý ghi phím gõ passphrase. Đây là lý do
  **không** tuyên bố "tương đương Bitwarden".
- **Chưa sẵn sàng cho secret thật cho tới khi đủ vault operability**: export/restore, đổi passphrase,
  rotate DEK, migration `encryption_version`, phát hiện record hỏng.

---

## 5. Câu hỏi còn treo — quyết định lúc bắt đầu

- `TODO: decision needed` — PBKDF2-SHA256 ≥600k vòng (0 dependency) hay Argon2id (memory-hard, OWASP
  khuyến nghị, cần 1 thư viện WASM nhỏ)? Nghiêng Argon2id.
- `TODO: decision needed` — Auto-lock sau bao lâu không thao tác? (đề xuất 15 phút.)

---

## 6. Trình tự triển khai

- **B1 — Crypto core:** `vault_config` + Web Crypto layer (KDF + AES-GCM + AAD) + `account_secrets`
  + unlock modal / vault provider / secret field. Có self-check/test.
- **B2 — Vault operability (bắt buộc trước khi nhập secret thật):** export ciphertext, restore, đổi
  passphrase, rotate DEK, migration `encryption_version`, phát hiện record hỏng.
- **Làm B1 + B2 liền một đợt** — không bật crypto từng phần (mất passphrase mà chưa có export = mất
  trắng). Xong B1 **và** B2 mới gỡ banner "chưa mã hoá" ở `/accounts`.
- **B3 (sau):** auto-lock timer, TOTP thật cho phương thức authenticator, clipboard auto-clear.
