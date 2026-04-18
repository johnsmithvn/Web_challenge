# PLAN.md — Thử Thách Vượt Lười
**Updated:** 2026-04-18
**Current Version:** v1.3.1
**Rule:** Cập nhật khi milestone hoặc phase thay đổi.

---

## ✅ Phase 1 — Core MVP (v1.0.0)
*Hoàn thành: 2026-04-13*

- [x] Landing page (marketing, pricing, testimonials)
- [x] TrackerPage — daily tick, streak, badge
- [x] DashboardPage — stats overview
- [x] TeamPage — mock UI
- [x] Design system: dark mode, glassmorphism, CSS variables
- [x] Routing (BrowserRouter)

---

## ✅ Phase 2 — Gamification (v1.1.0)
*Hoàn thành: 2026-04-14*

- [x] XP & Level system (6 levels, localStorage)
- [x] Daily Challenge (+20 XP)
- [x] Quiz 10 câu MCQ (score-based XP)
- [x] Leaderboard (streak/XP, 3 tabs)
- [x] Notification reminder (browser API)
- [x] XpBar trên Navbar + TrackerPage

---

## ✅ Phase 3 — Cloud + Auth (v2.0.0)
*Hoàn thành: 2026-04-15*

- [x] Supabase schema (profiles, progress, streaks, xp_logs, teams, reactions, friendships)
- [x] Auth: Email + Google OAuth
- [x] Dual-mode habit store (localStorage ↔ Supabase)
- [x] localStorage → Supabase migration on first login
- [x] TeamPage: real DB create/join/leave, realtime
- [x] FriendsPage: search, add, accept/decline
- [x] RLS policies cho tất cả tables

---

## ✅ Phase 4 — Advanced Habit Tracking (v1.2.0)
*Hoàn thành: 2026-04-18*

- [x] Custom Habits CRUD (icon, màu, category, giờ target)
- [x] Per-habit daily tick (độc lập, không phụ thuộc nhau)
- [x] Monthly Calendar (VN holidays, click detail)
- [x] Pomodoro Focus Timer (SVG ring, phases, habit linking, session log)
- [x] Mood Tracker (5 levels, 1/ngày, dual-mode sync)
- [x] Skip Reasons (lý do bỏ habit, sau 8PM trigger)
- [x] TrackerPage redesign (streak ring, plant growth, 21-day dots)
- [x] DashboardPage redesign (flower journey, monthly donut, weekly table, contribution graph)
- [x] DB migration: thêm 4 bảng mới (habits, focus_sessions, mood_logs, skip_reasons)
- [x] Docs: FEATURES.md, TASKS.md, ARCHITECTURE.md, PLAN.md cập nhật

---

## ✅ Phase 4.5 — UX Polish + Data Architecture (v1.2.1 → v1.3.1)
*Hoàn thành: 2026-04-18*

- [x] Data modularization: tách all static content → `src/data/*.json` (Rule 14)
- [x] TrackerSection → read-only status dots (xoá manual toggle)
- [x] CompletionModal khi streak = 21 (confetti, XP summary, "Bắt đầu Vòng 2")
- [x] OnboardingModal 3 bước lần đầu truy cập
- [x] Focus session → auto-tick habit + +15 XP/session
- [x] Friend list → streak + XP thật từ Supabase
- [x] Leaderboard → query `xp_logs` thật thay công thức hardcode
- [x] Dashboard → Skip Reason Insight widget (14 ngày, bar chart, smart tip)
- [x] Fix `week_num` hardcode → tính từ program start

---

## 🚧 Phase 5 — Team Accountability v3 (v3.0.0)
*Đang thiết kế — chưa implement*

**Core Value Insight (2026-04-18):**
> “Teammate Check là “vũ khí” chính của app. Khi người dùng hiểu rằng “quyền lực” nằm trong tay đồng đội, họ mới thấy app có giá trị.”

**Game design quyết định:**
| Tuần | Self-check | Teammate check | Logic |
|------|:---:|:---:|---------|
| Tuần 1 | ✅ Cho phép | — | Tạo thói quen, low-friction |
| Tuần 2 | ❌ Vô hiệu hoá | ✅ Bắt buộc | Accountability có răng |
| Tuần 3 | ❌ Vô hiệu hoá | ✅ Bắt buộc | Kỷ luật đầy đủ |

**Core Features:**
- [ ] N-member teams (không giới hạn, do creator quyết định)
- [ ] Week-based progression per user (user_programs)
- [ ] **Tuần 2+:** Tắt nút tự tick — chỉ khi đồng đội nhấn “Xác Nhận” mới xanh
- [ ] Teammate check panel: Done ✓ / Fail ✗ + lý do
- [ ] Join sync modal: Reset tuần về 1 vs tiếp tục tuần hiện tại
- [ ] Team rules: Propose → All members agree → Active
- [ ] Team penalty/reward system: custom rules do team set
- [ ] Realtime check notifications

**DB cần:** `team_members`, `user_programs`, `team_check_logs`, `team_rules`, `team_rule_agreements`

**Schema:** Đã thiết kế trong `data/supabase_team_v3.sql`

---

## 📋 Phase 6 — Analytics & Intelligence (v2.1.0)
*Backlog*

- [ ] Mood pattern chart (7 ngày, 30 ngày)
- [ ] Skip reason analysis (thường bỏ ngày nào nhất, lý do gì)
- [ ] Weekly review digest (email hoặc in-app summary)
- [ ] Focus session breakdown per habit (charts)
- [ ] AI insight từ pattern data

---

## 📋 Phase 7 — Production Hardening (v2.2.0)
*Backlog*

- [ ] Per-habit progress sync lên Supabase (`vl_habit_progress` hiện chỉ localStorage)
- [ ] Lazy loading routes (giảm bundle size)
- [ ] PWA manifest + offline support
- [ ] SEO meta tags, sitemap
- [ ] Error boundary components
- [ ] Loading skeleton states
- [ ] Supabase Edge Functions (streak recompute cron)
- [ ] Rate limiting + abuse prevention

---

## Semantic Version Map

| Version | Milestone |
|---------|-----------|
| v1.0.0 | Core MVP |
| v1.1.0 | Gamification |
| v1.1.1 | Bug fixes (checkbox, UI) |
| v1.2.0 | Advanced Habit + Focus + Dashboard redesign |
| v1.2.1 | Data modularization (JSON-first, Rule 14) |
| v1.2.2 | TrackerSection read-only status dots |
| v1.3.0 | Completion Modal + Onboarding + Focus auto-tick + Friend streaks |
| v1.3.1 | Focus XP + Skip insight analytics + week_num fix |
| v2.0.0 | Cloud Auth + Supabase sync |
| v3.0.0 | Team Accountability N-member (Teammate check Tuần 2) |
