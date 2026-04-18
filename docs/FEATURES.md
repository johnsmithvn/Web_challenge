# FEATURES.md — Thử Thách Vượt Lười
**Version:** v1.3.1
**Updated:** 2026-04-18
**Rule:** File này PHẢI được cập nhật mỗi khi thêm hoặc sửa tính năng.

---

## Tổng Quan Hệ Thống

**Thử Thách Vượt Lười** là nền tảng habit tracking 21 ngày gamified, hỗ trợ cả chế độ offline (localStorage) lẫn đồng bộ cloud (Supabase). Người dùng có thể tự thiết lập thói quen, theo dõi tiến độ theo ngày/tháng, dùng Pomodoro timer, và luyện tập trong team accountability.

---

## 1. 🗓 Tracker 21 Ngày (`/tracker`)

**File:** `src/pages/TrackerPage.jsx`

**Mô tả:** Trang hành động chính — tick hoàn thành mỗi ngày, theo dõi streak, xem tiến độ hành trình 21 ngày.

**Chi tiết:**
- **Big Tick Button:** Nút lớn ở giữa, bounce animation khi click, đổi màu sau khi tick
- **Streak Ring:** Vòng tròn SVG tô màu theo % tiến độ, màu thay đổi theo cây sinh trưởng
- **Plant Growth 🌰→🏆:** 6 giai đoạn hiển thị bên trong ring (hạt → mầm → cây lớn → trophy)
- **21-Day Dot Grid:** 3 hàng × 7 ô đại diện 3 tuần, tính từ ngày bắt đầu thật (không phải ngược về từ hôm nay)
- **Progress Bar:** `streak / 21` ngày
- **Habit Chips:** Hiển thị top 4 custom habit hôm nay, dạng pill, click để đến `/habits`
- **Mood Tracker:** 5 mức cảm xúc, lưu theo ngày, sync DB nếu đã login
- **XP Bar:** Hiển thị level + XP hiện tại
- **Daily Challenge:** Thử thách ngẫu nhiên mỗi ngày, +20 XP khi hoàn thành
- **Insight:** Nhận xét động theo streak hiện tại
- **Notification Settings:** Toggle + giờ nhắc nhở browser notification
- **Completion Modal (v1.3.0):** Khi streak đạt 21 lần đầu → popup ăn mừng, hiện XP/habits/round, CTA "Bắt Đầu Vòng 2"
  - "Bắt đầu Vòng 2" → xóa `vl_habit_data`, `vl_habit_progress`, reload — Supabase history giữ lại
  - Deduped bằng `vl_completion_shown_N` key, không hiện lại sau khi đã xử lý

**Data:** `useHabitStore` (localStorage / Supabase dual-mode)

---

## 2. 📋 Habits Management (`/habits`)

**File:** `src/pages/HabitsPage.jsx`

**Mô tả:** Quản lý và tick từng custom habit cụ thể, xem lịch tháng, theo dõi tâm trạng.

**Chi tiết:**
- **Today Quick-Tick:** Danh sách tất cả custom habit hôm nay, mỗi habit có checkbox riêng độc lập
  - Tick xong → tên gạch ngang + nền tô màu habit
  - Khi TẤT CẢ habits tick → mark overall day done (tác động streak)
  - XP +10 mỗi habit tick (deduped by habit+date)
- **Skip Reason Modal:** Trigger sau 8PM nếu chưa tick — chọn lý do preset + ghi chú, lưu localStorage/DB
- **Mood Tracker:** 5 emoji mức cảm xúc, upsert 1 lần/ngày
- **Tab Lịch Tháng:** `MonthCalendar` component — VN holidays, done/miss/future states, click ngày xem detail
- **Tab Quản Lý Habits:** `HabitManager` component — CRUD habits

**Data:** `useCustomHabits` + `useMoodLog` + `useSkipReasons`

---

## 3. ⚙️ Custom Habit Manager

**Files:** `src/components/HabitManager.jsx`, `src/hooks/useCustomHabits.js`

**Mô tả:** Hệ thống tạo/sửa/xóa thói quen tùy chỉnh của từng người dùng.

**Chi tiết:**
- **Tạo habit mới:** Nhập tên, chọn icon (30+), chọn màu (10 màu), chọn category, đặt giờ target, thời lượng (phút)
- **Preview live:** Xem trước giao diện habit card trước khi lưu
- **Edit/Delete:** Sửa hoặc ẩn (soft delete — `active = false`)
- **Default habits:** 3 habit mặc định nếu chưa tạo (Tập thể dục, Đọc sách, Thiền)
- **Categories:** `health`, `learning`, `mindfulness`, `productivity`, `other`
- **Sync:** localStorage guest / Supabase DB (`habits` table) khi authed

---

## 4. ⏱ Focus Timer — Pomodoro (`/focus`)

**Files:** `src/pages/FocusPage.jsx`, `src/components/FocusTimer.jsx`, `src/hooks/useFocusTimer.js`

**Mô tả:** Pomodoro timer 25/5/15, gắn session với habit, log lịch sử tập trung.

**Chi tiết:**
- **SVG Ring Countdown:** Vòng tròn countdown theo thời gian, màu đổi theo phase (focus/nghỉ ngắn/nghỉ dài)
- **3 Phases:** Work (25p mặc định) → Short Break (5p) → Long Break (15p, sau 4 sessions)
- **Custom settings:** Điều chỉnh thời gian bằng slider, lưu localStorage
- **Habit Picker Custom Dropdown:** Chọn habit để gắn với session (dropdown glassmorphism thay native select)
  - Hiển thị icon, tên, giờ target của habit
  - Dấu ✓ khi đang được chọn
- **Session Stats hôm nay:** Số sessions + phút tập trung, breakdown theo từng habit
- **Lịch sử sessions:** 10 sessions gần nhất, tên habit + thời gian
- **Notification:** Browser notification khi hết giờ (cần cấp quyền)
- **DB Sync:** Insert vào `focus_sessions` table (fire-and-forget) khi authed
- **FocusPage layout:** 2 cột (timer | stats + history + tips)
- **Auto-tick habit (v1.3.0):** Khi session hoàn thành và tổng `durationMin` đủ so với target của habit → tự tick `vl_habit_progress`, dispatch `storage` event để HabitsPage cập nhật live
- **Focus XP (v1.3.1):** +15 XP mỗi session hoàn thành, deduped theo `sessionId`

---

## 5. 📈 Dashboard Cá Nhân (`/dashboard` / Stats)

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
  - Smart tip theo lý do phổ biến nhất (“Thiếu động lực” / “Bận công việc” / “Quên mất”)
  - Chỉ hiển khi có dữ liệu skip trong 14 ngày

---

## 6. 🤝 Team Mode (`/team`)

**File:** `src/pages/TeamPage.jsx`, `src/hooks/useTeam.js`

**Mô tả:** Chế độ accountability partner — tạo/join team, xem progress của nhau, gửi reaction.

**Chi tiết:**
- **Tạo team:** Random invite code 6 ký tự, chờ đối tác join
- **Join team:** Nhập invite code của người khác
- **Realtime:** Cập nhật trạng thái tick, streak của teammate realtime qua Supabase
- **Duo Cards:** 2 card (mình + teammate) hiển thị streak, status hôm nay (done/pending/miss)
- **Reactions:** Gửi emoji reaction (🔥💪👏🫡😎) cho teammate, persist DB
- **Auth wall:** Yêu cầu đăng nhập để dùng team mode (có nút bypass demo)
- **Fallback mock:** Chạy được ở local nếu chưa có Supabase keys

**Team Logic (Week 2+):** *(đang thiết kế, chưa deploy)*
- Week 2: Teammate check thay vì self-check
- Team rules: Đề xuất + tất cả đồng ý mới áp dụng

---

## 7. 🔐 Xác Thực (Auth)

**Files:** `src/contexts/AuthContext.jsx`, `src/components/AuthModal.jsx`

**Mô tả:** Đăng ký / đăng nhập / Google OAuth.

**Chi tiết:**
- **Email/Password:** Đăng ký → auto tạo profile + streak row
- **Google OAuth:** 1 click, redirect flow
- **Guest mode:** Không cần đăng nhập — dữ liệu lưu localStorage
- **Migration:** Lần đầu đăng nhập → tự động migrate localStorage → Supabase DB
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
| Tick daily check | +10 | 1 lần/habit/ngày |
| Streak 3 ngày | +50 | One-time milestone |
| Streak 10 ngày | +100 | One-time milestone |
| Streak 21 ngày | +200 | One-time milestone |
| Daily Challenge | +20 | Max 1/ngày |
| Quiz (score×5) | +10→+50 | Mỗi lần làm |
| Focus Session | +15 | 1 lần/session (deduped sessionId) |

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
- **XP thật (v1.3.0):** Query `xp_logs` table tính totalXp thật thay vì công thức `streak*10` hàrdócode
- **Fallback:** Nếu `xp_logs` chưa có → fallback về công thức ước tính (không bị lỗi)

---

## 11. 👥 Friends (`/friends`)

**File:** `src/pages/FriendsPage.jsx`

**Mô tả:** Hệ thống kết bạn, tìm user theo username.

**Chi tiết:**
- Search realtime theo username (fuzzy với `pg_trgm`)
- Gửi lời mời kết bạn
- Accept / Decline request
- Danh sách bạn bè hiện tại
- **Streak + Level thật (v1.3.0):** Mỗi bạn hiển thị streak 🔥 N ngày và level từ XP thật (query `streaks` + `xp_logs` table, parallel)

---

## 12. 📅 Monthly Calendar

**File:** `src/components/MonthCalendar.jsx`

**Mô tả:** Lịch tháng inline trong HabitsPage.

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
- localStorage + Supabase `mood_logs` table
- Hiển thị trên TrackerPage + HabitsPage

---

## 14. 📝 Skip Reasons

**Files:** `src/hooks/useMoodSkip.js` (`useSkipReasons`)

**Mô tả:** Ghi nhận lý do bỏ habit một ngày.

- Trigger tự động sau 8PM nếu chưa tick
- 7 lý do preset + ô ghi chú tự do
- localStorage + Supabase `skip_reasons` table
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

- Seed theo ngày → cùng user cùng ngày thấy cùng challenge
- Click "Hoàn thành" → +20 XP, 1 lần/ngày
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

## Data Architecture — Dual Mode

| Chức năng | localStorage key | Supabase table |
|-----------|-----------------|----------------|
| Daily tick | `vl_habit_data` | `progress` |
| Streak cache | computed | `streaks` (trigger) |
| XP log | `vl_xp_store` | `xp_logs` |
| Custom habits | `vl_custom_habits` | `habits` |
| Habit progress/day | `vl_habit_progress` | *(TODO: per-habit progress table)* |
| Focus sessions | `vl_focus_sessions` | `focus_sessions` |
| Mood logs | `vl_mood_log` | `mood_logs` |
| Skip reasons | `vl_skip_{date}` | `skip_reasons` |
| Teams | — | `teams` |
| Friends | — | `friendships` |
| Notifications | `vl_notif_settings` | `notification_settings` |

---

## Routes

| Route | Page | Auth Required |
|-------|------|:---:|
| `/` | LandingPage | ❌ |
| `/tracker` | TrackerPage | ❌ |
| `/habits` | HabitsPage | ❌ |
| `/focus` | FocusPage | ❌ |
| `/team` | TeamPage | ✅ (soft wall) |
| `/dashboard` | DashboardPage | ❌ |
| `/quiz` | QuizPage | ❌ |
| `/leaderboard` | LeaderboardPage | ❌ |
| `/friends` | FriendsPage | ✅ |
