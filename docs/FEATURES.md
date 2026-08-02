# FEATURES.md — Life Hub (Personal Life OS)
**Version:** v4.26.1
**Updated:** 2026-07-28
**Rule:** File này PHẢI được cập nhật mỗi khi thêm hoặc sửa tính năng.

**Cấu trúc file:** §1–§27 = tính năng **đang chạy**, số thứ tự duy nhất và tăng dần.
Cuối file: `Data Architecture` → `Routes` → **`Archived / Removed`**.
Tính năng đã bỏ KHÔNG được để lẫn trong phần active — chuyển xuống bảng Archived kèm version.

---

## Tổng Quan Hệ Thống

**Life Hub** là nền tảng Personal Life OS ("Bộ não thứ 2") tích hợp: habit tracking 21 ngày gamified, quản lý chi tiêu, đăng ký dịch vụ, ghi chú nhanh (Inbox/Collect), và lịch sử hoạt động (Life Log heatmap). Hỗ trợ cả chế độ offline (in-memory guest) lẫn đồng bộ cloud (Supabase).

---

## 1. 🗓 Tracker 21 Ngày (`/tracker`)

**File:** `src/pages/TrackerPage.jsx` (merged with HabitsPage since v1.9.0)

**Mô tả:** Trang hành động chính — tick từng habit, xem tiến độ 21 ngày, track streak per-habit.
**4 tabs:** ⚡ Hôm Nay | 📅 Lịch | 📊 Tuần | ⚙️ Quản Lý

**Chi tiết:**
- **Header Stats:** 3 stat cards: Streak 🔥, Tổng ngày 📅, Số habits 🎯
- **XP Bar:** Hiển thị level + XP hiện tại
- **Hero Status (v1.9.2):** Read-only indicator (`X/Y habits` hoặc `Hoàn thành! 🎉`). Không còn nút tick manual — day complete tự auto-derived khi tất cả habits đều done
- **Streak Ring:** Vòng tròn SVG tô màu theo % tiến độ, màu thay đổi theo cây sinh trưởng
- **Plant Growth 🌰→🏆:** 6 giai đoạn hiển thị bên trong ring (hạt → mầm → cây lớn → trophy)
- **21-Day Dot Grid:** 3 hàng × 7 ô đại diện 3 tuần. Anchor từ `user_journeys.started_at` nếu có journey active, fallback = ngày tick sớm nhất
- **Progress Bar:** `streak / 21` ngày
- **Journey Banner:** Active = tên lộ trình + "Ngày X/Y" + link; Inactive (authed) = CTA "Chọn lộ trình →"
- **Daily Quote (v4.12.0):** `QuoteWidget` component — daily-seeded random from `quotes.json` (30 câu), nút 🔀 shuffle, crossfade animation, hỗ trợ `audio_url`. Hiện ở 3 pages: Today, Inbox, Knowledge (mỗi page seed khác → quote khác nhau)

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

- **Skip Reason:** Trigger sau 8PM nếu chưa tick
- **Daily Challenge:** Thử thách mỗi ngày, +20 XP khi hoàn thành
- **Insight:** Nhận xét động theo streak hiện tại
- **Notification Settings:** Toggle + giờ nhắc nhở browser notification
- **Empty State:** Khi authenticated + no habits → CTA "🗺 Chọn Lộ Trình"
- **🥚 Incubator Review Banner (v4.2.1):** Khi có dự định cần review hôm nay → banner vàng "🥚 N dự định cần review" + link tới `/incubator`. Cùng khu vực với SubAlert và các banner ngữ cảnh khác.

**Tab 📅 Lịch:** `MonthCalendar` component (lazy loaded)

**Tab 📊 Tuần:** `PerHabitWeeklyGrid` (memoized)
- 14 ngày gần nhất hiển thị dạng dot grid per-habit
- Header row: % hoàn thành toàn bộ habits theo từng ngày (màu xanh=100%, cam>0%)
- Mỗi habit: streak 🔥N + tỷ lệ 14 ngày + progress bar
- Cell gradient: ô xanh = habit done; ô nhạt = ngày có làm partial habits khác

**Tab ⚙️ Quản Lý:** `HabitManager` component (lazy loaded) + Conquered Habits 🏅

**Completion Modal (v1.3.0):** Khi streak đạt 21 → certificate modal: CTA "Gia Hạn" / "Thử Thách Mới" / "🗺 Chọn Lộ Trình Mới"

**Data:** `useHabitStore`, `useCustomHabits`, `useHabitLogs`, `useJourney`, `useXpStore`, `useSkipReasons`

---

## 2. ⚙️ Custom Habit Manager

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

## 3. ⏱ Focus Timer — Pomodoro (`/focus`)

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

## 4. 📈 Dashboard Cá Nhân (`/dashboard`)

**File:** `src/pages/DashboardPage.jsx`, `src/styles/dashboard.css`
**Version:** v3.2.1 — Unified Life Hub Dashboard + Polish

**Mô tả:** Tổng quan toàn bộ cuộc sống — hôm nay, thói quen, tài chính, hoạt động, focus.

**Chi tiết:**
- **Today Overview (4 KPIs hôm nay):** Hoạt động (activity_logs) / Focus phút + sessions (useFocusTimer) / Chi tiêu hôm nay (expenses) / XP kiếm hôm nay (xp_logs). Hover lift animation.
- **Section Dividers:** `SectionTitle` với gradient underline + icon + action link
- **Habits:** Flower Journey 21 ô / Monthly Donut ring / Weekly Table 4 tuần / mini KPI row (Streak, Best, Tổng, XP)
- **Finance Summary:** 3 KPI cards (Chi tháng / Đăng ký/tháng / Sắp hết hạn) + Finance Pie SVG donut (category breakdown + legend %)
- **Activity Heatmap:** Reuse `ActivityHeatmap` — toàn bộ activity_logs (thay ContributionGraph habit-only)

- **Focus Breakdown (v3.2.1):** Per-habit horizontal bar chart 7 ngày gần nhất. Query trực tiếp `focus_sessions` + join `habits` table. Hiển thị icon, tên habit, progress bar, phút, %.
- **Weekly Review (v3.2.1):** Collapsible summary card: Habits (ngày hoàn thành), XP, Chi tiêu — so sánh với tuần trước (↑/↓/→). Expand/collapse với animation.
- **Insights:** Skip Reason analysis 14 ngày + nhận xét streak + milestone tiếp theo
- **Guest mode:** Finance/Activity/Focus widgets hiện empty state graceful

**Data sources:** `useHabitStore`, `useXpStore`, `useSkipReasons`, `useFocusTimer`, `useExpenses`, `useSubscriptions`, `useActivityLog`, `useAuth`, `supabase` (direct query for FocusBreakdown)

---

## 5. 🔐 Xác Thực (Auth)

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

## 6. 🏆 XP & Level System

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
| Quiz | score × 5 (0→50) | Mỗi lần làm |
| Focus Session | +15 | 1 lần/session (deduped by `meta.sessionId`) |

> Nguồn: `XP_REWARDS` trong `useXpStore.js`; `FOCUS_XP` trong `useFocusTimer.js`.

**XpBar:** Hiển thị compact trên Navbar + đầy đủ trên TrackerPage

---

## 7. 🧠 Quiz Tâm Lý (`/quiz`)

**File:** `src/pages/QuizPage.jsx`

**Mô tả:** 10 câu trắc nghiệm về não bộ và tâm lý học thói quen.

**Chi tiết:**
- Pool 21 câu, seed ngẫu nhiên theo ngày (cùng ngày → cùng câu hỏi)
- Trả lời xong → xem đáp án + giải thích
- Score-based XP: đúng 10 câu = +50 XP
- Unlimited attempts (XP mỗi lần)

---

## 8. 🏆 Leaderboard (`/leaderboard`)

**File:** `src/pages/LeaderboardPage.jsx`

**Mô tả:** Bảng xếp hạng người dùng theo streak/XP.

**Chi tiết:**
- **3 tabs:** 🔥 Streak | ⚡ XP | ✅ Ngày Done
- **Top 3 podium:** Hiển thị đặc biệt với animation
- **Data (v4.24.0):** 1 lời gọi `supabase.rpc('get_leaderboard')` — RPC `SECURITY DEFINER`
  trả về display_name/avatar/streak/XP/ngày done, **không** trả email. Top 50.
  Không còn client-side join `profiles`/`xp_logs` (RLS giờ chỉ cho đọc hàng của mình),
  và không còn "fallback công thức ước tính"
- ⚠️ Cột streak lấy từ bảng `streaks` — bảng này chưa được cập nhật sau signup,
  xem `docs/DATABASE.md` § Streak — Source of Truth

---

## 9. 📅 Monthly Calendar

**File:** `src/components/MonthCalendar.jsx` + `src/styles/calendar.css`
**Dùng ở:** `/tracker` tab 📅 Lịch, `/life-log`, `/tasks` tab 📅 Lịch (v4.29.0)

**Mô tả:** Lịch tháng inline, **2 chế độ** quyết định bởi prop `habitData` (v4.29.0).

**Chung cho cả 2 mode:**
- Navigate tháng prev/next + nút "Hôm nay"
- Ngày lễ VN, highlight today, outline ngày đang chọn
- Click ngày → panel chi tiết list task đã hoàn thành + expand mô tả + giờ xong
- **1 query cho cả tháng** (`getCompletedTasksRange`), group theo ngày **địa phương** ở client. Click ngày chỉ filter mảng đã fetch — không fetch thêm

**habit mode** (truyền `habitData` — `/tracker`, `/life-log`):
- Ô ngày: done (xanh), **miss (đỏ nhạt)**, future (mờ) — theo việc tick đủ habit
- 1 dấu dot cho ngày done
- Stats: X ngày done / % tháng này / X ngày miss
- Hiện `skipLog` (lý do bỏ habit) trong panel chi tiết

**task mode** (KHÔNG truyền `habitData` — `/tasks`):
- Ô cao `76px` (bỏ `aspect-ratio: 1`), hiện **chip tên task** (tối đa 2 + `+N nữa`)
- Ngày quá khứ không có task xong là **transparent, không tô đỏ** — thiếu habit là thất bại, không có task ngày đó thì không
- Stats: X task xong / X ngày có việc xong / TB mỗi ngày
- Không có `skipLog`, legend chỉ còn "Có task xong / Chưa tới / Ngày lễ"

> Khi feature habit bị cắt, xoá nhánh `habitMode` là xong — không có prop cấu hình để dọn.

---

## 10. 📝 Skip Reasons

**Files:** `src/hooks/useMoodSkip.js` (`useSkipReasons`)

**Mô tả:** Ghi nhận lý do bỏ habit một ngày.

- Trigger tự động sau 8PM nếu chưa tick
- 7 lý do preset + ô ghi chú tự do
- Supabase-first (v1.6.2), in-memory cho guest
- Dùng để phân tích pattern bỏ habit

---

## 11. 🔔 Notification Reminder

**Files:** `src/hooks/useNotifications.js`, `src/components/NotificationSettings.jsx`

**Mô tả:** Nhắc nhở hàng ngày qua browser notification.

- Toggle bật/tắt, chọn giờ nhắc (mặc định 21:00)
- Scheduler tự tính `setTimeout` đến giờ đặt
- Không nhắc nếu đã tick xong hôm nay
- Settings sync DB nếu authed

---

## 12. 📊 Daily Challenge

**File:** `src/components/DailyChallenge.jsx`

**Mô tả:** Một thử thách nhỏ mỗi ngày từ pool 21 thử thách.

- Pick theo streak day (v1.7.0) → user mới thấy Challenge Ngày 1, không còn random
- Click "Hoàn thành" → +20 XP, 1 lần/ngày. Un-check → removeXp (v2.0.0)
- Hiển thị trên TrackerPage

---

## 13. 👋 Onboarding Modal (v1.3.0)

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

## 14. 🗺 Lộ Trình (Journey) (`/journey`)

**Added:** v1.6.0, expanded v2.0.0
**Files:** `src/pages/JourneyPage.jsx`, `src/components/journey/*`, `src/styles/journey.css`, `src/data/programs.json`

**Mô tả:** Hệ thống quản lý lộ trình (journey) giúp user có mục tiêu hành trình rõ ràng. Kể từ `v4.21.0`, việc chọn lộ trình là tùy chọn (Optional), loại bỏ cơ chế cưỡng chế tự động chuyển hướng khi người dùng đăng nhập mà không có lộ trình active.

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

## 15. 🗺 Journey Detail (`/journey/:id`) (v1.8.0)

**File:** `src/pages/JourneyDetailPage.jsx`

**Mô tả:** Full dashboard cho 1 journey cụ thể.

**Chi tiết:**
- Stats grid: completion %, focus hours, XP
- Habit chips with status
- **JourneyCalendar:** Month view — 🟢 all done / 🟡 partial / ⬜ missed / ⚫ outside range
- Click ngày → **DayDetailModal:** danh sách habits ✅/❌, focus sessions với timestamp
- **MonthSummary (v1.9.1):** Per-month progress rings (Hoàn thành / Bỏ qua / Còn lại)

---

## 16. 📌 Nhiệm Vụ Cá Nhân (Personal Tasks) (v2.1.0 → v4.27.0)

**Added:** v2.1.0, **tách thành route riêng v4.27.0**
**Route:** `/tasks` (lazy)
**Files:** `src/pages/TasksPage.jsx`, `src/components/TaskListSection.jsx`, `src/hooks/useUserTasks.js`, `src/styles/tasks.css`, `public/sw.js`

**Mô tả:** Danh sách nhiệm vụ cá nhân (to-do), tách biệt khỏi habit/journey/XP. User tự tạo task với tiêu đề, mô tả, ngày giờ hẹn. Nhận notification khi đến hạn. Tick hoàn thành → lưu log xem trên calendar.

**Chi tiết:**
- **Route riêng `/tasks` (v4.27.0):** Trước đó `TaskListSection` chỉ render trong TrackerPage tab "⚡ Hôm Nay" — Task bị ràng vào trang habit. Nay là page độc lập, có link `📌 Nhiệm Vụ` trong nav CHÍNH. CSS task tách từ `tracker.css` → `src/styles/tasks.css`.
- **Hero + 2 view (v4.29.0):**
  - **Hero:** số việc cần làm (quá hạn + hôm nay) ở display scale với `.gradient-text`, kèm 3 tile Quá hạn / Hôm nay / Sắp tới. Độ nổi mã hoá độ gấp: quá hạn nền đỏ, hôm nay tím, sắp tới `opacity 0.6`.
  - **Tab 📋 Danh sách** — chỉ việc **CHƯA** làm. Block "Đã hoàn thành hôm nay" **đã xoá** khỏi list.
  - **Tab 📅 Lịch** — việc **ĐÃ** xong theo ngày. Reuse `MonthCalendar` ở **task mode** (không truyền `habitData`): ô ngày hiện **chip tên task** thay 1 dấu dot, bấm ngày → list task đã xong + expand mô tả + giờ hoàn thành.
  - **Dải màu priority** 3px bên trái mỗi task card, màu từ `PRIORITY_OPTIONS` — quét mắt thấy ngay cái nào gấp.
  - **Animation tick** thuần CSS (`::after` + `:active` + `--transition-spring` + `--shadow-green`), không cần state React. Có escape `prefers-reduced-motion`.
  - **Empty state** có icon + tiêu đề, không còn là dòng text trơn.
- **1 query/tháng thay 30 (v4.29.0):** `getCompletedTasks(dateStr)` → `getCompletedTasksRange(start, end)`. Calendar fetch 1 lần/tháng rồi group theo ngày **địa phương** ở client — vừa bớt N+1, vừa sửa luôn lỗi lệch ngày do `completed_at` được so sánh theo UTC.
- **Cố ý KHÔNG làm:** week/day time-grid kiểu Google Calendar. `due_time` mặc định `23:59` nên mọi task sẽ dồn vào 1 hàng đáy — phần đắt nhất của GCal (cột giờ, thuật toán xếp event chồng, drag-resize) không đem lại gì cho dữ liệu all-day. Cũng không làm Board/Gantt/assignee/custom field (xem `docs/TASKS.md`).
- **Add form:** Tên (required), mô tả (optional), ngày (default hôm nay), giờ (optional)
- **Task card:** Checkbox + title + description expand (▸/▾) + ⏰ badge + 📅 badge + "Quá hạn" indicator
- **Tick hoàn thành** → gạch ngang, lưu `completed_at` timestamp
- **Completed tasks** hôm nay hiển thị bên dưới với style nhạt
- Sau ngày hôm đó → task biến mất khỏi danh sách chính
- **Overdue Triage (v3.5.0):** Task list chia 3 khối: ⚠️ Quá hạn (nền đỏ, nút 🔄 Dời sang hôm nay) / 📅 Hôm nay / 🔮 Sắp tới (collapsed). Bắt user đối mặt và dọn dẹp backlog.
- **Rollover (v3.5.0):** Nút 🔄 trên overdue task → `updateTask(id, { due_date: today })` → task chuyển sang section Hôm nay.
- **Priority (v4.9.0):** Thay thế Energy Tag + Duration Estimate của v3.6.0. `priority SMALLINT` 0=None / 1=Lowest / 2=Low / 3=Medium / 4=High / 5=Urgent (`PRIORITY_OPTIONS` trong `TaskListSection.jsx`). Badge màu trên task card khi `priority > 0`. Cột `energy_level` + `duration_est` đã bị DROP khỏi schema.
- **Recurring Tasks (v3.6.0 → v4.31.0):** Toggle 🔁 Lặp lại: Mỗi N ngày / Hàng tuần thứ X / Hàng tháng ngày Y. Khi tick xong task recurring → task cũ ở lại "Hoàn thành hôm nay" (dopamine hit) → task mới insert ẩn với `due_date` tương lai (đã fix clamp cuối tháng — ngày lặp không tồn tại ở tháng đích thì rơi vào ngày cuối tháng đó, không tràn sang tháng sau nữa). Tag + link KB của task cũ được copy sang occurrence mới (best-effort, không rollback task chính nếu bước copy lỗi). Chống sinh trùng: nếu task đã có occurrence tiếp theo rồi (tích/bỏ tích/tích lại nhanh) thì không sinh thêm. Sinh task lỗi hẳn sau khi hết retry → báo lỗi qua toast (trước đây chỉ log console, user không biết chuỗi lặp đã chết).
  - **Quan hệ chuỗi (`recurrence_parent_id`, v4.31.0):** mỗi task lặp lưu lại "được sinh ra từ task nào". **Sửa** 1 task trong chuỗi không bao giờ đụng task khác đã tồn tại (chỉ ảnh hưởng occurrence tương lai chưa sinh). **Xoá** task **gốc** (chưa từng được sinh ra) → chỉ xoá đúng nó, chuỗi phía sau giữ nguyên. Xoá task **không phải gốc** (tự nó được sinh ra) → xoá luôn toàn bộ hậu duệ phía sau. **Bỏ tích** 1 task → tự xoá occurrence nó đã sinh ra (kèm hậu duệ xa hơn nếu có), tránh trùng khi tích/bỏ tích nhiều lần — có toast báo.
  - Logic thuần (tính ngày kế tiếp + tính chuỗi cần xoá) tách ra `src/utils/recurrenceUtils.js`, unit test ở `src/__tests__/recurrenceUtils.test.js` (`npm test`).
- **DB columns:** `priority SMALLINT`, `recurrence_rule JSONB` trên `user_tasks`.
- **Calendar integration:** Tab 📅 Lịch → click ngày → 1 danh sách "Nhiệm vụ ngày này" gồm cả task đã hoàn thành ngày đó (expandable description + giờ hoàn thành, có nút 🗑 xoá) và task sắp tới/chưa hoàn thành due ngày đó (v4.31.0). Chip trên ô ngày: xanh = có task xong, tím = chỉ có task sắp tới.
- **Xem + xoá task đã hoàn thành (v4.31.0):** Tab 📋 Danh sách có section "✅ Đã hoàn thành" (collapsed mặc định), lọc theo ngày (`DatePickerPopover`, mặc định hôm nay) qua `getCompletedTasksRange`. Xoá task (cả ở đây lẫn trong Lịch, lẫn task pending/quá hạn/hôm nay/sắp tới ở view mode và mobile overflow menu) đều đi qua 1 `useConfirm()` dùng chung + toast xác nhận qua `ToastContext` (global, góc phải dưới).
- **Service Worker notification:** Background check mỗi 60s → fire notification khi task đến hạn (hoạt động cả khi tab đóng, chỉ cần browser mở)
- **Không tính XP, không tính streak, không gắn journey**
- **Task ↔ KB Many-to-Many Link (v4.5.0):**
  - Nút 🔗 trên mỗi task card → mở `LinkKBModal` (search + checkbox, max 10 kết quả)
  - Badge `🔗 N bài` trên task card khi có liên kết
  - Junction table `task_collections` (composite PK, CASCADE, RLS)
  - Embedded Supabase select: 1 query fetch tasks + linked collections (no N+1)
  - `linkCollection(taskId, collectionId)` + `unlinkCollection(taskId, collectionId)` với optimistic updates
- **Tags (v4.31.0):** `TagPicker` trong form Thêm + Sửa task, badge `🏷 tên` trên task card. Junction `task_tags` (đã có bảng từ v4.28.0, trước đó chưa có UI). `linkTaskTag(taskId, tag)`/`unlinkTaskTag(taskId, tagId)` trong `useUserTasks.js` — optimistic riêng (không dùng `useTags.linkTag` trực tiếp vì hook đó không sync state `tasks`).
- **Data:** `user_tasks` + `task_collections` + `task_tags` (Supabase), guest = in-memory

---

## 17. 💛 Hành Trình Cuộc Đời (Life Journey) (`/life-journey`) (v2.2.0)

**Added:** v2.2.0
**Files:** `src/pages/LifeJourneyPage.jsx`, `src/styles/life-journey.css`, `src/hooks/useLifeJourney.js`

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

## 18. 📥 Inbox (`/inbox`)

**File:** `src/pages/InboxPage.jsx` + `src/styles/inbox.css`
**Hook:** `src/hooks/useCollections.js`, `src/hooks/useExpenses.js`, `src/hooks/useActivityLog.js`

**Mô tả:** Nơi ghi nhanh mọi thứ (link, ý tưởng, ghi chú) — phân loại sau. Trạm triage với luồng chuyển đổi nhanh.

**Chi tiết:**
- Quick-add form (text input + submit)
- Inbox items list với thời gian tạo
- Classify action: phân loại nhanh qua `<select>` dropdown (lấy dữ liệu tĩnh từ `knowledge.json`)
- **📌 Task action:** Chuyển inbox item thành Task (v3.0.1)
- **✓ Xong nhanh (v4.20.0):** Nút "✓ Xong" trên mỗi inbox item và trong Reader view. Nhấp vào sẽ tự động chuyển item thành Task, đánh dấu hoàn thành (completed) trong ngày hôm nay ngay lập tức, ghi nhận vào activity log (`task_done`), và xoá/dọn dẹp item đó khỏi inbox.
- **🔄 Đăng ký action:** Chuyển sang FinancePage tạo Subscription (v3.0.1)
- **💸 Chi tiêu nhanh (v3.5.0):** Bấm nút → QuickExpenseModal inline (không navigate). Regex tự bóc tách số tiền từ text ("Cafe 50k" → 50,000đ). Pre-fill amount + note + category dropdown 8 loại. Lưu → `addExpense()` + `logActivity()` + xóa item khỏi inbox.
- **✏️ Sửa chi tiêu (v4.2.1):** Click ✏️ trên expense → modal sửa (số tiền, danh mục, ghi chú). Optimistic update + rollback.
- **🔄 Sub auto-advance (v4.2.1):** Subscription hết hạn tự động nhảy `next_due` theo cycle (monthly/3month/6month/yearly). Chạy khi fetch, bounded max 24 cycle.
- Delete action
- **🕔 Snooze (v3.8.0):** Ẩn inbox item tạm thời. 4 options: 1 tuần / 2 tuần / 1 tháng / 3 tháng. Badge "🕔 X snoozed" trong header.
- **··· Overflow Menu (v4.0.1):** 2 primary buttons (📌 Task + 🗑) luôn hiện. 5 actions phụ (📂 Phân loại, 💸 Chi tiêu, 🔄 Đăng ký, 🥚 Ấp Trứng, 🕔 Snooze) gom vào dropdown ···. Click-outside auto-close.
- **📊 Filter Chips (v4.3.0):** 3 chip lọc: Tất cả / Có URL / Gần đây (7 ngày). Client-side filtering trên data đã fetch. Smart empty state khi không có item khớp.
- Tự động detect URL
- Empty state khi inbox trống

- **Data source:** `collections` table (Supabase, type='inbox'), `expenses` table (khi dùng Quick Expense), `knowledge.json` cho danh sách phân loại

---

## 19. 🏷️ Tags — Hệ Thống Trung Tâm (v3.7.0)

**Added:** v3.7.0
**Files:** `src/hooks/useTags.js`, `src/components/TagPicker.jsx`
**DB:** `tags`, `expense_tags`, `subscription_tags`, `collection_tags` (§27), `task_tags` (v4.31.0)

**Mô tả:** Hệ thống tag trung tâm dùng chung cho expenses, subscriptions, collections (§27), và tasks (v4.31.0). Mỗi user có bộ tags riêng.

**Chi tiết:**
- `useTags` hook: fetchTags, addTag (upsert), deleteTag, linkTag, unlinkTag, `getTagUsageBreakdown` (v4.31.0 — đếm riêng theo từng loại entity, dùng cho confirm xoá tag ở Settings) — `ENTITY_CONFIG` hỗ trợ 4 loại: `expense`, `subscription`, `collection`, `task`
- `TagPicker` component: searchable dropdown, multi-select toggle, inline tạo tag mới bằng Enter
- Tích hợp vào FinancePage (expense/subscription form), CollectPage (§27), TaskListSection (v4.31.0 — form Thêm/Sửa task)
- Tags link qua junction tables (expense_tags, subscription_tags, collection_tags, task_tags)
- Task dùng optimistic wrapper riêng (`linkTaskTag`/`unlinkTaskTag` trong `useUserTasks.js`) thay vì gọi `useTags.linkTag` trực tiếp — cần sync state `task._tags` ngay để hiện badge, `useTags` không giữ state đó
- RLS policies đảm bảo user chỉ thấy tags của mình

---

## 20. 📅 Cashflow Calendar (v3.7.0)

**Added:** v3.7.0
**Files:** `src/components/CashflowBar.jsx`, `src/styles/finance.css`

**Mô tả:** Thanh timeline 30 ngày hiển thị các ngày có subscription sắp đến hạn.

**Chi tiết:**
- 30 cells ngang, mỗi cell = 1 ngày, dot đỏ khi có sub due
- Tooltip hiển tên sub khi hover
- Legend dưới bar hiển 5 ngày gần nhất có sub
- Chỉ hiển active subscriptions
- Mount trong FinancePage sau summary cards

---

## 21. 🥚 Trạm Ấp Trứng / Incubator (v3.9.0 → v4.2.0)

**Added:** v3.9.0, **upgraded v4.2.0** (Multi-Output Router)
**Files:** `src/pages/IncubatorPage.jsx`, `src/styles/incubator.css`, `src/hooks/useIntentions.js`
**DB:** `intentions`, `intention_logs`
**Route:** `/incubator`

**Mô tả:** Module "someday-maybe" với friction khi hoãn. Đóng vai trò **Bộ định tuyến nguồn lực**: hút vào ý tưởng trừu tượng, nhả ra hành động vật lý (tiền bạc, thói quen, công việc).

**Chi tiết:**
- Intention Card: title, original reason, estimated cost, **estimated time badge ⏱** (v4.2.0), review date, age badge
- **Form nhập (v4.2.0):** Chi phí dự kiến (number) + Cam kết thời gian (dropdown: 15m/30m/1h/1.5h/2h/nửa ngày)
- Dời lại (Defer): bắt buộc nhập lý do (friction UX chống bốc đồng). 4 options: 1w/2w/1m/3m
- **Thực thi (Execute) v4.2.0 — Multi-Output Router:**
  - 3 checkbox cards (đa lựa chọn, không phải radio):
    - 💰 Ghi nhận Chi tiêu → `addExpense()` + dropdown category (8 loại)
    - 🔁 Tạo Thói quen → `addHabit()` + tự động điền `durationMin` từ `estimated_time`
    - 📌 Tạo Công việc → `addTask()` + tự động điền `durationEst` từ `estimated_time`
  - Auto-suggest: cost > 0 → pre-check Expense, time > 0 → pre-check Habit, cả 2 = 0 → pre-check Task
  - Multi-dispatch: tạo đồng thời nhiều records (expense + habit + task)
  - `converted_to TEXT[]` lưu mảng output types, `converted_ids JSONB` lưu map UUID
- Bỏ qua (Abandon): xóa khỏi danh sách với reason log
- Timeline: lịch sử mọi lần dời/thực thi/tạo. Expand từ card
- **Archive View (v4.3.0):** Nút "▼ Xem dự định đã bỏ qua" ở cuối trang. Lazy-load abandoned intentions, hiện read-only cards.
- Review-due highlighting: card viền vàng khi đến ngày review
- Badge header: số lượng đang ấp + cần review
- Inbox integration: nút 🥚 Ấp Trứng chuyển inbox item vào Incubator

**Data source:** `intentions` + `intention_logs` (Supabase). Cross-module: `expenses`, `habits`, `user_tasks`

---

## 22. 📓 Kho Tàng Kiến Thức (`/collect`) — v3.3.0

**File:** `src/pages/CollectPage.jsx` + `src/styles/collect.css` + `src/styles/tiptap.css`
**Component:** `src/components/TiptapEditor.jsx` (WYSIWYG) + `TiptapReadOnly` + `src/components/SlashCommand.jsx` [v3.3.0]
**Hook:** `src/hooks/useCollections.js`

**Mô tả:** Kho lưu trữ và viết bài kiến thức đã phân loại — hỗ trợ 2 editor mode.

**Chi tiết:**
- **6 tabs:** Tất cả / Links / Quotes / Ghi chú / Học / Ý tưởng
- **Search filter** theo tiêu đề, nội dung, tag
- **Tag Autocomplete:** Dropdown searchable (max 10 tags), tạo tag mới bằng Enter

**Dual-Mode Editor (v3.2.0):**
- **Markdown mode** (mặc định) — editor textarea với live preview
- **Visual mode** — Tiptap WYSIWYG: Bold/Italic/Strike/Highlight/Code/H1-H3/Lists/TaskList/Blockquote/CodeBlock/HR/Link (inline popover)/Table/Image/YouTube/Audio/Undo/Redo
- **Mode Lock:** Chọn mode khi tạo bài, không đổi được sau khi save
- **Inline Popovers:** UrlInputPopover (ClickUp-style) cho Link, Image, YouTube, Audio — thay thế `window.prompt`
- **ReaderView:** Tự detect format, render `TiptapReadOnly` hoặc `ReactMarkdown`
- **Media Support (v4.16.0):** Ảnh (🖼️), YouTube (▶️), Audio/Video (🎵) — cả toolbar + slash commands. AudioNode custom Tiptap extension hỗ trợ PasteRules tự động chuyển đổi Google Drive link và Audio URL gốc thành Inline Player.
- **Reader View Player (v4.16.0):** Tự động parse và hiển thị Audio/Video Player nội tuyến tại trang đọc nếu bài viết thuộc loại `podcast` hoặc có URL là link Google Drive/Audio.
- **Unified Drive Upload Architecture (v4.16.1):** Upload API (`/api/upload.js`) định tuyến 100% tất cả các file (Ảnh, Audio, Video, PDF) sang Google Drive thông qua Service Account (không cần user login). URL trả về đã được tối ưu dạng Direct link để hiển thị ảnh mượt mà trên trình duyệt.
- **Quy chuẩn Đặt Tên File (v4.16.2):** Tự động đổi tên file upload theo format chuẩn `LifeHub_{folder}_{yyyyMMdd}_{HHMMSS}_{hex6}.{ext}` (VD: `LifeHub_images_20260523_161030_1a2b3c.jpg`) giúp chống lỗi ký tự tiếng Việt, khoảng trắng và chống trùng lặp file.
- **Global Mini Player (v4.16.0):** Thanh phát audio trôi nổi toàn cục (GlobalAudioPlayer) hiển thị trên mọi trang, sử dụng hook `useRandomPodcast` để tự động chọn và phát ngẫu nhiên podcast từ kho tàng kiến thức (hỗ trợ phát trực tiếp từ stream link Google Drive).
- **Phân Loại Media Nâng Cao (v4.18.0 → v4.23.0):** MediaNode thay thế AudioNode trong Tiptap, kết hợp MediaPreview thống nhất các định dạng YouTube Shorts, direct audio/video, và Google Drive. Hỗ trợ hệ thống Hashtag client-side (`#audio` / `#video`) để lưu trữ định dạng. Drive URL mặc định render dạng Audio Player (v4.23.0 — xóa option "Dạng Drive" không dùng, default audio-first). Toggle bar chỉ còn 2 option: 🎵 Audio / 📺 Video. Editor format pill tương ứng cũng chỉ còn 2 nút.
- **Custom Audio Player (v4.19.0 → v4.23.0):** Trình phát âm thanh tùy chỉnh glassmorphic. Play/Pause/Volume/Seek/Duration. Tích hợp cơ chế fallback thông minh: nếu stream trực tiếp từ Google Drive thất bại (CORS), player tự động hiển thị compact iframe (80px) với card styling sạch sẽ (v4.23.0 — xóa verbose warning "Đang sử dụng trình phát dự phòng bảo mật của Drive").
- **Unified Custom Dropdowns (v4.19.7):** Thay thế toàn bộ dropdown `<select>` mặc định của hệ điều hành bằng component `CustomSelect` kính mờ (glassmorphic) đồng bộ trên mọi nền tảng (áp dụng tại Inbox, Collect editor và Incubator execute modal). Hỗ trợ nhãn emoji và tự động đóng khi click ra ngoài.
- **Task Overdue UX Fixes (v4.19.7):** Mặc định giờ hoàn thành nhiệm vụ là `23:59` (Nhiệm vụ cả ngày) thay vì lấy giờ tạo hiện tại giúp tránh cảnh báo quá hạn lập tức. Tích hợp badge màu vàng vui nhộn `⏳ Nhanh lên sắp hết ngày rồi` cho các nhiệm vụ ngày hôm nay chưa hoàn thành.
- **Postcard Gallery (v4.13.0):** Quote-type items render dạng gradient postcard cards (2-col grid) thay vì article list. 8 gradient màu, serif italic typography, line-clamp 5 dòng + fade truncation. Audio badge detection. Responsive 1-col mobile.
- **QuoteWidget KB Integration (v4.13.0):** KB quote items tự động được merge vào QuoteWidget random rotation pool trên trang Collect — user quotes xuất hiện cạnh system quotes.

**Slash Command Menu (v3.3.0):**
- Gõ `/` trong Tiptap editor → dropdown 12 block types
- Filter theo query text (`/hea` → Heading 1/2/3)
- Arrow keys + Enter chọn, Escape đóng
- Dùng `@tiptap/suggestion` plugin — handles cursor tracking + keyboard trapping
- Block types: Paragraph, H1-H3, Bullet/Ordered/Task List, Blockquote, Code Block, Divider, Table, Highlight, Image, YouTube, Audio

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
- Fallback: extract text từ Tiptap JSON khi `body_text` chưa có (v4.5.0)
- `safeHostname()` guard `new URL()` crash
- Word count read-time khi có `word_count` từ DB
- Badge `📌 N tasks` khi bài viết được link với task (v4.5.0)

**Task Filter (v4.5.0):**
- Dòng chip `📌 Task:` bên dưới tag filter — chỉ hiện task active (chưa hoàn thành)
- Click chip → lọc bài viết đã link với task đó
- Data: `useCollections` join `task_collections(task_id)` → `_linkedTaskIds` + `_linkedTaskCount`

**Knowledge Groups — REMOVED (v4.11.0 → v4.30.0):**
> Quyết định sản phẩm P2-7 (2026-08-01, chốt lại cùng ngày sau thảo luận thêm): `knowledge_groups`
> từng là bảng M:N riêng, trùng việc với `tags`. Bước đầu định gộp hiển thị ("nhóm" = tag có
> `emoji`), nhưng quyết định CUỐI CÙNG là **bỏ hẳn tính năng Nhóm khỏi UI** — không còn tab 📁 Nhóm,
> không còn GroupPicker, không còn badge folder trên ArticleCard. Chỉ còn tag thường (`#tag`).
> Dữ liệu nhóm cũ đã được migrate thành tag thường (giữ tên, mất emoji/description) — bài viết
> KHÔNG mất liên kết, chỉ mất hiển thị "folder" đặc biệt.
- **DB:** `knowledge_groups`/`collection_groups` bị DROP; `tags.emoji`/`tags.description` (thêm tạm ở bước gộp) cũng bị DROP vì không còn UI nào đọc. Xem `data/migration_v4.30.0_merge_knowledge_groups_into_tags.sql` Phase 2.
- **Hooks:** `useKnowledgeGroups.js` đã xoá. `useTags.js` không còn nhận `{emoji, description}` — về lại chữ ký gốc trước v4.30.0.

**Sub-Notes / Threaded Notes (v4.11.0):**
- **Ghi Chú Cá Nhân:** Section bên dưới bài viết trong ReaderView.
- **Add form:** Textarea + Ctrl+Enter save. Plain text.
- **Inline edit:** Click ✏️ → edit textarea + Save/Hủy.
- **Delete:** Click 🗑 → optimistic remove.
- **Use case:** Book reading notes, personal annotations, follow-up thoughts.
- **Hook:** `useCollectionNotes.js` (fetchNotes, addNote, updateNote, deleteNote, getNoteCount)
- **DB:** `collection_notes` table (FK → collections + profiles, CASCADE)

**ConfirmModal (v3.2.0):**
- Tất cả delete/switch action dùng `useConfirm()` — không còn `window.confirm()`

**Data source:** `collections` + `collection_notes` + `collection_tags` (Supabase) — columns: `type, title, body, url, source, status, content_format, body_text, word_count, snoozed_until`. Tags (kể cả tag-nhóm có emoji) đi qua junction `collection_tags` (không phải cột `tags`). Phân loại được config cứng ở `src/data/knowledge.json`.

---

## 23. 💰 Finance (`/finance`)

**File:** `src/pages/FinancePage.jsx` + `src/styles/finance.css`
**Hook:** `src/hooks/useExpenses.js` + `src/hooks/useSubscriptions.js`

**Mô tả:** Quản lý chi tiêu và đăng ký dịch vụ.

**Chi tiết:**
- **Summary cards:** Chi tiêu tháng / Đăng ký/tháng / Tổng ước tính
- **Alert bar:** Cảnh báo subscriptions sắp hết hạn (≤7 ngày)
- **Tab Chi tiêu:** Quick-add form (số tiền + category + ghi chú), category breakdown với progress bars, expense list với delete
- **Tab Đăng ký:** Sub cards với tên, số tiền, chu kỳ, ngày hết hạn, toggle active/pause, delete
- **8 categories:** Ăn uống, Di chuyển, Mua sắm, Sức khỏe, Học tập, Giải trí, Hóa đơn, Khác
- **Tự động phân tích & Quy đổi ngoại tệ (v4.20.1):** Hỗ trợ nhập tiền tệ tự do dạng văn bản (ví dụ: `50`, `50k`, `89$`, `1.5m`) tại ô nhập chi phí, đăng ký và ấp trứng. Hiển thị nhãn Xem trước trực tiếp đã phân tách nghìn dạng VND (`vi-VN` standard). Tự động nhân 1000 đối với số ngắn dưới 10,000 (Auto-K) và quy đổi USD dựa trên tỷ giá tùy chỉnh. Cấu hình tỷ giá và Toggle bật/tắt Auto-K được quản lý trong tab Chung ở trang Cài đặt. Tự động nối thông tin quy đổi gốc vào phần ghi chú/tên dịch vụ khi lưu.

**Data source:** `expenses` + `subscriptions` tables (Supabase)

---

## 24. 📅 Life Log (`/life-log`)

**File:** `src/pages/LifeLogPage.jsx` + `src/styles/lifelog.css`
**Components:** `src/components/ActivityHeatmap.jsx`
**Hook:** `src/hooks/useActivityLog.js`

**Mô tả:** Lịch sử hoạt động toàn hệ thống dạng GitHub contribution heatmap.

**Chi tiết:**
- **Today stat badge:** Số hoạt động hôm nay
- **ActivityHeatmap:** SVG 53×7 grid, 5-level purple scale
- **MonthCalendar (habit mode):** Lịch tháng — ô tô màu theo habit, bấm ngày xem task đã xong. Task mode (không `habitData`) dùng ở `/tasks`, xem §16
- **Activity types logged (11):** habit_done, habit_undo, challenge_done, task_done, expense_add, subscription_add, inbox_snooze, inbox_classify, inbox_bulk_delete, inbox_bulk_classify, focus_done

**Data source:** `activity_logs` table (Supabase, append-only)

> ⚠️ Heatmap chỉ **đếm số row/ngày** — không đọc `action`, `label`, `amount`, `meta`.
> Chưa có daily drill-down: `onDateClick` của ActivityHeatmap hiện là no-op. Xem `docs/TASKS.md` § Activity Log.

---

## 25. 🔔 Sidebar Widgets

**Files:** `src/components/SubAlert.jsx` + `src/styles/widgets.css`

**Mô tả:** Widget nhỏ gắn inline trong TrackerPage, tự động ẩn khi không có data.

**Chi tiết:**
- **SubAlert:** Hiển thị subscriptions sắp gia hạn (≤7 ngày) + đếm ngược ngày. Urgent style khi ≤2 ngày.

> **Note:** `DailyReview` widget đã bị xóa v4.7.1 để giảm UI clutter.

**Data source:** SubAlert → `subscriptions`

---

## 26. ⚙️ Cài Đặt (`/settings`)

**File:** `src/pages/SettingsPage.jsx` + `src/styles/settings.css`
**Hooks:** `src/hooks/useTags.js`, `src/hooks/useQuotes.js` (v4.12.0)

**Mô tả:** Trang cài đặt hệ thống. 3 tabs sidebar: Chung, Quotes, Hồ sơ.

**Chi tiết:**
- **Tab Chung — Tag Manager:** Danh sách tags + color dot + usage count
  - Add tag: Form + color picker (12 màu)
  - Inline edit: Rename + recolor (Enter save, Escape cancel)
  - Delete: Confirm modal, hiển thị breakdown liên kết sẽ bị gỡ theo từng loại (vd "3 nhiệm vụ, 2 khoản chi") kèm khẳng định rõ chỉ gỡ liên kết, không xoá các mục đó (v4.31.0 — `getTagUsageBreakdown`)
- **Tab Quotes (v4.12.0) — Quote Manager:**
  - Add quote: Textarea nội dung + Author + Source + nút Thêm
  - List: Hiện quotes cá nhân, toggle On/Off (ToggleLeft/Right), Edit inline, Delete
  - System quotes: Collapsible section hiện 30 câu hệ thống (read-only)
- **Tab Hồ sơ — Profile:**
  - Avatar + username (read-only)
  - Editable: Display name, Email, Bio
  - Save + validation (email unique, format check)

**Data source:** `tags` table + `inspirational_quotes` table (Supabase)

---

## 27. 🏷️ Tags — Hợp Nhất vào Knowledge Base (v4.1.0)

**Files:** `src/hooks/useTags.js` + `src/hooks/useCollections.js` + `src/pages/CollectPage.jsx`
**DB:** `collection_tags` (đã nằm trong `data/schema_v4.24.0.sql`)

**Mô tả:** Thống nhất hệ thống tags: `collections.tags` (TEXT[]) → central `tags` + `collection_tags` junction table.

**Chi tiết:**
- **Junction table:** `collection_tags` (collection_id, tag_id) với RLS + CASCADE delete
- **useTags.js:** Mở rộng `linkTag`/`unlinkTag` hỗ trợ `entityType='collection'`. Thêm `updateTag()`, `getTagsForEntity()`, `getTagUsageCount()`, `getAllTagUsageCounts()`.
- **useCollections.js:** `fetchItems()` join `collection_tags(tags(id,name,color))` → `item._tags`. `addItem()` không còn ghi vào `collections.tags` TEXT[].
- **CollectPage:** TagInput hiển color dots, tag filter chips hiển color dots, save/edit dùng `linkTag`/`unlinkTag`.
- **Backward compat:** không còn — `collections.tags` TEXT[] **không tồn tại** trong `schema_v4.24.0.sql`. Fresh install chỉ có junction `collection_tags`.

**Data source:** `tags` + `collection_tags` + `expense_tags` + `subscription_tags` (Supabase)

---

## Data Architecture — Dual Mode

| Chức năng | Storage (Authed) | Guest Fallback |
|-----------|-------------------|---------------|
| Daily tick | `progress` | in-memory |
| Streak | tính client-side từ `progress` (`useHabitStore`) | tính client-side |
| XP log | `xp_logs` | in-memory |
| Custom habits | `habits` | in-memory defaults |
| Habit per-day | `habit_logs` | in-memory |
| Focus sessions | `focus_sessions` | in-memory |
| Skip reasons | `skip_reasons` | in-memory |
| Journeys | `user_journeys` + `journey_habits` | — (cần login để lưu) |
| Personal tasks | `user_tasks` + `task_collections` | in-memory |
| Inbox / Knowledge | `collections` (+ groups/notes/tags) | — (cần login) |
| Finance | `expenses`, `subscriptions` | — (cần login) |
| Incubator | `intentions`, `intention_logs` | — (cần login) |
| Notifications | `notification_settings` + `vl_notif_settings` | localStorage |
| Life milestones | `vl_life_journey_events` (localStorage-only) | localStorage |

---

## Routes

| Route | Page | Auth |
|-------|------|:---:|
| `/` | LandingPage (eager) | ❌ |
| `/tracker` | TrackerPage (eager) | ❌ |
| `/inbox` | InboxPage | ✅ |
| `/collect` | CollectPage | ✅ |
| `/finance` | FinancePage | ✅ |
| `/life-log` | LifeLogPage | ✅ |
| `/incubator` | IncubatorPage | ✅ |
| `/settings` | SettingsPage | ✅ |
| `/focus` | FocusPage | ❌ |
| `/journey` | JourneyPage | ❌ (soft wall: cần login để lưu) |
| `/journey/:id` | JourneyDetailPage | ❌ |
| `/dashboard` | DashboardPage | ❌ |
| `/quiz` | QuizPage | ❌ |
| `/leaderboard` | LeaderboardPage | ❌ |
| `/life-journey` | LifeJourneyPage | ❌ |
| `/habits`, `/team`, `/friends` | `<Navigate to="/tracker">` | — |
| `*` | LandingPage (catch-all) | ❌ |

Auth ✅ = trang tự hiện empty/login state khi guest (không có route guard tập trung).

---

## Archived / Removed

Không còn là tính năng đang chạy. Giữ lại đây để không ai mô tả chúng như đang hoạt động.

| Tính năng | Trạng thái |
|-----------|-----------|
| 🤝 **Team Mode** (`/team`) | Huỷ v3.0.0, code xoá hẳn v4.25.0 (`TeamPage.jsx`, `useTeam.js`, `team/*` — lấy lại được từ git history). Route redirect `/tracker`. Bảng `teams`/`reactions`/`partner_queue` **chưa từng** tồn tại trong schema |
| 👥 **Friends** (`/friends`) | Archived v3.0.0, code xoá hẳn v4.25.0 (`FriendsPage.jsx` — lấy lại được từ git history). Route redirect `/tracker`. Bảng `friendships` còn trong schema nhưng không hook nào dùng — an toàn để DROP |
| 📋 **Habits Page** (`/habits`) | Gộp vào TrackerPage v1.9.0, file xoá v2.2.1. Route redirect `/tracker` |
| 🏋️ **Fitness Log / Sức Khỏe** (tab 5 của `/tracker`) | Xoá v4.26.0 — `useFitnessLog.js`, tab TrackerPage, card Dashboard, XP `fitness_done` (lấy lại được từ git history). Bảng `fitness_logs` **còn** trong schema, không hook nào dùng — an toàn để DROP. Row `activity_logs` với `action='fitness_done'` cũ vẫn còn, vẫn hiện trên heatmap Life Log |
| 😊 **Mood Log** | Bỏ v4.10.1 (`useMoodLog` + bảng `mood_logs`). Chỉ còn `useSkipReasons` (§10) |
| 🔗 **Inbox Link Preview** | Bỏ v4.23.0 cùng với `api/meta.js`. Inbox chỉ tự detect URL, không fetch metadata |
| 📊 **DailyReview widget** | Xoá v4.7.1 để giảm UI clutter |
| ⚡ **Energy Tag + Duration Estimate** (task) | Thay bằng `priority` v4.9.0, cột DB đã DROP |
| 🎚 **"Dạng Drive" media option** | Xoá v4.23.0 — Drive URL mặc định render audio player |
| 📤 **`useFileUpload` hook** | Xoá v4.22.0 (dead code, chưa từng được import) |
