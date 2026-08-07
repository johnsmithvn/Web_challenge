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
├── pages/        (9) 1 file / route. LandingPage eager, 8 còn lại lazy
├── components/  (25) UI dùng lại, props-driven, không gọi supabase trực tiếp
│                     (AccountDetail giữ view+edit inline của vault, không gọi supabase)
├── hooks/       (13) use<Entity>.js — toàn bộ logic Supabase, dual-mode guest fallback
│                     (ngoại lệ: useAccounts — không có guest mode, xem §Dual-Mode)
├── contexts/     (3) AuthContext, ThemeContext, ToastContext
├── extensions/   (1) MediaNode.jsx — Tiptap atom node cho media inline
├── lib/          (1) supabase.js — singleton client, graceful fallback khi thiếu env
├── utils/        (8) vaultLogic, currencyUtils, dateUtils, logger, mediaUtils,
│                     recurrenceUtils, taskFields (pure, no React)
│                 (+2) dateUtils.test.js, mediaUtils.test.js — self-check `npm test`
├── __tests__/    (3) recurrenceUtils.test.js, taskFields.test.js,
│                     vaultLogic.test.js — `npm test`
├── data/         (4) JSON content tĩnh (Rule 14): quotes, expense-categories,
│                     knowledge, ui-strings
└── styles/      (25) 1 file / domain + global.css (design tokens). Không dùng Tailwind

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
Hook (e.g. useUserTasks)
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

> **Ngoại lệ có chủ ý — `useAccounts` (v5.2.0) KHÔNG có nhánh guest.** Hồ sơ tài khoản mà mất khi
> refresh thì vô nghĩa, và đây là dữ liệu riêng tư nhất trong app. Chưa đăng nhập → `/accounts` hiện
> lời nhắc đăng nhập, không có in-memory fallback. Đừng "sửa" cho khớp pattern.

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
vl_acc_favicon         # "0" = tắt tải logo dịch vụ ở /accounts (mặc định bật) (v5.2.0)
```

> **Rule:** localStorage chỉ lưu **UI state flags**, **offline guest fallback**, và các
> **ngoại lệ legacy được ghi rõ**. Mọi user data khác phải dùng Supabase làm primary.
>
> **Ngoại lệ legacy hiện tại** — là user data thật, **chưa** migrate:
>
> (Life Journey đã gỡ ở v5.0.0 — mục này giữ lại làm ghi chú lịch sử.) Hệ quả cũ: dữ liệu không sync giữa thiết bị,
> kể cả khi đã đăng nhập. Migrate sang Supabase là đổi code + thêm bảng — chưa làm, không phải
> việc của tài liệu. Đừng dùng 2 key này làm tiền lệ cho feature mới.

### Supabase Tables

Không liệt kê lại ở đây — **`docs/DATABASE.md`** là nơi duy nhất mô tả bảng, còn
**`data/schema_v4.24.0.sql`** là source of truth (**18 `CREATE TABLE`**, tất cả đều đang dùng — v5.0.0 đã DROP 12 bảng chết/đã gỡ feature).
v5.2.0 thêm 6 bảng vault qua **`data/migration_v5.2.0_vault.sql`** — file này **chưa gộp vào master** (RULES §3), tổng thực tế trên DB là **24 bảng**.
Các file `migration_*.sql` theo version đã bị gộp và xoá; đừng tham chiếu chúng nữa.

Cụm bảng theo domain:

| Domain | Tables |
|--------|--------|
| Tasks | `user_tasks`, `task_collections`, `task_tags`, `activity_logs` (lịch sử + ghi chú) |
| Knowledge | `collections`, `collection_tags`, `collection_notes`, `inspirational_quotes` |
| Finance | `expenses`, `subscriptions`, `expense_tags`, `subscription_tags` |
| Incubator | `intentions`, `intention_logs` |
| Account Vault | `accounts`, `account_fields` (field theo loại; multi/link là jsonb), `account_auth`, `account_codes`, `account_logs` (append-only), `account_tags` — **v5.2.0, plaintext, chưa mã hoá** |
| Tags | `tags` + 5 junction + VIEW `tagged_items` |
| Focus | `focus_sessions` |
| Gamification | `xp_logs` |
| Account | `profiles` |

> **v5.0.0 DROP 12 bảng:** `progress`, `habits`, `habit_logs`, `programs`,
> `program_habits`, `user_journeys`, `journey_habits`, `skip_reasons` (Habit +
> Lộ Trình), `streaks` (BXH), `notification_settings`, `friendships`,
> `fitness_logs` (chết sẵn). Không còn bảng nào trong schema mà không có hook dùng.

### ~~DashboardPage — Data Sources~~ — TRANG ĐÃ GỠ (v5.0.0)

`DashboardPage` tổng hợp 8 hook + 1 query supabase trực tiếp (ngoại lệ duy nhất
của quy tắc "component không gọi supabase"). Gỡ trang này cũng gỡ luôn ngoại lệ đó.

---

## Routes

| Path | Component | Auth | Load |
|------|-----------|:----:|:----:|
| `/` | LandingPage | Public | Eager |
| `/inbox` | InboxPage | Required | Lazy |
| `/tasks` | TasksPage (List + Calendar view) | Required | Lazy |
| `/collect` | CollectPage | Required | Lazy |
| `/finance` | FinancePage | Required | Lazy |
| `/focus` | FocusPage | Public | Lazy |
| `/team` | Inline redirect → `/tracker` | — | — |
| `/friends` | Inline redirect → `/tracker` | — | — |
| `/incubator` | IncubatorPage | Required | Lazy |
| `/accounts` | AccountsPage (v5.2.0 — vault Keyplate, 2 pane) | Required | Lazy |
| `/settings` | SettingsPage | Required | Lazy |


---

## App Architecture (v1.7.0+)

```
ThemeProvider
  └── ToastProvider
        └── AuthProvider
              └── BrowserRouter
                     └── AppShell
                           ├── PageMeta (SEO title/desc per route)
                           ├── OnboardingModal (once, gated by vl_onboarded)
                           ├── Navbar (sidebar desktop + bottom tabs mobile)
                           ├── QuickCapture (global floating [+] button)
                           └── ErrorBoundary
                                └── Suspense (PageSkeleton fallback)
                                      └── Routes (7 lazy + 1 eager)
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
- **v5.0.0: không còn khái niệm streak trong app.** Habit tracker và bảng `streaks`
  đều đã gỡ. Nếu sau này cần lại, đừng dựng bảng cache — tính runtime từ dữ liệu gốc.
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
- **v5.0.0:** nguồn XP đổi từ habit sang **hoàn thành Nhiệm vụ** (+10, dedup theo
  `taskId`). Dòng `xp_logs` cũ của habit/quiz/challenge vẫn giữ — append-only, cố
  ý không dọn, nên tổng XP không tụt.

### 6-8. ~~Journey-as-Core-Context~~ / ~~Journey Owns Habits~~ / ~~Page Consolidation~~ — HẾT HIỆU LỰC (v5.0.0)

Ba quyết định kiến trúc này đều xoay quanh Habit tracker + Lộ Trình 21 ngày, đã
gỡ hẳn. Ghi lại bài học để không lặp lại:

- **`JourneyContext` bọc toàn bộ App** và bị 4 hook import trực tiếp
  (`useCustomHabits`, `useHabitLogs`, `useFocusTimer`, `useJourney`). Hệ quả: khi
  muốn gỡ, **không tách nhỏ được** — Habit, Lộ Trình, XP và Focus phải xử lý
  cùng một đợt. Một context toàn cục là một ràng buộc toàn cục.
- **Journey sở hữu Habit** (mỗi lộ trình tạo habit rows riêng, complete → đóng
  hết) khiến 2 feature dính chặt tới mức không thể giữ cái này bỏ cái kia.
- **Page Consolidation** gộp mọi thứ vào `TrackerPage` (886 dòng, 4 tab). Gộp
  càng nhiều thì càng khó cắt: `/tasks` phải tách khỏi nó ở v4.27.0 trước, mới
  gỡ được `TrackerPage` ở v5.0.0.

### 9. Onboarding gate (v1.3.0)
- `AppShell` kiểm tra `vl_onboarded` trước khi render app
- Nếu chưa có → show `OnboardingModal` (3 bước; nội dung viết lại ở v5.0.0)
- Không block routing — user có thể bỏ qua

### 10. Lazy Loading + Error Boundary (v1.7.0)
- 7 pages lazy-loaded via `React.lazy` + `Suspense` (chỉ `LandingPage` là eager)
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
