# CHANGELOG

## v1.5.0 — 2026-04-19

### Added
- `data/migration_v1.5.0.sql` — 5 bảng mới: `programs`, `program_habits`, `user_journeys`, `journey_habits`, `habit_logs` + RLS + indexes + 5 seed templates
- `src/hooks/useHabitLogs.js` — Thay thế `vl_habit_progress` localStorage bằng Supabase `habit_logs`. One-time silent migration. Giữ cùng format `habitProg` map để UI backward-compatible
- `src/hooks/useJourney.js` — Lifecycle management: start/complete/renew/extend journey. `ensureDefaultJourney()` auto-wrap habits cũ

### Changed
- `src/pages/HabitsPage.jsx` — Dùng `useHabitLogs` + `useJourney` thay vì đọc/ghi `vl_habit_progress` trực tiếp
- `docs/ARCHITECTURE.md` — Cập nhật hooks, Supabase tables, localStorage keys (v1.5.0)

### Technical Debt Resolved
- `vl_habit_progress` (localStorage) → `habit_logs` (Supabase): data bền vững, cross-device, có thể xem lại lịch sử

---

## v1.4.5 — 2026-04-19

### Added
- `src/data/quotes.json` — 30 câu trích dẫn động lực tiếng Việt (Rule 14: tách ra khỏi component)
- `src/pages/HabitsPage.jsx` — Daily motivational quote card xoay theo ngày trong năm
- `src/pages/HabitsPage.jsx` — Header stat cards: Habits count 🎯 + Ngày còn lại ⏳
- `src/pages/HabitsPage.jsx` — Tab "📊 Theo Tuần": PerHabitWeeklyGrid 14 ngày per-habit
- `src/pages/HabitsPage.jsx` — Per-habit streak 🔥N trong today list
- `src/pages/HabitsPage.jsx` — Counter badge X/N habits done hôm nay
- `src/pages/HabitsPage.jsx` — `computeHabitStreak()` + `dayPct()` helpers

### Changed
- `src/pages/HabitsPage.jsx` — Weekly grid: gradient cell (partial day = tint màu habit)
- `src/pages/HabitsPage.jsx` — Weekly grid: header row % completion toàn bộ habits per-day

---

## v1.4.0 — 2026-04-18

### Added
- `data/migration_v1.4.0.sql` — Thêm cột `action`, `status`, `cycle_count`, `conquered_at` vào bảng `habits`
- `src/data/habits.json` — Thêm field `action` cho 3 default habits
- `src/components/LoginNudgeModal.jsx` — Bottom sheet nhắc đăng ký cho guest sau ngày 1
- `src/styles/completion.css` — Certificate styles (seal, divider, dual CTA options)

### Changed
- `src/hooks/useCustomHabits.js` — Thêm `conquestHabit()`, `renewHabit()`, computed `activeHabits`, `conqueredHabits`
- `src/components/HabitManager.jsx` — Thêm field `action` (hành động cụ thể) vào form
- `src/components/CompletionModal.jsx` — Redesign thành Certificate modal: 2 CTA (Gia Hạn / Thử Thách Mới)
- `src/pages/HabitsPage.jsx` — Thêm Celebration banner + Conquered Habits section + LoginNudgeModal
- `src/pages/TrackerPage.jsx` — Wire `onRenew` / `onNewChallenge` cho CompletionModal

---


### Added
- `src/hooks/useTeam.js` — Team hook: fetch N members (batch), realtime subscription, create/join/leave team
- `src/hooks/useTeamCheck.js` — Check logic: week-2 lock enforcement, submit team_check_logs, validate per-user
- `src/hooks/useTeamRules.js` — Rules hook: propose rules, agree/reject flow, status computation (pending→active/rejected)
- `src/components/team/TeamMemberCard.jsx` — Per-member card: week badge, 7-day mini heatmap, lock state, check button
- `src/components/team/TeammateCheckPanel.jsx` — Done/Fail modal: required reason on fail, realtime feedback
- `src/components/team/JoinSyncModal.jsx` — Week sync modal: restart vs continue choice when joining mid-program
- `src/components/team/TeamRules.jsx` — Rules section: list rules, TeamRuleCard with agree/reject UI, propose form
- `docs/supabase_team_v3.sql` — Full DB migration: 5 new tables, indexes, RLS policies, realtime publication
- `vercel.json` — SPA routing config for Vercel deploy

### Changed
- `src/pages/TeamPage.jsx` — Full refactor: N-member grid (Duo/Trio/Squad), all new hooks + components wired, demo mode with 3 mock members
- `src/styles/team.css` — Full rewrite: N-member responsive grid, member card styles, check panel modal, join sync modal, rules section

### Database Schema (run `docs/supabase_team_v3.sql`)
- `teams` — added `name`, `max_members`, `created_by`, `activated_at`
- `team_members` — junction table (N per team), `role`, `week_sync`
- `user_programs` — per-user 21-day journey, `started_at`, `current_week`, `reset_count`
- `team_check_logs` — accountability checks, UNIQUE(team_id, checked_id, date)
- `team_rules` — reward/punishment rules with trigger types
- `team_rule_agreements` — per-member approval flow

---

## v2.0.0 — 2026-04-15

### Added
- `src/lib/supabase.js` — Singleton Supabase client, safe fallback when keys not set
- `.env.local.example` — Template for Supabase credentials
- `src/contexts/AuthContext.jsx` — Full auth context: signIn, signUp, Google OAuth, signOut, profile
- `src/components/AuthModal.jsx` — Login / Register / Google tabs with error UX
- `src/styles/auth.css` — Modal, input, avatar, user menu dropdown styles
- `src/pages/FriendsPage.jsx` — Friend search, send/accept/decline requests, friend list
- `src/styles/friends.css` — Friends page styles

### Changed
- `src/hooks/useHabitStore.js` — Dual mode: Supabase when authenticated, localStorage when guest, auto-migration on first login
- `src/components/Navbar.jsx` — Avatar + dropdown menu when logged in, login button when guest
- `src/pages/TeamPage.jsx` — Real Supabase create/join team, realtime subscription, reactions to DB, auth wall + demo bypass

---

## v1.1.0 — 2026-04-14

### Added
- `src/hooks/useXpStore.js` — XP/Level system: 6 levels, localStorage, milestone awards
- `src/components/XpBar.jsx` — Compact (Navbar) + full card (TrackerPage) XP display
- `src/components/DailyChallenge.jsx` — 21-challenge pool, date-seeded daily challenge, +20 XP on complete
- `src/pages/QuizPage.jsx` — 10 MCQ questions (brain science), route `/quiz`, XP reward
- `src/hooks/useNotifications.js` — Browser Notification API, schedule daily reminder
- `src/components/NotificationSettings.jsx` — Toggle + time picker in TrackerPage
- `src/pages/LeaderboardPage.jsx` — 3 tabs (weekly/monthly/all-time), podium top 3, mock + real user, route `/leaderboard`
- `src/components/TestimonialsSection.jsx` — 4 testimonial cards on LandingPage

### Changed
- `src/components/Navbar.jsx` — Added Quiz, Leaderboard links + compact XpBar
- `src/components/TrackerSection.jsx` — +10 XP per daily check (deduped by date)
- `src/pages/TrackerPage.jsx` — XP milestone toast + browser notification scheduling
- Fix countdown: localStorage-persisted 7-day rolling window

---

## v1.0.0 — 2026-04-13

### Added
- Full design system: CSS tokens, glassmorphism, dark mode, animations (`global.css`)
- `src/components/Navbar.jsx` — Sticky + mobile burger menu
- `src/components/HeroSection.jsx` — Typewriter, floating orbs, dual CTA, stats counter
- `src/components/ContentSections.jsx` — Problem toggle + Knowledge 3-cards + MiniLesson popup
- `src/components/RoadmapSection.jsx` — Interactive 3-week timeline with task expansion
- `src/components/TrackerSection.jsx` — Habit table T2→CN × 3 weeks (PDF-accurate)
- `src/components/ReverseSection.jsx` — Split-screen old vs new approach
- `src/components/PricingSection.jsx` — Pricing card + live countdown timer
- `src/pages/LandingPage.jsx` — 7-section landing assembly
- `src/pages/TrackerPage.jsx` — 28-day heatmap + day-of-week bar chart + insights
- `src/pages/TeamPage.jsx` — Team Mode: invite code, mock teammate, emoji reactions, auth wall
- `src/pages/DashboardPage.jsx` — Analytics dashboard
- `src/hooks/useHabitStore.js` — localStorage: streak, badge, completion tracking
- `src/App.jsx` — BrowserRouter + 4 routes
- `README.md`, `CHANGELOG.md`, SEO meta tags in `index.html`
