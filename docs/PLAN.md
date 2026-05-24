# PLAN.md — Life Hub (Personal Life OS)
**Updated:** 2026-05-24
**Current Version:** v4.20.1
**Rule:** Cập nhật khi milestone hoặc phase thay đổi.

---

## ✅ Phase 1 — Core MVP (v1.0.0)
*Hoàn thành: 2026-04-13*

- [x] Landing page (marketing, pricing, testimonials)
- [x] TrackerPage — daily tick, streak, badge
- [x] DashboardPage — stats overview
- [x] TeamPage — mock UI
- [x] Design system: dark mode, glassmorphism, CSS variables
- [x] Routing (BrowserRouter)

---

## ✅ Phase 2 — Gamification (v1.1.0)
*Hoàn thành: 2026-04-14*

- [x] XP & Level system (6 levels, localStorage)
- [x] Daily Challenge (+20 XP)
- [x] Quiz 10 câu MCQ (score-based XP)
- [x] Leaderboard (streak/XP, 3 tabs)
- [x] Notification reminder (browser API)
- [x] XpBar trên Navbar + TrackerPage

---

## ✅ Phase 3 — Cloud + Auth (v2.0.0-auth)
*Hoàn thành: 2026-04-15*

- [x] Supabase schema (profiles, progress, streaks, xp_logs, teams, reactions, friendships)
- [x] Auth: Email + Google OAuth
- [x] Dual-mode habit store (localStorage ↔ Supabase)
- [x] localStorage → Supabase migration on first login
- [x] TeamPage: real DB create/join/leave, realtime
- [x] FriendsPage: search, add, accept/decline
- [x] RLS policies cho tất cả tables

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

- [x] DB migration: 5 bảng mới (`programs`, `program_habits`, `user_journeys`, `journey_habits`, `habit_logs`) + RLS + 5 seed templates
- [x] `useHabitLogs.js` — Thay thế `vl_habit_progress` localStorage bằng Supabase `habit_logs`. One-time silent migration
- [x] `useJourney.js` — Journey lifecycle: start/complete/renew/extend, `ensureDefaultJourney()`
- [x] UUID guard: lọc default habits (h1, h2, h3) khỏi Supabase sync
- [x] Team RLS fix: `get_my_team_ids()` SECURITY DEFINER chống recursion

---

## ✅ Phase 4.7 — Journey System UI (v1.6.0)
*Hoàn thành: 2026-04-19*

- [x] `JourneyPage.jsx` — 3 tabs: Đang Chạy / Khám Phá / Lịch Sử
- [x] Journey sub-components: `ActiveJourneyPanel`, `ProgramBrowser`, `JourneyHistory`, `CustomJourneyModal`
- [x] `programs.json` — 5 system templates (Rule 14, offline fallback)
- [x] Route `/journey` + Navbar link "🗺 Lộ Trình"
- [x] `HabitsPage.jsx` — Journey banner (active: Ngày X/Y; inactive: CTA)
- [x] `TrackerPage.jsx` — 21-day dots anchor từ `user_journeys.started_at`
- [x] `CompletionModal.jsx` — Option C "🗺 Chọn Lộ Trình Mới" → navigate `/journey`
- [x] `AuthModal` thay `alert()` khi guest action

---

## ✅ Phase 4.8 — Supabase-First Migration (v1.6.1 → v1.6.2)
*Hoàn thành: 2026-04-19*

- [x] `useHabitStore.js` — Xóa localStorage primary, Supabase-first, guest=in-memory
- [x] `useMoodSkip.js` — Supabase-first, xóa localStorage
- [x] `useCustomHabits.js` — Supabase-first, one-time migrate rồi wipe
- [x] `useXpStore.js` — Supabase `xp_logs` primary, migrate rồi wipe
- [x] `useFocusTimer.js` — Xóa `vl_focus_sessions` direct reads, Supabase-first
- [x] `data/migration_v1.6.2.sql` — Create `xp_logs` + `friendships` tables, enable Realtime

---

## ✅ Phase 4.9 — Production Hardening (v1.7.0)
*Hoàn thành: 2026-04-19*

- [x] `ErrorBoundary.jsx` — Friendly fallback UI thay màn trắng
- [x] `PageSkeleton.jsx` — Shimmer skeleton loading
- [x] `public/manifest.json` — PWA Web App Manifest
- [x] `index.html` — PWA meta tags, OG tags, Twitter Card
- [x] `App.jsx` — Lazy load 8 pages, `React.lazy` + `Suspense`
- [x] DailyChallenge fix: pick-by-streak-day thay hash-by-date
- [x] Bundle: 1 chunk ~350kB → Main 79kB + lazy pages 0.6-9kB each

---

## ✅ Phase 5.0 — Journey-as-Core-Context (v1.8.0 → v1.8.1)
*Hoàn thành: 2026-04-19*

- [x] `JourneyContext.jsx` — Single source of truth, 1 fetch per login
- [x] `App.jsx` — Wrap `JourneyProvider`, redirect `/journey?firstTime=true` if no journey
- [x] `useHabitLogs.js` — Auto-pass `journey_id` to habit_logs
- [x] `useFocusTimer.js` — Tag `journey_id` to focus_sessions
- [x] `useCustomHabits.js` — Auto-tag `journey_id` on habit create
- [x] `JourneyDetailPage.jsx` — Full stats page `/journey/:id`
- [x] `useJourney.js` — Rewrite to read from JourneyContext (single source of truth)

---

## ✅ Phase 5.1 — Page Consolidation + Hotfixes (v1.9.0 → v1.9.5)
*Hoàn thành: 2026-04-20*

- [x] TrackerPage absorbs HabitsPage → 4 tabs (Hôm Nay/Lịch/Tuần/Quản Lý)
- [x] HabitsPage → redirect `/tracker`
- [x] Navbar: remove "📋 Habits" link
- [x] JourneyDetailPage: JourneyCalendar + DayDetailModal + MonthSummary
- [x] ProgramBrowser: join `program_habits(*)` fix
- [x] useCustomHabits: authenticated → no DEFAULT_HABITS fallback
- [x] Remove manual tick button → auto-derived from habit ticks
- [x] Fix redirect loop (sessionStorage + synchronous derived `isLoadingJourney`)
- [x] Fix signup → can't login (trigger `handle_new_user` metadata extraction)
- [x] Seed template habits in Supabase
- [x] Journey switch modal: Replace vs Append mode
- [x] `lazyRetry()` wrapper for stale chunk resilience

---

## ✅ Phase 5.2 — Journey Owns Habits (v2.0.0)
*Hoàn thành: 2026-04-20*

- [x] Each journey creates FRESH habit rows (no name-match reuse)
- [x] Replace mode: close all old habits + create fresh
- [x] Append mode: keep old habits + add new
- [x] `completeJourney` → close all active habits (`active=false, status='completed'`)
- [x] `renewJourney` → snapshot old habits → clone as fresh rows
- [x] `MyJourneys.jsx` — "📂 Của Tôi" tab + "Bắt đầu lại" button
- [x] `ActiveJourneyPanel` — Completion celebration UI: 🎉 + Renew/Extend/Complete
- [x] JourneyPage: 4 tabs (thêm "📂 Của Tôi")
- [x] `removeXp()` — Un-tick deducts XP properly

---

## ✅ Phase 5.3 — Personal Tasks (v2.1.0)
*Hoàn thành: 2026-04-21*

- [x] `data/migration_v2.1.0.sql` — `user_tasks` table + RLS + indexes
- [x] `src/hooks/useUserTasks.js` — Task CRUD (Supabase-first, guest in-memory)
- [x] `src/components/TaskListSection.jsx` — Task list UI in TrackerPage
- [x] `public/sw.js` — Service Worker background notification (check 60s, fire when due)
- [x] `src/App.jsx` — Register Service Worker
- [x] `src/components/MonthCalendar.jsx` — Show completed tasks in day detail
- [x] `src/pages/TrackerPage.jsx` — Wire task list + calendar integration

---

## ✅ Phase 5.4 — Life Journey Visualization (v2.2.0)
*Hoàn thành: 2026-04-22*

- [x] `src/pages/LifeJourneyPage.jsx` + `LifeJourneyPage.css` — Emotion timeline SVG (Catmull-Rom curve)
- [x] `src/hooks/useLifeJourney.js` — CRUD milestones (localStorage-only, no Supabase)
- [x] `src/contexts/ThemeContext.jsx` — Dark/Light theme toggle
- [x] Route `/life-journey` + Navbar link "💛 Hành Trình"
- [x] Dual view: compact (hover tooltip) / expanded (tiered labels)
- [x] 30 emoji picker, emotion slider -5→+5, custom chart title

---

## ❌ Phase 6 — Team Accountability v3 — CANCELLED
*Cancelled: 2026-04-25 — Pivot to Personal Life Hub*

> Team features archived. App repositioned as personal productivity hub ("Second Brain").
> Code moved to `src/_archived/`. DB tables remain but unused.

---

## ✅ Phase 6 (NEW) — Personal Life Hub Foundation (v3.0.0)
*Hoàn thành: 2026-04-25 — Branch: `feat/v3-personal`*

**Goal:** Pivot app từ "Team Habit Tracker" → "Personal Life Hub / Second Brain"

### 6.1 — Cleanup + Migration SQL ✅
- [x] Archive team/friends code → `src/_archived/`
- [x] Create `data/migration_v3.0.0.sql` (4 new tables + RLS)
- [x] Rebrand: "Thử Thách Vượt Lười" → "Life Hub — Personal Life OS"
- [x] Update `package.json` version → 3.0.0

### 6.2 — Navigation Restructure ✅
- [x] Sidebar (desktop) + Bottom tabs (mobile): Today, Inbox, Collect, Finance, Life Log
- [x] Gamification dropdown (Journey, Quiz, BXH) — ẩn khỏi nav chính
- [x] Global floating [+] Quick Capture button
- [x] Landing page: marketing (unauthenticated) → login → Today page

### 6.3 — Activity Log System ✅
- [x] `useActivityLog.js` — log mọi action vào `activity_logs` table
- [x] Wire into existing: habit tick, task done, mood set, focus done, challenge done, collect add

### 6.4 — Inbox + Collect ✅
- [x] `useCollections.js` — CRUD collections (inbox + typed items)
- [x] `InboxPage.jsx` — Quick items chưa phân loại, classify → Collect
- [x] `CollectPage.jsx` — Kho Tàng Kiến Thức: 6 tabs, search, card grid, reader view
- [x] `DailyReview.jsx` — Today-recap widget (sidebar)

### 6.5 — Finance ✅
- [x] `useExpenses.js` — CRUD expenses (chi tiêu only)
- [x] `useSubscriptions.js` — CRUD subscriptions + expiry alerts
- [x] `FinancePage.jsx` — 2 tabs: Chi tiêu (quick-add + breakdown) + Đăng ký
- [x] `SubAlert.jsx` — Cảnh báo sắp hết hạn (sidebar)
- [x] `src/data/expense-categories.json` — 8 categories mặc định

### 6.6 — Life Log ✅
- [x] `ActivityHeatmap.jsx` — GitHub-style yearly activity heatmap (SVG)
- [x] `DailyTimeline.jsx` — Vertical feed per day (click from heatmap)
- [x] `LifeLogPage.jsx` — Combine heatmap + daily timeline

---

## ✅ Phase 7 — Unified Dashboard (v3.1.0)
*Hoàn thành: 2026-04-26*

- [x] Dashboard redesign — Unified stats từ tất cả modules (habit + finance + activity + focus + XP)
- [x] Today Overview row: 4 KPIs hôm nay
- [x] Finance Section: 3 KPI cards + Finance Pie SVG donut chart
- [x] ActivityHeatmap thay ContributionGraph habit-only

---

## ✅ Phase 7.5 — Knowledge Base Dual-Mode Editor + UX Polish (v3.2.0)
*Hoàn thành: 2026-04-26*

### KB Dual-Mode Editor
- [x] `TiptapEditor.jsx` — WYSIWYG editor (Tiptap) + `TiptapReadOnly`
- [x] `tiptap.css` — Dark theme toolbar, prose styles, table, inline link popover
- [x] `CollectPage.jsx` — Mode toggle (Markdown default / Visual), mode-lock per article
- [x] `CollectPage.jsx` — `isTiptapBody()` auto-detect (fallback khi migration chưa chạy)
- [x] `CollectPage.jsx` — `ReaderView` detect format → render `TiptapReadOnly` hoặc `ReactMarkdown`
- [x] `CollectPage.jsx` — `ArticleCard` dùng `body_text` cho excerpt
- [x] `CollectPage.jsx` — `safeHostname()` guard `new URL()` crash
- [x] `useCollections.js` — `addItem` nhận `content_format`, `body_text`, `word_count`
- [x] `migration_v3.2.0_knowledge.sql` — ADD COLUMN `content_format / body_text / word_count`

### ConfirmModal System
- [x] `ConfirmModal.jsx` — Promise-based `useConfirm()` hook, glassmorphism UI, danger variant
- [x] `confirm-modal.css` — Scale-in animation, Escape key, backdrop click, light mode
- [x] Remove tất cả `window.confirm()`, `window.alert()`, `window.prompt()` trong active code

---

## ✅ Phase 7.6 — Dashboard Polish + Debt Cleanup (v3.2.1)
*Hoàn thành: 2026-04-27*

- [x] Mood trend chart (7/30 ngày toggle, dot-line SVG)
- [x] Focus session breakdown per habit (horizontal bar chart)
- [x] Weekly review digest (in-app 7-day summary)
- [x] Docs cleanup: Team v3 debris, version bump, PLAN.md fix

---

## ✅ Phase 7.7 — Tiptap Slash Command + Shortcuts (v3.3.0)
*Hoàn thành: 2026-04-27*

- [x] Slash Command Menu (`/`) — 12 block types, @tiptap/suggestion plugin
- [x] Keyboard Shortcuts Panel (Ctrl+.) — 25+ shortcuts, 4 sections, glassmorphism modal
- [x] Browser Shortcut Override — Ctrl+S save, Ctrl+P block, Ctrl+. toggle
- [x] CollectPage → TiptapEditor `onSave` prop wired
- [x] SlashCommand.jsx [NEW]

## ✅ Phase 8.1—8.5 — Personal OS Expansion (v3.5.0 → v3.9.0)
*Hoàn thành: 2026-04-30*

### 8.1 — Quick Expense + Overdue Triage (v3.5.0) ✅
- [x] Quick Expense Modal (Inbox → Expense, regex parse VNĐ)
- [x] Overdue triage sections (Quá hạn / Hôm nay / Sắp tới)
- [x] One-click Rollover overdue → today

### 8.2 — Energy Tag + Recurring Tasks (v3.6.0) ✅
- [x] energy_level + duration_est columns on user_tasks
- [x] recurrence_rule JSONB (interval/weekly/monthly)
- [x] Spawn-one recurring logic (no infinite loops)
- [x] Energy filter chips in TaskListSection

### 8.3 — Cashflow Calendar + PARA Tags (v3.7.0) ✅
- [x] CashflowBar — 30-day subscription timeline
- [x] Central tags table + junction tables (expense_tags, subscription_tags)
- [x] useTags hook + TagPicker component

### 8.4 — Inbox Snooze (v3.8.0) ✅
- [x] snoozed_until DATE on collections
- [x] snoozeItem() + getSnoozedCount() in useCollections
- [x] Snooze UI (4 options) + snoozed badge

### 8.5 — 🥚 Incubator Module (v3.9.0) ✅
- [x] intentions + intention_logs DB tables
- [x] useIntentions hook (defer with friction, execute → Task/Expense)
- [x] IncubatorPage — card UI, timeline, defer/execute modals
- [x] Route /incubator + Navbar link
- [x] Inbox → 🥚 Ấp Trứng action

---

## ✅ Phase 8.6 — Reader View + Health Tab (v4.0.0)
*Hoàn thành: 2026-04-30*

- [x] Vercel Edge Function api/meta.js (OG metadata fetch)
- [x] useLinkMeta hook + preview cards in InboxPage
- [x] Graceful fallback for blocked URLs
- [x] fitness_logs table + useFitnessLog hook
- [x] 🏋️ Sức Khỏe tab in TrackerPage
- [x] XP + Heatmap integration for fitness

---

## ✅ Phase 8.7 — Incubator Multi-Output Router (v4.2.0)
*Hoàn thành: 2026-05-01*

- [x] Execute Modal: Radio → Checkbox (multi-select: Expense + Habit + Task)
- [x] `estimated_time` UI: dropdown form input + duration badge on cards
- [x] Multi-dispatch: `addExpense` + `addHabit` + `addTask` đồng thời
- [x] Auto-suggest: cost→Expense, time→Habit, nothing→Task
- [x] DB: `converted_to TEXT[]` + `converted_ids JSONB`
- [x] Cross-module: `useExpenses` + `useCustomHabits` + `expense-categories.json`

---

## ✅ Phase 9.1 — Quick Wins: Edit Expense + Sub Auto-Advance + Review Banner (v4.2.1)
*Hoàn thành: 2026-05-01*

- [x] `useExpenses.updateExpense()` — optimistic update + rollback
- [x] FinancePage: ✏️ edit button + modal (amount, category, note)
- [x] `useSubscriptions.fetchSubs` auto-advance expired `next_due` (bounded MAX=24)
- [x] TrackerPage: 🥚 Incubator Review Banner (yellow alert + link)

---

## ✅ Phase 9.4 — Inbox Filters + Incubator Archive + Tags Cleanup (v4.3.0)
*Hoàn thành: 2026-05-01*

- [x] InboxPage: Filter chips (Tất cả / Có URL / Gần đây) — client-side filtering
- [x] IncubatorPage: Archive toggle — xem dự định đã bỏ qua
- [x] `useIntentions.fetchAbandoned()` — fetch abandoned intentions
- [x] Migration: `ALTER TABLE collections DROP COLUMN IF EXISTS tags`

---

## ✅ Phase 10 — Task ↔ Knowledge Link + Inbox Bulk Actions (v4.4.0)
*Hoàn thành: 2026-05-02*

### 10.1 — Bug Fixes ✅
- [x] `IncubatorPage.jsx` — Fix `EXPENSE_DATA.map()` crash → `.categories.map()` + fix field names `cat.id`→`cat.key`, `cat.name`→`cat.label`
- [x] `useSubscriptions.js` — Fix `getMonthlyCost()` for `3month` (÷3) and `6month` (÷6) cycles

### 10.2 — Activity Log for Inbox Actions ✅
- [x] `InboxPage.jsx` — `handleClassify()` + `handleSnooze()` → `logActivity()` integration

### 10.3 — Task ↔ Knowledge 1:1 Link ✅
- [x] `migration_v4.4.0_task_knowledge_link.sql` — `ALTER TABLE user_tasks ADD COLUMN collection_id UUID REFERENCES collections(id)`
- [x] `useUserTasks.addTask()` — accepts optional `collectionId`
- [x] `CollectPage.jsx` — ReaderView: 📌 Task button creates task linked to KB item
- [x] `TaskListSection.jsx` — 🔗 KB badge on tasks with `collection_id`, click navigates to /collect

### 10.4 — Inbox Bulk Actions ✅
- [x] `InboxPage.jsx` — Toggle "☑ Chọn nhiều" mode, checkbox per item, select all/none
- [x] `InboxPage.jsx` — Bulk classify (📂 type picker) + bulk delete (🗑)
- [x] `InboxPage.jsx` — Activity log for bulk operations
- [x] `inbox.css` — Bulk bar, classify menu, checkbox, selected highlight (dark/light)

---

## ✅ Phase 10.5 — Task ↔ KB Many-to-Many + Recovery (v4.5.0 → v4.5.2)
*Hoàn thành: 2026-05-07*

### 10.5A — Junction Table (v4.5.0) ✅
- [x] `schema_v4.4.0.sql` — `task_collections` junction table (composite PK, RLS, CASCADE, index)
- [x] Migration: INSERT existing `user_tasks.collection_id` data → junction table
- [x] Deprecate `user_tasks.collection_id` column (COMMENT, keep for rollback)

### 10.5B — Hooks: Embedded Select + Link/Unlink (v4.5.0) ✅
- [x] `useUserTasks.js` — Fetch with embedded select `task_collections(collection_id, collections(id, title, type))` → `_collections` array (1 query, no N+1)
- [x] `useUserTasks.js` — `linkCollection(taskId, collectionId)` + `unlinkCollection(taskId, collectionId)` with optimistic updates
- [x] `useCollections.js` — Fetch with `task_collections(task_id)` join → `_linkedTaskIds` + `_linkedTaskCount` per item
- [x] Both hooks: 2-step graceful fallback (full → tags-only → plain) when junction table missing

### 10.5C — UI: LinkKBModal + Task Side (v4.5.0) ✅
- [x] `LinkKBModal.jsx` [NEW] — Search + checkbox modal, max 10 results, linked items sorted first, searches title + body_text/body
- [x] `TaskListSection.jsx` — Badge `🔗 N bài`, 🔗 button per task opens LinkKBModal, KB link button in edit form
- [x] `TaskListSection.jsx` — `fetchCollections({})` trigger when modal opens

### 10.5D — UI: KB Side (v4.5.0) ✅
- [x] `CollectPage.jsx` — 📌 icon + dropdown task filter popup (click-outside auto-close, task search)
- [x] `CollectPage.jsx` — ArticleCard `📌 N tasks` badge when linked
- [x] `CollectPage.jsx` — ArticleCard excerpt: extract text from Tiptap JSON when `body_text` is empty

### 10.5E — Bug Fixes (v4.5.1) ✅
- [x] `useUserTasks.js` — Fallback query when `task_collections` table doesn't exist (400 error → retry plain select)
- [x] `useCollections.js` — 3-step fallback: full join → tags-only → plain `select('*')`
- [x] `LinkKBModal.jsx` — Fix empty modal: trigger `fetchCollections({})` when modal opens
- [x] `schema_v4.4.0.sql` — Add missing `profiles_insert_own` INSERT RLS policy
- [x] `Navbar.jsx` — Add "⚙️ Cài Đặt" to avatar dropdown menu

### 10.5F — Recovery (v4.5.2) ✅
- [x] `useUserTasks.js` — Restored from git (0 bytes corruption) + re-applied v4.5.0 upgrades
- [x] `useCollections.js` — Restored from git (0 bytes corruption) + re-applied v4.5.0 upgrades
- [x] `LinkKBModal.jsx` — Rebuilt from scratch (no git history)
- [x] `index.html` — Replace deprecated `apple-mobile-web-app-capable` with `mobile-web-app-capable`

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

