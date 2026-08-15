# DATABASE.md — Life Hub

**Target:** Supabase PostgreSQL · **Version:** v6.2.0 · **Updated:** 2026-08-09

Runbook cài đặt duy nhất nằm trong [`README.md`](../README.md). File này mô tả trạng thái schema cuối,
không thay thế SQL thật.

## Trạng thái schema cuối

Sau khi chạy đủ baseline và ba migration domain, database có **27 bảng public đang hoạt động**:

- 14 bảng core
- 11 bảng Finance (10 bảng chính + junction tag)
- 2 bảng Vault

`data/schema_v4.24.0.sql` tự nó chỉ là baseline đã hợp nhất tới v5.0. Nó không phải snapshot độc lập
của toàn bộ v6.2.

```text
auth.users
└─ profiles
   ├─ user_tasks ── task_collections ── collections
   │      │                              ├─ collection_notes
   │      └─ activity_logs               └─ collection_tags ── tags
   │      └─ task_tags ────────────────────────────────┘
   ├─ focus_sessions
   ├─ xp_logs
   ├─ intentions ── intention_logs
   ├─ inspirational_quotes
   ├─ finance_* ── finance_transaction_tags ── tags
   ├─ accounts
   └─ vault_config
```

## Inventory

### Core — 14 bảng

| Table | Vai trò | Ràng buộc đáng chú ý |
|---|---|---|
| `profiles` | Profile 1:1 với `auth.users` | PK = user id; trigger tạo khi đăng ký |
| `focus_sessions` | Lịch sử Pomodoro | own-row RLS |
| `xp_logs` | Event XP | amount giới hạn; app có thể xóa event khi bỏ hoàn thành Task |
| `user_tasks` | Task cá nhân | priority, recurrence JSON, recurrence parent, completion/timestamps |
| `collections` | Inbox + Knowledge | type/status được CHECK; updated-at trigger |
| `task_collections` | Task ↔ Knowledge M:N | FK hai phía, cascade, RLS hai phía |
| `activity_logs` | Field diff + note của Task | FK `task_id` cascade; chỉ note được update |
| `tags` | Tag dùng chung | unique theo `(user_id, name)` |
| `collection_tags` | Knowledge ↔ Tag | FK/RLS hai phía |
| `task_tags` | Task ↔ Tag | FK/RLS hai phía |
| `intentions` | Incubator | status lifecycle |
| `intention_logs` | Lịch sử Incubator | FK về intention |
| `collection_notes` | Sub-note của bài Knowledge | FK về collection/user |
| `inspirational_quotes` | Quote cá nhân | Quote hệ thống nằm ở `src/data/quotes.json`, không ở bảng này |

### Finance — 11 bảng

| Table | Vai trò |
|---|---|
| `finance_transactions` | Sổ giao dịch duy nhất; expense/income/saving; liên kết rule/Task/Inbox |
| `finance_bills` | Hóa đơn/chi định kỳ. `note` là ghi chú của quy tắc (số công tơ, ai đứng tên) — **không** sao chép xuống `finance_transactions` |
| `finance_loans` | Khoản vay và kỳ trả |
| `finance_cards` | Chu kỳ sao kê và thanh toán thẻ |
| `finance_saving_goals` | Quỹ tiết kiệm và chính sách khóa |
| `finance_deposits` | Nơi gửi thuộc quỹ; đáo hạn suy ra từ kỳ hạn |
| `finance_income_rules` | Thu định kỳ |
| `finance_shortcuts` | Mẫu nhập nhanh, không giữ số tiền cố định. `recent_amounts` (tối đa 3) là các mức đã dùng, hiện thành nút bấm-là-ghi khi mở shortcut. Đã cân nhắc thêm cột `default_amount` để bấm một cái ghi luôn và **bỏ** — xem mục "Đã thử rồi bỏ" trong CHANGELOG |
| `finance_budgets` | Hạn mức theo category |
| `finance_category_overrides` | Nhãn/màu/icon/subcategory tùy biến theo user |
| `finance_transaction_tags` | Giao dịch ↔ Tag |

Nguyên lý Finance:

1. Không lưu số tổng/balance toàn app.
2. Báo cáo tính lại từ `finance_transactions.occurred_at` theo kỳ.
3. Nghĩa vụ chỉ tạo transaction khi user xác nhận; RPC xử lý write nhiều bảng nguyên khối.
4. Trigger/constraint chặn reference khác owner, kỳ trùng và payload phân nhánh không hợp lệ.

Chi tiết sản phẩm: [`DESIGN_FINANCE.md`](DESIGN_FINANCE.md).

### Vault — 2 bảng

| Table | Vai trò | Quyền authenticated |
|---|---|---|
| `accounts` | Một AES-GCM ciphertext cho mỗi item | SELECT/INSERT/UPDATE/DELETE own-row |
| `vault_config` | KDF metadata + DEK đã wrap, một row/user | SELECT/INSERT own-row |

`accounts` chỉ giữ `id`, `user_id`, `created_at`, `updated_at`, `encrypted_payload`,
`encryption_nonce`, `encryption_version`. Title, template, favorite, note, tag, field, auth method,
recovery code, link và history đều nằm trong encrypted JSON.

`vault_config` giữ PBKDF2 algorithm/salt/iterations, wrapped DEK, wrap nonce và version. Passphrase,
KEK và raw DEK không được lưu. Raw DEK chỉ tồn tại trong memory của phiên unlock.

AES-GCM AAD:

```text
vault-key|v{version}|{user_id}
vault-item|v{version}|{user_id}|{item_id}
```

Migration v6.2 fail-closed nếu `accounts` có row. Nếu config mất nhưng ciphertext còn, app hard-error
thay vì tạo DEK mới. Update/delete item dùng `updated_at` như optimistic revision.

Chi tiết: [`DESIGN_ACCOUNT_VAULT.md`](DESIGN_ACCOUNT_VAULT.md).

## View

`tagged_items` hợp nhất ba junction plaintext:

```text
collection_tags → kind=collection
task_tags       → kind=task
finance_transaction_tags → kind=finance
```

View bắt buộc dùng `security_invoker=true` để giữ RLS của bảng dưới. Vault không có branch vì tên tag
nằm trong ciphertext.

## RPC và function

### Auth boundary

- `login_email(text)`
- `username_exists(text)`
- `email_exists(text)`

Ba function này phục vụ lookup trước đăng nhập; quyền execute được cấp có chủ ý. `profiles` vẫn
own-row và không public-select.

### Finance write RPC

- `finance_pay_bill`
- `finance_skip_bill_period`
- `finance_receive_income`
- `finance_record_loan_payment`
- `finance_pay_card_statement`
- `finance_request_saving_withdrawal`
- `finance_move_saving`

Migration còn có helper validate/refresh/cycle và trigger sync progress. Không gọi RPC write trực tiếp
từ UI ngoài data owner `useFinance`.

## RLS và grants

- Tất cả bảng public user-owned bật RLS.
- Policy cơ bản: `auth.uid() = user_id`; `profiles` dùng `auth.uid() = id`.
- Junction kiểm ownership cả hai đầu, không chỉ entity đang hiển thị.
- `activity_logs`: SELECT/INSERT/DELETE own-row; UPDATE chỉ row note và chỉ cột `note`.
- Finance RPC tự kiểm owner; trigger kiểm các FK/reference chéo domain.
- Vault migration `REVOKE ALL` trước khi cấp đúng verb, tránh ACL mặc định như TRUNCATE/REFERENCES.
- `anon` không được đọc dữ liệu app. Service role chỉ dùng ở server/admin boundary phù hợp.

Schema có đưa `profiles`, `focus_sessions`, `xp_logs` vào publication Realtime, nhưng frontend hiện
không tạo channel/subscription. UI đồng bộ bằng fetch và optimistic state.

## File SQL và thứ tự

### Local

`supabase db reset --local` replay năm snapshot timestamp theo thứ tự:

1. `20260802000000_base_v5_0_0.sql`
2. `20260805000000_vault_v5_2_0.sql`
3. `20260808000000_finance_v6_0_0.sql`
4. `20260809000000_vault_encryption_v6_2_0.sql`
5. `20260815000000_finance_bill_note_v6_3_0.sql`

Snapshot đã tồn tại là bất biến. Schema change mới phải dùng migration timestamp mới.

### Hosted fresh install / handoff

1. `data/schema_v4.24.0.sql`
2. `data/migration_v5.2.0_vault.sql`
3. `data/migration_v6.0.0_finance.sql`
4. `data/migration_v6.2.0_vault_encryption.sql`
5. `data/migration_v6.3.0_finance_bill_note.sql`

Không chạy `data/migration_v5.0.0_activity_logs_v2.sql` sau baseline fresh vì thay đổi đã nằm trong
baseline. `data/migration_v4.31.0_recurrence_chain.sql` và `data/RUNBOOK.sql` là hồ sơ/upgrade cũ,
không thuộc fresh-install order hiện tại.

**Không chạy lại baseline một mình trên database đã ở v6.x.** Baseline vẫn tạo các bảng Finance legacy
trước khi migration Finance xóa chúng; chạy riêng sẽ làm schema cuối bị drift. Khi cần dựng lại, luôn
dùng toàn bộ ordered chain trong README trên database phù hợp và chỉ khi user chủ động cho phép.

Production Finance/Vault chưa được tài liệu này đánh dấu đã áp dụng. User tự chạy runbook và xác nhận
smoke trước khi đổi trạng thái.

## Reset dữ liệu

`data/reset_user_data.sql` xóa dữ liệu app của **tất cả user**, gồm ciphertext Vault và
`vault_config`, nhưng giữ `auth.users`; profile/XP chỉ xóa khi user tự mở phần tùy chọn. Script được bọc
transaction nhưng vẫn không thể hoàn tác sau commit.

Agent không tự chạy reset, truncate, drop schema/database hoặc delete hàng loạt. Phải giải thích target,
cảnh báo mất dữ liệu và xin phép rõ ràng trước.

## Nguồn sự thật

- Column, CHECK, trigger, policy, grant: đọc SQL theo ordered chain.
- Thứ tự thao tác local/hosted: [`README.md`](../README.md).
- Hành vi UI: [`FEATURES.md`](FEATURES.md).
- Lịch sử bảng/cột đã xóa: [`CHANGELOG.md`](../CHANGELOG.md), không lặp lại trong inventory hiện hành.
