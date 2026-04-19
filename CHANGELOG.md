# CHANGELOG

## v1.7.1 — 2026-04-19

### Fixed (Journey-Habit Integration)
- `src/hooks/useJourney.js` — `startJourney()` giờ INSERT habits từ template vào bảng `habits` của user (trước chỉ snapshot vào `journey_habits`). Habits được link `journey_id` ngay khi tạo
- `src/components/journey/ProgramBrowser.jsx` — `handleStart` giờ truyền `habits` array từ template khi gọi `onStart()`
- `src/pages/JourneyPage.jsx` — `handleStart` forward `habits` xuống `startJourney`. Thêm success toast "X habits mới được thêm" sau khi bắt đầu lộ trình
- `src/components/journey/ActiveJourneyPanel.jsx` — Progress ring/bar giờ tính từ **habit_logs thực tế**: đếm số ngày user tick đủ TẤT CẢ habits của lộ trình (thay vì đếm calendar days). Hiện "Hôm nay đã hoàn thành ✅" hoặc "Chưa tick đủ ⭕"

### Flow sau fix
```
1. User bấm "Bắt Đầu" template "Kỷ Luật Thể Chất"
2. → 3 habits (Tập luyện, Uống 2L, Ngủ trước 23h) tự xuất hiện trong /habits
3. → Mỗi ngày tick đủ 3 = +1 ngày hoàn thành
4. → Progress ring = (ngày tick đủ) / target_days
```

---

## v1.7.0 — 2026-04-19

### Added
- `src/components/ErrorBoundary.jsx` — Class component bắt mọi render error, hiện friendly fallback với "Thử lại" + "Về trang chủ" thay vì màn trắng
- `src/components/PageSkeleton.jsx` — Shimmer skeleton loading placeholder cho lazy-loaded pages
- `public/manifest.json` — PWA Web App Manifest: `display: standalone`, theme-color, icons, categories
- `index.html` — PWA meta tags: `theme-color`, `og:type/url/image/locale`, Twitter Card, `<link rel="manifest">`

### Changed
- `src/App.jsx` — Lazy load 8 pages (HabitsPage, FocusPage, TeamPage, DashboardPage, QuizPage, LeaderboardPage, FriendsPage, JourneyPage) với `React.lazy` + `Suspense`. LandingPage + TrackerPage vẫn eager (entry points). Mỗi page = 1 JS chunk riêng
- `src/App.jsx` — Wrap toàn bộ Routes trong `<ErrorBoundary>` 
- `src/App.jsx` — Thêm `<PageMeta />` component cập nhật `document.title` + `meta[description]` theo route
- `src/components/DailyChallenge.jsx` — Fix: thay hash-by-date bằng pick-by-streak-day. User mới (streak=0/1) sẽ thấy Challenge Ngày 1, không còn hiện "Final Boss"
- `src/pages/TrackerPage.jsx` — Pass `streak` prop vào `<DailyChallenge>`

### Bundle Impact (gzip)
| Before | After |
|--------|-------|
| 1 chunk ~350kB | Main 79kB + pages 0.6-9kB each (lazy loaded) |

---

## v1.6.2 — 2026-04-19

### Added
- `data/migration_v1.6.2.sql` — Tạo bảng `xp_logs` (UUID, amount, reason, meta JSONB, RLS) và `friendships` (requester/addressee FK, status enum, UNIQUE constraint, RLS). Enable Realtime cho `team_check_logs`, `team_members`, `progress`, `xp_logs`

### Fixed
- `GET /xp_logs 404` — bảng chưa tồn tại, cơ bản vì code sử dụng bảng từ trước khi migration chạy
- `GET /friendships 404` — tương tự, bảng chưa được tạo trong DB
- `cannot add postgres_changes callbacks for realtime:team-v3-*` — `team_check_logs` + `team_members` + `progress` chưa được add vào `supabase_realtime` publication

### Changed
- `src/hooks/useMoodSkip.js` — Xóa localStorage khỏi `useMoodLog` + `useSkipReasons`. Supabase-first, load từ DB khi login, in-memory cho guest, rollback khi lỗi
- `src/hooks/useCustomHabits.js` — Supabase-first. One-time migrate `vl_custom_habits` rồi wipe. Load DB on login, in-memory default habits cho guest, optimistic CRUD với rollback
- `src/hooks/useXpStore.js` — Thêm Supabase `xp_logs` làm primary. Migrate `vl_xp_store` 1 lần rồi wipe. async `addXp()` với rollback
- `src/hooks/useFocusTimer.js` — Xóa `vl_focus_sessions` + `vl_custom_habits` + `vl_habit_progress` direct reads. Sessions load từ Supabase on login. XP award qua Supabase trực tiếp (deduped). Habit auto-tick thông qua `CustomEvent focus:habit-tick` (loose coupling)
- `src/hooks/useFocusTimer.js` — Xóa `vl_focus_sessions` + `vl_custom_habits` + `vl_habit_progress` direct reads. Sessions load từ Supabase on login. XP award qua Supabase trực tiếp (deduped). Habit auto-tick thông qua `CustomEvent focus:habit-tick` (loose coupling)
- `src/hooks/useHabitLogs.js` — Xóa `saveLocal()` sau khi fetch từ DB. Wipe `vl_habit_progress` sau migration. Thêm event listener `focus:habit-tick` → auto-tick habit khi focus đủ duration target
- `src/pages/TrackerPage.jsx` — Import `useHabitLogs`, dùng `habitProg` thay direct LS read. Xóa `localStorage.removeItem(vl_habit_data / vl_habit_progress / vl_custom_habits)` khỏi `handleRenew` + `handleNewChallenge`
- `vl_focus_settings` giữ lại trong localStorage — đây là UI preference, không phải user data

### Technical Debt Resolved
- Toàn bộ **user data** bây giờ dùng Supabase làm primary. localStorage chỉ còn UI state flags & settings
- Xóa coupling trực tiếp giữa `useFocusTimer` → `vl_custom_habits` → `vl_habit_progress` (bộ 3 reads LS bị xóa)

---

## v1.6.1 — 2026-04-19

### Changed
- `src/hooks/useHabitStore.js` — Xóa localStorage làm primary storage cho habit data. Supabase `progress` table là sole source of truth khi đã login. Guest mode dùng in-memory state (reset khi refresh — acceptable). Migration vẫn chạy lần cuối để import `vl_habit_data` cũ rồi xoá sạch.
- Bump migration flag key từ `vl_migrated` sang `vl_migrated_v2` để force re-run migration cho user cũ
- Thêm rollback optimistic update khi Supabase toggle thất bại

### Removed
- `src/hooks/useHabitStore.js` — Xóa `localStorage.setItem(STORAGE_KEY, ...)` khỏi tất cả các đường ghi. `vl_habit_data` key không còn được write nữa.

### Technical Debt Resolved
- `vl_habit_data` (localStorage) → Supabase `progress`: data bền vững, cross-device, không còn mất streak khi đăng nhập trên thiết bị khác

---

## v1.6.0 — 2026-04-19

### Added
- `src/pages/JourneyPage.jsx` — Trang Lộ Trình 3 tab: Đang Chạy / Khám Phá / Lịch Sử
- `src/components/journey/ActiveJourneyPanel.jsx` — Progress ring SVG, habit snapshot chips, renew/extend/quit actions với confirm modal
- `src/components/journey/ProgramBrowser.jsx` — Grid 5 templates, category filter tabs, load từ Supabase (fallback local JSON)
- `src/components/journey/JourneyHistory.jsx` — List các journey đã kết thúc, status badges (completed/archived/extended)
- `src/components/journey/CustomJourneyModal.jsx` — Modal tự tạo lộ trình: tên, mô tả, duration picker (14/21/30/60/custom)
- `src/data/programs.json` — 5 system templates (Rule 14: dữ liệu tách khỏi component, dùng làm offline fallback)
- `src/styles/journey.css` — Full CSS: progress ring, program cards glassmorphism, tabs animated, status badges, modals
- Route `/journey` — thêm vào `App.jsx`
- `src/components/Navbar.jsx` — Nav link "🗺 Lộ Trình"

### Changed
- `src/pages/HabitsPage.jsx` — Journey banner: active = "Lộ Trình — Ngày X/Y", inactive = CTA "Chọn lộ trình →". Import `journey.css` + `react-router-dom Link`
- `src/pages/TrackerPage.jsx` — `WeekDots` nhận `journeyStart` prop từ `activeJourney.started_at` → dots anchor đúng ngày bắt đầu journey thật
- `src/components/CompletionModal.jsx` — Thêm Option C "🗺 Chọn Lộ Trình Mới" → navigate `/journey`. Dùng `useNavigate` thay inline handler
- `docs/PLAN.md` — Dashboard Journey Selector thêm vào Phase 6 backlog

### Fixed
- `JourneyPage.jsx` — Dùng `AuthModal` thay `alert()` khi guest click Bắt Đầu
- `JourneyPage.jsx` — Layout wrapper đồng nhất với các page khác: `min-height: 100vh; padding: 6rem 0 4rem; background: var(--bg-primary)` + `.container` div
- `src/styles/journey.css` — `.journey-page` chuẩn hóa theo `tracker-v2-page` pattern, thêm `.journey-page-inner` cho max-width 900px

---

## v1.5.0 — 2026-04-19

### Added
- `data/migration_v1.5.0.sql` — 5 bảng mới: `programs`, `program_habits`, `user_journeys`, `journey_habits`, `habit_logs` + RLS + indexes + 5 seed templates
- `src/hooks/useHabitLogs.js` — Thay thế `vl_habit_progress` localStorage bằng Supabase `habit_logs`. One-time silent migration. Giữ cùng format `habitProg` map để UI backward-compatible
- `src/hooks/useJourney.js` — Lifecycle management: start/complete/renew/extend journey. `ensureDefaultJourney()` auto-wrap habits cũ

### Changed
- `src/pages/HabitsPage.jsx` — Dùng `useHabitLogs` + `useJourney` thay vì đọc/ghi `vl_habit_progress` trực tiếp
- `docs/ARCHITECTURE.md` — Cập nhật hooks, Supabase tables, localStorage keys (v1.5.0)

### Technical Debt Resolved
- `vl_habit_progress` (localStorage) → `habit_logs` (Supabase): data bền vững, cross-device, có thể xem lại lịch sử

---

## v1.4.5 — 2026-04-19

### Added
- `src/data/quotes.json` — 30 câu trích dẫn động lực tiếng Việt (Rule 14: tách ra khỏi component)
- `src/pages/HabitsPage.jsx` — Daily motivational quote card xoay theo ngày trong năm
- `src/pages/HabitsPage.jsx` — Header stat cards: Habits count 🎯 + Ngày còn lại ⏳
- `src/pages/HabitsPage.jsx` — Tab "📊 Theo Tuần": PerHabitWeeklyGrid 14 ngày per-habit
- `src/pages/HabitsPage.jsx` — Per-habit streak 🔥N trong today list
- `src/pages/HabitsPage.jsx` — Counter badge X/N habits done hôm nay
- `src/pages/HabitsPage.jsx` — `computeHabitStreak()` + `dayPct()` helpers

### Changed
- `src/pages/HabitsPage.jsx` — Weekly grid: gradient cell (partial day = tint màu habit)
- `src/pages/HabitsPage.jsx` — Weekly grid: header row % completion toàn bộ habits per-day

---

## v1.4.0 — 2026-04-18

### Added
- `data/migration_v1.4.0.sql` — Thêm cột `action`, `status`, `cycle_count`, `conquered_at` vào bảng `habits`
- `src/data/habits.json` — Thêm field `action` cho 3 default habits
- `src/components/LoginNudgeModal.jsx` — Bottom sheet nhắc đăng ký cho guest sau ngày 1
- `src/styles/completion.css` — Certificate styles (seal, divider, dual CTA options)

### Changed
- `src/hooks/useCustomHabits.js` — Thêm `conquestHabit()`, `renewHabit()`, computed `activeHabits`, `conqueredHabits`
- `src/components/HabitManager.jsx` — Thêm field `action` (hành động cụ thể) vào form
- `src/components/CompletionModal.jsx` — Redesign thành Certificate modal: 2 CTA (Gia Hạn / Thử Thách Mới)
- `src/pages/HabitsPage.jsx` — Thêm Celebration banner + Conquered Habits section + LoginNudgeModal
- `src/pages/TrackerPage.jsx` — Wire `onRenew` / `onNewChallenge` cho CompletionModal

---


### Added
- `src/hooks/useTeam.js` — Team hook: fetch N members (batch), realtime subscription, create/join/leave team
- `src/hooks/useTeamCheck.js` — Check logic: week-2 lock enforcement, submit team_check_logs, validate per-user
- `src/hooks/useTeamRules.js` — Rules hook: propose rules, agree/reject flow, status computation (pending→active/rejected)
- `src/components/team/TeamMemberCard.jsx` — Per-member card: week badge, 7-day mini heatmap, lock state, check button
- `src/components/team/TeammateCheckPanel.jsx` — Done/Fail modal: required reason on fail, realtime feedback
- `src/components/team/JoinSyncModal.jsx` — Week sync modal: restart vs continue choice when joining mid-program
- `src/components/team/TeamRules.jsx` — Rules section: list rules, TeamRuleCard with agree/reject UI, propose form
- `docs/supabase_team_v3.sql` — Full DB migration: 5 new tables, indexes, RLS policies, realtime publication
- `vercel.json` — SPA routing config for Vercel deploy

### Changed
- `src/pages/TeamPage.jsx` — Full refactor: N-member grid (Duo/Trio/Squad), all new hooks + components wired, demo mode with 3 mock members
- `src/styles/team.css` — Full rewrite: N-member responsive grid, member card styles, check panel modal, join sync modal, rules section

### Database Schema (run `docs/supabase_team_v3.sql`)
- `teams` — added `name`, `max_members`, `created_by`, `activated_at`
- `team_members` — junction table (N per team), `role`, `week_sync`
- `user_programs` — per-user 21-day journey, `started_at`, `current_week`, `reset_count`
- `team_check_logs` — accountability checks, UNIQUE(team_id, checked_id, date)
- `team_rules` — reward/punishment rules with trigger types
- `team_rule_agreements` — per-member approval flow

---

## v2.0.0 — 2026-04-15

### Added
- `src/lib/supabase.js` — Singleton Supabase client, safe fallback when keys not set
- `.env.local.example` — Template for Supabase credentials
- `src/contexts/AuthContext.jsx` — Full auth context: signIn, signUp, Google OAuth, signOut, profile
- `src/components/AuthModal.jsx` — Login / Register / Google tabs with error UX
- `src/styles/auth.css` — Modal, input, avatar, user menu dropdown styles
- `src/pages/FriendsPage.jsx` — Friend search, send/accept/decline requests, friend list
- `src/styles/friends.css` — Friends page styles

### Changed
- `src/hooks/useHabitStore.js` — Dual mode: Supabase when authenticated, localStorage when guest, auto-migration on first login
- `src/components/Navbar.jsx` — Avatar + dropdown menu when logged in, login button when guest
- `src/pages/TeamPage.jsx` — Real Supabase create/join team, realtime subscription, reactions to DB, auth wall + demo bypass

---

## v1.1.0 — 2026-04-14

### Added
- `src/hooks/useXpStore.js` — XP/Level system: 6 levels, localStorage, milestone awards
- `src/components/XpBar.jsx` — Compact (Navbar) + full card (TrackerPage) XP display
- `src/components/DailyChallenge.jsx` — 21-challenge pool, date-seeded daily challenge, +20 XP on complete
- `src/pages/QuizPage.jsx` — 10 MCQ questions (brain science), route `/quiz`, XP reward
- `src/hooks/useNotifications.js` — Browser Notification API, schedule daily reminder
- `src/components/NotificationSettings.jsx` — Toggle + time picker in TrackerPage
- `src/pages/LeaderboardPage.jsx` — 3 tabs (weekly/monthly/all-time), podium top 3, mock + real user, route `/leaderboard`
- `src/components/TestimonialsSection.jsx` — 4 testimonial cards on LandingPage

### Changed
- `src/components/Navbar.jsx` — Added Quiz, Leaderboard links + compact XpBar
- `src/components/TrackerSection.jsx` — +10 XP per daily check (deduped by date)
- `src/pages/TrackerPage.jsx` — XP milestone toast + browser notification scheduling
- Fix countdown: localStorage-persisted 7-day rolling window

---

## v1.0.0 — 2026-04-13

### Added
- Full design system: CSS tokens, glassmorphism, dark mode, animations (`global.css`)
- `src/components/Navbar.jsx` — Sticky + mobile burger menu
- `src/components/HeroSection.jsx` — Typewriter, floating orbs, dual CTA, stats counter
- `src/components/ContentSections.jsx` — Problem toggle + Knowledge 3-cards + MiniLesson popup
- `src/components/RoadmapSection.jsx` — Interactive 3-week timeline with task expansion
- `src/components/TrackerSection.jsx` — Habit table T2→CN × 3 weeks (PDF-accurate)
- `src/components/ReverseSection.jsx` — Split-screen old vs new approach
- `src/components/PricingSection.jsx` — Pricing card + live countdown timer
- `src/pages/LandingPage.jsx` — 7-section landing assembly
- `src/pages/TrackerPage.jsx` — 28-day heatmap + day-of-week bar chart + insights
- `src/pages/TeamPage.jsx` — Team Mode: invite code, mock teammate, emoji reactions, auth wall
- `src/pages/DashboardPage.jsx` — Analytics dashboard
- `src/hooks/useHabitStore.js` — localStorage: streak, badge, completion tracking
- `src/App.jsx` — BrowserRouter + 4 routes
- `README.md`, `CHANGELOG.md`, SEO meta tags in `index.html`
