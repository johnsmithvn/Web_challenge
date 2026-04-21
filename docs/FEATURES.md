# FEATURES.md — Thử Thách Vượt Lười
**Version:** v2.1.0
**Updated:** 2026-04-21
**Rule:** File này PHẢI được cập nhật mỗi khi thêm hoặc sửa tính năng.

---

## Tổng Quan Hệ Thống

**Thử Thách Vượt Lười** là nền tảng habit tracking 21 ngày gamified, hỗ trợ cả chế độ offline (in-memory guest) lẫn đồng bộ cloud (Supabase). Người dùng có thể tự thiết lập thói quen, theo dõi tiến độ theo ngày/tháng, dùng Pomodoro timer, và luyện tập trong team accountability.

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

## 2. 📋 Habits Page (`/habits`) — DEPRECATED

**File:** `src/pages/HabitsPage.jsx`

**Mô tả:** Deprecated since v1.9.0. Redirect → `/tracker`. Tất cả features đã merge vào TrackerPage.

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

**Mô tả:** Tổng quan số liệu cá nhân, visual progress, weekly table, contribution graph.

**Chi tiết:**
- **4 KPI Cards:** Streak hiện tại, Best streak, Tổng ngày, Tổng XP
- **Flower Journey 🌸:** 21 ô hoa đại diện hành trình, hoa nở dần theo streak liên tiếp (`🌰→🌱→🌿→🌸→🌺→🌻`), highlight ô hôm nay
- **Monthly Donut Ring:** Tỷ lệ hoàn thành tháng hiện tại — Done / Bỏ / Còn lại
- **Weekly Table:** 4 tuần gần nhất, mỗi tuần hiển thị:
  - 7 ô ✓ (xanh) / ngày (mờ) / tương lai (dashed)
  - Cột Done / Miss / % tỷ lệ
- **Contribution Graph:** 12 tuần × 7 ngày kiểu GitHub, ô xanh = done, ô cyan = hôm nay
- **Insight:** Nhận xét động theo streak + milestone tiếp theo
- **Skip Reason Insight (v1.3.1):** Widget phân tích lý do bỏ qua trong 14 ngày gần đây
  - Hiển thị top 3 lý do dưới dạng bar chart miniature
  - Smart tip theo lý do phổ biến nhất ("Thiếu động lực" / "Bận công việc" / "Quên mất")
  - Chỉ hiển khi có dữ liệu skip trong 14 ngày

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

---

## Routes

| Route | Page | Auth Required |
|-------|------|:---:|
| `/` | LandingPage | ❌ |
| `/tracker` | TrackerPage | ❌ |
| `/habits` | → redirect `/tracker` | — |
| `/focus` | FocusPage | ❌ |
| `/journey` | JourneyPage | ❌ (soft wall: cần login để lưu) |
| `/journey/:id` | JourneyDetailPage | ❌ |
| `/team` | TeamPage | ✅ (soft wall) |
| `/dashboard` | DashboardPage | ❌ |
| `/quiz` | QuizPage | ❌ |
| `/leaderboard` | LeaderboardPage | ❌ |
| `/friends` | FriendsPage | ✅ |
