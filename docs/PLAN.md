# PLAN.md — Life Hub (Personal Life OS)
**Updated:** 2026-04-25
**Current Version:** v3.0.1
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
- [x] `CollectPage.jsx` — Filtered list (Link, Quote, Want, Learn, Idea)
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

## 📋 Phase 7 — Analytics & Intelligence (v3.1.0+)
*Backlog — sau khi v3.0.0 stable*

- [ ] Mood pattern chart (7/30 ngày)
- [ ] Skip reason analysis
- [ ] Focus session breakdown per habit
- [ ] Weekly review digest (in-app summary)
- [ ] Dashboard redesign (unified stats from all modules)
- [ ] AI insight từ pattern data (future)

---

## 📋 Phase 8 — Focus Upgrade + Polish (v3.2.0+)
*Backlog — deferred theo yêu cầu*

- [ ] Ambient sounds (Rain, Café, Forest, Lo-fi, Ocean)
- [ ] Distraction Pad (quick capture from Focus)
- [ ] Focus stats dashboard
- [ ] Fullscreen mode
- [ ] SEO sitemap
- [ ] i18n (Vietnamese/English)
- [ ] Kanban board cho Wishlist (if needed)
- [ ] Tree structure cho Learning notes (if needed)

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

