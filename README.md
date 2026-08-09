# Life Hub — Personal Life OS v6.2.0

> **Kỷ Luật = Hệ Thống, Không Phải Ý Chí**

Ứng dụng quản lý cuộc sống cá nhân một người dùng: Inbox, Nhiệm vụ, Knowledge Base, Finance,
Account Vault, Incubator và Focus. Frontend React/Vite, dữ liệu chính trên Supabase với RLS.

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

# (tuỳ chọn) Self-check nhanh — node:assert, không cần cài gì thêm
npm test
```

> **Không có Supabase?** Các module cơ bản vẫn có thể chạy guest bằng state in-memory. Finance và
> Account Vault yêu cầu đăng nhập vì dữ liệu có nhiều quan hệ và không có guest fallback.

---

## ⚙️ Environment Variables

File [`.env.local.example`](./.env.local.example) chứa tất cả biến. Copy sang `.env.local` rồi điền giá trị.

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

Mọi file được upload qua **Google Drive Service Account** (Vercel serverless
[`api/upload.js`](./api/upload.js)) và phát lại qua proxy [`api/stream.js`](./api/stream.js).
Upload **yêu cầu người dùng đã đăng nhập** (xác thực Supabase JWT).

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

Bốn migration local được chạy tự động theo timestamp:

1. [`20260802000000_base_v5_0_0.sql`](./supabase/migrations/20260802000000_base_v5_0_0.sql)
2. [`20260805000000_vault_v5_2_0.sql`](./supabase/migrations/20260805000000_vault_v5_2_0.sql)
3. [`20260808000000_finance_v6_0_0.sql`](./supabase/migrations/20260808000000_finance_v6_0_0.sql)
4. [`20260809000000_vault_encryption_v6_2_0.sql`](./supabase/migrations/20260809000000_vault_encryption_v6_2_0.sql)

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
| 1 | [`data/schema_v4.24.0.sql`](./data/schema_v4.24.0.sql) | Master schema đã hợp nhất tới v5.0: bảng lõi, RLS, index, trigger, RPC, Task activity log. Idempotent. |
| 2 | [`data/migration_v5.2.0_vault.sql`](./data/migration_v5.2.0_vault.sql) | Schema Vault trung gian bắt buộc để v6.2 cutover. Idempotent. |
| 3 | [`data/migration_v6.0.0_finance.sql`](./data/migration_v6.0.0_finance.sql) | Finance v6 clean rebuild, 10 bảng + junction + RPC. Có kiểm tra và rollback khi thiếu. |
| 4 | [`data/migration_v6.2.0_vault_encryption.sql`](./data/migration_v6.2.0_vault_encryption.sql) | Cutover Vault trống sang full-content encryption. Chạy đúng một lần. |

> Không chạy thêm `migration_v5.0.0_activity_logs_v2.sql` trên fresh install vì thay đổi đó đã nằm
> trong master schema. Finance v6 sẽ xóa dữ liệu Finance legacy (`expenses`, `subscriptions`);
> xem phần VERIFY cuối từng file trước khi dùng trên DB đang có dữ liệu.

### Nâng production hiện có lên Vault v6.2 — user tự chạy

Vault v6.2 mã hóa **toàn bộ nội dung do người dùng nhập** ngay trong trình duyệt bằng AES-GCM:
tiêu đề, username, URL, notes, tags, fields, phương thức đăng nhập, recovery codes và history.
Supabase chỉ nhận owner/id, timestamps, ciphertext, nonce và version. Vault passphrase, KEK và DEK
thô không được lưu trên server.

Migration này là cutover dành riêng cho **Vault trống**. Nó chủ động dừng và rollback nếu bảng
`accounts` có bất kỳ dòng nào; không có quá trình chuyển plaintext cũ.

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
> item đã lưu. Không xóa `vault_config` khi còn ciphertext trong `accounts`.

### Reset dữ liệu app (giữ nguyên schema và tài khoản đăng nhập)

[`data/reset_user_data.sql`](./data/reset_user_data.sql) xóa dữ liệu ứng dụng của **tất cả user**,
bao gồm ciphertext Vault và `vault_config`, nhưng giữ `auth.users`. Script không có `WHERE` và
không thể hoàn tác; chỉ dùng cho local/test hoặc khi chủ động muốn xóa sạch production. XP,
friendships và profiles chỉ bị xóa nếu tự mở các dòng tùy chọn ở cuối file.

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
  pages/                    ← 9 route pages (Landing + 8 lazy modules)
    TasksPage.jsx           ← /tasks — Danh sách + Lịch
    FinancePage.jsx         ← /finance/:screen — module Finance Nocturne
    AccountsPage.jsx        ← /accounts — Account Vault Keyplate
    InboxPage.jsx           ← /inbox — quick capture
    CollectPage.jsx         ← /collect — Knowledge Base
    IncubatorPage.jsx       ← /incubator — someday/maybe
    FocusPage.jsx           ← /focus — Pomodoro
    SettingsPage.jsx        ← /settings — Tags + Quotes + Profile
  components/               ← UI dùng lại; finance/ chứa các màn Finance
    TaskListSection.jsx     ← CRUD task + completed range
    TaskDetailModal.jsx     ← Detail/log/note + edit tại chỗ
    MonthCalendar.jsx       ← Lịch task, âm lịch và ngày lễ
    AppIcon.jsx             ← Phosphor icon adapter dùng toàn app
  hooks/                    ← Supabase/data logic, không đặt trong component
    useUserTasks.js         ← Task CRUD, recurrence, optimistic state
    useFinance.js           ← 10 bảng Finance
    useAccounts.js          ← Account Vault
  contexts/                 ← Auth, Theme, Toast
  data/                     ← JSON tĩnh: UI strings, holidays, taxonomy, templates
  styles/                   ← CSS per domain (global.css = tokens)
  __tests__/                ← Self-check chạy qua npm test
  utils/                    ← Pure logic + self-check
  lib/supabase.js           ← Singleton Supabase client
api/
  upload.js                 ← File upload proxy → Google Drive (Supabase JWT required)
  stream.js                 ← Google Drive media stream proxy (Range/seek; folder-scoped)
  _lib/verifyAuth.js        ← Supabase JWT verification helper (not a route)
  _lib/driveToken.js        ← Drive Service Account token, cached per scope (not a route)
  _lib/smoke.test.js        ← Self-check: `node api/_lib/smoke.test.js`
data/
  schema_v4.24.0.sql        ← Master schema lõi (đã gộp tới v5.0)
  migration_v5.2.0_vault.sql
  migration_v6.0.0_finance.sql
  migration_v6.2.0_vault_encryption.sql
  reset_user_data.sql       ← Wipe toàn bộ app data, giữ auth users
supabase/
  migrations/               ← Chuỗi migration timestamp chỉ dùng local
docs/
  PROJECT.md                ← Bản đồ cấp cao
  ARCHITECTURE.md           ← Module structure + data flow
  DATABASE.md               ← SQL, RLS, RPC và thứ tự migration
  FEATURES.md               ← Toàn bộ hành vi tính năng
  TASKS.md                  ← Trạng thái + backlog
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
| Thiết kế Account Vault | [`docs/DESIGN_ACCOUNT_VAULT.md`](./docs/DESIGN_ACCOUNT_VAULT.md) |
| Thiết kế Finance | [`docs/DESIGN_FINANCE.md`](./docs/DESIGN_FINANCE.md) |
| Trạng thái/backlog | [`docs/TASKS.md`](./docs/TASKS.md) và [`docs/PLAN.md`](./docs/PLAN.md) |
| Design system | [`DESIGN.md`](./DESIGN.md) |
| Lịch sử phiên bản | [`CHANGELOG.md`](./CHANGELOG.md) |

---

## 🗺 Pages & Routes

| URL | Mô tả |
|-----|-------|
| `/` | Landing / đăng nhập |
| `/inbox` | Quick-capture inbox |
| `/tasks` | Nhiệm vụ: Danh sách + Lịch tháng |
| `/collect` | Knowledge Base — dual-mode editor (Tiptap + Markdown) |
| `/finance`, `/finance/:screen` | Tổng quan, Nhập nhanh, Giao dịch, Danh mục, Hóa đơn; Ngân sách/Thống kê nằm trong Tổng quan |
| `/accounts` | Account Vault hai pane |
| `/incubator` | Trạm Ấp Trứng — someday/maybe |
| `/focus` | Pomodoro timer |
| `/settings` | Tags + Quotes + Profile |
| `/tracker`, `/habits`, `/dashboard`, `/journey` | Redirect về `/tasks` (module cũ đã gỡ v5.0) |

---

## ✨ Tính Năng Chính

### 🏠 Core
- **Nhiệm vụ:** danh sách full-bleed, lịch tháng, task lặp, priority, tag, liên kết Knowledge và lịch sử thay đổi
- **Finance:** giao dịch, ngân sách/thống kê, danh mục, hóa đơn, khoản vay, thẻ và quỹ tiết kiệm; liên kết Task/Inbox
- **Account Vault:** full-content AES-GCM phía client; phải unlock mới tải/hiện title, username, URL,
  notes, tags, fields, mã dự phòng và history
- **Knowledge Base:** editor Tiptap + Markdown, multimedia, slash command, tag và sub-note
- **Inbox:** Quick capture → phân loại
- **Incubator:** Someday/maybe ideas with friction defer + multi-output execute
- **Focus:** Pomodoro + XP event log

### 📌 Tasks v6.1.0
- **Task Detail:** nút Sửa dùng lại form edit ngay trong popup; không đóng popup hoặc navigate về list
- **Hoàn thành tức thời:** task vừa tick xuất hiện ngay trong khối Đã hoàn thành; lỗi DB rollback cả hai state
- **Lịch:** ngày dương + ngày âm + tên ngày lễ trong ô, không chồng chữ; panel ngày liệt kê task xong và sắp tới
- **Sức chứa:** ngày thường tối đa 4 task, ngày lễ 3 task để dành một dòng cho tên lễ; phần còn lại hiện đúng `+N nữa…`

### 🎵 Media Infrastructure (v4.23.0)
- **Upload:** Paste / drop / toolbar → Google Drive (Service Account) qua `api/upload.js` — **yêu cầu đăng nhập**
- **Image / YouTube / Audio / Video:** toolbar + slash command; YouTube nhúng player, Drive media phát qua custom HTML5 player
- **Stream proxy:** `api/stream.js` proxy media Drive (hỗ trợ Range/seek) — chỉ phục vụ file nằm trong thư mục app
- **MediaNode (Tiptap v3):** tự nhận diện URL Drive / YouTube / audio / video khi paste
- **QuoteWidget:** Daily-seeded random, shuffle 🔀, audio support (Today / Inbox / KB)
- **Quote Manager:** Settings → CRUD personal quotes + view system quotes

### 🔐 Auth & Sync
- Email/Password + Google OAuth (Supabase)
- RLS own-row cho dữ liệu người dùng
- Guest in-memory ở các module hỗ trợ; Finance và Account Vault yêu cầu đăng nhập

---

## 🛠 Tech Stack

| | |
|--|--|
| **Frontend** | React 19, Vite 8, React Router 7 |
| **Editor** | Tiptap v3 (ProseMirror) + custom extensions |
| **Styling** | Vanilla CSS, Dark/Light mode, Glassmorphism |
| **Backend** | Supabase (PostgreSQL + Auth + RLS) |
| **Serverless** | Vercel Functions (`api/upload.js`, `api/stream.js`) |
| **Media Storage** | Google Drive (Service Account, server-side upload + stream proxy) |
| **Deploy** | Vercel (static SPA + serverless functions) |
| **PWA** | Web App Manifest, Service Worker |

---

## 📦 Phiên Bản

| Version | Mô tả |
|---------|-------|
| **v6.2.0** | Account Vault full-content encryption: PBKDF2-SHA256 600.000 vòng, DEK bọc bằng passphrase, AES-GCM + AAD theo user/item; key chỉ giữ trong memory |
| **v6.1.0** | Tasks full-bleed; completed range; edit trong detail popup; lịch âm/ngày lễ; giới hạn 4/3 task theo sức chứa ô |
| **v6.0.0** | Finance Nocturne clean rebuild, 10 bảng + junction/RPC, liên kết Task và Inbox |
| **v5.2.0** | Account Vault Keyplate, 6 bảng, field/auth/code/history |
| **v5.0.0** | Task Detail + activity log v2; gỡ Habit, Journey, Life Log, Dashboard, Quiz và Leaderboard |
| **v4.23.0** | Drive stream proxy (`api/stream.js`) + custom audio player + API hardening (auth/CORS/rate-limit) |
| **v4.16.1** | Unified Google Drive upload — thay thế Imgur + Cloudflare R2 |
| **v4.13.0–v4.22.0** | GlobalAudioPlayer + useRandomPodcast, MediaNode (thay AudioNode), CustomAudioPlayer, currency settings, GenericModal, dateUtils |
| **v4.12.0** | Media Infrastructure: Image/YouTube/Audio + QuoteWidget + Quote Manager |
| **v4.11.0** | Knowledge Groups M:N + Sub-Notes |
| **v4.9.0** | Task priority system + ClickUp DatePicker |
| **v4.5.0** | M:M Task↔KB linking + LinkKBModal |
| **v4.1.0** | Tag Unification + Settings Page |
| **v4.0.0** | Fitness Log + OG metadata API |
| **v3.9.0** | Incubator (someday/maybe + friction defer) |
| **v3.7.0** | PARA Tags + Cashflow Calendar |
| **v3.3.0** | Tiptap WYSIWYG + Slash Commands + Shortcuts |
| **v3.0.0** | Personal Life Hub: Inbox+Collect+Finance+LifeLog |
| **v2.2.0** | Life Journey + Theme toggle |
| **v2.0.0** | Journey Owns Habits + MyJourneys |
| **v1.0.0** | MVP — landing, tracker, dashboard |

---

## 🌿 Git Workflow

```bash
# Feature branch
git checkout -b feat/ten-feature

# Commit theo Conventional Commits
git commit -m "feat(media): v4.12.0 — Image/YouTube/Audio + QuoteWidget"
git commit -m "fix(finance): subscription date filter"
git commit -m "docs: update README v4.12.0"

# Push và tạo PR
git push origin feat/ten-feature
```

---

## 🐛 Troubleshooting

| Vấn đề | Giải pháp |
|--------|-----------|
| App trắng, không load | Kiểm tra `VITE_SUPABASE_URL` trong `.env.local` |
| Upload ảnh/file thất bại | Đăng nhập trước; kiểm tra `GOOGLE_SERVICE_ACCOUNT_JSON` + `DRIVE_FOLDER_ID` trên Vercel |
| Audio/video Drive không phát | Kiểm tra `DRIVE_FOLDER_ID` (stream proxy fail-closed nếu thiếu) |
| Quotes tab trống / Collect lỗi khi lưu | Chạy lại [`data/schema_v4.24.0.sql`](./data/schema_v4.24.0.sql) trong Supabase (idempotent) |
| Vault báo thiếu `vault_config`/cột ciphertext | Với fresh install chạy đủ master → Vault v5.2 → Finance v6 → Vault encryption v6.2; với project hiện có làm đúng runbook nâng production phía trên |
| Vault migration báo `accounts is not empty` | Dừng lại: migration đang bảo vệ dữ liệu cũ. Chỉ xóa/export khi đã xác nhận đó là test data |
| Quên Vault passphrase | Không có reset/recovery; không xóa config vì sẽ làm ciphertext còn lại không thể giải mã |
| Finance báo không tải được dữ liệu | Chạy DB đúng thứ tự: master → Vault v5.2 → Finance v6 → Vault encryption v6.2; dùng nút Thử lại sau khi migration thành công |
| 404 khi refresh | Kiểm tra [`vercel.json`](./vercel.json) có rewrite rule |
| Build fail | `npm run build` — check console errors |

---

*Built with ❤️ — Kỷ luật không phải ý chí, là hệ thống.*
