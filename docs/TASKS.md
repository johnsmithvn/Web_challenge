# TASKS — Thử Thách Vượt Lười
**Updated:** 2026-04-19

---

## v1.4.5 — ✅ DONE (2026-04-19)

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

## v3.0.0 — 🚧 Đang Thiết Kế (Team Mode v3 — N members)

### DB (chưa deploy)
- [x] Schema thiết kế: `team_members`, `user_programs`, `team_check_logs`, `team_rules`, `team_rule_agreements`
- [ ] Chạy `data/supabase_team_v3.sql` trong Supabase

### Hooks (chưa implement)
- [ ] `src/hooks/useTeamCheck.js` — week-2 check logic (teammate check, không self-check)
- [ ] `src/hooks/useTeamRules.js` — CRUD rules, propose + unanimous approval

### Components (chưa implement)
- [ ] `src/components/team/TeamMemberCard.jsx`
- [ ] `src/components/team/TeammateCheckPanel.jsx` — done/fail modal + reason
- [ ] `src/components/team/JoinSyncModal.jsx` — restart vs continue week
- [ ] `src/components/team/TeamRules.jsx`

### Next (backlog)
- [ ] Per-habit progress sync lên Supabase (hiện chỉ localStorage `vl_habit_progress`)
- [ ] Mood log chart trong DashboardPage
- [ ] Weekly review email/notification
- [ ] AI insight từ skip reason patterns

---

## v2.0.0 — ✅ DONE

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
