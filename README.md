# Life Hub — Personal Life OS v4.12.0

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

### Tùy chọn — Imgur (auto-upload ảnh khi paste/drop)

| Biến | Ở đâu | Mục đích |
|------|--------|----------|
| `IMGUR_CLIENT_ID` | Vercel only | Imgur Anonymous API |

**Cách lấy:**
1. Vào [api.imgur.com/oauth2/addclient](https://api.imgur.com/oauth2/addclient)
2. **Application name:** LifeHub
3. **Authorization type:** "Anonymous usage without user authorization"
4. **Callback URL:** `https://your-domain.vercel.app`
5. Submit → Copy **Client ID** (KHÔNG phải Secret)

> ⚠️ **KHÔNG thêm prefix `VITE_`** — biến này chỉ dùng server-side trong Vercel Functions.

### Tùy chọn — Cloudflare R2 (upload audio/file lớn)

| Biến | Ở đâu | Mục đích |
|------|--------|----------|
| `R2_ACCOUNT_ID` | Vercel only | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | Vercel only | R2 API Key |
| `R2_SECRET_ACCESS_KEY` | Vercel only | R2 API Secret |
| `R2_BUCKET_NAME` | Vercel only | Tên bucket (mặc định: `lifehub-media`) |
| `R2_PUBLIC_URL` | Vercel only | Public URL của bucket |

**Cách tạo:**
1. Vào [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage**
2. **Create Bucket** → Tên: `lifehub-media` → Region: Auto
3. Vào bucket → **Settings** → **Public access** → **Allow Access**
4. Copy **Public Bucket URL** → `R2_PUBLIC_URL`
5. **Manage R2 API Tokens** → Create Token → Permission: Object Read & Write → Scope: `lifehub-media`
6. Copy **Access Key ID** + **Secret Access Key**

> ⚠️ **KHÔNG thêm prefix `VITE_`** — server-side only. Không bao giờ expose secrets ra frontend.

---

## 🗄 Database Setup (Supabase)

### Cài lần đầu (Fresh Install)

Chạy SQL trong **Supabase SQL Editor** theo thứ tự:

| # | File | Nội dung |
|---|------|----------|
| 1 | `data/schema_v4.4.0.sql` | **Master schema** — tạo tất cả bảng + RLS + indexes + triggers + seed data |
| 2 | `data/migration_v4.7.2_add_description_to_intentions.sql` | Thêm cột `description` cho intentions |
| 3 | `data/migration_v4.9.0_task_priority.sql` | Thêm priority cho tasks |
| 4 | `data/migration_v4.10.1_drop_mood.sql` | Dọn bảng mood cũ |
| 5 | `data/migration_v4.11.0_knowledge_groups.sql` | Knowledge Groups M:N + Sub-notes |
| 6 | `data/migration_v4.12.0_quotes.sql` | Inspirational quotes (user-managed) |

> **Lưu ý:** `schema_v4.4.0.sql` là file master, chứa tất cả bảng từ v1.0 → v4.4.0. Các migration sau đó là incremental.

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
| `VITE_SUPABASE_ANON_KEY` | ✅ | `eyJhb...` |
| `IMGUR_CLIENT_ID` | ❌ | Client ID từ Imgur |
| `R2_ACCOUNT_ID` | ❌ | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | ❌ | R2 API Key |
| `R2_SECRET_ACCESS_KEY` | ❌ | R2 API Secret |
| `R2_BUCKET_NAME` | ❌ | `lifehub-media` |
| `R2_PUBLIC_URL` | ❌ | `https://pub-xxx.r2.dev` |

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
    TiptapEditor.jsx        ← WYSIWYG editor (Tiptap v2)
    SlashCommand.jsx        ← / slash command menu
    QuoteWidget.jsx         ← Daily quote with shuffle + audio
    UrlInputPopover.jsx     ← Shared media URL input
    QuickCapture.jsx        ← Global floating [+] → inbox
    ...
  extensions/
    AudioNode.js            ← Custom Tiptap audio player node
  hooks/
    useHabitStore.js        ← Supabase-first habit ticks
    useCollections.js       ← KB article CRUD
    useQuotes.js            ← User quotes CRUD + system merge
    useFileUpload.js        ← Upload to Imgur/R2
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
  meta.js                   ← OG metadata fetcher (Vercel Edge)
  upload.js                 ← File upload proxy (Imgur + R2)
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

### 🎵 Media Infrastructure (v4.12.0)
- **Image:** Paste/drop → auto-upload Imgur + toolbar + `/image` slash
- **YouTube:** Toolbar + `/youtube` slash → embedded player
- **Audio:** Custom AudioNode + toolbar 🎵 + `/audio` slash → native player
- **Upload API:** Dual provider (Imgur for images, R2 for audio/files)
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
| **Editor** | Tiptap v2 (ProseMirror) + custom extensions |
| **Styling** | Vanilla CSS, Dark/Light mode, Glassmorphism |
| **Backend** | Supabase (PostgreSQL + Auth + RLS) |
| **Serverless** | Vercel Functions (`api/upload.js`, `api/meta.js`) |
| **Image CDN** | Imgur (anonymous upload, free, unlimited) |
| **File Storage** | Cloudflare R2 (S3-compatible, 10GB free) |
| **Deploy** | Vercel (static SPA + serverless functions) |
| **PWA** | Web App Manifest, Service Worker |

---

## 📦 Phiên Bản

| Version | Mô tả |
|---------|-------|
| **v4.12.0** | Media Infrastructure: Image/YouTube/Audio + QuoteWidget + Imgur upload + Quote Manager |
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
| Paste ảnh không upload | Kiểm tra `IMGUR_CLIENT_ID` trên Vercel env vars |
| Audio upload failed | Kiểm tra R2 env vars (`R2_ACCOUNT_ID`, etc.) |
| Quotes tab trống | Chạy `migration_v4.12.0_quotes.sql` trong Supabase |
| 404 khi refresh | Kiểm tra `vercel.json` có rewrite rule |
| Build fail | `npm run build` — check console errors |

---

*Built with ❤️ — Kỷ luật không phải ý chí, là hệ thống.*
