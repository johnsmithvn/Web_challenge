# DESIGN — Vault v6.2 full-content encryption

**Trạng thái:** ✅ code + local DB + automated tests + authenticated browser/RLS smoke đã xong.
**Production:** ⏳ chưa áp dụng; user tự chạy migration/deploy theo README.

Vault v6.2 thay thiết kế mã hóa chọn lọc trước đây. Không còn `account_secrets`, không giữ title,
username, URL, notes, tags hoặc log ở plaintext. Mỗi account là **một JSON payload được mã hóa toàn bộ**
trên trình duyệt trước khi gửi Supabase.

---

## 1. Phạm vi được mã hóa

Payload schema v1 của một account gồm:

```text
schema
title
tpl
favorite
notes
tags[]
fields[]        # label, type, value, multi-values, links
auth[]          # loại, ghi chú, trạng thái primary/on/off
codes[]         # mã dự phòng và trạng thái used
log[]           # nội dung history/diff log
```

Tất cả các giá trị trên nằm trong cùng `encrypted_payload`. Vì vậy database không biết user lưu dịch
vụ nào, username nào, URL nào, dùng tag gì hoặc đã thay đổi gì. Search/filter chỉ chạy phía client sau
khi Vault được unlock và payload đã giải mã.

Các cột kỹ thuật vẫn plaintext vì server cần chúng cho ownership và CRUD:

```text
accounts.id
accounts.user_id
accounts.encrypted_payload
accounts.encryption_nonce
accounts.encryption_version
accounts.created_at
accounts.updated_at
```

Supabase vẫn suy ra được số lượng item, chủ sở hữu, kích thước ciphertext và thời điểm tạo/sửa. Full-
content encryption không che được metadata vận hành đó.

---

## 2. Envelope encryption đã triển khai

```text
Vault passphrase (không gửi server)
        │
        │ PBKDF2-SHA256, 600.000 vòng, salt 16 byte/user
        ▼
KEK 256-bit
        │ AES-GCM unwrap
        ▼
DEK 256-bit ngẫu nhiên/user
        │ AES-GCM encrypt/decrypt
        ▼
Một encrypted JSON cho mỗi account
```

- Passphrase riêng với Supabase Auth, tối thiểu 12 ký tự; không lưu vào database hay browser storage.
- PBKDF2-SHA256 600.000 vòng dùng Web Crypto native, không thêm dependency.
- Mỗi user có một DEK ngẫu nhiên. Database chỉ lưu DEK đã được KEK bọc trong `vault_config`.
- DEK đã unwrap chỉ nằm trong memory (`useRef`) của phiên hiện tại; không lưu `localStorage`, session
  storage hoặc Supabase.
- Mỗi lần tạo/sửa account sinh nonce AES-GCM 12 byte mới và ghi lại toàn bộ payload ciphertext.
- AES-GCM vừa mã hóa vừa xác thực; ciphertext/AAD bị sửa hoặc tráo item sẽ không giải mã được.

### AAD

Wrapped DEK được gắn với đúng user và version:

```text
vault-key|v{version}|{user_id}
```

Mỗi account payload được gắn với đúng user, item và version:

```text
vault-item|v{version}|{user_id}|{item_id}
```

Do đó copy ciphertext sang user khác, đổi `id`, đổi version hoặc sửa ciphertext đều fail authentication.

---

## 3. Data model v6.2

### `accounts`

Sau cutover, bảng chỉ còn ownership/timestamps và ba cột crypto:

```sql
encrypted_payload  TEXT NOT NULL
encryption_nonce   TEXT NOT NULL
encryption_version SMALLINT NOT NULL DEFAULT 1
```

Các bảng plaintext cũ `account_fields`, `account_auth`, `account_codes`, `account_logs` và
`account_tags` bị bỏ. Vault tags nằm trong ciphertext, nên `tagged_items` không còn nhánh `account`.

### `vault_config`

Một dòng cho mỗi authenticated user:

```text
user_id
kdf_algorithm       # PBKDF2-SHA256
kdf_salt
kdf_iterations      # 600000 hiện tại; DB chấp nhận 600000..5000000
wrapped_key
wrapped_key_nonce
encryption_version  # 1
created_at
updated_at
```

Passphrase, KEK và raw DEK **không được lưu**. Bảng bật RLS own-row; authenticated chỉ được
SELECT/INSERT vì app v6.2 chưa có đổi/xóa config. `anon` không có quyền. Migration revoke ACL mặc
định rộng trước khi grant để không sót TRUNCATE/REFERENCES/TRIGGER ngoài RLS.

---

## 4. Trạng thái và luồng UI

Vault có các trạng thái thực tế:

- `signed-out`: yêu cầu đăng nhập.
- `loading`: đang đọc `vault_config`.
- `setup`: user chưa có config; nhập + xác nhận passphrase để tạo KEK/DEK.
- `locked`: có config nhưng DEK chưa ở memory.
- `unlocked`: DEK ở memory; mới tải/giải mã và cho CRUD item.
- `error`: schema/config không đọc được; không mở fallback plaintext.

Luồng phiên:

1. Setup tạo config và mở Vault lần đầu.
2. Lần sau, passphrase derive lại KEK để unwrap DEK. Passphrase sai hoặc config hỏng đều fail đóng.
   Nếu config mất trong khi còn ciphertext, app hard-error và tuyệt đối không tạo DEK mới.
3. Manual lock xóa reference đến DEK và xóa item đã giải mã khỏi React state.
4. Sign-out và reload cũng làm mất DEK, nên Vault trở lại locked.
5. Password generator đã bật; password sinh ra chỉ đi qua encrypted CRUD.

Không tuyên bố zero-out RAM tuyệt đối: JavaScript runtime không bảo đảm xóa vật lý mọi bản sao trong
memory. Đây là best-effort ở tầng ứng dụng.

---

## 5. Ghi dữ liệu và xử lý lỗi

- `create`: client tạo UUID trước, dựng payload, mã hóa với AAD chứa UUID rồi mới INSERT ciphertext.
- `update`, favorite, auth state, code used và history: sửa bản giải mã trong memory rồi mã hóa/UPDATE
  lại toàn bộ payload trong một row. UPDATE kèm `updated_at` đã đọc làm revision; nếu row không còn
  khớp thì báo conflict, không ghi đè thay đổi từ tab/device khác.
- `delete`: xóa đúng row theo `id`, `user_id` và revision `updated_at`.
- Sau write thành công, hook dùng chính plaintext vừa mã hóa + timestamp server trả về để cập nhật
  state; không refetch snapshot có thể cũ.
- Mọi config/fetch/mutation giữ epoch phiên. Lock, sign-out, đổi user hoặc fetch mới làm request cũ
  mất quyền commit ref/state/finally, nên plaintext không thể quay lại UI sau khi khóa.
- Khi một item hỏng, các item giải mã được vẫn hiển thị; item hỏng không bị sửa/xóa và UI báo số item
  không mở được.
- Không có fallback đọc/ghi schema plaintext. Thiếu schema v6.2 đưa UI về error thay vì làm rò dữ liệu.

Một JSON/account là lựa chọn tối giản có chủ đích: cập nhật một phần nhỏ phải mã hóa lại toàn item,
nhưng đổi lại mọi nội dung luôn có chung biên bảo mật và không thể vô tình thêm field plaintext ở bảng con.
Chỉ tách ciphertext thành nhiều record khi kích thước/hiệu năng thực tế chứng minh cần thiết.

---

## 6. Empty-Vault cutover

`data/migration_v6.2.0_vault_encryption.sql` chỉ dành cho Vault trống, đúng với xác nhận rằng local và
production chưa có dữ liệu thật.

Migration chạy trong transaction và kiểm tra trước:

```sql
IF EXISTS (SELECT 1 FROM accounts LIMIT 1) THEN
  RAISE EXCEPTION 'Vault encryption cutover refused ...';
END IF;
```

Chỉ khi không có account nó mới drop schema plaintext cũ, đổi `accounts`, tạo `vault_config`, policy và
view. Vì vậy giả định “DB trống” sai sẽ làm migration dừng, không âm thầm xóa dữ liệu. Không có dual-read,
dual-write hay data migration cho dữ liệu không tồn tại.

Production chưa chạy. User phải dùng đúng thứ tự migration trong README và kiểm tra `accounts` trống;
agent không tự link/push hosted Supabase.

---

## 7. Kiểm chứng hiện tại

Đã pass local:

- Crypto round-trip; wrong passphrase; tamper; wrong user/item AAD; nonce mới khi ghi lại.
- Database contract cho empty-Vault guard, schema ciphertext, KDF constraint, grants và RLS.
- Reset user data với `accounts` + `vault_config`.
- Authenticated browser: setup, create/read/update/delete, tags, auth methods, recovery codes, history,
  password generator, manual lock/unlock và reload lock.
- Hai user bị cô lập bởi RLS; database/network chỉ nhận ciphertext cho nội dung item.

Đây chưa phải audit mật mã độc lập và không được mô tả là tương đương Bitwarden.

---

## 8. Rủi ro và giới hạn

- Quên passphrase hiện đồng nghĩa không mở lại được DEK; chưa có recovery/reset cho dữ liệu cũ.
- XSS, extension độc hại, keylogger hoặc frontend/dependency bị thay khi Vault đang mở vẫn có thể lấy
  plaintext/passphrase.
- RLS là lớp phòng thủ bổ sung, không thay thế crypto; crypto cũng không thay thế bảo mật frontend.
- Chưa có export/restore, nên chưa nên dùng Vault làm **bản sao duy nhất** của secret quan trọng.

---

## 9. Follow-up, chưa nằm trong v6.2 core

- **Export/restore:** backup ciphertext/config có kiểm tra version và quy trình phục hồi rõ ràng.
- **Đổi passphrase:** derive KEK mới rồi re-wrap cùng DEK; không cần mã hóa lại item.
- **Rotate DEK:** tạo DEK mới và mã hóa lại toàn bộ item khi nghi lộ khóa.
- **Version migration:** nâng KDF/payload/encryption version mà không làm mất dữ liệu.
- **Auto-lock:** khóa sau thời gian không hoạt động; thời lượng chưa chốt.
- **Clipboard auto-clear:** xóa secret đã copy sau timeout.
- **TOTP thật:** lưu seed trong encrypted payload và sinh mã phía client.

Các mục trên phải được triển khai + test riêng; tài liệu không đánh dấu chúng đã xong và production cũng
không được đánh dấu đã áp dụng cho tới khi user xác nhận.
