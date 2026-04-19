# ARCHITECTURE.md — Thử Thách Vượt Lười
**Version:** v1.6.0
**Updated:** 2026-04-19
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
│   ├── journey/             # Journey system sub-components (NEW v1.6.0)
│   │   ├── ActiveJourneyPanel.jsx   # Progress ring, habit chips, renew/extend/quit
│   │   ├── ProgramBrowser.jsx       # Template grid, category filter, start flow
│   │   ├── JourneyHistory.jsx       # Past journeys list + status badges
│   │   └── CustomJourneyModal.jsx   # Free-form journey creation modal
│   ├── team/                # Team-specific sub-components
│   │   ├── TeamMemberCard.jsx     (TODO v3)
│   │   ├── TeammateCheckPanel.jsx (TODO v3)
│   │   ├── JoinSyncModal.jsx      (TODO v3)
│   │   └── TeamRules.jsx          (TODO v3)
│   ├── AuthModal.jsx          # Login/Register/Google tabs
│   ├── CompletionModal.jsx    # v1.3.0 — Popup ăn mừng streak=21. v1.6.0 — thêm "Chọn Lộ Trình Mới"
│   ├── OnboardingModal.jsx    # NEW v1.3.0 — 3-step guide lần đầu truy cập
│   ├── DailyChallenge.jsx     # Daily mini-challenge, +20 XP
│   ├── FocusTimer.jsx         # SVG countdown + habit dropdown
│   ├── HabitManager.jsx       # CRUD custom habits UI
│   ├── MonthCalendar.jsx      # Monthly view, VN holidays
│   ├── NotificationSettings.jsx
│   ├── TrackerSection.jsx     # Read-only 3-week status dots (v1.2.2+)
│   ├── XpBar.jsx              # XP + level indicator
│   └── ...
│
├── contexts/
│   └── AuthContext.jsx      # Auth state, signIn, signUp, Google, profile
│
├── hooks/
│   ├── useHabitStore.js     # Daily tick, streak, dual-mode (LS/Supabase)
│   ├── useCustomHabits.js   # Custom habit CRUD, dual-mode
│   ├── useHabitLogs.js      # NEW v1.5.0 — Per-habit daily logs (replaces vl_habit_progress)
│   ├── useJourney.js        # NEW v1.5.0 — Journey lifecycle (start/complete/renew/extend)
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
│   ├── TrackerPage.jsx      # /tracker — Tick daily, streak ring, 21-day dots (v1.6.0: journeyStart prop)
│   ├── HabitsPage.jsx       # /habits — Per-habit tick, calendar, manage (v1.6.0: journey banner)
│   ├── FocusPage.jsx        # /focus — Pomodoro timer
│   ├── JourneyPage.jsx      # /journey — NEW v1.6.0 — 3 tabs: Đang chạy / Khám Phá / Lịch Sử
│   ├── DashboardPage.jsx    # /dashboard (Stats tab) — Flower, donut, weekly table
│   ├── TeamPage.jsx         # /team — Accountability partner
│   ├── QuizPage.jsx         # /quiz — 10-question MCQ
│   ├── LeaderboardPage.jsx  # /leaderboard — Streak/XP ranking
│   └── FriendsPage.jsx      # /friends — Kết bạn
│
├── data/                    # Static JSON content (Rule 14)
│   ├── challenges.json      # 21 Daily Challenges
│   ├── quiz.json            # 10 Quiz questions
│   ├── habits.json          # defaultHabits, categories, icons, colors, skipReasons, moods
│   ├── testimonials.json    # Landing page reviews
│   ├── quotes.json          # v1.4.5 — 30 daily motivational quotes
│   └── programs.json        # NEW v1.6.0 — 5 system program templates (offline fallback)
│
├── styles/
│   ├── global.css           # CSS variables, reset, typography
│   ├── components.css       # Shared component classes
│   ├── tracker.css          # Tracker + Team styles (page wrapper pattern)
│   ├── dashboard.css        # Dashboard v2 styles
│   ├── focus.css            # Focus timer + custom dropdown
│   ├── calendar.css         # Monthly calendar
│   ├── auth.css             # Auth modal
│   ├── friends.css          # Friends page
│   ├── xpbar.css            # XP bar
│   ├── journey.css          # NEW v1.6.0 — Journey page, progress ring, program cards, modals
│   ├── completion.css       # v1.3.0 — CompletionModal styles
│   ├── onboarding.css       # v1.3.0 — OnboardingModal styles
│   └── team.css             # Team page (v3 ready)
│
└── App.jsx                  # AppShell wrapper — Onboarding gate + Router
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
vl_habit_progress      # { [dateStr_habitId]: boolean } — DEPRECATED v1.5.0
                       # → migrated to Supabase habit_logs on first auth login
vl_custom_habits       # Habit[] — list of custom habits
vl_xp_store            # XPEntry[] — immutable log
vl_mood_log            # { [dateStr]: { emoji, label } }
vl_skip_{date}         # SkipEntry — per-day skip reason
vl_focus_sessions      # FocusSession[]
vl_notif_settings      # { enabled, time }
vl_migrated            # "true" after first login migration
vl_onboarded           # "1" — onboarding completed
vl_program_round       # "1"|"2"|... — which 21-day round
vl_completion_shown_N  # "1" — completion modal shown for round N
vl_active_journey      # NEW v1.5.0 — snapshot of active user_journey (offline fallback)
vl_habit_logs_migrated # NEW v1.5.0 — "1" after vl_habit_progress migrated to Supabase
```

### Supabase Tables

```
profiles              ← auth.users (auto-created by trigger)
streaks               ← updated by trigger on progress INSERT/UPDATE
progress              ← primary daily check source of truth
habits                ← custom user habits (+journey_id col v1.5.0)
focus_sessions        ← pomodoro session log
mood_logs             ← daily mood (UNIQUE user+date)
skip_reasons          ← daily skip (UNIQUE user+date)
xp_logs               ← immutable XP event log
teams                 ← accountability pairs
reactions             ← emoji reactions between teammates
friendships           ← friend request graph
notification_settings ← 1:1 with profiles
partner_queue         ← auto-match waiting room
quiz_attempts         ← quiz history
daily_challenge_completions ← 1 per day

-- NEW v1.5.0 (run data/migration_v1.5.0.sql)
programs              ← program/lộ trình library (system templates + user)
program_habits        ← habit templates belonging to a program
user_journeys         ← each user's run of a program (with start/end dates)
journey_habits        ← snapshot of habits at journey start (history preservation)
habit_logs            ← per-habit daily completion (replaces vl_habit_progress)
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
- `focus_session` XP (+15) được write trực tiếp vào `vl_xp_store` trong `useFocusTimer.js` để tránh circular import với `useXpStore.js`

### 6. week_num computation (v1.3.1)
- Trước: hardcode `week_num: 1` khi sync sang Supabase
- Sau: tính từ ngày đầu tiên trong `vl_habit_data`, `diffDays/7 + 1`, capped tại 3
- Dùng `vl_program_round` để track hành trình vòng 2, 3...

### 7. Onboarding gate (v1.3.0)
- `AppShell` kiểm tra `vl_onboarded` trước khi render app
- Nếu chưa có → show `OnboardingModal` (3 bước)
- Không block routing — user có thể bỏ qua

### 8. TrackerSection — read-only (v1.2.2)
- Các ô ngày trong TrackerSection không còn là checkbox tương tác
- Status dots tự động từ `vl_habit_progress` (auto-sync khi all habits done)
- Single source of truth: `useHabitStore` ← aggregated từ `HabitsPage`

---

## Environment Variables

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

Nếu thiếu → `supabase.js` fallback graceful, mọi thứ chạy với localStorage.
