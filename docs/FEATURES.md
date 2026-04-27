# FEATURES.md — Life Hub (Personal Life OS)
**Version:** v3.3.0
**Updated:** 2026-04-27
**Rule:** File này PHẢI được cập nhật mỗi khi thêm hoặc sửa tính năng.

---

## Tổng Quan Hệ Thống

**Life Hub** là nền tảng Personal Life OS ("Bộ não thứ 2") tích hợp: habit tracking 21 ngày gamified, quản lý chi tiêu, đăng ký dịch vụ, ghi chú nhanh (Inbox/Collect), và lịch sử hoạt động (Life Log heatmap). Hỗ trợ cả chế độ offline (in-memory guest) lẫn đồng bộ cloud (Supabase).

---

## 1. 🗓 Tracker 21 Ngày (`/tracker`)

**File:** `src/pages/TrackerPage.jsx` (merged with HabitsPage since v1.9.0)

**Mô tả:** Trang hành động chính — tick từng habit, xem tiến độ 21 ngày, track streak per-habit. **4 tabs:** ⚡ Hôm Nay | 📅 Lịch | 📊 Tuần | ⚙️ Quản Lý

**Chi tiết:**
- **Header Stats:** 3 stat cards: Streak 🔥, Tổng ngày 📅, Số habits 🎯
- **XP Bar:** Hiển thị level + XP hiện tại
- **Hero Status (v1.9.2):** Read-only indicator (`X/Y habits` hoặc `Hoàn thành! 🎉`). Không còn nút tick manual — day complete tự auto-derived khi tất cả habits đều done
- **Streak Ring:** Vòng tròn SVG tô màu theo % tiến độ, màu thay đổi theo cây sinh trưởng
- **Plant Growth 🌰→🏆:** 6 giai đoạn hiển thị bên trong ring (hạt → mầm → cây lớn → trophy)
- **21-Day Dot Grid:** 3 hàng × 7 ô đại diện 3 tuần. Anchor từ `user_journeys.started_at` nếu có journey active, fallback = ngày tick sớm nhất
- **Progress Bar:** `streak / 21` ngày
- **Journey Banner:** Active = tên lộ trình + "Ngày X/Y" + link; Inactive (authed) = CTA "Chọn lộ trình →"
- **Daily Quote:** Câu trích dẫn động lực xoay theo ngày (30 câu từ `quotes.json`)

**Tab ⚡ Hôm Nay:**
- **Today Quick-Tick:** Danh sách custom habits hôm nay
  - Hiện `action` cụ thể (ví dụ: "Học 30 phút Duolingo") thay vì chỉ tên habit
  - **Per-habit streak 🔥N:** Chuỗi ngày liên tục của từng habit riêng lẻ
  - **Counter `X/N`:** Badge hiển thị số habit đã done hôm nay so với tổng
  - Tick xong → gạch ngang + nền tô màu
  - XP +10 mỗi habit tick (deduped by habit+date). Un-tick → removeXp (v2.0.0)
  - Khi TẤT CẢ tick → mark overall day done → sinh celebration banner
- **Celebration Banner:** "🎉 Ngày X/21 hoàn thành!" fade out sau 4s
- **LoginNudgeModal:** Bottom sheet không blocking cho guest sau ngày 1 hoàn thành
- **Mood Tracker:** 5 emoji mức cảm xúc, upsert 1 lần/ngày (single instance, no duplicate)
- **Skip Reason:** Trigger sau 8PM nếu chưa tick
- **Daily Challenge:** Thử thách mỗi ngày, +20 XP khi hoàn thành
- **Insight:** Nhận xét động theo streak hiện tại
- **Notification Settings:** Toggle + giờ nhắc nhở browser notification
- **Empty State:** Khi authenticated + no habits → CTA "🗺 Chọn Lộ Trình"

**Tab 📅 Lịch:** `MonthCalendar` component (lazy loaded)

**Tab 📊 Tuần:** `PerHabitWeeklyGrid` (memoized)
- 14 ngày gần nhất hiển thị dạng dot grid per-habit
- Header row: % hoàn thành toàn bộ habits theo từng ngày (màu xanh=100%, cam>0%)
- Mỗi habit: streak 🔥N + tỷ lệ 14 ngày + progress bar
- Cell gradient: ô xanh = habit done; ô nhạt = ngày có làm partial habits khác

**Tab ⚙️ Quản Lý:** `HabitManager` component (lazy loaded) + Conquered Habits 🏅

**Completion Modal (v1.3.0):** Khi streak đạt 21 → certificate modal: CTA "Gia Hạn" / "Thử Thách Mới" / "🗺 Chọn Lộ Trình Mới"

**Data:** `useHabitStore`, `useCustomHabits`, `useHabitLogs`, `useJourney`, `useXpStore`, `useMoodLog`, `useSkipReasons`

---

## 2. 📋 Habits Page (`/habits`) — REMOVED v2.2.1

**Mô tả:** Deprecated v1.9.0, file deleted v2.2.1. Route `/habits` redirects inline to `/tracker` via `App.jsx`.

---

## 3. ⚙️ Custom Habit Manager

**Files:** `src/components/HabitManager.jsx`, `src/hooks/useCustomHabits.js`

**Mô tả:** Hệ thống tạo/sửa/xóa thói quen tùy chỉnh của từng người dùng.

**Chi tiết:**
- **Tạo habit mới:** Nhập tên, hành động cụ thể (`action`), chọn icon (30+), chọn màu (10 màu), chọn category, đặt giờ target, thời lượng (phút)
- **Preview live:** Xem trước giao diện habit card trước khi lưu
- **Edit/Delete:** Sửa hoặc ẩn (soft delete — `active = false`)
- **Default habits:** 3 habit mặc định nếu chưa tạo (guest only — authenticated chỉ thấy real data)
- **Categories:** `health`, `learning`, `mindfulness`, `productivity`, `other`
- **Conquered Habits 🏅:** Habits đã chinh phục 21 ngày (`status='conquered'`)
- **Journey tagging (v1.8.0):** Mỗi habit tạo mới tự động gắn `journey_id: activeJourney?.id`
- **Sync:** Supabase-first (v1.6.2). Guest dùng in-memory default habits

---

## 4. ⏱ Focus Timer — Pomodoro (`/focus`)

**Files:** `src/pages/FocusPage.jsx`, `src/components/FocusTimer.jsx`, `src/hooks/useFocusTimer.js`

**Mô tả:** Pomodoro timer 25/5/15, gắn session với habit, log lịch sử tập trung.

**Chi tiết:**
- **SVG Ring Countdown:** Vòng tròn countdown theo thời gian, màu đổi theo phase (focus/nghỉ ngắn/nghỉ dài)
- **3 Phases:** Work (25p mặc định) → Short Break (5p) → Long Break (15p, sau 4 sessions)
- **Custom settings:** Điều chỉnh thời gian bằng slider, lưu localStorage (`vl_focus_settings`)
- **Habit Picker Custom Dropdown:** Chọn habit để gắn với session (dropdown glassmorphism thay native select)
  - Hiển thị icon, tên, giờ target của habit
  - Dấu ✓ khi đang được chọn
- **Session Stats hôm nay:** Số sessions + phút tập trung, breakdown theo từng habit
- **Lịch sử sessions:** 10 sessions gần nhất, tên habit + thời gian
- **Notification:** Browser notification khi hết giờ (cần cấp quyền)
- **Journey tagging (v1.8.0):** Insert `journey_id` vào `focus_sessions`
- **DB Sync:** Supabase-first (v1.6.2). Guest dùng in-memory
- **Auto-tick habit (v1.3.0):** Khi session hoàn thành và tổng `durationMin` đủ → dispatch `CustomEvent focus:habit-tick` (loose coupling)
- **Focus XP (v1.3.1):** +15 XP mỗi session hoàn thành, deduped qua Supabase

---

## 5. 📈 Dashboard Cá Nhân (`/dashboard`)

**File:** `src/pages/DashboardPage.jsx`, `src/styles/dashboard.css`
**Version:** v3.2.1 — Unified Life Hub Dashboard + Polish

**Mô tả:** Tổng quan toàn bộ cuộc sống — hôm nay, thói quen, tài chính, hoạt động, tâm trạng, focus.

**Chi tiết:**
- **Today Overview (4 KPIs hôm nay):** Hoạt động (activity_logs) / Focus phút + sessions (useFocusTimer) / Chi tiêu hôm nay (expenses) / XP kiếm hôm nay (xp_logs). Hover lift animation.
- **Section Dividers:** `SectionTitle` với gradient underline + icon + action link
- **Habits:** Flower Journey 21 ô / Monthly Donut ring / Weekly Table 4 tuần / mini KPI row (Streak, Best, Tổng, XP)
- **Finance Summary:** 3 KPI cards (Chi tháng / Đăng ký/tháng / Sắp hết hạn) + Finance Pie SVG donut (category breakdown + legend %)
- **Activity Heatmap:** Reuse `ActivityHeatmap` — toàn bộ activity_logs (thay ContributionGraph habit-only)
- **Mood Trend Chart (v3.2.1):** Dot-line SVG chart với toggle 7/30 ngày. Color-coded dots by mood score, average indicator, emoji overlay. Empty state khi chưa có data.
- **Focus Breakdown (v3.2.1):** Per-habit horizontal bar chart 7 ngày gần nhất. Query trực tiếp `focus_sessions` + join `habits` table. Hiển thị icon, tên habit, progress bar, phút, %.
- **Weekly Review (v3.2.1):** Collapsible summary card: Habits (ngày hoàn thành), XP, Chi tiêu, Mood TB — so sánh với tuần trước (↑/↓/→). Expand/collapse với animation.
- **Insights:** Skip Reason analysis 14 ngày + nhận xét streak + milestone tiếp theo
- **Guest mode:** Finance/Activity/Focus widgets hiện empty state graceful

**Data sources:** `useHabitStore`, `useXpStore`, `useSkipReasons`, `useMoodLog`, `useFocusTimer`, `useExpenses`, `useSubscriptions`, `useActivityLog`, `useAuth`, `supabase` (direct query for FocusBreakdown)

---

## 6. 🤝 Team Mode (`/team`)

**File:** `src/pages/TeamPage.jsx`, `src/hooks/useTeam.js`

**Mô tả:** Chế độ accountability partner — tạo/join team, xem progress của nhau, gửi reaction.

**Chi tiết:**
- **Tạo team:** Random invite code 6 ký tự, chờ đối tác join
- **Join team:** Nhập invite code của người khác
- **Realtime:** Cập nhật trạng thái tick, streak của teammate realtime qua Supabase
- **N-member grid:** Duo/Trio/Squad cards hiển thị streak, status hôm nay
- **Reactions:** Gửi emoji reaction (🔥💪👏🫡😎) cho teammate, persist DB
- **Auth wall:** Yêu cầu đăng nhập để dùng team mode (có nút bypass demo)
- **Demo mode:** 3 mock members khi chạy local

**Team Logic (v3 — components built, chưa full deploy):**
- `TeamMemberCard.jsx` — Per-member card: week badge, 7-day mini heatmap, lock state
- `TeammateCheckPanel.jsx` — Done/Fail modal + reason
- `JoinSyncModal.jsx` — Reset tuần về 1 vs tiếp tục
- `TeamRules.jsx` — Propose → All members agree → Active

---

## 7. 🔐 Xác Thực (Auth)

**Files:** `src/contexts/AuthContext.jsx`, `src/components/AuthModal.jsx`

**Mô tả:** Đăng ký / đăng nhập / Google OAuth.

**Chi tiết:**
- **Email/Password:** Đăng ký → auto tạo profile + streak row
- **Google OAuth:** 1 click, redirect flow
- **Guest mode:** Không cần đăng nhập — dữ liệu in-memory (reset khi refresh)
- **Migration:** Lần đầu đăng nhập → tự động migrate localStorage → Supabase DB → wipe local
- **Navbar:** Hiển thị avatar + dropdown nếu logged in, nút Login nếu guest
- **Profile:** Auto-generate username từ email, unique suffix nếu trùng

---

## 8. 🏆 XP & Level System

**Files:** `src/hooks/useXpStore.js`, `src/components/XpBar.jsx`

**Mô tả:** Gamification — tích XP, lên cấp, milestone rewards.

**Levels:**
| Level | Name | XP cần |
|-------|------|--------|
| 0 | 🌱 Người Mới | 0 |
| 1 | ⚡ Luyện Sĩ | 100 |
| 2 | 🔥 Đệ Tử | 300 |
| 3 | ⚔️ Chiến Binh | 700 |
| 4 | 👑 Huyền Thoại | 1500 |
| 5 | 🏆 Vô Địch | 3000 |

**XP Events:**
| Event | XP | Điều kiện |
|-------|-----|----------|
| Tick habit | +10 | 1 lần/habit/ngày (un-tick → removeXp) |
| Streak 3 ngày | +50 | One-time milestone |
| Streak 10 ngày | +100 | One-time milestone |
| Streak 21 ngày | +200 | One-time milestone |
| Daily Challenge | +20 | Max 1/ngày (un-check → removeXp) |
| Quiz (score×5) | +10→+50 | Mỗi lần làm |
| Focus Session | +15 | 1 lần/session (deduped) |

**XpBar:** Hiển thị compact trên Navbar + đầy đủ trên TrackerPage

---

## 9. 🧠 Quiz Tâm Lý (`/quiz`)

**File:** `src/pages/QuizPage.jsx`

**Mô tả:** 10 câu trắc nghiệm về não bộ và tâm lý học thói quen.

**Chi tiết:**
- Pool 21 câu, seed ngẫu nhiên theo ngày (cùng ngày → cùng câu hỏi)
- Trả lời xong → xem đáp án + giải thích
- Score-based XP: đúng 10 câu = +50 XP
- Unlimited attempts (XP mỗi lần)

---

## 10. 🏆 Leaderboard (`/leaderboard`)

**File:** `src/pages/LeaderboardPage.jsx`

**Mô tả:** Bảng xếp hạng người dùng theo streak/XP.

**Chi tiết:**
- **3 tabs:** Streak | XP | Tổng ngày
- **Top 3 podium:** Hiển thị đặc biệt với animation
- **Real data:** Từ `streaks` table (public read), Supabase
- **XP thật (v1.3.0):** Query `xp_logs` table tính totalXp thật
- **Fallback:** Nếu `xp_logs` chưa có → fallback về công thức ước tính

---

## 11. 👥 Friends (`/friends`)

**File:** `src/pages/FriendsPage.jsx`

**Mô tả:** Hệ thống kết bạn, tìm user theo username.

**Chi tiết:**
- Search realtime theo username (fuzzy với `pg_trgm`)
- Gửi lời mời kết bạn
- Accept / Decline request
- Danh sách bạn bè hiện tại
- **Streak + Level thật (v1.3.0):** Mỗi bạn hiển thị streak 🔥 N ngày và level từ XP thật

---

## 12. 📅 Monthly Calendar

**File:** `src/components/MonthCalendar.jsx`

**Mô tả:** Lịch tháng inline trong TrackerPage (tab 📅 Lịch).

**Chi tiết:**
- Navigate tháng prev/next
- Mỗi ô ngày: done (xanh), miss (đỏ nhạt), future (mờ), today (highlight)
- Click ngày → xem detail (trạng thái + mood nếu có)
- VN national holidays hiển thị
- Stats bar dưới lịch: X ngày done / X miss / % tháng này

---

## 13. 😊 Mood Tracker

**Files:** `src/hooks/useMoodSkip.js` (`useMoodLog`)

**Mô tả:** Ghi lại tâm trạng mỗi ngày, 5 mức độ.

- 5 mức: 😴 Kiệt sức · 😔 Thấp · 😐 Bình thường · 😊 Tốt · 💪 Tuyệt vời
- 1 lần/ngày (upsert)
- Supabase-first (v1.6.2), in-memory cho guest
- Hiển thị trên TrackerPage (tab Hôm Nay)

---

## 14. 📝 Skip Reasons

**Files:** `src/hooks/useMoodSkip.js` (`useSkipReasons`)

**Mô tả:** Ghi nhận lý do bỏ habit một ngày.

- Trigger tự động sau 8PM nếu chưa tick
- 7 lý do preset + ô ghi chú tự do
- Supabase-first (v1.6.2), in-memory cho guest
- Dùng để phân tích pattern bỏ habit

---

## 15. 🔔 Notification Reminder

**Files:** `src/hooks/useNotifications.js`, `src/components/NotificationSettings.jsx`

**Mô tả:** Nhắc nhở hàng ngày qua browser notification.

- Toggle bật/tắt, chọn giờ nhắc (mặc định 21:00)
- Scheduler tự tính `setTimeout` đến giờ đặt
- Không nhắc nếu đã tick xong hôm nay
- Settings sync DB nếu authed

---

## 16. 📊 Daily Challenge

**File:** `src/components/DailyChallenge.jsx`

**Mô tả:** Một thử thách nhỏ mỗi ngày từ pool 21 thử thách.

- Pick theo streak day (v1.7.0) → user mới thấy Challenge Ngày 1, không còn random
- Click "Hoàn thành" → +20 XP, 1 lần/ngày. Un-check → removeXp (v2.0.0)
- Hiển thị trên TrackerPage

---

## 17. 👋 Onboarding Modal (v1.3.0)

**Files:** `src/components/OnboardingModal.jsx`, `src/styles/onboarding.css`

**Mô tả:** Hướng dẫn 3 bước, hiện 1 lần duy nhất sau lần đầu truy cập app.

**Chi tiết:**
- **Bước 1:** Chào mừng + giới thiệu mục tiêu 21 ngày
- **Bước 2:** Giải thích MVA (Minimum Viable Action) — tại sao bắt đầu nhỏ hiệu quả hơn
- **Bước 3:** Hướng dẫn cách dùng — Tick Habits → Daily Challenge → Duy trì streak
- Nút **"Bỏ qua"** ở mọi bước
- Ghi nhớ bằng `vl_onboarded` localStorage — không hiện lại sau khi đóng
- Mount ở `AppShell` (`App.jsx`) — hiện trên tất cả routes

---

## 18. 🗺 Lộ Trình (Journey) (`/journey`)

**Added:** v1.6.0, expanded v2.0.0
**Files:** `src/pages/JourneyPage.jsx`, `src/components/journey/*`, `src/styles/journey.css`, `src/data/programs.json`

**Mô tả:** Hệ thống quản lý lộ trình (journey) giúp user có mục tiêu hành trình rõ ràng.

**4 tabs:**
1. **🗺 Đang Chạy** — Progress ring SVG (ngày hiện tại / target), habit chips. Completion UI (v2.0.0): khi `completedDays >= targetDays` → 🎉 banner + 3 actions: Renew / +21 Ngày / ✅ Hoàn Thành. Nút Gia Hạn / Bỏ Cuộc
2. **✨ Khám Phá** — Grid 5 system templates với category filter (Sức Khoẻ / Học Tập / Tâm Trí / Năng Suất). Load từ Supabase, fallback `programs.json`. Nút "✑ Tự tạo lộ trình riêng" mở `CustomJourneyModal`. **SwitchModeModal (v1.9.3):** khi có active journey → 2 options: 🔄 Replace / ➕ Append
3. **📂 Của Tôi** (v2.0.0) — `MyJourneys` component: list past journeys với "🔄 Bắt đầu lại" button (fetches journey_habits snapshot)
4. **📜 Lịch Sử** — List journey đã kết thúc: tên, ngày bắt đầu/kết thúc, trạng thái badge (completed/archived/extended), % hoàn thành. Click → `/journey/:id`

**Integrations:**
- **TrackerPage:** Journey banner nhỏ hiển thị tên lộ trình + "Ngày X/Y" nếu active; CTA nếu chưa có
- **TrackerPage:** 21-day dots anchor từ `user_journeys.started_at`
- **CompletionModal:** Option C "🗺 Chọn Lộ Trình Mới" sau khi hoàn thành 21 ngày

**Business logic (v2.0.0 — Journey Owns Habits):**
- Guest có thể browse templates, nhưng cần login để lưu journey → mở `AuthModal`
- Mỗi journey creates fresh habit rows. Không reuse across journeys
- Replace mode: archive old + close habits → create fresh from template
- Append mode: archive old, keep old habits + add new
- Complete/quit → close all active habits (`active=false, status='completed'`)
- Renew → snapshot old habits → clone as fresh rows for new cycle

---

## 19. 🗺 Journey Detail (`/journey/:id`) (v1.8.0)

**File:** `src/pages/JourneyDetailPage.jsx`

**Mô tả:** Full dashboard cho 1 journey cụ thể.

**Chi tiết:**
- Stats grid: completion %, focus hours, XP, mood distribution
- Habit chips with status
- **JourneyCalendar:** Month view — 🟢 all done / 🟡 partial / ⬜ missed / ⚫ outside range
- Click ngày → **DayDetailModal:** danh sách habits ✅/❌, tâm trạng, focus sessions với timestamp
- **MonthSummary (v1.9.1):** Per-month progress rings (Hoàn thành / Bỏ qua / Còn lại)

---

## 20. 📌 Nhiệm Vụ Cá Nhân (Personal Tasks) (v2.1.0)

**Added:** v2.1.0
**Files:** `src/components/TaskListSection.jsx`, `src/hooks/useUserTasks.js`, `public/sw.js`

**Mô tả:** Danh sách nhiệm vụ cá nhân (to-do), tách biệt khỏi habit/journey/XP. User tự tạo task với tiêu đề, mô tả, ngày giờ hẹn. Nhận notification khi đến hạn. Tick hoàn thành → lưu log xem trên calendar.

**Chi tiết:**
- **Task list** trong TrackerPage tab "⚡ Hôm Nay" (giữa Mood và Daily Challenge)
- **Add form:** Tên (required), mô tả (optional), ngày (default hôm nay), giờ (optional)
- **Task card:** Checkbox + title + description expand (▸/▾) + ⏰ badge + 📅 badge + "Quá hạn" indicator
- **Tick hoàn thành** → gạch ngang, lưu `completed_at` timestamp
- **Completed tasks** hôm nay hiển thị bên dưới với style nhạt
- Sau ngày hôm đó → task biến mất khỏi danh sách chính
- **Calendar integration:** Tab 📅 Lịch → click ngày → thấy danh sách tasks đã hoàn thành + expandable description + thời gian hoàn thành
- **Service Worker notification:** Background check mỗi 60s → fire notification khi task đến hạn (hoạt động cả khi tab đóng, chỉ cần browser mở)
- **Không tính XP, không tính streak, không gắn journey**
- **Data:** `user_tasks` (Supabase), guest = in-memory

---

## 21. 💛 Hành Trình Cuộc Đời (Life Journey) (`/life-journey`) (v2.2.0)

**Added:** v2.2.0
**Files:** `src/pages/LifeJourneyPage.jsx`, `src/pages/LifeJourneyPage.css`, `src/hooks/useLifeJourney.js`

**Mô tả:** Biểu đồ cảm xúc theo tuổi — người dùng ghi lại các cột mốc quan trọng trong cuộc đời (vui/buồn) lên đồ thị SVG. Dữ liệu chỉ lưu localStorage (feature cá nhân, không sync cloud).

**Chi tiết:**
- **Emotion timeline SVG:** Trục X = tuổi, trục Y = cảm xúc (-5 → +5). Catmull-Rom smooth curve, bi-color (xanh=tích cực, đỏ=tiêu cực)
- **Dual view:** "Thu gọn" (hover tooltip) / "Xem chi tiết" (expanded: labels gắn trực tiếp, tiered layout tránh overlap)
- **CRUD events:** Thêm/sửa/xóa cột mốc qua modal: tuổi, cảm xúc slider, tên, mô tả, icon emoji (30 emoji picker)
- **Stats cards:** Tổng cột mốc, số tích cực, số tiêu cực, TB cảm xúc
- **Event list:** Grid cards sorted theo tuổi, click → edit modal
- **Custom title:** Click tiêu đề → inline edit, lưu localStorage (`vl_journey_title`)
- **Reset to default:** 12 sample events mẫu
- **Navbar link:** "💛 Hành Trình" trong main nav
- **Data:** `vl_life_journey_events` (localStorage JSON array) — KHÔNG dùng Supabase

---

## Data Architecture — Dual Mode


| Chức năng | Storage (Authed) | Guest Fallback |
|-----------|-------------------|---------------|
| Daily tick | `progress` (Supabase) | in-memory |
| Streak cache | `streaks` (trigger) | computed |
| XP log | `xp_logs` (Supabase) | in-memory |
| Custom habits | `habits` (Supabase) | in-memory defaults |
| Habit per-day | `habit_logs` (Supabase) | in-memory |
| Focus sessions | `focus_sessions` (Supabase) | in-memory |
| Mood logs | `mood_logs` (Supabase) | in-memory |
| Skip reasons | `skip_reasons` (Supabase) | in-memory |
| Journeys | `user_journeys` (Supabase) | — |
| Teams | `teams` (Supabase) | — |
| Friends | `friendships` (Supabase) | — |
| Notifications | `vl_notif_settings` (localStorage) | localStorage |
| Personal tasks | `user_tasks` (Supabase) | in-memory |
| Life milestones | `vl_life_journey_events` (localStorage) | localStorage |

---

## Routes

| Route | Page | Auth Required |
|-------|------|:---:|
| `/` | LandingPage | ❌ |
| `/tracker` | TrackerPage | ❌ |
| `/habits` | Inline redirect → `/tracker` | — |
| `/inbox` | InboxPage | ✅ |
| `/collect` | CollectPage | ✅ |
| `/finance` | FinancePage | ✅ |
| `/life-log` | LifeLogPage | ✅ |
| `/focus` | FocusPage | ❌ |
| `/journey` | JourneyPage | ❌ (soft wall: cần login để lưu) |
| `/journey/:id` | JourneyDetailPage | ❌ |
| `/team` | → redirect `/tracker` | — (archived) |
| `/dashboard` | DashboardPage | ❌ |
| `/quiz` | QuizPage | ❌ |
| `/leaderboard` | LeaderboardPage | ❌ |
| `/friends` | → redirect `/tracker` | — (archived) |
| `/life-journey` | LifeJourneyPage | ❌ |

---

## 17. 📥 Inbox (`/inbox`)

**File:** `src/pages/InboxPage.jsx` + `src/styles/inbox.css`
**Hook:** `src/hooks/useCollections.js`

**Mô tả:** Nơi ghi nhanh mọi thứ (link, ý tưởng, ghi chú) — phân loại sau.

**Chi tiết:**
- Quick-add form (text input + submit)
- Inbox items list với thời gian tạo
- Classify action: phân loại → Link / Quote / Muốn mua / Học / Ý tưởng
- Delete action
- Tự động detect URL
- Empty state khi inbox trống

**Data source:** `collections` table (Supabase, type='inbox')

---

## 18. 📓 Kho Tàng Kiến Thức (`/collect`) — v3.3.0

**File:** `src/pages/CollectPage.jsx` + `src/styles/collect.css` + `src/styles/tiptap.css`
**Component:** `src/components/TiptapEditor.jsx` (WYSIWYG) + `TiptapReadOnly` + `src/components/SlashCommand.jsx` [v3.3.0]
**Hook:** `src/hooks/useCollections.js`

**Mô tả:** Kho lưu trữ và viết bài kiến thức đã phân loại — hỗ trợ 2 editor mode.

**Chi tiết:**
- **6 tabs:** Tất cả / Links / Quotes / Muốn / Học / Ý tưởng
- **Search filter** theo tiêu đề, nội dung, tag
- **Tag Autocomplete:** Dropdown searchable (max 10 tags), tạo tag mới bằng Enter

**Dual-Mode Editor (v3.2.0):**
- **Markdown mode** (mặc định) — editor textarea với live preview
- **Visual mode** — Tiptap WYSIWYG: Bold/Italic/Strike/Highlight/Code/H1-H3/Lists/TaskList/Blockquote/CodeBlock/HR/Link (inline popover)/Table/Undo/Redo
- **Mode Lock:** Chọn mode khi tạo bài, không đổi được sau khi save
- **Inline Link Popover:** Thay `window.prompt` — input bar xuất hiện dưới toolbar khi bấm 🔗
- **ReaderView:** Tự detect format, render `TiptapReadOnly` hoặc `ReactMarkdown`

**Slash Command Menu (v3.3.0):**
- Gõ `/` trong Tiptap editor → dropdown 12 block types
- Filter theo query text (`/hea` → Heading 1/2/3)
- Arrow keys + Enter chọn, Escape đóng
- Dùng `@tiptap/suggestion` plugin — handles cursor tracking + keyboard trapping
- Block types: Paragraph, H1-H3, Bullet/Ordered/Task List, Blockquote, Code Block, Divider, Table, Highlight

**Keyboard Shortcuts Panel (v3.3.0):**
- Toggle bằng nút `⌨` trên toolbar hoặc `Ctrl+.`
- 25+ phím tắt, 4 nhóm: Văn bản / Khối / Chèn / Chung
- Glassmorphism modal, 2-column responsive, kbd key badges

**Browser Shortcut Override (v3.3.0):**
- `Ctrl+S` → save article (thay vì browser Save Page dialog)
- `Ctrl+P` → blocked (không mở Print)
- `Ctrl+.` → toggle shortcuts panel
- Xử lý qua `editorProps.handleKeyDown`, return `true` = consume event

**AI-Ready Fields (v3.2.0):**
- `content_format`: `'markdown' | 'tiptap'` — loại nội dung
- `body_text`: Plain text extracted (không markdown/HTML) — dùng cho future AI/embedding
- `word_count`: Pre-computed — dùng cho read-time estimate

**ArticleCard:**
- Dùng `body_text` cho excerpt (không hiện JSON raw với bài Tiptap)
- `safeHostname()` guard `new URL()` crash
- Word count read-time khi có `word_count` từ DB

**ConfirmModal (v3.2.0):**
- Tất cả delete/switch action dùng `useConfirm()` — không còn `window.confirm()`

**Data source:** `collections` table (Supabase) — columns: `type, title, body, url, tags, source, status, content_format, body_text, word_count`

---

## 19. 💰 Finance (`/finance`)

**File:** `src/pages/FinancePage.jsx` + `src/styles/finance.css`
**Hook:** `src/hooks/useExpenses.js` + `src/hooks/useSubscriptions.js`

**Mô tả:** Quản lý chi tiêu và đăng ký dịch vụ.

**Chi tiết:**
- **Summary cards:** Chi tiêu tháng / Đăng ký/tháng / Tổng ước tính
- **Alert bar:** Cảnh báo subscriptions sắp hết hạn (≤7 ngày)
- **Tab Chi tiêu:** Quick-add form (số tiền + category + ghi chú), category breakdown với progress bars, expense list với delete
- **Tab Đăng ký:** Sub cards với tên, số tiền, chu kỳ, ngày hết hạn, toggle active/pause, delete
- **8 categories:** Ăn uống, Di chuyển, Mua sắm, Sức khỏe, Học tập, Giải trí, Hóa đơn, Khác

**Data source:** `expenses` + `subscriptions` tables (Supabase)

---

## 20. 📅 Life Log (`/life-log`)

**File:** `src/pages/LifeLogPage.jsx` + `src/styles/lifelog.css`
**Components:** `src/components/ActivityHeatmap.jsx` + `src/components/DailyTimeline.jsx`
**Hook:** `src/hooks/useActivityLog.js`

**Mô tả:** Lịch sử hoạt động toàn hệ thống dạng GitHub contribution heatmap.

**Chi tiết:**
- **Today stat badge:** Số hoạt động hôm nay
- **ActivityHeatmap:** SVG 53×7 grid, 5-level purple scale, click để drill-down
- **DailyTimeline:** Vertical timeline với action icons, timestamps, labels, XP amounts
- **Activity types logged:** habit_done, habit_undo, mood_set, challenge_done, collect_add, focus_done, expense_add, subscription_add

**Data source:** `activity_logs` table (Supabase, append-only)

---

## 21. 🔔 Sidebar Widgets

**Files:** `src/components/SubAlert.jsx` + `src/components/DailyReview.jsx` + `src/styles/widgets.css`

**Mô tả:** Widgets nhỏ gắn trong sidebar desktop, tự động ẩn khi không có data.

**Chi tiết:**
- **SubAlert:** Hiển thị subscriptions sắp gia hạn (≤7 ngày) + đếm ngược ngày. Urgent style khi ≤2 ngày.
- **DailyReview:** Tổng số hoạt động hôm nay + 5 actions gần nhất với icon + timestamp.

**Data source:** SubAlert → `subscriptions` | DailyReview → `activity_logs`
