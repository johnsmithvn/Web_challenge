# ARCHITECTURE.md — Thử Thách Vượt Lười
**Version:** v2.2.1
**Updated:** 2026-04-24
**Rule:** Cập nhật file này mỗi khi thêm page, hook, hoặc thay đổi data flow.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite 8 |
| Routing | React Router v6 |
| Styling | Vanilla CSS (CSS variables, glassmorphism) |
| Database | Supabase (PostgreSQL + Realtime + Auth) |
| Local fallback | localStorage (UI state only) |
| Build | Vite (lazy-loaded chunks per page) |
| Hosting | Vercel (`vercel.json` SPA routing) |

---

## Cấu Trúc Thư Mục

```
src/
├── components/              # Reusable UI components
│   ├── journey/             # Journey system sub-components
│   │   ├── ActiveJourneyPanel.jsx   # Progress ring, habit chips, completion UI, renew/extend/quit
│   │   ├── ProgramBrowser.jsx       # Template grid, category filter, start flow, SwitchModeModal
│   │   ├── JourneyHistory.jsx       # Past journeys list + status badges, click → /journey/:id
│   │   ├── MyJourneys.jsx           # NEW v2.0.0 — "Của Tôi" tab, past journeys with "Bắt đầu lại"
│   │   └── CustomJourneyModal.jsx   # Free-form journey creation modal
│   ├── team/                # Team-specific sub-components
│   │   ├── TeamMemberCard.jsx       # Per-member card: week badge, mini heatmap
│   │   ├── TeammateCheckPanel.jsx   # Done/Fail modal with reason
│   │   ├── JoinSyncModal.jsx        # Week sync: restart vs continue
│   │   └── TeamRules.jsx            # Rules section: propose, agree/reject
│   ├── AuthModal.jsx          # Login/Register/Google tabs
│   ├── CompletionModal.jsx    # Certificate modal: Gia Hạn / Thử Thách Mới / Chọn Lộ Trình Mới
│   ├── OnboardingModal.jsx    # 3-step guide lần đầu truy cập
│   ├── DailyChallenge.jsx     # Daily mini-challenge, +20 XP, pick-by-streak-day
│   ├── ErrorBoundary.jsx      # v1.7.0 — Class component, friendly fallback UI
│   ├── FocusTimer.jsx         # SVG countdown + habit dropdown
│   ├── HabitManager.jsx       # CRUD custom habits UI
│   ├── LoginNudgeModal.jsx    # v1.4.0 — Bottom sheet nhắc guest đăng ký
│   ├── MonthCalendar.jsx      # Monthly view, VN holidays, completed tasks display
│   ├── NotificationSettings.jsx
│   ├── PageSkeleton.jsx       # v1.7.0 — Shimmer skeleton loading
│   ├── TaskListSection.jsx    # v2.1.0 — Personal tasks UI (📌 Nhiệm Vụ)
│   ├── TrackerSection.jsx     # Read-only 3-week status dots
│   ├── XpBar.jsx              # XP + level indicator
│   └── ...
│
├── contexts/
│   ├── AuthContext.jsx        # Auth state, signIn, signUp, Google, profile
│   ├── JourneyContext.jsx     # v1.8.0 — Single source of truth cho activeJourney
│   └── ThemeContext.jsx       # v2.2.0 — Dark/Light theme toggle (localStorage vl_theme)
│
├── hooks/
│   ├── useHabitStore.js       # Daily tick, streak, Supabase-first (guest=in-memory)
│   ├── useCustomHabits.js     # Custom habit CRUD, Supabase-first, journey_id tagging
│   ├── useHabitLogs.js        # v1.5.0 — Per-habit daily logs (replaces vl_habit_progress)
│   ├── useJourney.js          # v1.5.0 — Journey lifecycle (start/complete/renew/extend)
│   ├── useFocusTimer.js       # Pomodoro phases, session log, DB sync, journey_id tagging
│   ├── useMoodSkip.js         # useMoodLog + useSkipReasons hooks, Supabase-first
│   ├── useXpStore.js          # XP log, level computation, addXp/removeXp, Supabase-first
│   ├── useTeam.js             # Team fetch, create/join/leave, realtime
│   ├── useTeamCheck.js        # Week-2 check logic, submit team_check_logs
│   ├── useTeamRules.js        # CRUD rules, propose + unanimous approval
│   ├── useUserTasks.js        # v2.1.0 — Personal task CRUD, notification sync
│   ├── useLifeJourney.js      # v2.2.0 — Life milestones CRUD (localStorage-only)
│   ├── useNotifications.js    # Browser notification API
│   └── ...
│
├── lib/
│   └── supabase.js            # Singleton Supabase client, safe fallback
│
├── pages/
│   ├── LandingPage.jsx        # / — Marketing page (eager loaded)
│   ├── TrackerPage.jsx        # /tracker — Main tracker. 4 tabs: Hôm Nay/Lịch/Tuần/Quản Lý
│   │                           # /habits redirects here (inline Navigate in App.jsx)
│   ├── FocusPage.jsx          # /focus — Pomodoro timer (lazy)
│   ├── JourneyPage.jsx        # /journey — 4 tabs: Đang chạy / Khám Phá / Của Tôi / Lịch Sử (lazy)
│   ├── JourneyDetailPage.jsx  # /journey/:id — Full dashboard per journey (lazy)
│   ├── DashboardPage.jsx      # /dashboard — Flower, donut, weekly table, contribution (lazy)
│   ├── TeamPage.jsx           # /team — N-member accountability (lazy)
│   ├── QuizPage.jsx           # /quiz — 10-question MCQ (lazy)
│   ├── LeaderboardPage.jsx    # /leaderboard — Streak/XP ranking (lazy)
│   ├── FriendsPage.jsx        # /friends — Kết bạn (lazy)
│   ├── LifeJourneyPage.jsx    # /life-journey — v2.2.0 — Emotion timeline SVG (lazy)
│   └── LifeJourneyPage.css    # Co-located CSS (not in styles/)
│
├── data/                      # Static JSON content (Rule 14)
│   ├── challenges.json        # 21 Daily Challenges
│   ├── quiz.json              # 10 Quiz questions
│   ├── habits.json            # defaultHabits, categories, icons, colors, skipReasons, moods
│   ├── testimonials.json      # Landing page reviews
│   ├── quotes.json            # v1.4.5 — 30 daily motivational quotes
│   └── programs.json          # v1.6.0 — 5 system program templates (offline fallback)
│
├── styles/
│   ├── global.css             # CSS variables, reset, typography
│   ├── navbar.css             # Navbar layout + mobile menu
│   ├── hero.css               # HeroSection styles
│   ├── sections.css           # ContentSections + RoadmapSection
│   ├── tracker.css            # TrackerPage v2 styles (merged habits)
│   ├── dashboard.css          # Dashboard v2 styles
│   ├── focus.css              # Focus timer + custom dropdown
│   ├── calendar.css           # Monthly calendar
│   ├── daily.css              # DailyChallenge styles
│   ├── journey.css            # Journey page, progress ring, program cards, modals
│   ├── team.css               # Team page (N-member grid, check panel, rules)
│   ├── auth.css               # Auth modal
│   ├── friends.css            # Friends page
│   ├── xpbar.css              # XP bar
│   ├── quiz.css               # Quiz page
│   ├── leaderboard.css        # Leaderboard page
│   ├── completion.css         # CompletionModal styles
│   ├── onboarding.css         # OnboardingModal styles
│   └── testimonials.css       # Testimonials section
│
└── App.jsx                    # AppShell wrapper — ThemeProvider + Onboarding gate + JourneyProvider + Router + LazyLoad
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
    │       ├── YES → Supabase upsert/insert (PRIMARY)
    │       │         ├── Realtime subscription → live update
    │       │         └── Error → optimistic rollback
    │       │
    │       └── NO → In-memory state (reset on refresh — acceptable for guest)
    │
    └── Update local React state → re-render
```

> **v1.6.2+:** Toàn bộ **user data** dùng Supabase làm primary.
> localStorage chỉ còn **UI state flags** và **settings** (không chứa user data).

### localStorage Keys

```
vl_xp_store            # DEPRECATED — migrated to Supabase `xp_logs`, then wiped
vl_custom_habits       # DEPRECATED — migrated to Supabase `habits`, then wiped
vl_habit_data          # REMOVED v1.6.1 — migrated sang Supabase `progress`, wiped
vl_habit_progress      # REMOVED v1.5.0 — migrated sang Supabase `habit_logs`, wiped
vl_focus_sessions      # REMOVED v1.6.2 — migrated sang Supabase `focus_sessions`, wiped
vl_mood_log            # REMOVED v1.6.2 — Supabase-first, in-memory cho guest
vl_skip_{date}         # REMOVED v1.6.2 — Supabase-first, in-memory cho guest

--- STILL IN USE (UI state only) ---
vl_migrated_v2         # userId — đã migrate vl_habit_data lên Supabase (v1.6.1)
vl_onboarded           # "1" — onboarding completed, UI state
vl_notif_settings      # { enabled, time } — UI preference, stays local
vl_focus_settings      # UI preference cho focus timer durations
vl_completion_shown_N  # "1" — completion modal shown for round N
vl_habit_logs_migrated # "1" — vl_habit_progress migrated to Supabase
vl_login_nudge_shown   # "1" — login nudge shown once
vl_chunk_retry         # "1" — stale chunk retry flag (cleared on success)
vl_journey_redirected  # sessionStorage — redirect-once flag per session
vl_theme               # "dark" | "light" — theme preference (v2.2.0)
vl_life_journey_events # JSON array — life milestones (v2.2.0, localStorage-only)
vl_journey_title       # string — custom title for life journey chart (v2.2.0)
```

> **Rule:** Chỉ lưu **UI state flags** và **offline guest fallback** trong localStorage.
> Mọi **user data** có thể được sync đều phải dùng Supabase làm primary.

### Supabase Tables

```
profiles              ← auth.users (auto-created by trigger)
streaks               ← updated by trigger on progress INSERT/UPDATE
progress              ← primary daily check source of truth
habits                ← custom user habits (+journey_id, +action, +status, +cycle_count, +conquered_at)
focus_sessions        ← pomodoro session log (+journey_id v1.8.0)
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
user_tasks                 ← v2.1.0: personal to-do items (title, desc, due date/time)

-- v1.5.0 (run data/migration_v1.5.0.sql)
programs              ← program/lộ trình library (system templates + user)
program_habits        ← habit templates belonging to a program
user_journeys         ← each user's run of a program (with start/end dates)
journey_habits        ← snapshot of habits at journey start (history preservation)
habit_logs            ← per-habit daily completion (replaces vl_habit_progress)

-- Team v3 (run data/supabase_team_v3.sql)
team_members          ← junction table (N per team)
user_programs         ← per-user 21-day journey
team_check_logs       ← accountability checks
team_rules            ← reward/punishment rules
team_rule_agreements  ← per-member approval flow
```

---

## Routes

| Path | Component | Auth | Load |
|------|-----------|:----:|:----:|
| `/` | LandingPage | Public | Eager |
| `/tracker` | TrackerPage | Public | Eager |
| `/habits` | Inline redirect → `/tracker` | — | — |
| `/focus` | FocusPage | Public | Lazy |
| `/journey` | JourneyPage | Public (soft wall for save) | Lazy |
| `/journey/:id` | JourneyDetailPage | Public | Lazy |
| `/dashboard` | DashboardPage | Public | Lazy |
| `/team` | TeamPage | Soft wall (needs login) | Lazy |
| `/quiz` | QuizPage | Public | Lazy |
| `/leaderboard` | LeaderboardPage | Public | Lazy |
| `/friends` | FriendsPage | Required | Lazy |
| `/life-journey` | LifeJourneyPage | Public | Lazy |

---

## App Architecture (v1.7.0+)

```
ThemeProvider
  └── AuthProvider
        └── BrowserRouter
              └── JourneyProvider
                    └── AppShell
                          ├── PageMeta (SEO title/desc per route)
                          ├── OnboardingModal (once, gated by vl_onboarded)
                          ├── Redirect to /journey?firstTime=true (once per session if no journey)
                          ├── Navbar (uses useTheme for dark/light toggle)
                          └── ErrorBoundary
                                └── Suspense (PageSkeleton fallback)
                                      └── Routes (10 lazy + 2 eager)
```

---

## Key Design Decisions

### 1. Dual-Mode (Guest → Authenticated)
- Ưu tiên UX: không cần đăng nhập để dùng cơ bản
- v1.6.2+: Supabase là primary. Guest dùng in-memory (reset khi refresh)
- Migration tự động: lần đầu login → push localStorage → Supabase → wipe local

### 2. localStorage key format
- Prefix `vl_` cho tất cả keys → tránh conflict với thư viện khác
- Dễ xóa sạch: `Object.keys(localStorage).filter(k => k.startsWith('vl_'))`

### 3. Streak computed on client vs DB trigger
- Client: in-memory (guest)
- DB: trigger `refresh_streak()` sau mỗi INSERT/UPDATE vào `progress`
- RLS cho phép teammate đọc progress (isTeammate check)

### 4. CSS architecture
- Không dùng Tailwind — vanilla CSS với CSS variables
- `global.css` → design tokens (`--bg-primary`, `--purple`, `--radius-md`, etc.)
- Mỗi domain có file CSS riêng để dễ maintain

### 5. XP là immutable log
- Không update/delete XP entries (except removeXp v2.0.0 for un-tick)
- Compute `totalXp = SUM(log)` tại runtime
- Dedup bằng `hasMilestone(reason, meta)` trước khi `addXp`
- `focus_session` XP (+15) write trực tiếp qua Supabase (deduped)

### 6. Journey-as-Core-Context (v1.8.0+)
- `JourneyContext` wraps entire app, fetches activeJourney once on login
- All habit ticks → `habit_logs.journey_id`
- All focus sessions → `focus_sessions.journey_id`
- All new habits → `habits.journey_id`

### 7. Journey Owns Habits (v2.0.0)
- Mỗi journey tạo fresh habit rows riêng. Không reuse habits giữa journeys
- Complete/quit → close all active habits (`active=false`)
- Renew → snapshot old habits → clone as fresh rows for new cycle
- Replace mode: archive old journey + close habits → create fresh
- Append mode: archive old journey, keep old habits + add new

### 8. Page Consolidation (v1.9.0)
- HabitsPage deprecated → redirect `/tracker`
- TrackerPage absorbed tất cả features: per-habit tick, mood, skip, calendar, weekly grid, habit manager
- 4 tabs: ⚡ Hôm Nay | 📅 Lịch | 📊 Tuần | ⚙️ Quản Lý

### 9. Onboarding gate (v1.3.0)
- `AppShell` kiểm tra `vl_onboarded` trước khi render app
- Nếu chưa có → show `OnboardingModal` (3 bước)
- Không block routing — user có thể bỏ qua

### 10. Lazy Loading + Error Boundary (v1.7.0)
- 8 pages lazy-loaded via `React.lazy` + `Suspense`
- `ErrorBoundary` wraps routes → friendly fallback thay màn trắng
- `lazyRetry()` wrapper auto-reload on stale chunk after Vercel redeploy

---

## Environment Variables

```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

Nếu thiếu → `supabase.js` fallback graceful, mọi thứ chạy với in-memory state.
