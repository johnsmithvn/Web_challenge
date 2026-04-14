# PLAN — Thử Thách Vượt Lười

## Current Version: v1.1.0 ✅

---

## Phase 1 — v1.1.0 (Frontend Only) — ✅ DONE
**Branch:** `feat/v1.1-gamification-quiz-notifications`

### Completed
- [x] Fix countdown hardcoded → localStorage-persisted 7-day rolling window
- [x] Testimonials section (4 cards, landing page)
- [x] XP / Level gamification system (6 levels, localStorage)
- [x] Daily Challenge (21-pool, date-seeded, +20 XP)
- [x] Quiz Não Bộ page (10 MCQ, XP reward, explanation)
- [x] Web Notifications (browser Notification API, scheduled reminder)
- [x] Leaderboard page (mock + local user, 3 tabs, podium)
- [x] Navbar: Quiz + Leaderboard links + XpBar compact
- [x] TrackerSection: +10 XP per daily check (deduped)

---

## Phase 2 — v2.0.0 (Supabase Backend)
**Status:** PENDING — requires Supabase project keys  
**Branch:** `feat/v2.0-supabase-auth-team`

### Prerequisites
- [ ] Create Supabase project at supabase.com (region: Singapore)
- [ ] Run `docs/DATABASE.md` SQL schema in SQL Editor
- [ ] Enable Google OAuth (Authentication → Providers → Google)
- [ ] Enable Realtime for: progress, reactions, streaks, teams
- [ ] Add keys to `.env.local`:
  ```
  VITE_SUPABASE_URL=https://xxx.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJxxx...
  ```

### Milestones
- [ ] `src/lib/supabase.js` — singleton Supabase client
- [ ] `src/contexts/AuthContext.jsx` — session, signIn, signUp, signOut, Google OAuth
- [ ] `src/components/AuthModal.jsx` — Login/Register/Google tabs
- [ ] Navbar: avatar + logout if logged in, else "Login" button
- [ ] `useHabitStore.js` — dual mode: Supabase DB (if authed) / localStorage (guest)
- [ ] Migration: localStorage → DB on first login
- [ ] `TeamPage.jsx` — real invite codes via Supabase `teams` table
- [ ] Realtime: teammate progress subscription
- [ ] Auto-match queue (`partner_queue` table)
- [ ] `FriendsPage.jsx` — search user, send/accept requests
- [ ] `LeaderboardPage.jsx` — real data from Supabase DB aggregation

---

## Phase 3 — v3.0.0 (AI + Advanced)
**Status:** BACKLOG

- [ ] AI Coach chatbot (OpenAI API)
- [ ] Payment gateway integration (Stripe / MoMo)
- [ ] Push notifications via Service Worker (native mobile-like)
- [ ] PWA manifest + offline support

---

## Architecture Notes

### Data Flow (v1.x — current)
```
User action → useHabitStore → localStorage → React state
           → useXpStore   → localStorage → XpBar UI
```

### Data Flow (v2.x — Supabase)
```
Guest:   action → localStorage (unchanged UX, no login needed)
Authed:  action → Supabase DB → realtime broadcast → teammate UI updates
         (optimistic update to localStorage first for instant feedback)
```

### Auth Strategy
- **Guest mode**: full app usable with no login, no friction
- **Login trigger**: when accessing Team Mode real sync or seeing Leaderboard real data
- **Session**: Supabase JWT, persisted via localStorage adapter
- **First login**: detect `vl_habit_data` in localStorage → migrate to Supabase progress table
