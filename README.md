# Life Hub — Personal Life OS v3.1.0

> **Kỷ Luật = Hệ Thống, Không Phải Ý Chí**

Ứng dụng quản lý cuộc sống cá nhân all-in-one: habit tracking 21 ngày, quản lý tài chính, pomodoro focus timer, knowledge collector, life log heatmap, journey system, XP/Level, quiz, leaderboard, và life emotion timeline.

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

Chạy migration SQL **theo thứ tự** trong **Supabase SQL Editor**:

| # | File | Nội dung |
|---|------|----------|
| 1 | `data/migration_v1.2.0.sql` | habits, focus_sessions, mood_logs, skip_reasons, profiles, streaks, progress |
| 2 | `data/migration_v1.4.0.sql` | Thêm action/status/cycle_count/conquered_at cho habits |
| 3 | `data/migration_v1.5.0.sql` | programs, program_habits, user_journeys, journey_habits, habit_logs + 5 templates |
| 4 | `data/migration_v1.6.2.sql` | xp_logs, friendships, Realtime, focus_sessions.journey_id |
| 5 | `data/migration_v1.9.0.sql` | Update handle_new_user trigger, seed program_habits |
| 6 | `data/migration_v2.1.0.sql` | user_tasks table + RLS + indexes |
| 7 | `data/migration_v2.2.2_security.sql` | Security fixes: RLS, XP CHECK constraint, trigger merge |
| 8 | `data/migration_v3.0.0.sql` | collections, expenses, subscriptions, activity_logs + RLS |

> **Team Mode tables** (chưa full deploy): `data/supabase_team_v3.sql`

---

## 📁 Cấu trúc

```
src/
  pages/
    LandingPage.jsx         ← Landing marketing (eager)
    TrackerPage.jsx         ← 4-tab habit tracker (eager)
    InboxPage.jsx           ← Quick capture inbox
    CollectPage.jsx         ← Tabbed knowledge collector
    FinancePage.jsx         ← Chi tiêu + Đăng ký
    LifeLogPage.jsx         ← Activity heatmap + daily timeline
    FocusPage.jsx           ← Pomodoro timer + habit linking
    JourneyPage.jsx         ← Journey: 4 tabs (Đang chạy/Khám phá/Của Tôi/Lịch sử)
    JourneyDetailPage.jsx   ← Full dashboard per journey
    DashboardPage.jsx       ← Unified dashboard: habits + finance + activity + XP
    QuizPage.jsx            ← Quiz não bộ
    LeaderboardPage.jsx     ← Streak/XP ranking
    LifeJourneyPage.jsx     ← Life emotion timeline SVG
  components/
    journey/                ← Journey sub-components (ActiveJourneyPanel, ProgramBrowser, MyJourneys...)
    ActivityHeatmap.jsx     ← GitHub-style yearly heatmap (53×7 grid)
    DailyTimeline.jsx       ← Vertical activity timeline per day
    SubAlert.jsx            ← Upcoming subscription renewals alert
    DailyReview.jsx         ← Today recap widget
    KnowledgeResurface.jsx  ← Spaced repetition widget
    TaskListSection.jsx     ← Personal tasks UI
    MonthCalendar.jsx       ← Monthly calendar + mood + tasks
    HabitManager.jsx        ← Habit CRUD
    QuickCapture.jsx        ← Global floating [+] button → inbox
    AuthModal.jsx           ← Login/Register/Google
    ...
  hooks/
    useHabitStore.js        ← Supabase-first (guest=in-memory)
    useHabitLogs.js         ← Per-habit daily logs (Supabase)
    useCustomHabits.js      ← Custom habit CRUD
    useJourney.js           ← Journey lifecycle
    useFocusTimer.js        ← Pomodoro logic + todayMinutes
    useXpStore.js           ← XP + Level system (Supabase)
    useUserTasks.js         ← Personal task CRUD
    useExpenses.js          ← Expense CRUD + getTotal + getByCategory
    useSubscriptions.js     ← Subscription CRUD + getMonthlyCost + getUpcoming
    useActivityLog.js       ← Append-only activity logger + heatmap
    useCollections.js       ← Inbox/Collect CRUD
    useLifeJourney.js       ← Life milestones (localStorage-only)
    useMoodSkip.js          ← Mood log + skip reasons (Supabase)
    useNotifications.js     ← Browser notification scheduling
  contexts/
    AuthContext.jsx         ← Supabase Auth (signIn, signUp, Google OAuth)
    JourneyContext.jsx      ← Active journey single source of truth
    ThemeContext.jsx        ← Dark/Light mode toggle
  data/
    challenges.json         ← 21 Daily Challenges
    quiz.json               ← 10 quiz questions
    habits.json             ← defaultHabits, categories, skipReasons, moods
    testimonials.json       ← Landing page reviews
    quotes.json             ← 30 motivational quotes
    programs.json           ← 5 system program templates
    expense-categories.json ← 8 expense categories
  styles/                   ← CSS per domain (global.css = design tokens)
  lib/supabase.js           ← Singleton Supabase client
docs/
  ARCHITECTURE.md           ← Module structure + data flow
  DATABASE.md               ← Full SQL schema + RLS
  FEATURES.md               ← All features documented
  PLAN.md                   ← Development phases
  TASKS.md                  ← TODO tracker
  RULES.md                  ← AI agent coding rules
```

---

## 🗺 Pages & Routes

| URL | Mô tả |
|-----|-------|
| `/` | Landing page — marketing sections |
| `/tracker` | Habit tracker 4 tabs (Hôm Nay / Lịch / Tuần / Quản Lý) |
| `/inbox` | Quick-capture inbox — ghi nhanh, phân loại sau |
| `/collect` | Knowledge collector — links, quotes, wishlist, learn, ideas |
| `/finance` | Chi tiêu cá nhân + quản lý đăng ký gói |
| `/life-log` | Life Log — heatmap cả năm + daily activity timeline |
| `/focus` | Pomodoro timer + habit linking + session log |
| `/journey` | Journey system: program templates, history |
| `/journey/:id` | Full journey dashboard per run |
| `/dashboard` | Unified stats: hôm nay + habits + finance + activity |
| `/quiz` | Quiz não bộ — 10 MCQ |
| `/leaderboard` | Global streak/XP leaderboard |
| `/life-journey` | Life emotion timeline SVG |
| `/habits` | Redirect → `/tracker` |
| `/team` | Redirect → `/tracker` (Team module archived) |
| `/friends` | Redirect → `/tracker` (Friends module archived) |

---

## ✨ Tính Năng

### 🏠 Core Modules (v3.x)
- ✅ **Habit Tracker:** Custom habits, per-habit streak, mood, skip reason, calendar
- ✅ **Inbox & Collect:** Quick capture → phân loại (links/quotes/wishlist/learn/ideas)
- ✅ **Finance:** Chi tiêu theo danh mục + đăng ký gói (monthly/yearly) + sắp hết hạn
- ✅ **Life Log:** GitHub-style heatmap (activity_logs) + daily timeline
- ✅ **Dashboard:** Unified stats — hôm nay + habits + finance + activity + XP

### 🗺 Journey System
- ✅ 5 system templates + custom journeys (14/21/30/60 ngày)
- ✅ 4 tabs: Đang chạy / Khám Phá / Của Tôi / Lịch Sử
- ✅ Journey owns habits (fresh per cycle)
- ✅ Replace vs Append mode khi switch template
- ✅ Journey detail dashboard + calendar + day modal

### 🎮 Gamification
- ✅ XP/Level system (6 levels: 🌱→⚡→🔥→⚔️→👑→🏆)
- ✅ Daily Challenge — 21 challenges, +20 XP
- ✅ Quiz — 10 MCQ, score-based XP
- ✅ Leaderboard (real Supabase data)
- ✅ Pomodoro focus timer (SVG ring, habit linking, +15 XP/session)

### 🔐 Auth & Sync
- ✅ Email/Password + Google OAuth (Supabase)
- ✅ Supabase-first: tất cả user data sync cloud
- ✅ Guest mode: in-memory (reset on refresh)
- ✅ Auto migrate localStorage → Supabase on first login

### 💛 Life Journey
- ✅ Emotion timeline SVG (age × emotion ±5)
- ✅ Catmull-Rom smooth curve, bi-color
- ✅ CRUD milestones, emoji picker, compact/expanded view

---

## 🛠 Tech Stack

| | |
|--|--|
| **Frontend** | React 19, Vite 8, React Router 7 |
| **Styling** | Vanilla CSS, Dark/Light mode, Glassmorphism |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime) |
| **Deploy** | Vercel (static SPA) |
| **State** | Custom hooks, Supabase-first, localStorage for UI flags only |
| **PWA** | Web App Manifest, Service Worker (task notifications) |

---

## 📦 Phiên Bản

| Version | Mô tả |
|---------|-------|
| **v3.1.0** | Unified Dashboard: Today 4-KPI + Finance Pie + ActivityHeatmap |
| **v3.0.1** | KnowledgeResurface, Finance Charts, InboxPage Task→SubAlert |
| **v3.0.0** | Personal Life Hub: Inbox+Collect+Finance+LifeLog+ActivityLog |
| **v2.2.0** | Life Journey visualization + Theme toggle |
| **v2.1.0** | Personal Tasks + Service Worker notifications |
| **v2.0.0** | Journey Owns Habits + MyJourneys + removeXp |
| **v1.9.x** | Page consolidation (TrackerPage absorbs HabitsPage) |
| **v1.8.x** | JourneyContext + journey_id tagging |
| **v1.7.0** | ErrorBoundary + PWA + Lazy loading |
| **v1.6.x** | Journey UI + Supabase-first migration |
| **v1.5.0** | Journey DB foundation (5 tables) |
| **v1.4.x** | Habit actions + Conquered habits + Daily quotes |
| **v1.1.0** | XP/Level, Quiz, Leaderboard, Daily Challenge |
| **v1.0.0** | MVP — landing, tracker, dashboard |

---

## 🌿 Git Workflow

```bash
# Feature branch
git checkout -b feat/ten-feature

# Commit theo Conventional Commits
git commit -m "feat(dashboard): unified stats v3.1.0"
git commit -m "fix(finance): subscription date filter"
git commit -m "docs: update README v3.1.0"

# Push và tạo PR
git push origin feat/ten-feature
```

---

*Built with ❤️ — Kỷ luật không phải ý chí, là hệ thống.*
