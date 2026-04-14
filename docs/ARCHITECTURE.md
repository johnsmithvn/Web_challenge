# ARCHITECTURE — Thử Thách Vượt Lười

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Vite + React 18 | SPA, component-based |
| Styling | Vanilla CSS | Custom design system, no Tailwind |
| Routing | react-router-dom v6 | BrowserRouter, 6 routes |
| State (v1) | Custom hooks + localStorage | No Redux, no Context needed |
| State (v2) | Supabase Postgres + Realtime | Auth + DB + push |
| Auth (v2) | Supabase Auth | Email/password + Google OAuth |
| Hosting | Render Static Site | Auto-deploy from GitHub |

---

## Folder Structure (v1.1 current)

```
vuu-liem/
├── public/
│   └── _redirects              ← Render SPA redirect rule
├── src/
│   ├── components/
│   │   ├── Navbar.jsx           ← Sticky nav, XpBar inline, mobile burger
│   │   ├── HeroSection.jsx      ← Typewriter, orbs, dual CTA
│   │   ├── ContentSections.jsx  ← ProblemSection + KnowledgeSection
│   │   ├── RoadmapSection.jsx   ← 3-week interactive timeline
│   │   ├── TrackerSection.jsx   ← Habit table T2→CN × 3 weeks + XP award
│   │   ├── ReverseSection.jsx   ← Split-screen old vs new
│   │   ├── TestimonialsSection.jsx ← 4 review cards
│   │   ├── PricingSection.jsx   ← Countdown + CTA
│   │   ├── DailyChallenge.jsx   ← Date-seeded challenge + XP
│   │   ├── XpBar.jsx            ← XP/level display (compact + full)
│   │   └── NotificationSettings.jsx ← Toggle + time picker
│   ├── contexts/                ← [v2] AuthContext.jsx
│   ├── hooks/
│   │   ├── useHabitStore.js     ← Daily progress, streak, badge, localStorage
│   │   ├── useXpStore.js        ← XP log, level calc, localStorage
│   │   └── useNotifications.js  ← Browser Notification API
│   ├── lib/                     ← [v2] supabase.js singleton
│   ├── pages/
│   │   ├── LandingPage.jsx      ← 8-section landing
│   │   ├── TrackerPage.jsx      ← Heatmap + DailyChallenge + XpBar
│   │   ├── DashboardPage.jsx    ← Stats + bar chart + insights
│   │   ├── TeamPage.jsx         ← Team Mode (mock → real in v2)
│   │   ├── QuizPage.jsx         ← 10 MCQ + score + XP
│   │   └── LeaderboardPage.jsx  ← Podium + ranked table (mock → real in v2)
│   ├── styles/
│   │   ├── global.css           ← Design system: tokens, reset, components
│   │   ├── hero.css
│   │   ├── navbar.css
│   │   ├── sections.css         ← Problem, Knowledge, Roadmap, Reverse, Pricing
│   │   ├── tracker.css          ← Tracker table, Dashboard, Team
│   │   ├── testimonials.css
│   │   ├── xpbar.css
│   │   ├── daily.css            ← DailyChallenge + NotificationSettings
│   │   ├── quiz.css
│   │   └── leaderboard.css
│   ├── App.jsx                  ← BrowserRouter + 6 routes
│   └── main.jsx                 ← createRoot entry point
├── docs/
│   ├── PLAN.md                  ← Phase milestones
│   ├── TASKS.md                 ← Task tracking per version
│   ├── ARCHITECTURE.md          ← This file
│   └── DATABASE.md              ← Supabase schema + RLS
├── .env.local                   ← NOT committed (gitignored)
├── CHANGELOG.md
└── README.md
```

---

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/` | LandingPage | 8-section marketing/landing |
| `/tracker` | TrackerPage | Habit tracker + heatmap + XP + challenge |
| `/dashboard` | DashboardPage | Analytics: stats, bar chart, insights |
| `/team` | TeamPage | Team Mode (mock v1, real v2) |
| `/quiz` | QuizPage | 10 MCQ brain science quiz |
| `/leaderboard` | LeaderboardPage | Streak/XP/Done ranking |

---

## Component Tree (Simplified)

```
App
└── BrowserRouter
    ├── Navbar
    │   ├── XpBar (compact)
    │   └── NavLinks (Trang Chủ, Tracker, Đồng Đội, Dashboard, Quiz, BXH)
    └── Routes
        ├── / → LandingPage
        │   ├── HeroSection
        │   ├── ProblemSection
        │   ├── KnowledgeSection (+ MiniLesson modal)
        │   ├── RoadmapSection
        │   ├── TrackerSection
        │   ├── ReverseSection
        │   ├── TestimonialsSection
        │   └── PricingSection
        ├── /tracker → TrackerPage
        │   ├── XpBar (full)
        │   ├── DailyChallenge
        │   ├── 28-day Heatmap
        │   ├── TrackerSection (compact)
        │   ├── Insight card
        │   └── NotificationSettings
        ├── /dashboard → DashboardPage
        │   ├── Stat cards (streak, total, weekly%)
        │   ├── Heatmap
        │   ├── Day-of-week bar chart
        │   └── Insights
        ├── /team → TeamPage
        │   ├── Auth wall (demo bypass)
        │   ├── PlayerCard (Me)
        │   ├── PlayerCard (Teammate — mock/real)
        │   └── InviteCode + Reactions
        ├── /quiz → QuizPage
        │   ├── Question card
        │   ├── Options (A/B/C/D)
        │   ├── Explanation panel
        │   └── Result + XP reward
        └── /leaderboard → LeaderboardPage
            ├── Tab (Streak | XP | Done)
            ├── Podium top-3
            └── Full ranked table
```

---

## Custom Hooks

| Hook | Responsibility | Persistence |
|------|---------------|-------------|
| `useHabitStore` | Daily progress, streak, badge, week/total stats | localStorage → Supabase v2 |
| `useXpStore` | XP event log, level calculation, milestone check | localStorage |
| `useNotifications` | Browser permission, settings, scheduling | localStorage settings |
| `useAuth` (v2) | Session, user profile, sign in/out | Supabase JWT |

### XP Events

| Reason | Amount | Trigger |
|--------|--------|---------|
| `daily_check` | +10 | Each day habit ticked (deduped per date) |
| `streak_3` | +50 | One-time when streak reaches 3 |
| `streak_10` | +100 | One-time when streak reaches 10 |
| `streak_21` | +200 | One-time when streak reaches 21 |
| `daily_challenge` | +20 | One-time per day |
| `quiz_complete` | +10–50 | Based on score (score/10 × 50) |
| `duo_streak` | +30 | (v2) Each day both teammates done |

### Level Thresholds

| Level | Name | XP Min |
|-------|------|--------|
| 0 | 🌱 Người Mới | 0 |
| 1 | ⚡ Luyện Sĩ | 100 |
| 2 | 🔥 Đệ Tử | 300 |
| 3 | ⚔️ Chiến Binh | 700 |
| 4 | 👑 Huyền Thoại | 1500 |
| 5 | 🏆 Vô Địch | 3000 |

---

## Design System

**Colors (CSS variables)**
```css
--purple:      #8B5CF6
--cyan:        #06B6D4
--green:       #00FF88
--gold:        #FFD700
--blue:        #6366F1
--red:         #EF4444
--orange:      #F97316
--bg-primary:  #08080F
--bg-secondary:#0D0D1A
```

**Fonts**
- Display/headings: `Outfit` (Google Fonts)
- Body: `Inter` (Google Fonts)

**Glassmorphism pattern**
```css
background: rgba(255,255,255,0.04);
border: 1px solid rgba(255,255,255,0.08);
backdrop-filter: blur(20px);
border-radius: 16px;
```

---

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Guest mode (no forced login) | Reduce friction → max activation |
| localStorage first | Works offline, no auth needed for v1 |
| XP as immutable log | Append-only log prevents XP manipulation; mirrors production DB design |
| Date-seeded Daily Challenge | Consistent same day = same challenge; no DB needed |
| `hasMilestone()` deduplication | Prevents double XP across component remounts |
| Supabase Realtime for team | True push, no polling — scales well on free tier |
| Vanilla CSS (no Tailwind) | Per project RULES.md; full design token control |
