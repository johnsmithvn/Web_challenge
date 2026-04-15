# TASKS — Thử Thách Vượt Lười

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



### Setup
- [ ] `src/lib/supabase.js` — singleton client
- [ ] `.env.local` — VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

### Auth
- [ ] `src/contexts/AuthContext.jsx` — useAuth hook
- [ ] `src/components/AuthModal.jsx` — Login/Register/Google tabs
- [ ] Navbar: avatar + logout nếu logged in

### Data Sync
- [ ] `useHabitStore.js` — Supabase sync (guest fallback localStorage)
- [ ] Migration: merge localStorage → DB khi login lần đầu

### Team Mode
- [ ] `TeamPage.jsx` — real invite codes (Supabase `teams` table)
- [ ] Realtime subscription cho teammate progress
- [ ] Auto-match queue system

### Social
- [ ] `FriendsPage.jsx` — search, friend request, accept/decline
- [ ] `LeaderboardPage.jsx` — real data từ Supabase DB

## v1.0.0 — ✅ DONE

- [x] Navbar, Hero, Problem, Knowledge, Roadmap, Tracker, Reverse, Pricing
- [x] TrackerPage, DashboardPage, TeamPage (mock)
- [x] useHabitStore (streak, badge, localStorage)
- [x] Design system (dark mode, glassmorphism)
- [x] BrowserRouter + 4 routes
- [x] README + CHANGELOG + docs/
