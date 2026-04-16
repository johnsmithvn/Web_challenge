# Thử Thách Vượt Lười — v3.0.0

> **Kỷ Luật = Hệ Thống, Không Phải Ý Chí**

Ứng dụng theo dõi thói quen 21 ngày với hệ thống team accountability, XP/Level, quiz não bộ và leaderboard thời gian thực.

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

> **Không có Supabase?** App vẫn chạy đầy đủ ở chế độ Guest (localStorage). Chỉ cần key để bật Auth + Team Mode thực.

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

Chạy migration SQL trước khi test Team Mode:

1. Vào [supabase.com](https://supabase.com) → Project → **SQL Editor**
2. Paste nội dung file `docs/supabase_team_v3.sql`
3. Click **Run**

Tạo database schema cho: `team_members`, `user_programs`, `team_check_logs`, `team_rules`, `team_rule_agreements` + RLS policies + Realtime.

---

## 📁 Cấu trúc

```
src/
  components/
    team/               ← Team Mode v3 components
      TeamMemberCard.jsx
      TeammateCheckPanel.jsx
      JoinSyncModal.jsx
      TeamRules.jsx
    AuthModal.jsx       ← Login/Register/Google OAuth
    Navbar.jsx
    ...
  pages/
    LandingPage.jsx     ← Landing 7 sections
    TrackerPage.jsx     ← Habit tracker + XP
    TeamPage.jsx        ← Team Mode N members
    DashboardPage.jsx   ← Analytics + insights
    LeaderboardPage.jsx ← Real-time leaderboard
    QuizPage.jsx        ← Quiz não bộ
    FriendsPage.jsx     ← Friend requests
  hooks/
    useHabitStore.js    ← Dual mode: Supabase / localStorage
    useTeam.js          ← Team data + realtime
    useTeamCheck.js     ← Week-2 check logic
    useTeamRules.js     ← Rules approval flow
    useXpStore.js       ← XP + Level system
    useNotifications.js ← Browser notifications
  contexts/
    AuthContext.jsx     ← Supabase Auth (Email + Google)
  lib/
    supabase.js         ← Singleton client, safe fallback
  styles/               ← CSS design system (dark mode, glassmorphism)
docs/
  supabase_team_v3.sql  ← DB migration script
  TEAM_DESIGN.md        ← Team Mode v3 architecture
  TASKS.md              ← TODO tracker
```

---

## 🗺 Pages & Routes

| URL | Mô tả |
|-----|-------|
| `/` | Landing page — 7 sections |
| `/tracker` | Habit tracker + XP + daily challenge |
| `/team` | Team Mode — N members, week check |
| `/dashboard` | Analytics, heatmap, insights |
| `/leaderboard` | Global leaderboard real-time |
| `/quiz` | Quiz não bộ — 10 câu MCQ |
| `/friends` | Friends — search, request, accept |

---

## ✨ Tính Năng

### 🏠 Core
- ✅ Habit tracker 21 ngày (T2→CN × 3 tuần)
- ✅ Streak system + Badge tự động (Lấy Đà / Bứt Phá / Hoàn Thành)
- ✅ 28-day heatmap + bar chart analytics
- ✅ Dark mode glassmorphism design

### 🎮 Gamification
- ✅ XP/Level system (6 levels, localStorage)
- ✅ Daily Challenge — 21 challenges, date-seeded, +20 XP
- ✅ Quiz não bộ — 10 câu MCQ, XP reward
- ✅ Leaderboard với podium top 3

### 🔐 Auth & Sync
- ✅ Email/Password + Google OAuth (Supabase)
- ✅ Dual mode: Supabase khi login, localStorage khi guest
- ✅ Auto migrate localStorage → DB khi login lần đầu

### 🤝 Team Mode v3
- ✅ Nhóm N người: Duo (2) / Trio (3) / Squad (4)
- ✅ Tuần 2 lock: checkbox bị khóa, cần ≥1 teammate check
- ✅ TeammateCheckPanel: Done/Fail + bắt buộc nhập lý do khi fail
- ✅ JoinSyncModal: chọn restart / tiếp tục tuần khi join
- ✅ Team Rules: propose → all members agree → active
- ✅ Realtime subscription cho tất cả events

### 👥 Social
- ✅ Friends: search, gửi/nhận/chấp nhận/từ chối request
- ✅ Notifications: browser push, nhắc nhở daily

---

## 🛠 Tech Stack

| | |
|--|--|
| **Frontend** | React 19, Vite 8, React Router 7 |
| **Styling** | Vanilla CSS, Dark mode, Glassmorphism |
| **Backend** | Supabase (PostgreSQL + Auth + Realtime) |
| **Deploy** | Vercel (static SPA) |
| **State** | Zustand-free — custom hooks + localStorage |

---

## 📦 Phiên Bản

| Version | Mô tả |
|---------|-------|
| **v3.0.0** | Team Mode v3 — N members, week-lock, rules |
| **v2.0.0** | Supabase Auth, real team, friends, social |
| **v1.1.0** | XP/Level, Quiz, Leaderboard, Daily Challenge |
| **v1.0.0** | MVP — landing, tracker, dashboard, dark mode |

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
