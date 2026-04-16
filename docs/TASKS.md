# TASKS — Thử Thách Vượt Lười

## v3.0.0 — 🚧 In Progress (Team Mode v3)

### DB (run supabase_team_v3.sql)
- [x] `teams` table: `name`, `max_members`, `created_by`, `activated_at` columns
- [x] `team_members` junction table (N per team, role, week_sync)
- [x] `user_programs` (per-user 21-day journey, week tracking)
- [x] `team_check_logs` (accountability checks with UNIQUE(team_id,checked_id,date))
- [x] `team_rules` + `team_rule_agreements` (propose + approval flow)
- [x] Realtime: all 5 new tables published
- [x] RLS policies for all new tables

### Hooks
- [x] `src/hooks/useTeam.js` — fetch team + N members + programs + streaks, realtime, create/join/leave
- [x] `src/hooks/useTeamCheck.js` — week-2 check logic, submit + validate, realtime
- [x] `src/hooks/useTeamRules.js` — CRUD rules, agree/reject flow, status computation

### Components
- [x] `src/components/team/TeamMemberCard.jsx` — per-member card (week badge, heatmap, check btn)
- [x] `src/components/team/TeammateCheckPanel.jsx` — done/fail modal + reason field
- [x] `src/components/team/JoinSyncModal.jsx` — restart vs continue week choice
- [x] `src/components/team/TeamRules.jsx` + `TeamRuleCard` — rules list + propose form + agree UI

### Pages
- [x] `src/pages/TeamPage.jsx` — refactored: N members grid, all components wired

### Styles
- [x] `src/styles/team.css` — full rewrite: member grid, check panel, join modal, rules

### Pending (manual)
- [ ] Run `docs/supabase_team_v3.sql` in Supabase SQL Editor
- [ ] Test: create team → join → check tuần 2 flow
- [ ] Test: propose rule → all members agree → active

---

## v2.0.0 — ✅ DONE (code, pending Supabase keys)

### Setup
- [x] `src/lib/supabase.js` — singleton, safe fallback if keys missing
- [x] `.env.local.example` — template keys

### Auth
- [x] `src/contexts/AuthContext.jsx` — signIn, signUp, Google OAuth, signOut, profile
- [x] `src/components/AuthModal.jsx` — Login/Register/Google tabs, error UX
- [x] `src/styles/auth.css` — modal, input, user menu
- [x] Navbar: avatar + dropdown menu if logged in, login button if guest

### Data Sync
- [x] `useHabitStore.js` — dual mode (Supabase authed / localStorage guest)
- [x] Migration: localStorage → Supabase DB on first login (deduped)

### Team Mode
- [x] `TeamPage.jsx` — real Supabase create/join team, realtime subscription
- [x] Auth wall + demo bypass
- [x] Reactions persist to DB

### Social
- [x] `FriendsPage.jsx` — search, send/accept/decline requests, friend list
- [x] `src/styles/friends.css`
- [x] `src/styles/team.css`

> ⚠️ Cần điền VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY vào .env.local để kích hoạt

---

## v1.1.0 — ✅ DONE (2026-04-14)

- [x] Fix countdown: localStorage-persisted 7-day rolling window
- [x] Testimonials section: 4 cards, added to LandingPage before Pricing
- [x] `useXpStore.js` — XP/Level system (6 levels, localStorage)
- [x] `XpBar.jsx` — compact (Navbar) + full card (TrackerPage)
- [x] `DailyChallenge.jsx` — 21-challenge pool, date-seeded, +20 XP
- [x] `QuizPage.jsx` — 10 câu MCQ não bộ, route `/quiz`, XP reward
- [x] `useNotifications.js` — browser Notification API, schedule reminder
- [x] `NotificationSettings.jsx` — toggle + time picker trong TrackerPage
- [x] `LeaderboardPage.jsx` — 3 tabs, podium, mock + real user, `/leaderboard`
- [x] Navbar updated: Quiz + Leaderboard + XpBar compact
- [x] TrackerSection: +10 XP per daily check (deduped)
- [x] TrackerPage: XP milestone awards + notification scheduling

---

## v1.0.0 — ✅ DONE

- [x] Navbar, Hero, Problem, Knowledge, Roadmap, Tracker, Reverse, Pricing
- [x] TrackerPage, DashboardPage, TeamPage (mock)
- [x] useHabitStore (streak, badge, localStorage)
- [x] Design system (dark mode, glassmorphism)
- [x] BrowserRouter + 4 routes
- [x] README + CHANGELOG + docs/
