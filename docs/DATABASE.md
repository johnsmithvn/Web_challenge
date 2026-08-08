# DATABASE DESIGN — Life Hub (Personal Life OS)
**Target:** Supabase (PostgreSQL)
**Version:** v5.0.0
**Updated:** 2026-08-02
**Strategy:** Production-ready from day 1
**Source of Truth:** **`data/schema_v4.24.0.sql`** — single consolidated schema (all migrations v4.4.0 → v5.0.0 folded in, bao gồm `data/RUNBOOK.sql`). Idempotent — run once on a fresh project.

**Table count (verified against the `.sql` file):** **18 `CREATE TABLE`** — **tất cả đều đang được dùng**, không còn bảng archived nào. v5.0.0 DROP 12 bảng: 8 bảng Habit + Lộ Trình (`progress`, `habits`, `habit_logs`, `programs`, `program_habits`, `user_journeys`, `journey_habits`, `skip_reasons`), `streaks` (BXH), và 3 bảng chết sẵn (`notification_settings`, `friendships`, `fitness_logs`).
`mood_logs` is NOT in this schema (dropped in v4.10.1, folded into the consolidated file).
Every other doc that says 26 / 28 / 29 / 31 tables is stale — this line is the count.
`data/RUNBOOK.sql` vẫn giữ lại làm hồ sơ lịch sử SQL đã chạy trên DB thật (2026-08-02) — không cần
chạy lại, `schema_v4.24.0.sql` giờ đã phản ánh đúng trạng thái cuối cùng cho fresh install.

---

## Entity Overview

```
auth.users (Supabase built-in)
    │
    ▼
profiles ──────────────────────────────────────┐
    │                                           │
    ├──► xp_logs           (immutable events)   │
    ├──► focus_sessions    (pomodoro)           │
    │                                           │
    │                                           │
    ├──► user_tasks ◄──► task_collections ──► collections
    │                                    (M:N junction v4.5.0)
    ├──► collections       (inbox + knowledge)  │
    ├──► finance_transactions (bảng chi tiêu DUY NHẤT — v6.0.0)
    │        ├─ FK bill_id/loan_id/card_id/saving_goal_id/shortcut_id
    │        ├─ FK inbox_item_id → collections  (liên kết Inbox)
    │        └─ FK task_id       → user_tasks   (liên kết Task)
    ├──► finance_bills / finance_loans / finance_cards / finance_saving_goals
    │    finance_deposits / finance_income_rules / finance_shortcuts / finance_budgets
    │    finance_category_overrides (taxonomy riêng theo user)
    ├──► activity_logs     (task history + notes)│
    ├──► intentions / intention_logs (incubator)│
    │                                           │
    ├──► accounts ──► account_fields (field theo loại; multi + link là jsonb)
    │            ├──► account_auth  (phương thức đăng nhập)  (v5.2.0)
    │            ├──► account_codes (mã dự phòng dùng 1 lần)
    │            ├──► account_logs  (lịch sử, append-only)
    │            └──► account_tags              │
    │                                           │
    ├──► tags ◄──► collection_tags              │
    │         ◄──► task_tags        (v4.28.0)    │
    │         ◄──► account_tags     (v5.1.0)     │
    │         ◄──► finance_transaction_tags (v6.0.0)
    │              └─ all 4 ──► VIEW tagged_items │
    │                                           │
    ├──► collection_notes  (threaded sub-notes) │
    ├──► inspirational_quotes (user quotes)     │
    │                                           │
    └────────────────────────────────────────────┘
```

---

## Full SQL Schema

> ⚠️ Do NOT duplicate SQL here. Read [`data/schema_v4.24.0.sql`](../data/schema_v4.24.0.sql) directly for
> column definitions, RLS policies, triggers, and indexes. `schema_v4.4.0.sql` and the per-version
> `migration_*.sql` files no longer exist — they were folded into the consolidated file (history in git).

### Table Inventory (21 bảng — không còn bảng chết)

| # | Table | Purpose | Key constraints |
|---|-------|---------|-----------------|
| 1 | `profiles` | Extends `auth.users` (1:1) | PK = `auth.users.id`, auto-created by trigger |
| 2 | `xp_logs` | Immutable XP event log | CHECK(amount BETWEEN -200 AND 200). v5.0.0: nguồn XP đổi sang `task_done` + `focus_session`; dòng cũ của habit/quiz/challenge **giữ nguyên** (append-only) |
| 3 | `focus_sessions` | Pomodoro sessions | v5.0.0: DROP 2 cột `habit_id` + `journey_id` — Focus không còn gắn habit/lộ trình |
| 4 | `user_tasks` | Personal to-do items | priority SMALLINT, recurrence_rule JSONB, `recurrence_parent_id` UUID self-FK ON DELETE CASCADE (v4.31.0 — link "task này được sinh ra TỪ task nào", khác cột `parent_id` subtask đang có kế hoạch riêng), `updated_at` TIMESTAMPTZ + trigger `user_tasks_updated_at` tái dùng hàm chung `update_updated_at()` (v5.0.0; backfill = `created_at` cho task cũ) |
| 5 | `task_collections` | Junction: Task ↔ KB (M:N) | Composite PK(task_id, collection_id), CASCADE |
| 6 | `collections` | Inbox + Knowledge Base | type CHECK (8, **sửa v4.28.0**): `inbox`, `note`, `quote`, `learn`, `idea`, `ai`, `entertainment`, `podcast`. ⚠️ Trước v4.28.0 CHECK có `emotion` (không tồn tại trong `src/`) và **thiếu `podcast`** (có trong `knowledge.json`) → classify sang Podcast fail constraint |
| 7–8 | ~~`expenses`~~ ~~`subscriptions`~~ | **[DROPPED v6.0.0]** — thay bằng module Finance mới (bảng `finance_*` bên dưới). Xem `data/migration_v6.0.0_finance.sql`. |
| 9 | `activity_logs` | Lịch sử thay đổi + ghi chú cá nhân của **Task** | **Dựng lại ở v5.0.0**, dữ liệu cũ xoá hết theo chủ ý: `task_id` UUID FK → `user_tasks` ON DELETE CASCADE (mọi dòng đều gắn task), `action`, `field`, `old_value`, `new_value`, `note`. Bỏ `label`/`amount`/`meta` (không nơi nào đọc; tiền/XP đã có nguồn thật ở `expenses`/`subscriptions`/`xp_logs`). 4 policy: SELECT/INSERT/DELETE own + UPDATE chỉ dòng `action='note'` kèm `GRANT UPDATE (note)` cấp cột → dòng field-diff bất biến. 1 index `idx_activity_logs_task` phục vụ truy vấn đọc duy nhất. **Không còn** dòng "sự kiện rời rạc" (expense_add, inbox_*, focus_done…) — Life Log/heatmap là người đọc duy nhất của chúng và đã gỡ hẳn ở v5.0.0 |
| 10 | `intentions` | Incubator (someday-maybe) | status: incubating/deferred/executed/abandoned |
| 11 | `intention_logs` | Incubator audit trail | FK → intentions |
| 12 | `tags` | Central tag system | UNIQUE(user_id, name). Cột `emoji`/`description` (thêm tạm ở RUNBOOK.sql Phần 2) đã **DROP lại** ở Phần 3, xác nhận 2026-08-02 — feature "Nhóm" bỏ hẳn khỏi UI, 2 cột này không còn ai đọc/ghi |
| 13 | `collection_tags` | Junction: KB ↔ Tags | Composite PK |
| 14–15 | ~~`expense_tags`~~ ~~`subscription_tags`~~ | **[DROPPED v6.0.0]** — thay bằng `finance_transaction_tags`. |
| 16 | `task_tags` | Junction: Task ↔ Tags | **v4.28.0.** Composite PK(task_id, tag_id), CASCADE. RLS kiểm ownership **cả 2 phía**. Chỉ index `tag_id` (task_id đã là cột dẫn đầu của PK) |
| 17 | `collection_notes` | Threaded sub-notes per article | FK → collections, FK → profiles, plain text |
| 18 | `inspirational_quotes` | User + system quotes | FK → profiles, `is_active` toggle, `audio_url` optional |
| 19 | `accounts` | **v5.2.0.** 1 item trong vault (thiết kế Keyplate) | `service_name` (= `Item.title` của đặc tả — giữ tên cột, không thêm cột `title`), `tpl` (key template, **KHÔNG CHECK** — template là content trong JSON, thêm mẫu mới không cần migration), `favorite`, `notes`, `updated_at` + trigger `accounts_updated_at` tái dùng `update_updated_at()`. **KHÔNG chứa secret** — xem `account_fields` |
| 20 | `account_fields` | **v5.2.0.** Field của item, phân nhánh render theo `type` | `label` + `type` CHECK(10 loại: text/password/secret/url/email/phone/multi/link/number/date — khớp `TYPES` trong `vaultLogic.js`), `value` (**PLAINTEXT**; password/secret chỉ mask UI), `multi_values` jsonb (loại `multi`), `links` jsonb `[{id,itemId,value}]` (loại `link`, **nhiều link/field**; jsonb không FK nên xoá item đích → link mồ côi "Missing item", đúng đặc tả). RLS kiểm ownership 2 phía (row + account chứa; phía đích không kiểm được vì jsonb — không leak, UI resolve trong bộ đã fetch của chính user) |
| 21 | `account_auth` | **v5.2.0.** Phương thức đăng nhập của item | `kind` (**KHÔNG CHECK** — 9 kiểu trong `authKinds` JSON), `note`, `state` CHECK(primary/on/off), `sort_order`. Partial UNIQUE `unique_account_auth_primary(account_id) WHERE state='primary'` → ép **≤1 primary**; đổi primary = hạ cũ trước, nâng mới sau |
| 22 | `account_codes` | **v5.2.0.** Mã dự phòng dùng 1 lần | `code`, `used`, `sort_order`. Đánh dấu đã dùng/hoàn ghi log ngay ngoài chế độ sửa |
| 23 | `account_logs` | **v5.2.0.** Lịch sử thay đổi từng field | `logged_at` (tên `at` là từ khoá SQL; hook map → `at`), `text`, `detail`. **APPEND-ONLY ép bằng RLS**: chỉ có policy SELECT + INSERT, **không** UPDATE/DELETE. `diffLog` mask secret trước khi ghi |
| 24 | `account_tags` | **v5.1.0.** Junction: Account ↔ Tags | Composite PK(account_id, tag_id), CASCADE. RLS kiểm ownership cả 2 phía. Chỉ index `tag_id` |
| — | `knowledge_groups` | **[DROPPED v4.31.0, 2026-08-02]** KB folder/group metadata | Quyết định P2-7 (2026-08-01): trùng việc với `tags`. Ban đầu định gộp hiển thị (tag có emoji = "nhóm"), nhưng chốt cuối là **bỏ hẳn tính năng Nhóm khỏi UI**. Data đã copy sang `tags`/`collection_tags` (Phase 1) trước khi drop — bài viết không mất liên kết, chỉ mất hiển thị folder. Frontend không còn dùng (`useKnowledgeGroups.js` đã xoá). **Bảng đã DROP** qua RUNBOOK.sql Phần 3, xác nhận `information_schema.tables` 0 dòng. |
| — | `collection_groups` | **[DROPPED v4.31.0, 2026-08-02]** Junction: KB ↔ Groups (M:N) | Cùng lý do với `knowledge_groups` ở trên. |

### Module Finance (v6.0.0 — `data/migration_v6.0.0_finance.sql`)

Thiết kế: `docs/DESIGN_FINANCE.md`. Nguyên lý: app **không tính số dư**; **một bảng giao dịch, mọi
báo cáo = đếm lại lọc theo `occurred_at`**; **app không trả hộ — chỉ nhắc, tới ngày user ghi ra 1
giao dịch mang FK trỏ về quy tắc**. Tất cả bật RLS, policy `FOR ALL USING (user_id = auth.uid())`
(junction kiểm 2 phía). Migration là **clean rebuild phá hủy dữ liệu Finance cũ**, bọc
`BEGIN/COMMIT`; parent category là tập đóng và được CHECK theo taxonomy handoff.

| Table | Purpose | Key constraints |
|-------|---------|-----------------|
| `finance_transactions` | Bảng DUY NHẤT | `amount > 0`; `type` expense/income/saving; chi/thu chỉ nhận parent category thuộc tập đóng, saving không có category; `items`/`attachments`; generated `source_kind`; liên kết Task/Inbox; cặp FK+kỳ cho bill/income/loan/card; `loan_part`; CHECK phân loại `excluded`; UNIQUE bill period, income period và loan part/period. Trigger kiểm ownership mọi FK Finance/Task/Inbox |
| `finance_bills` | Hóa đơn phải trả | Category chi hợp lệ + subcategory không rỗng; `rrule` hợp lệ; fixed phải có amount, ask lấy trung bình 3 giao dịch gần nhất ở runtime; `skipped_periods`; `term_done`/`finished_at` suy từ giao dịch; kỳ nghĩa vụ tách khỏi ngày trả thật |
| `finance_loans` | Khoản vay | `kind` interest/amort; lãi là chi, gốc `excluded`; gốc không vượt dư; `done` suy từ `loan_period`/`loan_part` |
| `finance_cards` | Thẻ tín dụng | Ngày chốt/đến hạn bắt buộc; RPC tính đúng khoảng sao kê, hỗ trợ trả một phần, chặn trả vượt dư sao kê |
| `finance_saving_goals` | Quỹ tiết kiệm | `lock_mode` soft/term/external; term bắt buộc `lock_until`; `auto_deposit` là `{amount,day}` hợp lệ; yêu cầu rút sớm khóa kỳ hạn chờ đúng 48h; **KHÔNG có cột số dư** (= SUM deposits) |
| `finance_deposits` | Nơi gửi (sổ của quỹ) | FK `(fund_id,user_id)` CASCADE chống nối chéo owner; `rate`; `matures_at` là generated column từ `opened_at + term`; `closed_on` |
| `finance_income_rules` | Thu định kỳ | `rrule`; `category_id` thuộc đúng 7 nhóm thu handoff; `received_periods` được suy từ transaction và UNIQUE theo kỳ; **không quá hạn** |
| `finance_shortcuts` | Nút nhập nhanh | Category chi hợp lệ + subcategory không rỗng; `recent_amounts` jsonb; **KHÔNG có cột số tiền** |
| `finance_budgets` | Hạn mức tháng | Category thuộc đúng 11 nhóm chi; UNIQUE `(user_id, category_id)`; ngưỡng cố định 50/30/20 của tổng hạn mức |
| `finance_category_overrides` | Phần taxonomy người dùng tuỳ biến | Parent group đóng (11 chi + 7 thu); màu chỉ nhận palette handoff; `subs` được kiểm tra cấu trúc/key/necessity; chỉ sửa nhãn/màu/Phosphor icon/ẩn/mức cần thiết/tính chất/`subs` |
| `finance_transaction_tags` | Junction: giao dịch ↔ tags | Composite PK, RLS 2 phía |

### Views

| View | Mục đích | Ghi chú |
|------|----------|---------|
| `tagged_items` | **v4.28.0, mở rộng v5.1.0, tạo lại v6.0.0.** 1 mặt đọc hợp nhất cho filter/search theo tag: `UNION ALL` 4 junction → `(tag_id, kind, item_id)` với `kind ∈ {collection, task, account, finance}` (v6.0.0 bỏ expense/subscription, thêm finance) | ⚠️ Tạo với `WITH (security_invoker = true)` — **bắt buộc**. Mặc định view chạy bằng quyền OWNER (postgres) và **bỏ qua RLS** của bảng dưới → leak data mọi user. Cần PostgreSQL ≥ 15. |

### Kiến trúc Tag — tại sao N junction, không phải 1 bảng polymorphic

`tags` là **1 bảng trung tâm duy nhất** (`UNIQUE(user_id, name)`), không có cột `tags TEXT[]` lặp ở đâu. Mỗi loại entity nối vào qua 1 junction riêng: `collection_tags`, `task_tags`, `account_tags`, `finance_transaction_tags`.

Nhìn có vẻ dư (N loại → N bảng), nhưng **đó là giá của referential integrity**: mỗi junction có `REFERENCES ... ON DELETE CASCADE` cả 2 phía, nên xoá entity thì link tự biến mất.

**Cố ý KHÔNG dùng** `taggables(tag_id, entity_type, entity_id)` polymorphic: `entity_id` không thể có FK → xoá entity không xoá link → **rác vĩnh viễn**.

> **v5.0.0:** `activity_logs` từng là ví dụ điển hình của bệnh này (row `fitness_done` treo mãi sau khi feature bị xoá ở v4.26.0). Khi dựng lại bảng, đã **bỏ hẳn hướng polymorphic** (`entity_type`/`entity_id`) để dùng FK thật `task_id → user_tasks(id) ON DELETE CASCADE`. Đánh đổi đã chốt: DB tự dọn, không bao giờ có dòng mồ côi — nhưng xoá 1 task là mất luôn lịch sử + ghi chú của nó.

Nguyên tắc: **N junction để GHI (giữ FK), 1 view để ĐỌC (unified filter).**

### Account Vault — link là jsonb, không phải bảng con (v5.2.0)

Quy tắc quyết bảng-vs-cột của module: **có lifecycle/ràng buộc riêng → bảng; là giá trị của một
field → cột.** Vì thế `account_auth`/`account_codes`/`account_logs` là bảng (bật/tắt, đánh dấu đã
dùng, ghi log đều xảy ra độc lập với việc sửa item), còn `multi_values`/`links` là cột jsonb trên
`account_fields` (chỉ đổi cùng chính field chứa nó).

`links` là jsonb `[{id,itemId,value}]`, **nhiều link/field**, cố ý **không** làm bảng con + FK:

| | Bảng con + FK | jsonb `links` (đang dùng) |
|---|---|---|
| Xoá item đích | ON DELETE CASCADE/SET NULL tự dọn | con trỏ mồ côi → UI hiện "Missing item" |
| Đảm bảo ownership phía đích | FK + RLS kiểm được | **không** kiểm được (jsonb) |
| Số bảng / query thêm | +1 bảng, +1 RLS, +1 query | 0 |

"Missing item" **đúng** là hành vi đặc tả yêu cầu (link tới item đã xoá phải hiện gãy), nên FK ở đây
không mua được gì. Rủi ro ownership phía đích: user tự sửa payload nhét id người khác vào — **không
leak**, UI resolve itemId trong đúng bộ item đã fetch của chính user (id lạ → "Missing item"), RLS
trên `accounts` vẫn chặn mọi đường đọc dòng người khác. Nâng cấp khi cần dọn orphan tự động: bảng
`account_field_links` + FK ON DELETE CASCADE.

**`account_auth` — đúng ≤1 primary/item, ép bằng partial UNIQUE** `... WHERE state='primary'`. Index
ép "không quá 1" chứ không "đúng 1" (0 primary là hợp lệ). Hệ quả cho code: đổi primary phải **hạ
cái cũ trước rồi nâng cái mới** (`setAuthState` trong `useAccounts.js`) — đảo thứ tự thì vi phạm.

**`account_logs` — append-only ép bằng RLS**, không bằng quy ước: bảng chỉ có policy SELECT + INSERT,
**không** UPDATE/DELETE → client không sửa/xoá được một dòng log nào kể cả khi code có bug. `diffLog`
(`vaultLogic.js`) mask secret = `•` × min(len,24) **trước khi** tạo dòng log — bất biến có test khoá.

> ⚠️ **`account_fields.value` là PLAINTEXT.** Type `password`/`secret` chỉ mask trên UI, **không mã
> hoá gì**. Không nhập mật khẩu/PIN/số thẻ thật vào bản này. Mã hoá client-side (envelope encryption
> KEK/DEK + AES-GCM) là việc tương lai — xem `DESIGN_ACCOUNT_VAULT.md`.

### Deprecated Columns

| Table | Column | Status | Replacement |
|-------|--------|--------|-------------|
| `user_tasks` | `collection_id` | **DEPRECATED v4.5.0 → code ngừng ghi v4.28.0 → xác nhận KHÔNG CÒN TỒN TẠI trên DB 2026-08-02** (`information_schema.columns` trả 0 dòng) | `task_collections` junction (M:N). v4.28.0 đã bỏ tham số `collectionId` khỏi `addTask` và chuyển `CollectPage.onCreateTask` sang `linkCollection()`. **Trước v4.28.0 link tạo từ Knowledge coi như mất** vì cột 1:1 không được đọc ở đâu. |
| `collections` | `resolved`, `course_name`, `duration_min`, `reviewed_at`, `priority` | **CỘT CHẾT — xác nhận KHÔNG CÒN TỒN TẠI trên DB 2026-08-02** (`information_schema.columns` trả 0 dòng, cả 5 cột) | Không cột nào được đọc/render (grep 0 hit trong `useCollections`/`CollectPage`/`InboxPage`/`ArticleCard`). `priority` chỉ được passthrough lúc INSERT — v4.28.0 đã bỏ. Lưu ý `collections.priority` là `TEXT`, khác hẳn `user_tasks.priority` (`SMALLINT`) dù trùng tên. |
| `user_tasks` | `energy_level`, `duration_est` | **DROPPED v4.9.0** | Replaced by `priority SMALLINT` (0=None … 5=Urgent). The schema file explicitly `DROP COLUMN IF EXISTS` both. |
| `collections` | `tags` (TEXT[]) | **GONE v4.1.0** | Use `collection_tags` junction. Not created by `schema_v4.24.0.sql` at all — a fresh install has no such column. Docs claiming it is "kept for backward compat" are stale. |

### Tables That Do NOT Exist

Named in older docs / older `ARCHITECTURE.md` revisions, but **never** in the current schema file:

| Table | Reality |
|-------|---------|
| `teams`, `reactions`, `partner_queue` | Team feature cancelled v3.0.0 — frontend code deleted v4.25.0 |
| `quiz_attempts` | Quiz đã gỡ hẳn ở v5.0.0 |
| `daily_challenge_completions` | Challenge XP goes to `xp_logs` |
| `mood_logs` | Existed until v4.10.1, dropped — not in `schema_v4.24.0.sql` |

<a id="streak-source-of-truth"></a>
### Streak — Source of Truth

- **v5.0.0: không còn khái niệm streak trong app.** Habit tracker + bảng `streaks`
  đều đã gỡ. Nếu sau này cần lại: tính runtime từ dữ liệu gốc, đừng dựng bảng cache
  (bảng `streaks` cũ chính là ví dụ — dựng ra rồi không ai update, luôn = 0).

## ~~Leaderboard~~ — GỠ HẲN v5.0.0

`get_leaderboard()` (`SECURITY DEFINER`, JOIN `profiles` + `streaks` + `xp_logs` + `progress`) đã
`DROP FUNCTION`. Trang `/leaderboard` xoá cùng đợt. 3 hàm RPC còn lại (`login_email`,
`username_exists`, `email_exists`) giữ nguyên — chúng phục vụ luồng đăng nhập/đăng ký, không liên
quan bảng xếp hạng.

## Migration Strategy (localStorage → Supabase)

**v1.6.2+ architecture:** Supabase is primary for ALL user data. localStorage only stores UI flags.

On first login (one-time per data type):
1. Read `vl_habit_data` from localStorage → upsert into `progress` → wipe local
2. Read `vl_custom_habits` → upsert into `habits` → wipe local
3. Read `vl_xp_store` → insert into `xp_logs` → wipe local
4. Read `vl_habit_progress` → insert into `habit_logs` → wipe local
5. Read `vl_focus_sessions` → insert into `focus_sessions` → wipe local
6. Set `vl_migrated_v2 = userId` flag in localStorage
7. Subsequent reads → Supabase only

## Migration Files

> **v4.24.0:** ALL migrations are now consolidated into a single file —
> **`data/schema_v4.24.0.sql`**. The old `schema_v4.4.0.sql` + the v4.7.2 → v4.14.0
> migrations + the v4.24.0 RLS patch have been merged and removed (history in git).
> The consolidated file is idempotent — run it once; re-running is safe.

| File | Purpose |
|------|---------|
| **`data/schema_v4.24.0.sql`** | **Single source of truth** — all 29 tables + RLS + indexes + triggers + 3 RPC functions (login_email/username_exists/email_exists) + seed 5 programs. Idempotent. **Đã gộp v5.0.0** (2026-08-02): `user_tasks.updated_at` + trigger, `activity_logs` schema v2, DROP `streaks` + `get_leaderboard()` |
| `data/migration_v5.0.0_activity_logs_v2.sql` | Bản **DROP + CREATE** của cùng thay đổi trên. **Chỉ chạy 1 lần.** Hai file tới cùng 1 schema cuối và **cùng xoá sạch log cũ** — master dùng `DELETE FROM activity_logs WHERE task_id IS NULL`, mà mọi dòng của schema v1 đều không gắn task. Chạy file nào cũng được; đừng chạy cả hai |
| **`data/migration_v5.2.0_vault.sql`** | **v5.2.0 — CHƯA gộp vào master** (RULES §3: chỉ sửa master khi có chỉ thị rõ ràng). 6 bảng Account Vault (`accounts`, `account_fields`, `account_auth`, `account_codes`, `account_logs`, `account_tags`) + `tagged_items` thêm `kind='account'`. Idempotent, dựng từ trạng thái trắng (bản v5.1.0 chưa từng chạy trên Supabase → đã xoá file đó). Có sẵn câu VERIFY ở cuối file |
| **`data/migration_v6.0.0_finance.sql`** | **v6.0.0 — CHƯA gộp vào master.** Clean rebuild toàn bộ Finance và tạo lại `tagged_items`. Phải chạy sau v5.2.0 vì view dùng `account_tags`; migration kiểm tra tiền đề và rollback toàn bộ nếu thiếu. |
| `data/reset_user_data.sql` | **Reset script** — DELETE all user data, keep auth accounts |

## Supabase Setup Checklist

- [ ] Create project (region: Southeast Asia – Singapore)
- [ ] Run `data/schema_v4.24.0.sql` in SQL Editor
- [ ] Run `data/migration_v5.2.0_vault.sql`
- [ ] Run `data/migration_v6.0.0_finance.sql`
- [ ] Enable Realtime for: profiles, progress, habits, focus_sessions, xp_logs
- [ ] Enable Google OAuth (Auth → Providers → Google)
- [ ] Get URL + anon key from Project Settings → API
- [ ] Create `.env.local` with the two keys
- [ ] Verify `on_auth_user_created` trigger fires on test signup
