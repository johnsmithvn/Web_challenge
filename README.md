# Life Hub — Personal Life OS v6.16.0

> **Kỷ Luật = Hệ Thống, Không Phải Ý Chí**

Life Hub là ứng dụng web cá nhân tích hợp: Inbox, Nhiệm Vụ (kèm Không gian Lịch 5 chế độ), Sổ Tay Tri Thức (Knowledge Base PKM / Athenaeum), Tài Chính,
Account Vault và Focus. Frontend React/Vite, dữ liệu chính trên Supabase với RLS.

- **Frontend:** React 19, Vite, React Router v7, vanilla CSS
- **Backend:** Supabase PostgreSQL + Auth, Vercel Serverless Functions
- **Lưu trữ tệp:** Google Drive API (qua serverless proxy, hỗ trợ Range/seek cho media)
- **Kiểm thử:** Node.js test runner thuần (`node:assert/strict`), không phụ thuộc Jest/Vitest

> **Lưu ý xác thực:** Landing Page, Nhiệm Vụ (ở chế độ khách) và Focus có thể dùng thử không cần tài khoản.
> Inbox, Knowledge, Finance, Settings và Account Vault yêu cầu đăng nhập.

---

## 🚀 Quick Start (Local Dev)

```bash
# 1. Clone repo
git clone https://github.com/johnsmithvn/Web_challenge.git
cd Web_challenge

# 2. Cài dependencies
npm install

# 3. Copy env và điền biến môi trường
cp .env.local.example .env.local
# → Sửa .env.local theo hướng dẫn bên dưới

# 4. Chạy dev server
npm run dev
# → http://localhost:5173

# (tuỳ chọn) Self-check nhanh — node:assert (24 test suites), không cần cài gì thêm
npm test
```

> **Không có Supabase?** Task list và Focus vẫn chạy guest bằng state in-memory và mất khi reload.
> Inbox, Knowledge, Finance, Settings và Account Vault yêu cầu đăng nhập.

---

## ⚙️ Environment Variables

File [`.env.local.example`](./.env.local.example) liệt kê biến bắt buộc và tùy chọn. Copy sang
`.env.local` rồi điền giá trị phù hợp môi trường.

### Các file `.env` trong project

| File | Vai trò | Git | Dùng khi |
|------|---------|:---:|----------|
| `.env.local.example` | **Mẫu** — liệt kê tên biến, không chứa secret | ✅ Tracked | Người mới clone xem để biết cần điền gì |
| `.env.local` | **Production** — trỏ tới Supabase cloud | ❌ Ignored | `npm run dev` kết nối DB production |
| `.env.development.local` | **Local Docker** — trỏ tới `localhost:54321` | ❌ Ignored | `npm run dev` kết nối DB local (Docker) |

> Vite ưu tiên: `.env.development.local` > `.env.local` trong dev mode. Khi có cả 2 file, app tự dùng local Docker. Xoá `.env.development.local` nếu muốn dev trực tiếp trên production.

### Bắt buộc

| Biến | Ở đâu | Mục đích |
|------|--------|----------|
| `VITE_SUPABASE_URL` | `.env.local` + Vercel | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `.env.local` + Vercel | Supabase anonymous API key |

**Cách lấy:**
1. Vào [supabase.com](https://supabase.com) → Create Project
2. Vào **Project Settings → API**
3. Copy `Project URL` → `VITE_SUPABASE_URL`
4. Copy `anon public` key → `VITE_SUPABASE_ANON_KEY`

### Tùy chọn — Google Drive (upload ảnh / audio / video / file)

Mọi file được upload qua **Google Drive Service Account** (Vercel serverless [`api/upload.js`](./api/upload.js)) và phát lại qua proxy [`api/stream.js`](./api/stream.js). Upload **yêu cầu người dùng đã đăng nhập** (xác thực Supabase JWT).

| Biến | Ở đâu | Mục đích |
|------|--------|----------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Vercel only | Service Account JSON (nén thành chuỗi 1 dòng) — bật upload + stream |
| `DRIVE_FOLDER_ID` | Vercel only | ID thư mục Drive gốc chứa file — bật upload + **bắt buộc cho stream** (fail-closed nếu thiếu) |
| `ALLOWED_ORIGIN` | Vercel only (tùy chọn) | Origin app cho CORS, vd `https://your-app.vercel.app` |

**Cách tạo:**
1. Vào [console.cloud.google.com → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Tạo Service Account → **Keys → Add key → JSON** → tải file JSON
3. Tạo 1 thư mục trên Google Drive, **Share** thư mục đó cho email của Service Account (quyền Editor)
4. Đặt thư mục gốc thành **"Anyone with the link → Viewer"** (file upload kế thừa quyền xem)
5. Copy ID thư mục (đoạn cuối URL Drive) → `DRIVE_FOLDER_ID`
6. Nén JSON thành chuỗi 1 dòng → `GOOGLE_SERVICE_ACCOUNT_JSON`

> ⚠️ **KHÔNG thêm prefix `VITE_`** — các biến này chỉ dùng server-side trong Vercel Functions. Không bao giờ expose Service Account ra frontend.

---

## 🗄 Database Setup (Supabase)

README gốc này là runbook duy nhất cho cả local và production. Các snapshot trong
[`supabase/migrations/`](./supabase/migrations/) chỉ dùng để dựng database local và được xem là
**bất biến**; mọi thay đổi database mới phải nằm trong một migration timestamp mới.

### Local development

Docker phải đang chạy. Từ thư mục dự án:

```bash
npm run db:local:start
npm run db:local:reset
npm run db:local:status
# Khi làm xong:
npm run db:local:stop
```

> `db:local:reset` xóa toàn bộ dữ liệu database local trước khi replay migration. Đây là lệnh user
> chủ động chạy cho môi trường test trắng; agent không tự chạy và không được dùng với hosted project.

18 migration local được chạy tự động theo timestamp:

1. [`20260802000000_base_v5_0_0.sql`](./supabase/migrations/20260802000000_base_v5_0_0.sql)
2. [`20260805000000_vault_v5_2_0.sql`](./supabase/migrations/20260805000000_vault_v5_2_0.sql)
3. [`20260808000000_finance_v6_0_0.sql`](./supabase/migrations/20260808000000_finance_v6_0_0.sql)
4. [`20260809000000_vault_encryption_v6_2_0.sql`](./supabase/migrations/20260809000000_vault_encryption_v6_2_0.sql)
5. [`20260815000000_finance_bill_note_v6_3_0.sql`](./supabase/migrations/20260815000000_finance_bill_note_v6_3_0.sql)
6. [`20260815010000_finance_lending_v6_4_0.sql`](./supabase/migrations/20260815010000_finance_lending_v6_4_0.sql)
7. [`20260815020000_finance_bill_icon_v6_5_0.sql`](./supabase/migrations/20260815020000_finance_bill_icon_v6_5_0.sql)
8. [`20260815030000_finance_card_annual_fee_on_v6_6_0.sql`](./supabase/migrations/20260815030000_finance_card_annual_fee_on_v6_6_0.sql)
9. [`20260815040000_finance_bill_multi_month_v6_7_0.sql`](./supabase/migrations/20260815040000_finance_bill_multi_month_v6_7_0.sql)
10. [`20260815050000_finance_bill_term_offset_v6_8_0.sql`](./supabase/migrations/20260815050000_finance_bill_term_offset_v6_8_0.sql)
11. [`20260816000000_finance_rule_detach_v6_9_0.sql`](./supabase/migrations/20260816000000_finance_rule_detach_v6_9_0.sql)
12. [`20260817000000_finance_lending_forfeited_v6_9_1.sql`](./supabase/migrations/20260817000000_finance_lending_forfeited_v6_9_1.sql)
13. [`20260818000000_drop_inspirational_quotes_v6_10_0.sql`](./supabase/migrations/20260818000000_drop_inspirational_quotes_v6_10_0.sql)
14. [`20260827000000_finance_taxonomy_v6_11_0.sql`](./supabase/migrations/20260827000000_finance_taxonomy_v6_11_0.sql)
15. [`20260829000000_finance_necessity_two_tiers_v6_12_0.sql`](./supabase/migrations/20260829000000_finance_necessity_two_tiers_v6_12_0.sql)
16. [`20260831000000_finance_transaction_description_v6_13_0.sql`](./supabase/migrations/20260831000000_finance_transaction_description_v6_13_0.sql)
17. [`20260831010000_vault_change_passphrase_v6_14_0.sql`](./supabase/migrations/20260831010000_vault_change_passphrase_v6_14_0.sql)
18. [`20260831020000_vault_recovery_key_v6_15_0.sql`](./supabase/migrations/20260831020000_vault_recovery_key_v6_15_0.sql)

Sau `npm run db:local:start`, tạo file `.env.development.local` (Git bỏ qua) bằng Project URL và
Publishable key hiện trong kết quả:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local Publishable key>
```

Vite sẽ ưu tiên file này trong development; `.env.local` hosted vẫn được giữ nguyên cho
môi trường hiện có.

> Chỉ dùng các script `db:local:*`. **Không chạy** `supabase db push`,
> `supabase db reset --linked` hoặc lệnh có hosted `--db-url`. Production từng được cập nhật thủ
> công qua SQL Editor nên chưa có các timestamp baseline; phải đối soát migration history riêng
> trước khi cân nhắc remote push trong tương lai.

### Hosted project mới (Fresh Install)

Mở **Supabase → SQL Editor** và chạy đúng thứ tự:

| Thứ tự | File | Nội dung |
|:------:|------|----------|
| 1 | [`data/schema_v4.24.0.sql`](./data/schema_v4.24.0.sql) | Baseline đã hợp nhất tới v5.0: bảng lõi, RLS, index, trigger, RPC, Task activity log. |
| 2 | [`data/migration_v5.2.0_vault.sql`](./data/migration_v5.2.0_vault.sql) | Schema Vault trung gian bắt buộc để v6.2 cutover. Idempotent. |
| 3 | [`data/migration_v6.0.0_finance.sql`](./data/migration_v6.0.0_finance.sql) | Finance v6 clean rebuild, 10 bảng + junction + RPC. Có kiểm tra và rollback khi thiếu. |
| 4 | [`data/migration_v6.2.0_vault_encryption.sql`](./data/migration_v6.2.0_vault_encryption.sql) | Cutover Vault trống sang full-content encryption. Chạy đúng một lần. |
| 5 | [`data/migration_v6.3.0_finance_bill_note.sql`](./data/migration_v6.3.0_finance_bill_note.sql) | Thêm cột `finance_bills.note` (ghi chú hóa đơn). Idempotent, không đụng dữ liệu. |
| 6 | [`data/migration_v6.4.0_finance_lending.sql`](./data/migration_v6.4.0_finance_lending.sql) | Bảng `finance_lendings` (Cho vay) + cột `finance_transactions.lending_id`. Sửa hai CHECK để giao dịch thu về được `excluded`. Idempotent. |
| 7 | [`data/migration_v6.5.0_finance_bill_icon.sql`](./data/migration_v6.5.0_finance_bill_icon.sql) | Cột `finance_bills.icon` để user chọn icon riêng cho từng hóa đơn. Idempotent. |
| 8 | [`data/migration_v6.6.0_finance_card_annual_fee.sql`](./data/migration_v6.6.0_finance_card_annual_fee.sql) | Cột `finance_cards.annual_fee_on` (ngày thu phí thường niên). **Bắt buộc** — thiếu là form thêm thẻ lỗi `PGRST204`. Idempotent. |
| 9 | [`data/migration_v6.7.0_finance_bill_multi_month.sql`](./data/migration_v6.7.0_finance_bill_multi_month.sql) | Cột `finance_bills.anchor_date` cho hóa đơn nhiều tháng một lần (quý/năm); chu kỳ nằm trong `rrule.every`. Idempotent. |
| 10 | [`data/migration_v6.8.0_finance_bill_term_offset.sql`](./data/migration_v6.8.0_finance_bill_term_offset.sql) | Cột `finance_bills.term_offset` (kỳ trả góp đã trả trước khi dùng app) + trigger tính lại `term_done`. Có backfill và verify. Idempotent. |
| 11 | [`data/migration_v6.9.0_finance_rule_detach.sql`](./data/migration_v6.9.0_finance_rule_detach.sql) | Xóa hóa đơn/khoản vay/thẻ không còn bị `ON DELETE RESTRICT` chặn: năm FK sang `SET NULL`, nới CHECK cặp id↔kỳ. Thuần DDL, không đụng dữ liệu. Idempotent. |
| 12 | [`data/migration_v6.9.1_finance_lending_forfeited.sql`](./data/migration_v6.9.1_finance_lending_forfeited.sql) | Cột `finance_lendings.forfeited_interest` (lãi mất do đập tiết kiệm trước hạn — tiền tuyệt đối, không nhân số ngày). **Bắt buộc** — thiếu là lưu khoản cho vay lỗi `PGRST204`. Additive, idempotent. |
| 13 | [`data/migration_v6.10.0_drop_inspirational_quotes.sql`](./data/migration_v6.10.0_drop_inspirational_quotes.sql) | Drop bảng `inspirational_quotes` (không còn consumer từ v6.9.0). **Fail-closed**: từ chối chạy nếu bảng còn dù một dòng. Idempotent. |
| 14 | [`data/migration_v6.11.0_finance_taxonomy.sql`](./data/migration_v6.11.0_finance_taxonomy.sql) | Cập nhật taxonomy 10 nhóm chi chính và subcategories. Idempotent. |
| 15 | [`data/migration_v6.12.0_finance_necessity_two_tiers.sql`](./data/migration_v6.12.0_finance_necessity_two_tiers.sql) | Hợp nhất mức độ thiết yếu thành 2 cấp (`need` và `want`). Idempotent. |
| 16 | [`data/migration_v6.13.0_finance_transaction_description.sql`](./data/migration_v6.13.0_finance_transaction_description.sql) | Cột `finance_transactions.description` cho ghi chú tự do nhiều dòng. Idempotent. |
| 17 | [`data/migration_v6.14.0_vault_change_passphrase.sql`](./data/migration_v6.14.0_vault_change_passphrase.sql) | Policy UPDATE cho bảng `vault_config` phục vụ đổi Mật khẩu chính. Idempotent. |
| 18 | [`data/migration_v6.15.0_vault_recovery_key.sql`](./data/migration_v6.15.0_vault_recovery_key.sql) | Thêm cột `recovery_wrapped_key`, `recovery_wrapped_nonce`, `recovery_salt` vào `vault_config`. Idempotent. |

Dọn dẹp bảng cũ (tùy chọn):
- [`data/drop_incubator_tables.sql`](./data/drop_incubator_tables.sql) (gỡ bỏ các bảng `intention_*` của phân hệ Ươm mầm đã ngưng phát triển).

> Không chạy thêm `migration_v5.0.0_activity_logs_v2.sql` trên fresh install vì thay đổi đó đã nằm
> trong baseline. Không chạy lại baseline một mình trên database đã ở v6.x: nó có thể tạo lại bảng
> Finance legacy trước khi migration v6 xóa chúng. Finance v6 sẽ xóa dữ liệu `expenses` và
> `subscriptions`; xem preflight/VERIFY trước khi dùng trên DB đang có dữ liệu.

### Nâng production hiện có lên Vault v6.2 — user tự chạy

Vault v6.2 mã hóa **toàn bộ nội dung do người dùng nhập** ngay trong trình duyệt bằng AES-GCM:
tiêu đề, username, URL, notes, tags, fields, phương thức đăng nhập, recovery codes và history.
Supabase nhận owner/id, timestamps, ciphertext, nonce, version và `vault_config` gồm KDF metadata +
DEK đã wrap. Vault passphrase, KEK và raw DEK không được lưu trên server.

Migration này là cutover dành riêng cho **Vault trống**. Nó chủ động dừng và rollback nếu bảng
`accounts` có bất kỳ dòng nào; không có quá trình chuyển plaintext cũ.

Trước khi nâng Vault, xác minh Finance v6 đã được áp dụng. Nếu production chưa có các bảng
`finance_*`, user phải backup/đối soát schema rồi chạy migration Finance v6 trước; migration đó xóa
Finance legacy nên không được chạy chỉ dựa trên phỏng đoán “chắc là chưa có dữ liệu”.

1. Trong **Supabase → SQL Editor**, xác nhận Vault production đang trống:

   ```sql
   SELECT COUNT(*) AS vault_items FROM public.accounts;
   ```

2. Chỉ tiếp tục khi kết quả là `0`. Nếu lớn hơn `0`, dừng lại; export/kiểm tra dữ liệu trước và
   không xóa dữ liệu thật chỉ để ép migration chạy.
3. Mở [`data/migration_v6.2.0_vault_encryption.sql`](./data/migration_v6.2.0_vault_encryption.sql),
   copy toàn bộ nội dung vào SQL Editor và bấm **Run đúng một lần**.
4. Deploy/redeploy frontend v6.2 trên Vercel ngay sau khi SQL thành công.
5. Đăng nhập, vào `/accounts`, tạo một **Vault passphrase riêng tối thiểu 12 ký tự**, rồi lưu nó ở
   nơi an toàn. Passphrase này khác mật khẩu đăng nhập Supabase.
6. Tạo một item thử, khóa Vault, reload trang và mở lại để xác nhận passphrase/ciphertext hoạt động.

> ⚠️ Vault passphrase không có reset hoặc recovery. Mất passphrase đồng nghĩa mất khả năng giải mã
> item đã lưu. Không xóa `vault_config` khi còn ciphertext trong `accounts`. Bản v6.2 chưa có
> export/restore hoặc đổi passphrase, nên chưa dùng Vault làm **bản sao duy nhất** của secret quan
> trọng; luôn giữ một bản khôi phục độc lập.

### Reset dữ liệu app (giữ nguyên schema và tài khoản đăng nhập)

[`data/reset_user_data.sql`](./data/reset_user_data.sql) xóa dữ liệu ứng dụng của **tất cả user**,
bao gồm ciphertext Vault và `vault_config`, nhưng giữ `auth.users`. Script không có `WHERE` và
không thể hoàn tác; chỉ dùng cho local/test hoặc khi chủ động muốn xóa sạch production. XP và
profiles chỉ bị xóa nếu tự mở các dòng tùy chọn ở cuối file.

---

## ☁️ Deploy (Vercel)

### Bước 1: Deploy code

1. Push code lên GitHub
2. Vào [vercel.com](https://vercel.com) → **Add New Project** → Import repo
3. Vercel tự detect Vite — giữ nguyên build settings
4. Click **Deploy** → ~1 phút → live ✅

### Bước 2: Environment Variables

Vào **Vercel → Project → Settings → Environment Variables**, thêm:

| Biến | Bắt buộc | Giá trị |
|------|:--------:|---------|
| `VITE_SUPABASE_URL` | ✅ | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | ✅ | `sb_publishable_...` (hoặc `eyJhb...`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | media | Service Account JSON (1 dòng) — bật upload + stream |
| `DRIVE_FOLDER_ID` | media | ID thư mục Drive gốc — bật upload + stream |
| `ALLOWED_ORIGIN` | ❌ | Origin app cho CORS các serverless function |

> `vercel.json` đã cấu hình sẵn cho SPA routing.

### Bước 3: Redeploy

Sau khi thêm env vars → vào **Deployments** → **Redeploy** (hoặc push commit mới).

---

## 📁 Cấu Trúc Thư Mục

```
src/
  pages/                    ← 7 route pages (Landing + 6 lazy modules)
    TasksPage.jsx           ← /tasks — Danh sách + Lịch 5 chế độ
    FinancePage.jsx         ← /finance/:screen — module Finance Nocturne
    AccountsPage.jsx        ← /accounts — Account Vault Keyplate
    InboxPage.jsx           ← /inbox — quick capture
    CollectPage.jsx         ← /collect — Sổ tay Kiến thức PKM / Athenaeum
    FocusPage.jsx           ← /focus — Pomodoro
    SettingsPage.jsx        ← /settings — Tags + Profile
  components/               ← UI dùng lại; finance/ (Finance), kb/ (Knowledge PKM)
    CalendarToolbar.jsx     ← Toolbar ghim đỉnh đa chế độ Lịch
    CalendarWidgetPanel.jsx ← Lịch vạn niên, Can Chi, Giờ Hoàng đạo, Ngày lễ & Kỷ niệm
    WeekCalendar.jsx        ← Lịch Tuần 7 cột thông minh
    MonthCalendar.jsx       ← Lịch Tháng kết hợp Dương & Âm lịch
    TaskCreateModal.jsx     ← Modal tạo nhanh Task có smart prefill
    AppIcon.jsx             ← Phosphor icon adapter dùng toàn app
  hooks/                    ← Supabase/data logic, không đặt trong component
    useUserTasks.js         ← Task CRUD, recurrence, optimistic state
    useFinance.js           ← 10 bảng Finance
    useAccounts.js          ← Account Vault
    useCollections.js       ← Inbox & Knowledge Base
  contexts/                 ← Auth, Theme, Toast
  data/                     ← JSON tĩnh: UI strings, holidays, taxonomy, templates
  styles/                   ← CSS per domain (global.css = tokens, kb-tokens.css, calendar-widget.css...)
  __tests__/                ← Self-check 24 bài test phân theo 4 domain (tasks/, vault/, finance/, core/)
  utils/                    ← Pure logic: kbDeriveUtils, calendarTimeUtils, lunarUtils, financeLogic, vaultCrypto
  lib/supabase.js           ← Singleton Supabase client
api/
  upload.js                 ← File upload proxy → Google Drive (Supabase JWT required)
  stream.js                 ← Google Drive media stream proxy (Range/seek; folder-scoped)
  _lib/verifyAuth.js        ← Supabase JWT verification helper (not a route)
  _lib/driveToken.js        ← Drive Service Account token, cached per scope (not a route)
  _lib/smoke.test.js        ← Self-check: `node api/_lib/smoke.test.js`
data/
  schema_v4.24.0.sql        ← Baseline schema lõi (đã gộp tới v5.0)
  migration_v5.2.0_vault.sql
  migration_v6.0.0_finance.sql
  migration_v6.2.0_vault_encryption.sql
  migration_v6.3.0_finance_bill_note.sql
  migration_v6.4.0_finance_lending.sql
  migration_v6.5.0_finance_bill_icon.sql
  migration_v6.6.0_finance_card_annual_fee.sql
  migration_v6.7.0_finance_bill_multi_month.sql
  migration_v6.8.0_finance_bill_term_offset.sql
  migration_v6.9.0_finance_rule_detach.sql
  migration_v6.9.1_finance_lending_forfeited.sql
  migration_v6.10.0_drop_inspirational_quotes.sql
  migration_v6.11.0_finance_taxonomy.sql
  migration_v6.12.0_finance_necessity_two_tiers.sql
  migration_v6.13.0_finance_transaction_description.sql
  migration_v6.14.0_vault_change_passphrase.sql
  migration_v6.15.0_vault_recovery_key.sql
  drop_incubator_tables.sql ← Dọn dẹp bảng cũ Ươm mầm
  reset_user_data.sql       ← Wipe toàn bộ app data, giữ auth users
supabase/
  migrations/               ← Chuỗi migration timestamp chỉ dùng local
docs/
  PROJECT.md                ← Bản đồ cấp cao
  ARCHITECTURE.md           ← Module structure + data flow
  DATABASE.md               ← SQL, RLS, RPC và thứ tự migration
  FEATURES.md               ← Toàn bộ hành vi tính năng
  MODULE_KNOWLEDGE.md       ← Hướng dẫn chuyên sâu Knowledge PKM
  DESIGN_SYSTEM.md          ← Quy chuẩn layout & thiết kế giao diện
  DESIGN_ACCOUNT_VAULT.md  ← Hợp đồng thiết kế Vault
  DESIGN_FINANCE.md        ← Hợp đồng thiết kế Finance
  TASKS.md                  ← Các việc còn mở, có thể thực hiện
  PLAN.md                   ← Thứ tự ưu tiên và roadmap
  RULES.md                  ← Quy tắc phát triển và an toàn
DESIGN.md                   ← Design system và component contract
CHANGELOG.md                ← Lịch sử phiên bản
```

---

## 🧭 Tài liệu và đường dẫn

| Nội dung | File chính |
|----------|------------|
| Cấu hình môi trường mẫu | [`.env.local.example`](./.env.local.example) |
| Scripts chạy/test/build/database | [`package.json`](./package.json) |
| Cấu hình deploy Vercel | [`vercel.json`](./vercel.json) |
| Bản đồ dự án | [`docs/PROJECT.md`](./docs/PROJECT.md) |
| Kiến trúc và data flow | [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) |
| Database, RLS và RPC | [`docs/DATABASE.md`](./docs/DATABASE.md) |
| Hành vi tính năng | [`docs/FEATURES.md`](./docs/FEATURES.md) |
| Không gian Quản trị Tri thức PKM | [`docs/MODULE_KNOWLEDGE.md`](./docs/MODULE_KNOWLEDGE.md) |
| Quy chuẩn Thiết kế & Bố cục | [`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md) |
| Thiết kế Account Vault | [`docs/DESIGN_ACCOUNT_VAULT.md`](./docs/DESIGN_ACCOUNT_VAULT.md) |
| Thiết kế Finance | [`docs/DESIGN_FINANCE.md`](./docs/DESIGN_FINANCE.md) |
| Trạng thái/backlog | [`docs/TASKS.md`](./docs/TASKS.md) và [`docs/PLAN.md`](./docs/PLAN.md) |
| Quy tắc phát triển và an toàn | [`docs/RULES.md`](./docs/RULES.md) |
| Design system | [`DESIGN.md`](./DESIGN.md) |
| Lịch sử phiên bản | [`CHANGELOG.md`](./CHANGELOG.md) |

---

## 🗺 Pages & Routes

| URL | Mô tả |
|-----|-------|
| `/` | Landing / đăng nhập |
| `/inbox` | Quick-capture inbox |
| `/tasks` | Nhiệm vụ & Không gian Lịch 5 chế độ |
| `/collect` | Sổ tay Tri thức PKM (Athenaeum / Wiki-links / Graph View) |
| `/finance`, `/finance/:screen` | Tổng quan, Nhập nhanh, Giao dịch, Danh mục, Hóa đơn; Thống kê nằm trong Tổng quan |
| `/accounts` | Account Vault mã hóa hai pane + Emergency Recovery Key |
| `/focus` | Pomodoro timer + XP |
| `/settings` | Tags + Profile |
| `/incubator`, `/tracker`, `/habits`, `/dashboard`, `/journey` | Redirect về `/tasks` (module cũ đã gỡ) |

---

## ✨ Tính Năng Chính

### 🏠 Core
- **Nhiệm vụ & Lịch:** 5 chế độ xem (List, Agenda, Day, Week, Month), Lịch vạn niên, Can Chi, Giờ hoàng đạo, Ngày lễ, Kỷ niệm cá nhân
- **Finance:** giao dịch, phân loại thiết yếu 2 cấp, ghi chú nhiều dòng, drawer 560px, danh mục, hóa đơn, khoản vay, thẻ và quỹ tiết kiệm
- **Account Vault:** full-content AES-GCM phía client, đổi Master Passphrase, Khóa khôi phục khẩn cấp 24 từ, xuất JSON rõ nghĩa và backup/restore mã hóa
- **Knowledge Base (PKM):** Liên kết 2 chiều `[[Wiki-links]]`, Graph Network View canvas, Backlinks ngữ cảnh, Reader TOC & Read Time, Dual-mode editor (Markdown + Tiptap Visual)
- **Inbox:** Quick capture → phân loại
- **Focus:** Pomodoro + XP event log

---

## 🛠 Tech Stack

| | |
|--|--|
| **Frontend** | React 19, Vite 8, React Router 7 |
| **Editor** | Tiptap v3 (ProseMirror) + Markdown + PKM Wiki-links |
| **Styling** | Vanilla CSS, Dark/Light mode, Glassmorphism, 100dvh Workspace Pattern |
| **Backend** | Supabase (PostgreSQL + Auth + RLS) |
| **Serverless** | Vercel Functions (`api/upload.js`, `api/stream.js`) |
| **Media Storage** | Google Drive (Service Account, server-side upload + stream proxy) |
| **Deploy** | Vercel (static SPA + serverless functions) |
| **PWA** | Web App Manifest, Service Worker |

---

## 📦 Phiên bản hiện hành

| Version | Mô tả |
|---------|-------|
| **v6.16.0** | Đại tu Knowledge Base thành PKM Athenaeum (Wiki-links, Graph View, Backlinks, Split Editor); Không gian Lịch 5 chế độ (`list`, `agenda`, `day`, `week`, `month`) kết hợp Lịch Vạn Niên & Can Chi; gỡ bỏ hoàn toàn module Ươm mầm |
| **v6.15.0** | Khóa khôi phục khẩn cấp Két mật mã (Emergency Recovery Key 24 từ / base64); xuất Plaintext JSON có xác thực Master Passphrase; Ciphertext Backup & Restore |
| **v6.14.0** | Đổi Master Passphrase Két mật mã (re-wrap DEK với salt/KEK mới); luồng Quên mật khẩu đăng nhập (Forgot Password OTP/Email) |
| **v6.13.0** | Ghi chú nhiều dòng (`description`) cho Giao dịch Tài chính; Drawer Sửa giao dịch 560px hỗ trợ nơi nhận và bảng chi tiết từng món; gom test thành 4 domain |
| **v6.12.0** | Tái cấu trúc Header Tài chính tinh gọn (Phương án A); hợp nhất Toolbar giao dịch; gom phân loại thiết yếu thành 2 cấp (`need` và `want`) |

Lịch sử đầy đủ và các feature đã xóa chỉ nằm trong [`CHANGELOG.md`](./CHANGELOG.md).

---

## 🐛 Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| App trắng, không load | Kiểm tra `VITE_SUPABASE_URL` trong `.env.local` |
| Upload ảnh/file thất bại | Đăng nhập trước; kiểm tra `GOOGLE_SERVICE_ACCOUNT_JSON` + `DRIVE_FOLDER_ID` trên Vercel |
| Audio/video Drive không phát | Kiểm tra `DRIVE_FOLDER_ID` (stream proxy fail-closed nếu thiếu) |
| Quotes tab trống / Collect lỗi khi lưu | Đối chiếu schema với ordered chain phía trên. Không chạy baseline một mình trên database v6.x |
| Vault báo thiếu `vault_config`/cột ciphertext | Với fresh install chạy đủ baseline → Vault v5.2 → Finance v6 → Vault encryption v6.2; với project hiện có làm đúng runbook nâng production phía trên |
| Vault migration báo `accounts is not empty` | Dừng lại: migration đang bảo vệ dữ liệu cũ. Chỉ xóa/export khi đã xác nhận đó là test data |
| Quên Vault passphrase | Không có reset/recovery; không xóa config vì sẽ làm ciphertext còn lại không thể giải mã |
| Finance báo không tải được dữ liệu | Chạy DB đúng thứ tự: baseline → Vault v5.2 → Finance v6 → Vault encryption v6.2; dùng nút Thử lại sau khi migration thành công |
| 404 khi refresh | Kiểm tra [`vercel.json`](./vercel.json) có rewrite rule |
| Build fail | `npm run build` — check console errors |

---

*Built with ❤️ — Kỷ luật không phải ý chí, là hệ thống.*
