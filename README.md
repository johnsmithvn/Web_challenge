# Life Hub — Personal Life OS v4.23.0

> **Kỷ Luật = Hệ Thống, Không Phải Ý Chí**

Ứng dụng quản lý cuộc sống cá nhân all-in-one: habit tracking 21 ngày, quản lý tài chính, pomodoro focus timer, knowledge base, daily quotes, life log heatmap, journey system, incubator, XP/Level, và more.

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
```

> **Không có Supabase?** App vẫn chạy ở chế độ Guest (in-memory state, reset khi refresh). Chỉ cần key để bật Auth + cloud sync.

---

## ⚙️ Environment Variables

File `.env.local.example` chứa tất cả biến. Copy sang `.env.local` rồi điền giá trị.

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

Mọi file được upload qua **Google Drive Service Account** (Vercel serverless `api/upload.js`) và phát lại qua proxy `api/stream.js`. Upload **yêu cầu người dùng đã đăng nhập** (xác thực Supabase JWT).

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

### Cài lần đầu (Fresh Install)

Chỉ cần **1 bước**: mở **Supabase → SQL Editor**, dán toàn bộ nội dung file dưới đây rồi **Run**:

| File | Nội dung |
|------|----------|
| **`data/schema_v4.24.0.sql`** | **Schema hợp nhất** — toàn bộ bảng + RLS + indexes + triggers + functions + seed (đã gộp mọi migration v4.4.0 → v4.24.0). Idempotent, chạy lại được. |

> **Lưu ý:** Đây là file **duy nhất** cần chạy (đã gộp tất cả migration cũ). Nó cũng vá lỗ rò email ở `profiles` (v4.24.0). Frontend tương ứng đã dùng các hàm `rpc()` định nghĩa trong file này — deploy code mới + chạy file này cùng lúc.

### Reset dữ liệu user (giữ nguyên schema)

```sql
-- Xóa dữ liệu của 1 user cụ thể (giữ bảng + schema)
-- File: data/reset_user_data.sql
```

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
  pages/                    ← Route pages (lazy-loaded)
    LandingPage.jsx         ← / — Marketing
    TrackerPage.jsx         ← /tracker — Habit tracker 4 tabs
    InboxPage.jsx           ← /inbox — Quick capture
    CollectPage.jsx         ← /collect — Knowledge Base (dual-mode editor)
    FinancePage.jsx         ← /finance — Chi tiêu + Subscriptions
    LifeLogPage.jsx         ← /life-log — Heatmap + Timeline
    FocusPage.jsx           ← /focus — Pomodoro timer
    JourneyPage.jsx         ← /journey — Journey browser
    DashboardPage.jsx       ← /dashboard — Unified stats
    IncubatorPage.jsx       ← /incubator — Someday/Maybe ideas
    SettingsPage.jsx        ← /settings — Tags + Quotes + Profile
    ...
  components/
    TiptapEditor.jsx        ← WYSIWYG editor (Tiptap v3)
    SlashCommand.jsx        ← / slash command menu
    MediaPreview.jsx        ← Render YouTube/Drive/audio/video
    CustomAudioPlayer.jsx   ← Glassmorphic HTML5 audio player
    GlobalAudioPlayer.jsx   ← Floating random-podcast mini-player
    QuoteWidget.jsx         ← Daily quote with shuffle + audio
    UrlInputPopover.jsx     ← Shared media URL input
    QuickCapture.jsx        ← Global floating [+] → inbox
    ...
  extensions/
    MediaNode.jsx           ← Custom Tiptap media node (audio/video/YouTube/Drive)
  hooks/
    useHabitStore.js        ← Supabase-first habit ticks
    useCollections.js       ← KB article CRUD
    useQuotes.js            ← User quotes CRUD + system merge
    useRandomPodcast.js     ← Random podcast picker (Drive audio)
    useKnowledgeGroups.js   ← KB groups M:N
    useCollectionNotes.js   ← Threaded sub-notes
    useIntentions.js        ← Incubator CRUD
    ...
  contexts/
    AuthContext.jsx         ← Supabase Auth
    ThemeContext.jsx         ← Dark/Light mode
    JourneyContext.jsx      ← Active journey state
  data/
    challenges.json         ← 21 Daily Challenges
    quiz.json               ← 10 quiz questions
    habits.json             ← defaultHabits, categories, moods
    quotes.json             ← 30 motivational quotes
    programs.json           ← 5 journey templates
    ...
  styles/                   ← CSS per domain (global.css = tokens)
  utils/                    ← Pure utility functions
  lib/supabase.js           ← Singleton Supabase client
api/
  upload.js                 ← File upload proxy → Google Drive (Supabase JWT required)
  stream.js                 ← Google Drive media stream proxy (Range/seek; folder-scoped)
  _lib/verifyAuth.js        ← Supabase JWT verification helper (not a route)
data/
  schema_v4.4.0.sql         ← Master DB schema
  migration_*.sql           ← Incremental migrations
docs/
  ARCHITECTURE.md           ← Module structure + data flow
  DATABASE.md               ← Full SQL schema + RLS
  FEATURES.md               ← All features documented
  PLAN.md                   ← Development phases
  TASKS.md                  ← TODO tracker
```

---

## 🗺 Pages & Routes

| URL | Mô tả |
|-----|-------|
| `/` | Landing page — marketing |
| `/tracker` | Habit tracker 4 tabs (Hôm Nay / Lịch / Tuần / Quản Lý) |
| `/inbox` | Quick-capture inbox |
| `/collect` | Knowledge Base — dual-mode editor (Tiptap + Markdown) |
| `/finance` | Chi tiêu + đăng ký gói |
| `/life-log` | Activity heatmap + daily timeline |
| `/focus` | Pomodoro timer |
| `/journey` | Journey browser (4 tabs) |
| `/journey/:id` | Journey dashboard |
| `/dashboard` | Unified stats |
| `/incubator` | Trạm Ấp Trứng — someday/maybe |
| `/settings` | Tags + Quotes + Profile |
| `/quiz` | Quiz não bộ |
| `/leaderboard` | Streak/XP ranking |
| `/life-journey` | Life emotion timeline SVG |

---

## ✨ Tính Năng Chính

### 🏠 Core
- **Habit Tracker:** Custom habits, per-habit streak, mood, skip reason, 21-day grid
- **Knowledge Base:** Dual-mode editor (Tiptap WYSIWYG + Markdown), multimedia (🖼️ ▶️ 🎵), slash commands, groups M:N, sub-notes
- **Inbox:** Quick capture → phân loại
- **Finance:** Chi tiêu + subscriptions + cashflow calendar
- **Life Log:** GitHub-style heatmap + daily timeline
- **Dashboard:** Unified stats — today + habits + finance + activity
- **Incubator:** Someday/maybe ideas with friction defer + multi-output execute

### 🎵 Media Infrastructure (v4.23.0)
- **Upload:** Paste / drop / toolbar → Google Drive (Service Account) qua `api/upload.js` — **yêu cầu đăng nhập**
- **Image / YouTube / Audio / Video:** toolbar + slash command; YouTube nhúng player, Drive media phát qua custom HTML5 player
- **Stream proxy:** `api/stream.js` proxy media Drive (hỗ trợ Range/seek) — chỉ phục vụ file nằm trong thư mục app
- **MediaNode (Tiptap v3):** tự nhận diện URL Drive / YouTube / audio / video khi paste
- **QuoteWidget:** Daily-seeded random, shuffle 🔀, audio support (Today / Inbox / KB)
- **Quote Manager:** Settings → CRUD personal quotes + view system quotes

### 🗺 Journey System
- 5 system templates + custom journeys (14/21/30/60 ngày)
- Journey detail dashboard + calendar + day modal

### 🎮 Gamification
- XP/Level (6 levels: 🌱→⚡→🔥→⚔️→👑→🏆)
- Daily Challenge, Quiz, Leaderboard, Pomodoro

### 🔐 Auth & Sync
- Email/Password + Google OAuth (Supabase)
- Guest mode: in-memory (reset on refresh)
- Auto migrate localStorage → Supabase on first login

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
| Quotes tab trống / Collect lỗi khi lưu | Chạy lại `data/schema_v4.24.0.sql` trong Supabase (idempotent) |
| 404 khi refresh | Kiểm tra `vercel.json` có rewrite rule |
| Build fail | `npm run build` — check console errors |

---

*Built with ❤️ — Kỷ luật không phải ý chí, là hệ thống.*
