# TASKS — Thử Thách Vượt Lười
**Updated:** 2026-04-21

---

## v2.0.0 — ✅ DONE (2026-04-20) — Journey Owns Habits

### Architecture: Journey-scoped habits
- [x] `src/hooks/useJourney.js` — startJourney rewritten: each journey creates FRESH habit rows. No name-match reuse. Replace mode closes all old habits. Append mode keeps old + adds new.
- [x] `src/hooks/useCustomHabits.js` — fetch query filters `.eq('active', true)` so manage tab only shows current journey's habits

### Lifecycle fixes
- [x] `completeJourney` — now closes all active habits (`active=false, status='completed'`) alongside the journey
- [x] `renewJourney` — snapshots old habits BEFORE completing, then clones them as fresh rows for the new cycle with `journey_id` pointing to the new journey

### New UI
- [x] `src/components/journey/MyJourneys.jsx` — [NEW] "Của Tôi" tab showing past journeys with "Bắt đầu lại" button (fetches journey_habits snapshot)
- [x] `src/components/journey/ActiveJourneyPanel.jsx` — completion celebration UI: when completedDays >= targetDays shows 🎉 banner + 3 actions (Renew / Extend / Complete)
- [x] `src/pages/JourneyPage.jsx` — added "📂 Của Tôi" tab + wired onComplete handler



### Journey switch modal (replace vs append)
- [x] `src/components/journey/ProgramBrowser.jsx` — SwitchModeModal with 2 radio options: 🔄 Thay thế toàn bộ habits / ➕ Ghi thêm habits
- [x] `src/hooks/useJourney.js` — `startJourney` accepts `habitMode`: replace deactivates old habits, append keeps them + re-points to new journey

### History sort fix
- [x] `src/hooks/useJourney.js` — history sorted by `created_at` DESC (not `started_at` which is DATE-only)

### Stale chunk resilience
- [x] `src/pages/TrackerPage.jsx` — `lazyRetry()` wrapper auto-reloads on chunk load failure after redeployment

---

## v1.9.4 — ✅ DONE (2026-04-19) — Bulletproof Redirect Fix

### The REAL root cause of the redirect bug
- [x] `src/contexts/JourneyContext.jsx` — Fixed a deeper React `useEffect` batching race condition. Previously, when `AuthContext` finished loading and `isAuthenticated` became `true`, there was exactly **one render cycle (tick)** where `AppShell` evaluated `isAuthenticated=true`, but `JourneyContext` hadn't fired its effect yet, so `isLoadingJourney` was still `false` (set by the guest initialization).
- **Solution:** Converted `isLoadingJourney` into a **synchronous derived state** (`loadedUserId !== user.id`) instead of relying on `useEffect`. Now, the moment `user` is available, `isLoadingJourney` evaluates to `true` instantly, blocking the `AppShell` redirect until the fetch truly finishes.

---### Remove manual tick button
- [x] `src/pages/TrackerPage.jsx` — removed `handleMainTick` + big "Tick Hôm Nay" button. Hero area now shows auto-calculated status (X/Y habits). Daily day-complete is auto-derived from habit ticks (all done = day done). Fixes cross-journey stale tick state bug.

---

## v1.9.1 — ✅ DONE (2026-04-19) — Hotfixes

### Fix firstTime redirect loop (attempt 1 → superseded by v1.9.2)
- [x] `src/App.jsx` — use `useRef` to fire redirect ONCE + skip if already on /journey

### Fix signup → can't login
- [x] `src/contexts/AuthContext.jsx` — pass username in auth metadata + `ignoreDuplicates: false` for profile upsert
- [x] `data/migration_v1.9.0.sql` — update trigger `handle_new_user` to extract username+email from metadata + `ON CONFLICT DO UPDATE`

### Seed template habits in Supabase
- [x] `data/migration_v1.9.0.sql` — seed `program_habits` for all 5 template programs

### Month summary UI for journey detail
- [x] `src/pages/JourneyDetailPage.jsx` — added `MonthSummary` component with per-month progress rings (Hoàn thành / Bỏ qua / Còn lại)

---



### Step 1 — Fix template habits loading (Bug 1)
- [x] `src/components/journey/ProgramBrowser.jsx` — join `program_habits(*)` + normalize vào `habits[]`

### Step 2 — Xóa fake habits khi login (Bug 2)
- [x] `src/hooks/useCustomHabits.js` — authenticated → real data only, no DEFAULT_HABITS fallback

### Step 3 — Gộp HabitsPage → TrackerPage (Bug 4+5)
- [x] `src/pages/TrackerPage.jsx` — merged: 4 tabs (Hôm Nay/Lịch/Tuần/Quản Lý), lazy MonthCalendar+HabitManager, memo PerHabitWeeklyGrid, single mood, empty state CTA
- [x] `src/pages/HabitsPage.jsx` — `<Navigate to="/tracker" replace />`
- [x] `src/components/Navbar.jsx` — removed Habits link
- [x] `src/App.jsx` — route exists, HabitsPage handles redirect

### Step 4 — JourneyDetailPage full dashboard (Bug 3)
- [x] `src/pages/JourneyDetailPage.jsx` — JourneyCalendar (🟢/🟡/⬜ per day) + DayDetailModal (habits ✅/❌, mood, focus sessions)

---

## v1.8.0 — ✅ DONE (2026-04-19) — Journey-as-Core-Context

### Step 1 — DB: add `journey_id` to `focus_sessions`
- [x] `data/migration_v1.6.2.sql` — ALTER TABLE focus_sessions ADD COLUMN journey_id

### Step 2 — JourneyContext
- [x] `src/contexts/JourneyContext.jsx` — NEW: expose activeJourney globally, 1 Supabase fetch per login
- [x] `src/App.jsx` — wrap AppShell với JourneyProvider

### Step 3 — useHabitLogs: pass journey_id khi tick
- [x] `src/hooks/useHabitLogs.js` — import useActiveJourney, effectiveJourneyId, pass vào habit_logs upsert

### Step 4 — useFocusTimer: tag journey_id
- [x] `src/hooks/useFocusTimer.js` — useRef pattern để pass activeJourney.id vào focus_sessions insert

### Step 5 — useCustomHabits: gắn journey_id khi tạo habit
- [x] `src/hooks/useCustomHabits.js` — addHabit() thêm journey_id: activeJourney?.id

### Step 6 — Onboarding: redirect /journey nếu chưa có journey
- [x] `src/App.jsx` — AppShell: sau login, nếu !activeJourney → Navigate to /journey?firstTime=true

### Step 7 — Journey Detail Page
- [x] `src/pages/JourneyDetailPage.jsx` — NEW full page /journey/:id với stats: completion%, focus hours, XP, mood, habits
- [x] `src/components/journey/JourneyHistory.jsx` — click card → navigate /journey/:id
- [x] `src/App.jsx` — add route /journey/:id

### ⚠️ Pending (manual action required)
- [ ] Chạy phần SQL mới trong `data/migration_v1.6.2.sql` (phần 4 — ADD COLUMN to focus_sessions) trong Supabase SQL Editor

---

## v1.6.0 — ✅ DONE (2026-04-19)

### Phase B — JourneyPage UI ✅ Done
- [x] `src/pages/JourneyPage.jsx` — 3 tabs: Đang chạy / Khám Phá / Lịch Sử
- [x] `src/App.jsx` — Thêm route `/journey`
- [x] `src/components/Navbar.jsx` — Thêm link "🗺 Lộ Trình"
- [x] `src/pages/HabitsPage.jsx` — Journey banner (active: Ngày X/Y + link; inactive: CTA)
- [x] `src/styles/journey.css` — Full CSS cho tất cả journey components
- [x] `src/data/programs.json` — 5 system templates (Rule 14 compliant)

### Phase C — Templates & History ✅ Done
- [x] `src/components/journey/ProgramBrowser.jsx` — Grid templates, category filter, Supabase + local fallback
- [x] `src/components/journey/JourneyHistory.jsx` — List lịch sử + status badges
- [x] `src/components/journey/ActiveJourneyPanel.jsx` — Progress ring, habit snapshot, quit/renew/extend
- [x] `src/components/journey/CustomJourneyModal.jsx` — Tự tạo lộ trình

### Phase D — Completion Flow ✅ Done
- [x] `src/pages/TrackerPage.jsx` — Dots tính từ `user_journeys.started_at` thay `vl_program_round`
- [x] `src/components/CompletionModal.jsx` — Thêm "🗺 Chọn Lộ Trình Mới" button → navigate /journey

---

### HabitsPage v1.4.x — Action Tracking + Per-Habit Grid + Streak
- [x] `src/data/quotes.json` — Tạo mới: 30 câu trích dẫn động lực theo Rule 14
- [x] `src/pages/HabitsPage.jsx` — Daily quote card xoay theo ngày (import từ `quotes.json`)
- [x] `src/pages/HabitsPage.jsx` — Header: thêm stat card "🎯 Habits" + "⏳ Ngày còn lại"
- [x] `src/pages/HabitsPage.jsx` — Per-habit streak 🔥N trong today list (tính ngược từ `vl_habit_progress`)
- [x] `src/pages/HabitsPage.jsx` — Counter badge X/N habits done hôm nay
- [x] `src/pages/HabitsPage.jsx` — Tab "📊 Theo Tuần": PerHabitWeeklyGrid 14 ngày
  - Header row: % toàn bộ habits per-day
  - Per-habit: streak badge + tỷ lệ 14 ngày + gradient cell (partial = tint màu)
- [x] `src/pages/HabitsPage.jsx` — `computeHabitStreak()` + `dayPct()` helper functions
- [x] `docs/FEATURES.md` — Cập nhật section #2 HabitsPage
- [x] `docs/TASKS.md` — File này
- [x] `CHANGELOG.md` — Cập nhật v1.4.x

---

## v1.4.0 — ✅ DONE (2026-04-18)

### Phase 3 — Polish & Tech Debt
- [x] `src/hooks/useFocusTimer.js` — Focus XP +15 mỗi session (deduped by sessionId, write trực tiếp vào vl_xp_store để tránh circular import)
- [x] `src/hooks/useXpStore.js` — Thêm `focus_session: 15` vào XP_REWARDS cho nhất quán
- [x] `src/hooks/useMoodSkip.js` — Thêm `getAllSkips()` API
- [x] `src/pages/DashboardPage.jsx` — Widget "Phân Tích Bỏ Qua" 14 ngày gần đây, top reasons bar chart + smart tip theo lý do
- [x] `src/hooks/useHabitStore.js` — Fix `week_num` hardcode: tính từ ngày đầu tiên tick, capped tại 3

---


## v1.3.0 — ✅ DONE (2026-04-18)

### Phase 1 — Quick Wins
- [x] `src/components/CompletionModal.jsx` — Modal ăn mừng 21 ngày, confetti, summary XP/habits/round
- [x] `src/styles/completion.css` — Gold theme, burst animation
- [x] `src/pages/TrackerPage.jsx` — Wire CompletionModal: show once per milestone, "Bắt đầu vòng 2" reset
- [x] `src/components/OnboardingModal.jsx` — 3-step guide: chào mừng, MVA, cách dùng app
- [x] `src/styles/onboarding.css` — Dot progress, step animation
- [x] `src/App.jsx` — AppShell wrapper: show OnboardingModal once (localStorage vl_onboarded)
- [x] `src/hooks/useFocusTimer.js` — Auto-tick habit khi session complete >= habit.durationMin

### Phase 2 — Feature Completion
- [x] `src/pages/FriendsPage.jsx` — Fetch streak + XP thật từ Supabase cho từng bạn bè, hiển thị 🔥 streak
- [x] `src/pages/LeaderboardPage.jsx` — Query xp_logs table thay công thức hardcode streak*10

### Skipped (deferred)
- [ ] Push Notification thực sự (Web Push) — để sau
- [ ] Cross-tick Team (Tuần 2 accountability) — để sau

---


## v1.2.0 — ✅ DONE (2026-04-18)

### Custom Habits + Focus Timer + Dashboard v2 + Tracker Redesign

- [x] `src/hooks/useCustomHabits.js` — CRUD custom habits, dual-mode sync (localStorage / Supabase `habits` table)
- [x] `src/components/HabitManager.jsx` — UI tạo/sửa/xóa habit, icon/color/category picker, live preview
- [x] `src/components/MonthCalendar.jsx` — Lịch tháng, VN holidays, done/miss/future states, click detail
- [x] `src/hooks/useFocusTimer.js` — Pomodoro logic (work/break phases, session log, DB sync)
- [x] `src/components/FocusTimer.jsx` — SVG ring countdown, custom dropdown habit picker, settings slider
- [x] `src/pages/FocusPage.jsx` — 2 cột: timer + session history + daily breakdown
- [x] `src/pages/HabitsPage.jsx` — Today quick-tick per-habit, mood, skip modal, calendar tab, manage tab
- [x] `src/hooks/useMoodSkip.js` — useMoodLog + useSkipReasons, dual-mode upsert
- [x] `src/pages/TrackerPage.jsx` — Redesign: streak ring SVG, plant growth, big tick button, 21-day dot grid
- [x] `src/pages/DashboardPage.jsx` — Redesign: flower journey, monthly donut, weekly table, contribution graph
- [x] `src/styles/dashboard.css` — CSS riêng cho dashboard v2
- [x] `src/styles/focus.css` — Custom dropdown styles thay native select
- [x] `src/styles/tracker.css` — Tracker v2 styles (streak ring, tick btn, week dots)
- [x] `docs/FEATURES.md` — Tạo mới: tài liệu giải thích 16 tính năng
- [x] `data/migration_v1.2.0.sql` — SQL migration chỉ chứa 4 bảng mới (habits, focus_sessions, mood_logs, skip_reasons)
- [x] `docs/DATABASE.md` — Thêm v1.2 additions section
- [x] `docs/ARCHITECTURE.md` — Cập nhật cấu trúc thư mục + routes
- [x] `docs/TASKS.md` — Cập nhật (file này)

### Pending (cần làm thủ công)
- [ ] Chạy `data/migration_v1.2.0.sql` trong Supabase SQL Editor (thêm 4 bảng mới)
- [ ] Điền real keys vào `.env.local` → test toàn bộ flow với DB thật
- [ ] Test: habit tick → mood → skip reason → focus session → all synced DB

---

## v1.1.1 — ✅ DONE (2026-04-18 sáng)

- [x] Fix checkbox per-habit: mỗi habit có state riêng `vl_habit_progress`
- [x] Fix mood handler: `handleMood(m)` thay vì `saveMood(m)` sai
- [x] Fix WeekDots: tính từ ngày bắt đầu thật, không phải ngược về từ hôm nay
- [x] Fix FocusTimer custom dropdown: thay native `<select>` bằng glassmorphism panel
- [x] Fix CSS import: `HabitManager.jsx` dùng `calendar.css` không phải `habits.css`

---

## v3.0.0 — 🚧 Components Built, Chưa Full Integration (Team Mode v3 — N members)

### DB (chưa deploy)
- [x] Schema thiết kế: `team_members`, `user_programs`, `team_check_logs`, `team_rules`, `team_rule_agreements`
- [ ] Chạy `data/supabase_team_v3.sql` trong Supabase

### Hooks (built, chưa integrate full flow)
- [x] `src/hooks/useTeamCheck.js` — week-2 check logic (teammate check, không self-check)
- [x] `src/hooks/useTeamRules.js` — CRUD rules, propose + unanimous approval

### Components (built, chưa integrate full flow)
- [x] `src/components/team/TeamMemberCard.jsx`
- [x] `src/components/team/TeammateCheckPanel.jsx` — done/fail modal + reason
- [x] `src/components/team/JoinSyncModal.jsx` — restart vs continue week
- [x] `src/components/team/TeamRules.jsx`

### Remaining (chưa done)
- [ ] Full integration: wire hooks + components vào TeamPage production flow
- [ ] Realtime check notifications

### Next (backlog)
- [ ] Mood log chart trong DashboardPage
- [ ] Weekly review email/notification
- [ ] AI insight từ skip reason patterns

---

## v2.0.0-auth — ✅ DONE (Cloud + Auth, trước Journey v2.0.0)

- [x] Auth system (email, Google OAuth)
- [x] AuthContext, AuthModal
- [x] useHabitStore dual-mode (localStorage → Supabase migration on first login)
- [x] TeamPage: create/join team, realtime, reactions
- [x] FriendsPage: search, send/accept/decline
- [x] Supabase schema: profiles, progress, streaks, xp_logs, teams, reactions, friendships

---

## v1.1.0 — ✅ DONE (2026-04-14)

- [x] useXpStore + XpBar (6 levels)
- [x] DailyChallenge component (+20 XP)
- [x] QuizPage (10 MCQ, score-based XP)
- [x] LeaderboardPage (3 tabs, podium)
- [x] useNotifications + NotificationSettings
- [x] TrackerSection +10 XP per check (deduped)

---

## v1.0.0 — ✅ DONE

- [x] Navbar, Landing, TrackerPage, DashboardPage, TeamPage (mock)
- [x] useHabitStore (streak, badge, localStorage)
- [x] Design system (dark mode, glassmorphism, CSS variables)
- [x] BrowserRouter + routes
