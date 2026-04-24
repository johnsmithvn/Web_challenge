# Thử Thách Vượt Lười — v2.2.0

> **Kỷ Luật = Hệ Thống, Không Phải Ý Chí**

Ứng dụng habit tracking 21 ngày gamified — Journey system, Pomodoro focus timer, team accountability, XP/Level, quiz, leaderboard, và life journey visualization.

---

## 🚀 Quick Start (Local Dev)

```bash
# 1. Clone repo
git clone https://github.com/johnsmithvn/Web_challenge.git
cd Web_challenge

# 2. Cài dependencies
npm install

# 3. Cấu hình Supabase (tuỳ chọn — app vẫn chạy không có)
cp .env.local.example .env.local
# Điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào .env.local

# 4. Chạy dev server
npm run dev
# → http://localhost:5173
```

> **Không có Supabase?** App vẫn chạy ở chế độ Guest (in-memory state, reset khi refresh). Chỉ cần key để bật Auth + cloud sync.

---

## ☁️ Deploy (Vercel)

1. Push code lên GitHub
2. Vào [vercel.com](https://vercel.com) → **Add New Project** → Import repo
3. Vercel tự detect Vite — giữ nguyên build settings
4. Thêm **Environment Variables**:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhb...` |

5. Click **Deploy** → ~1 phút → live ✅

> File `vercel.json` đã được cấu hình sẵn cho SPA routing.

---

## 🗄 Database Setup (Supabase)

Chạy migration SQL theo thứ tự trong **Supabase SQL Editor**:

| # | File | Nội dung |
|---|------|----------|
| 1 | `data/migration_v1.2.0.sql` | habits, focus_sessions, mood_logs, skip_reasons |
| 2 | `data/migration_v1.4.0.sql` | Thêm action/status/cycle_count cho habits |
| 3 | `data/migration_v1.5.0.sql` | programs, program_habits, user_journeys, journey_habits, habit_logs + 5 templates |
| 4 | `data/migration_v1.6.2.sql` | xp_logs, friendships + Realtime + focus_sessions.journey_id |
| 5 | `data/migration_v1.9.0.sql` | Update handle_new_user trigger, seed program_habits |
| 6 | `data/migration_v2.1.0.sql` | user_tasks table + RLS + indexes |
| 7 | `data/supabase_team_v3.sql` | team_members, user_programs, team_check_logs, team_rules (chưa full deploy) |

---

## 📁 Cấu trúc

```
src/
  pages/
    LandingPage.jsx         ← Landing marketing (eager)
    TrackerPage.jsx         ← 4-tab habit tracker (eager)
    FocusPage.jsx           ← Pomodoro timer
    JourneyPage.jsx         ← Journey: 4 tabs (Đang chạy/Khám phá/Của Tôi/Lịch sử)
    JourneyDetailPage.jsx   ← Full dashboard per journey
    DashboardPage.jsx       ← Analytics + insights
    TeamPage.jsx            ← Team N-member accountability
    QuizPage.jsx            ← Quiz não bộ
    LeaderboardPage.jsx     ← Streak/XP ranking
    FriendsPage.jsx         ← Friend requests
    LifeJourneyPage.jsx     ← Life emotion timeline SVG
    HabitsPage.jsx          ← DEPRECATED: redirect → /tracker
  components/
    journey/                ← Journey sub-components
    team/                   ← Team sub-components
    AuthModal.jsx           ← Login/Register/Google
    TaskListSection.jsx     ← Personal tasks UI
    MonthCalendar.jsx       ← Monthly calendar
    HabitManager.jsx        ← Habit CRUD
    FocusTimer.jsx          ← Pomodoro SVG ring
    DailyChallenge.jsx      ← Daily challenge +20 XP
    ...
  hooks/
    useHabitStore.js        ← Supabase-first (guest=in-memory)
    useCustomHabits.js      ← Custom habit CRUD
    useHabitLogs.js         ← Per-habit daily logs
    useJourney.js           ← Journey lifecycle
    useFocusTimer.js        ← Pomodoro logic
    useXpStore.js           ← XP + Level system
    useUserTasks.js         ← Personal task CRUD
    useLifeJourney.js       ← Life milestones CRUD
    useTeam.js / useTeamCheck.js / useTeamRules.js
    useNotifications.js     ← Browser notifications
  contexts/
    AuthContext.jsx         ← Supabase Auth
    JourneyContext.jsx      ← Active journey state
    ThemeContext.jsx         ← Dark/Light toggle
  data/                     ← Static JSON content
  styles/                   ← CSS per domain
  lib/supabase.js           ← Singleton client
docs/
  ARCHITECTURE.md           ← Module structure + data flow
  DATABASE.md               ← Full SQL schema + RLS
  FEATURES.md               ← All features documented
  PLAN.md                   ← Development phases
  TASKS.md                  ← TODO tracker
  TEAM_DESIGN.md            ← Team Mode v3 architecture
  RULES.md                  ← AI agent rules
```

---

## 🗺 Pages & Routes

| URL | Mô tả |
|-----|-------|
| `/` | Landing page — marketing sections |
| `/tracker` | Habit tracker 4 tabs (Hôm Nay/Lịch/Tuần/Quản Lý) |
| `/focus` | Pomodoro timer + habit linking |
| `/journey` | Journey system: program templates, history |
| `/journey/:id` | Full journey dashboard |
| `/team` | Team Mode — N members, accountability |
| `/dashboard` | Analytics: flower, donut, contribution graph |
| `/quiz` | Quiz não bộ — 10 MCQ |
| `/leaderboard` | Global streak/XP leaderboard |
| `/friends` | Friend requests (requires login) |
| `/life-journey` | Life emotion timeline SVG |

---

## ✨ Tính Năng

### 🏠 Core
- ✅ Custom habit tracking (CRUD, per-habit streak, categories)
- ✅ 21-day dot grid + plant growth visualization
- ✅ Monthly calendar with VN holidays
- ✅ Mood tracking + Skip reason analysis
- ✅ Personal tasks (to-do, notifications, calendar log)
- ✅ Dark/Light mode toggle

### 🗺 Journey System
- ✅ 5 system templates + custom journeys
- ✅ 4 tabs: Đang chạy / Khám Phá / Của Tôi / Lịch Sử
- ✅ Journey owns habits (fresh per cycle)
- ✅ Replace vs Append mode khi switch
- ✅ Journey detail dashboard with calendar + day modal

### 🎮 Gamification
- ✅ XP/Level system (6 levels, Supabase-first)
- ✅ Daily Challenge — 21 challenges, +20 XP
- ✅ Quiz — 10 MCQ, score-based XP
- ✅ Leaderboard (real data from Supabase)
- ✅ Pomodoro focus timer (SVG ring, habit linking, +15 XP)

### 🔐 Auth & Sync
- ✅ Email/Password + Google OAuth (Supabase)
- ✅ Supabase-first: all user data synced to cloud
- ✅ Guest mode: in-memory (reset on refresh)
- ✅ Auto migrate localStorage → Supabase on first login

### 🤝 Team Mode v3 (components built, chưa full deploy)
- ✅ N-member teams: Duo/Trio/Squad
- ✅ Week-2 lock: checkbox locked, needs teammate check
- ✅ Team Rules: propose → unanimous agree → active

### 💛 Life Journey
- ✅ Emotion timeline SVG (age × emotion ±5)
- ✅ Catmull-Rom smooth curve, bi-color
- ✅ CRUD milestones, emoji picker, dual view

### 👥 Social
- ✅ Friends: search, send/accept/decline requests
- ✅ Browser notifications: daily reminder

---

## 🛠 Tech Stack

| | |
|--|--|
| **Frontend** | React 19, Vite 8, React Router 7 |
| **Styling** | Vanilla CSS, Dark/Light mode, Glassmorphism |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime) |
| **Deploy** | Vercel (static SPA) |
| **State** | Custom hooks, Supabase-first, localStorage for UI flags only |

---

## 📦 Phiên Bản

| Version | Mô tả |
|---------|-------|
| **v2.2.0** | Life Journey visualization + Theme toggle |
| **v2.1.0** | Personal Tasks + Service Worker notifications |
| **v2.0.0** | Journey Owns Habits + MyJourneys + removeXp |
| **v1.9.x** | Page consolidation (TrackerPage absorbs HabitsPage) |
| **v1.8.x** | JourneyContext + journey_id tagging |
| **v1.7.0** | ErrorBoundary + PWA + Lazy loading |
| **v1.6.x** | Journey UI + Supabase-first migration |
| **v1.5.0** | Journey DB foundation (5 tables) |
| **v1.4.x** | Habit actions + Conquered habits + Daily quotes |
| **v1.3.x** | CompletionModal + Onboarding + Focus auto-tick |
| **v1.2.0** | Custom Habits + Focus Timer + Dashboard v2 |
| **v1.1.0** | XP/Level, Quiz, Leaderboard, Daily Challenge |
| **v1.0.0** | MVP — landing, tracker, dashboard |

---

## 🌿 Git Workflow

```bash
# Feature branch
git checkout -b feat/ten-feature

# Commit theo Conventional Commits
git commit -m "feat(team): thêm tính năng..."
git commit -m "fix(auth): sửa lỗi..."
git commit -m "docs: update README"

# Push và tạo PR
git push origin feat/ten-feature
```

---

*Built with ❤️ — Kỷ luật không phải ý chí, là hệ thống.*
