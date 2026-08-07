# PLAN.md — Life Hub (Personal Life OS)
**Updated:** 2026-08-05
**Current Version:** v5.2.0
**Rule:** Cập nhật khi milestone hoặc phase thay đổi.

> ⚠️ Bảng version ở cuối file **thiếu v4.23.0 → v4.31.0** (nhảy từ v4.26.1 sang v5.0.0) — sai lệch
> có từ trước, chưa fix vì ngoài scope. Nguồn đầy đủ: `CHANGELOG.md`.

---

## ✅ Phase 1 — Core MVP (v1.0.0)
*Hoàn thành: 2026-04-13*

Landing page, TrackerPage, DashboardPage, TeamPage (mock UI), design system (dark mode,
glassmorphism, CSS variables) và routing nền tảng ban đầu (chi tiết: CHANGELOG.md v1.0.0).

---

## ✅ Phase 2 — Gamification (v1.1.0)
*Hoàn thành: 2026-04-14*

XP & Level system, Daily Challenge, Quiz, Leaderboard, Notification reminder, XpBar
(chi tiết: CHANGELOG.md v1.1.0).

---

## ✅ Phase 3 — Cloud + Auth (v2.0.0-auth)
*Hoàn thành: 2026-04-15*

- [x] Supabase schema (profiles, progress, streaks, xp_logs, teams, reactions, friendships) + RLS policies cho tất cả tables
- [x] Auth Email + Google OAuth, dual-mode habit store (localStorage ↔ Supabase), migration localStorage → Supabase khi login lần đầu, TeamPage/FriendsPage dùng DB thật + realtime (chi tiết: CHANGELOG.md v2.0.0-auth)

---

## ✅ Phase 4 — Advanced Habit Tracking (v1.2.0)
*Hoàn thành: 2026-04-18*

- [x] Custom Habits CRUD (icon, màu, category, giờ target)
- [x] Per-habit daily tick (độc lập, không phụ thuộc nhau)
- [x] Monthly Calendar (VN holidays, click detail)
- [x] Pomodoro Focus Timer (SVG ring, phases, habit linking, session log)
- [x] Mood Tracker (5 levels, 1/ngày, dual-mode sync)
- [x] Skip Reasons (lý do bỏ habit, sau 8PM trigger)
- [x] TrackerPage redesign (streak ring, plant growth, 21-day dots)
- [x] DashboardPage redesign (flower journey, monthly donut, weekly table, contribution graph)
- [x] DB migration: thêm 4 bảng mới (habits, focus_sessions, mood_logs, skip_reasons)

---

## ✅ Phase 4.5 — UX Polish + Data Architecture (v1.2.1 → v1.3.1)
*Hoàn thành: 2026-04-18*

- [x] Data modularization: tách all static content → `src/data/*.json` (Rule 14)
- [x] TrackerSection → read-only status dots (xoá manual toggle)
- [x] CompletionModal khi streak = 21 (confetti, XP summary, "Bắt đầu Vòng 2")
- [x] OnboardingModal 3 bước lần đầu truy cập
- [x] Focus session → auto-tick habit + +15 XP/session
- [x] Friend list → streak + XP thật từ Supabase
- [x] Leaderboard → query `xp_logs` thật thay công thức hardcode
- [x] Dashboard → Skip Reason Insight widget (14 ngày, bar chart, smart tip)
- [x] Fix `week_num` hardcode → tính từ program start

---

## ✅ Phase 4.6 — Journey Foundation (v1.5.0)
*Hoàn thành: 2026-04-19*

- [x] DB migration (5 bảng mới: `programs`, `program_habits`, `user_journeys`, `journey_habits`, `habit_logs` + RLS + 5 seed templates), `useHabitLogs.js`, `useJourney.js` — lifecycle start/complete/renew/extend, `ensureDefaultJourney()` (chi tiết: CHANGELOG.md v1.5.0)
- [x] UUID guard: lọc default habits (h1, h2, h3) khỏi Supabase sync
- [x] Team RLS fix: `get_my_team_ids()` SECURITY DEFINER chống recursion

---

## ✅ Phase 4.7 — Journey System UI (v1.6.0)
*Hoàn thành: 2026-04-19*

`JourneyPage.jsx` 3 tab (Đang Chạy/Khám Phá/Lịch Sử) + sub-components
(`ActiveJourneyPanel`, `ProgramBrowser`, `JourneyHistory`, `CustomJourneyModal`),
`programs.json` 5 template, route `/journey`, banner Journey ở HabitsPage/TrackerPage
(chi tiết: CHANGELOG.md v1.6.0).

---

## ✅ Phase 4.8 — Supabase-First Migration (v1.6.1 → v1.6.2)
*Hoàn thành: 2026-04-19*

Chuyển `useHabitStore`, `useMoodSkip`, `useCustomHabits`, `useXpStore`, `useFocusTimer`
sang Supabase-first (xoá localStorage làm primary, guest = in-memory); tạo bảng `xp_logs`
+ `friendships` (chi tiết: CHANGELOG.md v1.6.1, v1.6.2).

---

## ✅ Phase 4.9 — Production Hardening (v1.7.0)
*Hoàn thành: 2026-04-19*

`ErrorBoundary`, `PageSkeleton`, PWA manifest + meta tags, lazy-load 8 trang, fix
DailyChallenge (pick-by-streak-day thay hash-by-date) (chi tiết: CHANGELOG.md v1.7.0).

---

## ✅ Phase 5.0 — Journey-as-Core-Context (v1.8.0 → v1.8.1)
*Hoàn thành: 2026-04-19*

`JourneyContext` làm single source of truth (1 fetch/login), tự gắn `journey_id` vào
`habit_logs`/`focus_sessions`/habit mới, `JourneyDetailPage` full stats
(chi tiết: CHANGELOG.md v1.8.0, v1.8.1).

---

## ✅ Phase 5.1 — Page Consolidation + Hotfixes (v1.9.0 → v1.9.5)
*Hoàn thành: 2026-04-20*

TrackerPage hấp thụ HabitsPage (4 tab: Hôm Nay/Lịch/Tuần/Quản Lý), JourneyDetailPage
thành dashboard đầy đủ (JourneyCalendar + DayDetailModal + MonthSummary), cùng 5 hotfix:
redirect loop, signup không login được, seed template habits, journey switch modal
(Replace/Append), `lazyRetry()` (chi tiết: CHANGELOG.md v1.9.0 → v1.9.5).

---

## ✅ Phase 5.2 — Journey Owns Habits (v2.0.0)
*Hoàn thành: 2026-04-20*

Mỗi journey tạo habit rows riêng (Replace/Append mode), `completeJourney`/`renewJourney`
xử lý đúng lifecycle, tab "📂 Của Tôi", `removeXp()` (chi tiết: CHANGELOG.md v2.0.0).

---

## ✅ Phase 5.3 — Personal Tasks (v2.1.0)
*Hoàn thành: 2026-04-21*

`user_tasks` table + RLS, `useUserTasks`, `TaskListSection`, Service Worker background
notification, tích hợp calendar (chi tiết: CHANGELOG.md v2.1.0).

---

## ✅ Phase 5.4 — Life Journey Visualization (v2.2.0)
*Hoàn thành: 2026-04-22*

`LifeJourneyPage` (emotion timeline SVG Catmull-Rom), `useLifeJourney` (localStorage-only,
không Supabase), `ThemeContext` dark/light toggle (chi tiết: CHANGELOG.md v2.2.0).

---

## ❌ Phase 6 — Team Accountability v3 — CANCELLED
*Cancelled: 2026-04-25 — Pivot to Personal Life Hub*

> Team features archived. App repositioned as personal productivity hub ("Second Brain").
> Code moved to `src/_archived/`. DB tables remain but unused.

---

## ✅ Phase 6 (NEW) — Personal Life Hub Foundation (v3.0.0)
*Hoàn thành: 2026-04-25 — Branch: `feat/v3-personal`*

**Goal:** Pivot app từ "Team Habit Tracker" → "Personal Life Hub / Second Brain"

Archive Team/Friends → `src/_archived/`, rebrand "Life Hub"; navigation restructure
(sidebar/bottom-tabs + QuickCapture FAB); Activity Log system; module Inbox + Collect;
module Finance (expenses + subscriptions); module Life Log (heatmap + timeline)
(chi tiết: CHANGELOG.md v3.0.0, có breakdown theo đúng 6 sub-phase 6.1–6.6).

---

## ✅ Phase 7 — Unified Dashboard (v3.1.0)
*Hoàn thành: 2026-04-26*

Dashboard redesign hợp nhất stats mọi module (habit + finance + activity + focus + XP),
Today Overview 4 KPI, Finance Section + Pie chart, ActivityHeatmap thay ContributionGraph
(chi tiết: CHANGELOG.md v3.1.0).

---

## ✅ Phase 7.5 — Knowledge Base Dual-Mode Editor + UX Polish (v3.2.0)
*Hoàn thành: 2026-04-26*

TiptapEditor dual-mode (Markdown mặc định / Visual, mode-lock per article) + ConfirmModal
thay toàn bộ `window.confirm/alert/prompt` (chi tiết: CHANGELOG.md v3.2.0).

---

## ✅ Phase 7.6 — Dashboard Polish + Debt Cleanup (v3.2.1)
*Hoàn thành: 2026-04-27*

Mood trend chart, Focus session breakdown, Weekly review digest, dọn nợ tài liệu Team v3
(chi tiết: CHANGELOG.md v3.2.1).

---

## ✅ Phase 7.7 — Tiptap Slash Command + Shortcuts (v3.3.0)
*Hoàn thành: 2026-04-27*

Slash Command Menu (`/`, 12 block types), Keyboard Shortcuts Panel (`Ctrl+.`), browser
shortcut override, `SlashCommand.jsx` (chi tiết: CHANGELOG.md v3.3.0).

## ✅ Phase 8.1—8.5 — Personal OS Expansion (v3.5.0 → v3.9.0)
*Hoàn thành: 2026-04-30*

- 8.1 Quick Expense + Overdue Triage (chi tiết: CHANGELOG.md v3.5.0)
- 8.2 Energy Tag + Recurring Tasks (chi tiết: CHANGELOG.md v3.6.0)
- 8.3 Cashflow Calendar + PARA Tags (chi tiết: CHANGELOG.md v3.7.0)
- 8.4 Inbox Snooze (chi tiết: CHANGELOG.md v3.8.0)
- 8.5 🥚 Incubator Module (chi tiết: CHANGELOG.md v3.9.0)

---

## ✅ Phase 8.6 — Reader View + Health Tab (v4.0.0)
*Hoàn thành: 2026-04-30*

`api/meta.js` (OG metadata) + `useLinkMeta`, tab 🏋️ Sức Khỏe (`fitness_logs` +
`useFitnessLog`, XP + Heatmap) (chi tiết: CHANGELOG.md v4.0.0).

---

## ✅ Phase 8.7 — Incubator Multi-Output Router (v4.2.0)
*Hoàn thành: 2026-05-01*

Execute Modal Radio → Checkbox (multi-select Expense + Habit + Task), auto-suggest,
`converted_to`/`converted_ids` (chi tiết: CHANGELOG.md v4.2.0).

---

## ✅ Phase 9.1 — Quick Wins: Edit Expense + Sub Auto-Advance + Review Banner (v4.2.1)
*Hoàn thành: 2026-05-01*

`updateExpense()` + edit modal FinancePage, auto-advance `next_due` (subscriptions),
Incubator Review Banner (chi tiết: CHANGELOG.md v4.2.1).

---

## ✅ Phase 9.4 — Inbox Filters + Incubator Archive + Tags Cleanup (v4.3.0)
*Hoàn thành: 2026-05-01*

Filter chips Inbox, Archive toggle Incubator, `fetchAbandoned()`, drop cột
`collections.tags` (chi tiết: CHANGELOG.md v4.3.0).

---

## ✅ Phase 10 — Task ↔ Knowledge Link + Inbox Bulk Actions (v4.4.0)
*Hoàn thành: 2026-05-02*

Fix 2 bug (IncubatorPage crash, subscription monthly cost), Task ↔ Knowledge 1:1 link
(`user_tasks.collection_id`), Inbox bulk classify/delete + activity log
(chi tiết: CHANGELOG.md v4.4.0).

---

## ✅ Phase 10.5 — Task ↔ KB Many-to-Many + Recovery (v4.5.0 → v4.5.2)
*Hoàn thành: 2026-05-07*

Junction `task_collections` (M:N) + `LinkKBModal` + filter task ở CollectPage (v4.5.0);
fix fallback query khi junction thiếu + Settings dropdown + profiles RLS (v4.5.1);
phục hồi 3 file bị corrupt 0-byte (v4.5.2) (chi tiết: CHANGELOG.md v4.5.0, v4.5.1, v4.5.2).

---

## Semantic Version Map

| Version | Milestone |
|---------|-----------|
| v1.0.0 | Core MVP |
| v1.1.0 | Gamification |
| v1.1.1 | Bug fixes (checkbox, UI) |
| v1.2.0 | Advanced Habit + Focus + Dashboard redesign |
| v1.2.1 | Data modularization (JSON-first, Rule 14) |
| v1.2.2 | TrackerSection read-only status dots |
| v1.3.0 | Completion Modal + Onboarding + Focus auto-tick + Friend streaks |
| v1.3.1 | Focus XP + Skip insight analytics + week_num fix |
| v1.4.0 | Habit action field + Conquered habits + LoginNudge + Certificate modal |
| v1.4.5 | Daily quotes + Per-habit weekly grid + Habit streaks |
| v1.5.0 | Journey DB foundation (5 tables + useHabitLogs + useJourney) |
| v1.6.0 | Journey UI (3 tabs + sub-components + programs.json) |
| v1.6.1 | useHabitStore Supabase-first (xóa localStorage primary) |
| v1.6.2 | Supabase-first toàn bộ hooks + xp_logs/friendships tables |
| v1.7.0 | ErrorBoundary + PWA + Lazy loading + PageSkeleton |
| v1.7.1 | Journey-Habit integration (template → real habits) |
| v1.8.0 | JourneyContext + journey_id tagging + JourneyDetailPage |
| v1.8.1 | useJourney rewrite (single source of truth from context) |
| v1.9.0 | Page consolidation (TrackerPage absorbs HabitsPage) + JourneyDetail dashboard |
| v1.9.1 | Hotfixes: redirect, signup, seed habits, MonthSummary |
| v1.9.2 | Remove manual tick, auto-derived day complete |
| v1.9.3 | Journey switch modal (Replace/Append) + lazyRetry |
| v1.9.4 | Synchronous isLoadingJourney (eliminate redirect race) |
| v1.9.5 | Fix manage tab showing old habits after replace |
| v2.0.0 | Journey Owns Habits + MyJourneys tab + removeXp + Completion UI |
| v2.1.0 | Personal Tasks (Nhiệm Vụ) + Service Worker notifications + Calendar log |
| v2.2.0 | Life Journey visualization + ThemeContext (dark/light toggle) |
| v2.2.1 | Remove deprecated HabitsPage |
| v2.2.2 | Database Security Fix (RLS + XP guard) |
| v2.2.3 | XP Dedup Fixes (isReady + server-side dedup) |
| v2.3.0 | Mood/Skip History on Calendar |
| **v3.0.0** | **Personal Life Hub (Inbox, Collect, Finance, Life Log)** |
| v3.0.1 | Plan gap fix: KnowledgeResurface, Finance charts, Inbox actions |
| v3.1.0 | Unified Dashboard (4-KPI today row, Finance Pie, ActivityHeatmap) |
| v3.1.1 | UX Bug: modal close on text-select fix |
| v3.1.2 | Mood chart, CustomSelect Finance dropdown, Life Log today default |
| **v3.2.0** | **KB Dual-Mode Editor (Tiptap+Markdown), ConfirmModal, AI-ready schema** |
| v3.2.1 | Dashboard Polish (Mood 30d, Focus breakdown, Weekly Review) + Debt Cleanup |
| v3.3.0 | Tiptap Slash Command + Keyboard Shortcuts |
| v3.5.0 | Quick Expense + Overdue Triage |
| v3.6.0 | Energy Tag + Duration + Recurring Tasks |
| v3.7.0 | Cashflow Calendar + PARA Tags |
| v3.8.0 | Inbox Snooze |
| **v3.9.0** | **🥚 Incubator Module (Trạm Ấp Trứng)** |
| v4.0.0 | Reader View + Health Tab |
| v4.0.1 | InboxPage Overflow Menu |
| v4.0.2 | Recurring Task Retry |
| v4.0.3 | Fitness Edit + Dashboard Card |
| **v4.1.0** | **⚙️ Settings Page + Tag Unification (collection_tags junction)** |
| v4.1.1 | Bug Fixes: Sidebar Dropdown + Inbox Add |
| **v4.2.0** | **🥚 Incubator Multi-Output Router + estimated_time UI** |
| v4.2.1 | Edit Expense + Sub auto-advance + Incubator Review Banner |
| **v4.3.0** | **Inbox Filters + Incubator Archive + Tags Cleanup** |
| v4.4.0 | Bug Fixes + Task↔Knowledge 1:1 Link + Inbox Bulk Actions |
| **v4.5.0** | **Task ↔ KB Many-to-Many (task_collections junction) + KB Task Filter + LinkKBModal** |
| v4.5.1 | Bug Fixes: query fallback, LinkKBModal empty state, Settings dropdown, profiles RLS |
| v4.5.2 | Recovery: 3 corrupted files restored + deprecated meta tag fix |
| v4.5.3 | Cleanup: archive old docs, remove dead CSS, sync reset script |
| v4.5.4 | Audit Cleanup: DB docs overhaul, phantom tables removed, habit sort_order persist |
| v4.9.0 | Task Priority System (replaced Energy/Duration) |
| v4.10.0 | ClickUp-style DatePicker |
| v4.10.1 | Task Start Time + Mobile DatePicker/Overflow + Mood Tracker Removal |
| **v4.11.0** | **Knowledge Groups (M:N) + Sub-Notes (Threaded Notes)** |
| **v4.12.0** | **Media Infrastructure (Image/YouTube/Audio/Upload/QuoteWidget/Quote Manager)** |
| **v4.13.0** | **Postcard Gallery + QuoteWidget KB Integration** |
| **v4.14.0** | **KB Category Expansion + DB Type Sync** |
| **v4.15.0** | **Knowledge Base Categories (JSON Refactor) + SubNotes UX** |
| **v4.16.0** | **Hybrid Storage & Podcast Player** |
| v4.16.1 | Unified Google Drive Upload + URL Fix |
| v4.16.2 | Documentation: Upload Naming Convention |
| v4.16.3 | Google Drive iframe Preview Fix |
| **v4.17.0** | **Compact Audio Preview Redesign** |
| **v4.18.0** | **Advanced Media Classification and Hashtag System** |
| v4.18.1 | Hotfix: TrackerSection keys and source URL truncation |
| **v4.19.0** | **Custom Glassmorphic Audio Player** |
| v4.19.1 | Hotfix: Preserve iframe player state in Markdown preview pane |
| v4.19.2 | Hotfix: Optimize ReactMarkdown preview re-renders (stable remarkPlugins and React.memo components) |
| v4.19.3 | Hotfix: Render format badges (Markdown/Visual) in ArticleCard and ReaderView |
| v4.19.4 | Hotfix: Optimize ArticleCard list borders and container backgrounds in Light Theme |
| v4.19.5 | Hotfix: Fix Task Filter popover readability and theme sync (Light/Dark adaptive CSS) |
| v4.19.6 | Hotfix: Enhance Sidebar, Input, Dropdown, and Tag borders/contrast in Light Mode |
| v4.19.7 | Hotfix: Unified Custom Dropdowns & Task Overdue UX Fixes |
| v4.19.8 | Hotfix: Fix Editor Title Input & CustomSelect Alignment |
| v4.19.9 | Hotfix: Fix Light Mode Task Form Inputs & Buttons Visibility |
| **v4.20.0** | **Inbox Quick Done Feature (instant task conversion & completion)** |
| v4.20.1 | Hotfix: Smart Money Input Parsing & Configurable Currency Settings |
| **v4.21.0** | **Optional Journey & Onboarding Redirect Polish** |
| **v4.22.0** | **Codebase Audit Cleanup (Dead Code, Dedup, Structural Fixes, GenericModal, dateUtils)** |
| **v4.25.0** | **Refactor P0 — Xoá code chết (`src/_archived/`, 2 dep `@uiw/*`, export không caller) + fix `@keyframes fadeIn` xung đột** |
| **v4.25.1** | **Refactor P1 (3/5) — `api/_lib/driveToken.js` dùng chung, `verifyAuth` bỏ `createClient`, `base64url` native** |
| **v4.26.0** | **Xoá feature Fitness Log (tab 🏋️ Sức Khỏe) — hook + tab TrackerPage + card Dashboard + XP. Bảng `fitness_logs` giữ lại, chưa DROP** |
| **v4.26.1** | **Refactor P2 (4/6) — bỏ `getSb()` lazy ở 3 hook, gộp `snoozedFilter`, gộp `isAudioUrl`/`isVideoUrl`, `dateUtils.toDateStr()` thay 4 bản copy, thêm `npm test`** |
| **v5.0.0** | **Activity Log v2 + Task Detail Modal + gỡ Life Log; dọn 5 đợt module (schema 30 → 18 bảng), XP đổi nguồn sang Task, landing viết lại** |
| **v5.2.0** | **🔐 Vault (`/accounts`) làm lại theo thiết kế Keyplate: 6 bảng, layout 2 pane, 10 template, 10 loại field, link nhiều-tới-một, sign-in methods, mã dự phòng, sửa inline + history. Chưa mã hoá. Thay bản Phase A1 v5.1.0 (chưa từng deploy)** |

---

## 🔧 Phase 12 — Refactor chống over-engineering (v4.25.x → )
*Bắt đầu: 2026-07-28 · Nguồn: review over-engineering toàn bộ `src/` + `api/` (41.128 dòng)*

**Goal:** Bỏ code trùng lặp, code chết và abstraction không cần thiết. Không thêm tính năng.
Mỗi phase = 1 commit độc lập, revert được, `npm run build` xanh trước khi qua phase sau.

| Phase | Nội dung | Trạng thái |
|-------|----------|-----------|
| P0 | Xoá code chết (`_archived`, 2 dep, export không caller, `fadeIn` trùng) | ✅ v4.25.0 |
| P1 | `api/`: gộp `getDriveToken`, `verifyAuth` dùng `fetch`, `base64url` native | ✅ v4.25.1 (3/5 mục) |
| P1b | `Response.formData()` thay parser multipart · `Readable.fromWeb().pipe()` thay vòng `pump` | ⏸ hoãn — rủi ro cao, chờ test upload thật |
| P2 | Hooks: bỏ `getSb()` lazy, gộp query snooze, gộp `isAudio/isVideo`, `toDateStr()` | ✅ v4.26.1 (4/6 mục) |
| P2b | Xoá 2 thang fallback migration · bỏ retry `spawnRecurringTask` | ⏸ chờ 2 quyết định dưới |
| P3 | `TaskListSection`: gộp form Add/Edit, 22 `useState` → 1 draft object | ⏳ chờ approve |
| P4 | Modal: `GenericModal` viết lại trên `<dialog>`, gộp 6 overlay + 14 handler Escape | ⏳ chờ approve |
| P5 | 872 inline style → CSS (1 page/PR) | ⏳ chờ approve |
| P6 | ~~Bỏ markdown mode~~ | ❌ HUỶ — mất TOC + mất tính portable của plain text, lợi ích thật chỉ ~120 dòng |

**Quyết định còn treo:**
- `TODO: decision needed` — Migration `task_collections` / `collection_tags` đã chạy trên prod chưa?
  Gate việc xoá 2 thang fallback ở P2 (`useCollections` 3 tầng, `useUserTasks` 1 tầng, ~71 dòng).
- `TODO: decision needed` — RULES §7 liệt kê `spawnRecurringTask` retry và `lazyRetry()` là pattern
  đang có. Đánh giá của review: cả hai là phòng xa không cần thiết (insert idempotent; chunk-fail
  đã có `ErrorBoundary`). Bỏ (−42 dòng, phải sửa RULES §7) hay giữ?

---

## 🔐 Phase 13 — Vault (v5.2.0 → )
*UI làm lại: 2026-08-05 theo bản thiết kế Keyplate · mã hoá: `docs/DESIGN_ACCOUNT_VAULT.md`*

**Goal:** Vault lưu mọi thứ về một tài khoản (field theo loại, phương thức đăng nhập, mã dự phòng,
lịch sử) theo bản thiết kế Keyplate. Chia 2 phần độc lập: **A = UI + metadata (không crypto)**,
**B = mã hoá client-side**.

| Phase | Nội dung | Trạng thái |
|-------|----------|-----------|
| A | 6 bảng + `useAccounts` + `/accounts` layout Keyplate + 10 template + 10 loại field + link nhiều-tới-một + sign-in methods + code sheet + sửa inline + history | ✅ v5.2.0 (SQL chờ user chạy) |
| B1+B2 | Crypto core (envelope KEK/DEK, `crypto.subtle`, unlock modal) **và** vault operability (export ciphertext, đổi passphrase) — làm **liền một đợt** | ⏳ chưa làm |
| B3 | Auto-lock timer, TOTP thật, clipboard auto-clear | ⏳ sau B2 |

**Điều kiện gỡ banner "chưa mã hoá" ở `/accounts`:** xong B1 **và** B2. Bật crypto mà chưa có
export + đổi passphrase = mất passphrase là mất trắng dữ liệu.

**Quyết định đã chốt (2026-08-05):** làm lại vault y hệt bản thiết kế Keyplate, bỏ các tính năng
chỉ Life Hub có (status, nhắc hạn đăng nhập, gom theo dịch vụ, favicon, 20 mẫu VN). Trong lúc chờ
mã hoá, type `password`/`secret` chỉ mask UI và **user đã chấp nhận tường minh rủi ro plaintext**.
