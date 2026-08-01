# ARCHITECTURE.md — Life Hub (Personal Life OS)
**Version:** v4.26.1
**Updated:** 2026-07-28
**Rule:** Cập nhật file này mỗi khi thêm page, hook, hoặc thay đổi data flow.


---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite 8 |
| Routing | React Router v7 |
| Styling | Vanilla CSS (CSS variables, glassmorphism) |
| Database | Supabase (PostgreSQL + Realtime + Auth) |
| Local fallback | localStorage (UI state only) |
| Build | Vite (lazy-loaded chunks per page) |
| Hosting | Vercel (`vercel.json` SPA routing) |

---

## Cấu Trúc Thư Mục

Chỉ liệt kê thư mục + vai trò. Danh sách file/feature chi tiết: `docs/FEATURES.md`.
Bản đồ cấp cao (route → page → hook → table): `PROJECT.md`.

```
src/
├── App.jsx           AppShell: PageMeta + Onboarding gate + Navbar + QuickCapture
│                     + GlobalAudioPlayer + ErrorBoundary + Suspense + Routes
├── main.jsx          React root
├── pages/       (15) 1 file / route. LandingPage + TrackerPage eager, 13 còn lại lazy
├── components/  (38) UI dùng lại, props-driven, không gọi supabase trực tiếp
│   └── journey/  (5) ActiveJourneyPanel, ProgramBrowser, MyJourneys, JourneyHistory,
│                     CustomJourneyModal
├── hooks/       (20) use<Entity>.js — toàn bộ logic Supabase, dual-mode guest fallback
├── contexts/     (3) AuthContext, JourneyContext, ThemeContext
├── extensions/   (1) MediaNode.jsx — Tiptap atom node cho media inline
├── lib/          (1) supabase.js — singleton client, graceful fallback khi thiếu env
├── utils/        (4) currencyUtils, dateUtils, logger, mediaUtils (pure, no React)
│                 (+2) dateUtils.test.js, mediaUtils.test.js — self-check `npm test`,
│                     không nằm trong bundle (không file app nào import)
├── data/         (8) JSON content tĩnh (Rule 14): challenges, quiz, habits, quotes,
│                     programs, expense-categories, knowledge, testimonials
└── styles/      (32) 1 file / domain + global.css (design tokens). Không dùng Tailwind

api/                  Vercel serverless
├── upload.js         Upload proxy → Google Drive (Supabase JWT + folder whitelist)
├── stream.js         Drive media stream proxy (Range/seek, rate-limited)
└── _lib/                Không phải route (Vercel bỏ qua prefix `_`)
    ├── verifyAuth.js    Xác thực Supabase JWT qua `/auth/v1/user`
    ├── driveToken.js    Ký JWT Service Account → access token, cache theo scope (rw/readonly)
    └── smoke.test.js    Self-check: `node api/_lib/smoke.test.js`

data/                 schema_v4.24.0.sql (source of truth) + reset_user_data.sql
public/               favicon.svg, icons.svg, manifest.json, sw.js (task notifications)
docs/                 ARCHITECTURE / DATABASE / FEATURES / PLAN / TASKS / RULES / AUDIT
```

---

## Data Flow

### Dual-Mode Architecture

```
User Action
    │
    ▼
Hook (e.g. useHabitStore)
    │
    ├── isAuthenticated?
    │       │
    │       ├── YES → Supabase upsert/insert (PRIMARY)
    │       │         ├── Realtime subscription → live update
    │       │         └── Error → optimistic rollback
    │       │
    │       └── NO → In-memory state (reset on refresh — acceptable for guest)
    │
    └── Update local React state → re-render
```

> **v1.6.2+:** Toàn bộ **user data** dùng Supabase làm primary.
> localStorage chỉ còn **UI state flags**, **settings**, và các **ngoại lệ legacy được ghi rõ** (xem Rule bên dưới).

### localStorage Keys

```
vl_xp_store            # DEPRECATED — migrated to Supabase `xp_logs`, then wiped
vl_custom_habits       # DEPRECATED — migrated to Supabase `habits`, then wiped
vl_habit_data          # REMOVED v1.6.1 — migrated sang Supabase `progress`, wiped
vl_habit_progress      # REMOVED v1.5.0 — migrated sang Supabase `habit_logs`, wiped
vl_focus_sessions      # REMOVED v1.6.2 — migrated sang Supabase `focus_sessions`, wiped
vl_skip_{date}         # REMOVED v1.6.2 — Supabase-first, in-memory cho guest
vl_journey_redirected  # REMOVED v4.21.0 — sessionStorage redirect-once flag per session

--- STILL IN USE (UI state only) ---
vl_migrated_v2         # userId — đã migrate vl_habit_data lên Supabase (v1.6.1)
vl_onboarded           # "1" — onboarding completed, UI state
vl_notif_settings      # { enabled, time } — UI preference, stays local
vl_focus_settings      # UI preference cho focus timer durations
vl_completion_shown_N  # "1" — completion modal shown for round N
vl_habit_logs_migrated # "1" — vl_habit_progress migrated to Supabase
vl_login_nudge_shown   # "1" — login nudge shown once
vl_chunk_retry         # "1" — stale chunk retry flag (cleared on success)
vl_theme               # "dark" | "light" — theme preference (v2.2.0)
vl_life_journey_events # JSON array — life milestones (v2.2.0, localStorage-only)
vl_journey_title       # string — custom title for life journey chart (v2.2.0)
```

> **Rule:** localStorage chỉ lưu **UI state flags**, **offline guest fallback**, và các
> **ngoại lệ legacy được ghi rõ**. Mọi user data khác phải dùng Supabase làm primary.
>
> **Ngoại lệ legacy hiện tại** — là user data thật, **chưa** migrate:
> - `vl_life_journey_events` — mảng cột mốc cuộc đời (Life Journey, v2.2.0)
> - `vl_journey_title` — tiêu đề tuỳ chỉnh của biểu đồ Life Journey
>
> Hệ quả: dữ liệu Life Journey không sync giữa thiết bị và mất khi user xoá browser data,
> kể cả khi đã đăng nhập. Migrate sang Supabase là đổi code + thêm bảng — chưa làm, không phải
> việc của tài liệu. Đừng dùng 2 key này làm tiền lệ cho feature mới.

### Supabase Tables

Không liệt kê lại ở đây — **`docs/DATABASE.md`** là nơi duy nhất mô tả bảng, còn
**`data/schema_v4.24.0.sql`** là source of truth (31 `CREATE TABLE`: 29 active + `friendships` / `fitness_logs` archived).
Các file `migration_*.sql` theo version đã bị gộp và xoá; đừng tham chiếu chúng nữa.

Cụm bảng theo domain:

| Domain | Tables |
|--------|--------|
| Habit / streak | `progress`, `habits`, `habit_logs`, `streaks`, `skip_reasons` |
| Journey | `programs`, `program_habits`, `user_journeys`, `journey_habits` |
| Focus | `focus_sessions` |
| Gamification | `xp_logs` |
| Tasks | `user_tasks`, `task_collections` |
| Knowledge | `collections`, `tags`/`collection_tags`, `collection_notes`, `inspirational_quotes` |
| Finance | `expenses`, `subscriptions` |
| Incubator | `intentions`, `intention_logs` |
| Tags | `tags`, `collection_tags`, `expense_tags`, `subscription_tags` |
| Audit | `activity_logs` |
| Account | `profiles`, `notification_settings` |
| Archived | `friendships`, `fitness_logs` (không hook nào dùng, an toàn để DROP) |

### DashboardPage v3.1.0 — Data Sources

```
DashboardPage
  ├── useHabitStore      → streak, longestStreak, totalDone, data (heatmap)
  ├── useXpStore         → totalXp, levelInfo, log (today XP earned)
  ├── useSkipReasons     → getAllSkips() (skip analysis 14 days)
  ├── useFocusTimer      → todayMinutes, todaySessions
  ├── useExpenses        → fetchExpenses, getTotal, getByCategory
  ├── useSubscriptions   → fetchSubs, getMonthlyCost, getUpcoming
  ├── useActivityLog     → getTodayCount
  ├── useAuth            → user, isAuthenticated (for FocusBreakdown) [v3.2.1]
  ├── supabase (direct)  → focus_sessions + habits (FocusBreakdown)  [v3.2.1]
  └── ActivityHeatmap    → reused component (activity_logs heatmap)
```

---

## Routes

| Path | Component | Auth | Load |
|------|-----------|:----:|:----:|
| `/` | LandingPage | Public | Eager |
| `/tracker` | TrackerPage | Public | Eager |
| `/habits` | Inline redirect → `/tracker` | — | — |
| `/inbox` | InboxPage | Required | Lazy |
| `/tasks` | TasksPage (List + Calendar view) | Required | Lazy |
| `/collect` | CollectPage | Required | Lazy |
| `/finance` | FinancePage | Required | Lazy |
| `/life-log` | LifeLogPage | Required | Lazy |
| `/focus` | FocusPage | Public | Lazy |
| `/journey` | JourneyPage | Public (soft wall for save) | Lazy |
| `/journey/:id` | JourneyDetailPage | Public | Lazy |
| `/dashboard` | DashboardPage | Public | Lazy |
| `/quiz` | QuizPage | Public | Lazy |
| `/leaderboard` | LeaderboardPage | Public | Lazy |
| `/team` | Inline redirect → `/tracker` | — | — |
| `/friends` | Inline redirect → `/tracker` | — | — |
| `/life-journey` | LifeJourneyPage | Public | Lazy |
| `/incubator` | IncubatorPage | Required | Lazy |
| `/settings` | SettingsPage | Required | Lazy |


---

## App Architecture (v1.7.0+)

```
ThemeProvider
  └── AuthProvider
        └── BrowserRouter
              └── JourneyProvider
                     └── AppShell
                           ├── PageMeta (SEO title/desc per route)
                           ├── OnboardingModal (once, gated by vl_onboarded)
                           ├── Navbar (sidebar desktop + bottom tabs mobile)
                           ├── QuickCapture (global floating [+] button)
                           └── ErrorBoundary
                                └── Suspense (PageSkeleton fallback)
                                      └── Routes (13 lazy + 2 eager)
```

---

## Key Design Decisions

### 1. Dual-Mode (Guest → Authenticated)
- Ưu tiên UX: không cần đăng nhập để dùng cơ bản
- v1.6.2+: Supabase là primary. Guest dùng in-memory (reset khi refresh)
- Migration tự động: lần đầu login → push localStorage → Supabase → wipe local

### 2. localStorage key format
- Prefix `vl_` cho tất cả keys → tránh conflict với thư viện khác
- Dễ xóa sạch: `Object.keys(localStorage).filter(k => k.startsWith('vl_'))`

### 3. Streak computed on client
- `useHabitStore.calcStreak()` tính streak từ map `progress` — cả guest lẫn authed
- Bảng `streaks` chỉ được INSERT 1 lần bởi trigger signup, **không có** `refresh_streak()`
  → cột streak trong `get_leaderboard()` hiện đứng ở 0. Chi tiết + TODO: `docs/DATABASE.md`
- RLS: mỗi user chỉ đọc hàng của mình (v4.24.0); cross-user đi qua RPC `SECURITY DEFINER`

### 4. CSS architecture
- Không dùng Tailwind — vanilla CSS với CSS variables
- `global.css` → design tokens (`--bg-primary`, `--purple`, `--radius-md`, etc.)
- Mỗi domain có file CSS riêng để dễ maintain

### 5. XP là immutable log
- Không update/delete XP entries (except removeXp v2.0.0 for un-tick)
- Compute `totalXp = SUM(log)` tại runtime
- Dedup bằng `hasMilestone(reason, meta)` trước khi `addXp`
- `focus_session` XP (+15) write trực tiếp qua Supabase (deduped)

### 6. Journey-as-Core-Context (v1.8.0+)
- `JourneyContext` wraps entire app, fetches activeJourney once on login
- All habit ticks → `habit_logs.journey_id`
- All focus sessions → `focus_sessions.journey_id`
- All new habits → `habits.journey_id`

### 7. Journey Owns Habits (v2.0.0)
- Mỗi journey tạo fresh habit rows riêng. Không reuse habits giữa journeys
- Complete/quit → close all active habits (`active=false`)
- Renew → snapshot old habits → clone as fresh rows for new cycle
- Replace mode: archive old journey + close habits → create fresh
- Append mode: archive old journey, keep old habits + add new

### 8. Page Consolidation (v1.9.0)
- HabitsPage deprecated → redirect `/tracker`
- TrackerPage absorbed tất cả features: per-habit tick, mood, skip, calendar, weekly grid, habit manager
- 4 tabs: ⚡ Hôm Nay | 📅 Lịch | 📊 Tuần | ⚙️ Quản Lý

### 9. Onboarding gate (v1.3.0)
- `AppShell` kiểm tra `vl_onboarded` trước khi render app
- Nếu chưa có → show `OnboardingModal` (3 bước)
- Không block routing — user có thể bỏ qua

### 10. Lazy Loading + Error Boundary (v1.7.0)
- 13 pages lazy-loaded via `React.lazy` + `Suspense` (LandingPage + TrackerPage are eager)
- `ErrorBoundary` wraps routes → friendly fallback thay màn trắng
- `lazyRetry()` wrapper auto-reload on stale chunk after Vercel redeploy

### 11. Task ↔ KB Many-to-Many (v4.5.0)
- Junction table `task_collections` replaces 1:1 `user_tasks.collection_id` FK
- Embedded Supabase select: `task_collections(collection_id, collections(id, title, type))` → 1 query, no N+1
- `useCollections` also joins `task_collections(task_id)` → `_linkedTaskCount` per article
- UI: `LinkKBModal` (search + checkbox) on tasks, `📌 Task:` filter chip on CollectPage

---

## Environment Variables

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

Nếu thiếu → `supabase.js` fallback graceful, mọi thứ chạy với in-memory state.
