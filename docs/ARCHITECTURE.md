# ARCHITECTURE.md — Thử Thách Vượt Lười
**Version:** v1.2.0
**Updated:** 2026-04-18
**Rule:** Cập nhật file này mỗi khi thêm page, hook, hoặc thay đổi data flow.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite |
| Routing | React Router v6 |
| Styling | Vanilla CSS (CSS variables, glassmorphism) |
| Database | Supabase (PostgreSQL + Realtime + Auth) |
| Local fallback | localStorage |
| Build | Vite (chunked output) |
| Hosting | (TBD — Vercel / Netlify) |

---

## Cấu Trúc Thư Mục

```
src/
├── components/              # Reusable UI components
│   ├── team/                # Team-specific sub-components
│   │   ├── TeamMemberCard.jsx     (TODO v3)
│   │   ├── TeammateCheckPanel.jsx (TODO v3)
│   │   ├── JoinSyncModal.jsx      (TODO v3)
│   │   └── TeamRules.jsx          (TODO v3)
│   ├── AuthModal.jsx        # Login/Register/Google tabs
│   ├── DailyChallenge.jsx   # Daily mini-challenge, +20 XP
│   ├── FocusTimer.jsx       # SVG countdown + habit dropdown
│   ├── HabitManager.jsx     # CRUD custom habits UI
│   ├── MonthCalendar.jsx    # Monthly view, VN holidays
│   ├── NotificationSettings.jsx
│   ├── TrackerSection.jsx   # Compact 3-week habit table
│   ├── XpBar.jsx            # XP + level indicator
│   └── ...
│
├── contexts/
│   └── AuthContext.jsx      # Auth state, signIn, signUp, Google, profile
│
├── hooks/
│   ├── useHabitStore.js     # Daily tick, streak, dual-mode (LS/Supabase)
│   ├── useCustomHabits.js   # Custom habit CRUD, dual-mode
│   ├── useFocusTimer.js     # Pomodoro phases, session log, DB sync
│   ├── useMoodSkip.js       # useMoodLog + useSkipReasons hooks
│   ├── useXpStore.js        # XP log, level computation
│   ├── useTeam.js           # Team fetch, create/join/leave, realtime
│   ├── useNotifications.js  # Browser notification API
│   └── ...
│
├── lib/
│   └── supabase.js          # Singleton Supabase client, safe fallback
│
├── pages/
│   ├── LandingPage.jsx      # / — Marketing page
│   ├── TrackerPage.jsx      # /tracker — Tick daily, streak ring, 21-day dots
│   ├── HabitsPage.jsx       # /habits — Per-habit tick, calendar, manage
│   ├── FocusPage.jsx        # /focus — Pomodoro timer
│   ├── DashboardPage.jsx    # /dashboard (Stats tab) — Flower, donut, weekly table
│   ├── TeamPage.jsx         # /team — Accountability partner
│   ├── QuizPage.jsx         # /quiz — 10-question MCQ
│   ├── LeaderboardPage.jsx  # /leaderboard — Streak/XP ranking
│   └── FriendsPage.jsx      # /friends — Kết bạn
│
├── styles/
│   ├── global.css           # CSS variables, reset, typography
│   ├── components.css       # Shared component classes
│   ├── tracker.css          # Tracker + Team styles (legacy split)
│   ├── dashboard.css        # Dashboard v2 styles
│   ├── focus.css            # Focus timer + custom dropdown
│   ├── calendar.css         # Monthly calendar
│   ├── auth.css             # Auth modal
│   ├── friends.css          # Friends page
│   ├── xpbar.css            # XP bar
│   └── team.css             # Team page (v3 ready)
│
└── App.jsx                  # Router config, all routes
```

---

## Data Flow

### Dual-Mode Architecture

```
User Action
    │
    ▼
Hook (e.g. useHabitStore)
    │
    ├── isAuthenticated?
    │       │
    │       ├── YES → Supabase upsert/insert
    │       │         ├── Realtime subscription → live update
    │       │         └── Error → fallback localStorage silently
    │       │
    │       └── NO → localStorage read/write
    │                 key format: vl_{feature}_{identifier}
    │
    └── Update local React state → re-render
```

### localStorage Keys

```
vl_habit_data          # { [dateStr]: boolean } — daily tick
vl_habit_progress      # { [dateStr_habitId]: boolean } — per-habit tick
vl_custom_habits       # Habit[] — list of custom habits
vl_xp_store            # XPEntry[] — immutable log
vl_mood_log            # { [dateStr]: { emoji, label } }
vl_focus_sessions      # FocusSession[]
vl_notif_settings      # { enabled, time }
vl_migrated            # "true" after first login migration
```

### Supabase Tables

```
profiles           ← auth.users (auto-created by trigger)
streaks            ← updated by trigger on progress INSERT/UPDATE
progress           ← primary daily check source of truth
habits             ← custom user habits
focus_sessions     ← pomodoro session log
mood_logs          ← daily mood (UNIQUE user+date)
skip_reasons       ← daily skip (UNIQUE user+date)
xp_logs            ← immutable XP event log
teams              ← accountability pairs
reactions          ← emoji reactions between teammates
friendships        ← friend request graph
notification_settings ← 1:1 with profiles
partner_queue      ← auto-match waiting room
quiz_attempts      ← quiz history
daily_challenge_completions ← 1 per day
```

---

## Routes

| Path | Component | Auth |
|------|-----------|:----:|
| `/` | LandingPage | Public |
| `/tracker` | TrackerPage | Public |
| `/habits` | HabitsPage | Public |
| `/focus` | FocusPage | Public |
| `/dashboard` | DashboardPage | Public |
| `/team` | TeamPage | Soft wall (needs login) |
| `/quiz` | QuizPage | Public |
| `/leaderboard` | LeaderboardPage | Public |
| `/friends` | FriendsPage | Required |

---

## Key Design Decisions

### 1. Dual-Mode (Guest → Authenticated)
- Ưu tiên UX: không cần đăng nhập để dùng cơ bản
- Migration tự động: lần đầu login → push localStorage → Supabase

### 2. localStorage key format
- Prefix `vl_` cho tất cả keys → tránh conflict với thư viện khác
- Dễ xóa sạch: `Object.keys(localStorage).filter(k => k.startsWith('vl_'))`

### 3. Streak computed on client vs DB trigger
- Client: từ `vl_habit_data` (guest)
- DB: trigger `refresh_streak()` sau mỗi INSERT/UPDATE vào `progress`
- RLS cho phép teammate đọc progress (isTeammate check)

### 4. CSS architecture
- Không dùng Tailwind — vanilla CSS với CSS variables
- `global.css` → design tokens (`--bg-primary`, `--purple`, `--radius-md`, etc.)
- Mỗi domain có file CSS riêng để dễ maintain

### 5. XP là immutable log
- Không update/delete XP entries
- Compute `totalXp = SUM(log)` tại runtime
- Dedup bằng `hasMilestone(reason, meta)` trước khi `addXp`

---

## Environment Variables

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

Nếu thiếu → `supabase.js` fallback graceful, mọi thứ chạy với localStorage.
