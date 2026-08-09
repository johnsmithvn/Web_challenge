# FEATURES.md — Life Hub (Personal Life OS)
**Version:** v6.2.0
**Updated:** 2026-08-09
**Rule:** File này PHẢI được cập nhật mỗi khi thêm hoặc sửa tính năng.

**Cấu trúc file:** §1–§27 = tính năng **đang chạy**, số thứ tự duy nhất và tăng dần.
Cuối file: `Data Architecture` → `Routes` → **`Archived / Removed`**.
Tính năng đã bỏ KHÔNG được để lẫn trong phần active — chuyển xuống bảng Archived kèm version.

---

## Tổng Quan Hệ Thống

**Life Hub** là Personal Life OS cho **một người dùng**: Inbox thu gom, Nhiệm vụ, Knowledge Base,
Chi tiêu, Incubator và Focus Timer. Hỗ trợ cả chế độ guest (in-memory) lẫn đồng bộ cloud (Supabase).

> **v5.0.0 đã gỡ hẳn** toàn bộ phần gamification 21 ngày: Habit tracker, Lộ Trình, Dashboard, Quiz,
> Bảng Xếp Hạng, Daily Challenge, Life Log, Hành Trình cảm xúc. Chi tiết từng đợt ở
> `docs/TASKS.md` § KẾ HOẠCH DỌN MODULE.

---

## 1-2. ~~🗓 Tracker 21 Ngày~~ + ~~⚙️ Custom Habit Manager~~ — ĐÃ GỠ HẲN (v5.0.0)

Đợt 4 của kế hoạch dọn module — đợt lớn nhất.

Xoá: `TrackerPage.jsx` (886), `HabitManager.jsx`, `useHabitStore.js`,
`useCustomHabits.js`, `useHabitLogs.js`, `tracker.css`, `data/habits.json`,
`CompletionModal.jsx` + `completion.css`, `LoginNudgeModal.jsx`. Route `/tracker`
và `/habits` giờ redirect về `/tasks`.

SQL: `DROP TABLE progress, habits, habit_logs`.

## 3. ⏱ Focus Timer — Pomodoro (`/focus`)

**Files:** `src/pages/FocusPage.jsx`, `src/components/FocusTimer.jsx`, `src/hooks/useFocusTimer.js`

**Mô tả:** Pomodoro timer 25/5/15, gắn session với habit, log lịch sử tập trung.

**Chi tiết:**
- **SVG Ring Countdown:** Vòng tròn countdown theo thời gian, màu đổi theo phase (focus/nghỉ ngắn/nghỉ dài)
- **3 Phases:** Work (25p mặc định) → Short Break (5p) → Long Break (15p, sau 4 sessions)
- **Custom settings:** Điều chỉnh thời gian bằng slider, lưu localStorage (`vl_focus_settings`)
- **Session Stats hôm nay:** Số sessions + phút tập trung
- **Lịch sử sessions:** 10 sessions gần nhất kèm thời gian
- **Notification:** Browser notification khi hết giờ (cần cấp quyền)
- **DB Sync:** Supabase-first (v1.6.2). Guest dùng in-memory
- **Focus XP (v1.3.1):** +15 XP mỗi session hoàn thành, deduped qua Supabase

> **v5.0.0:** bỏ toàn bộ phần gắn habit/lộ trình — picker chọn habit, breakdown
> theo habit, auto-tick habit khi đủ giờ, và 2 cột `focus_sessions.habit_id` /
> `journey_id`. Pomodoro giờ đứng độc lập.

---

## 4. ~~📈 Dashboard Cá Nhân~~ — ĐÃ GỠ HẲN (v5.0.0)

Xoá `DashboardPage.jsx` (586) + `dashboard.css`. Route `/dashboard` redirect về
`/tasks`. Sau khi bỏ Habit và XP-từ-habit thì trang chỉ còn lặp lại thứ Finance
và Focus đã có trang riêng.

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

**XP Events (v5.0.0 — còn 2):**
| Event | XP | Điều kiện |
|-------|-----|----------|
| Hoàn thành nhiệm vụ | +10 | Dedup theo `taskId`; bỏ tích → `removeXp` |
| Focus Session | +15 | 1 lần/session (deduped by `meta.sessionId`) |

> Nguồn: `XP_REWARDS` trong `useXpStore.js`; `FOCUS_XP` trong `useFocusTimer.js`.

**v5.0.0 — XP đổi nguồn.** Trước đây XP thuộc về Habit (tick habit, streak
3/10/21, Daily Challenge, Quiz). Cả 4 nguồn đó đã gỡ, nên **hoàn thành Nhiệm vụ
trở thành nguồn XP chính** — đảo lại quyết định cũ "Task cố ý không tính XP" ở
§16. Dòng `xp_logs` cũ với các reason đã bỏ **vẫn nằm trong DB và vẫn cộng vào
tổng XP**: bảng append-only, cố ý không dọn, nên level của bạn không tụt sau đợt
dọn module.

**XpBar:** Hiển thị compact trên Navbar (chỗ duy nhất còn dùng).

---

## 7-8. ~~🧠 Quiz Tâm Lý~~ + ~~🏆 Leaderboard~~ — ĐÃ GỠ HẲN (v5.0.0)

Đợt 3 của kế hoạch dọn module.

- **Quiz** (`/quiz`, `QuizPage.jsx`, `quiz.css`, `data/quiz.json`) — 10 câu trắc nghiệm tâm lý
  hành vi, thưởng XP theo điểm. Thuộc bộ gamification của sản phẩm "21 ngày" cũ.
- **Leaderboard** (`/leaderboard`, `LeaderboardPage.jsx`, `leaderboard.css`) — bảng xếp hạng
  streak + XP giữa các user. Đây là tính năng **xã hội** trong một app 1 người dùng → giá trị 0.
- **SQL đi kèm:** `DROP FUNCTION get_leaderboard()` + `DROP TABLE streaks`. Bảng `streaks` vốn đã
  chết từ lâu — chỉ được INSERT đúng 1 lần lúc signup, không nơi nào UPDATE, nên
  `current_streak`/`longest_streak` luôn = 0 với mọi user. INSERT trong `handle_new_user()` cũng
  đã gỡ.
- `XP_REWARDS.quiz_complete` xoá khỏi `useXpStore.js`.

---

## 9. 📅 Monthly Calendar

**File:** `src/components/MonthCalendar.jsx` + `src/styles/calendar.css`
**Dùng ở:** `/tasks` tab 📅 Lịch (v4.29.0)

**Mô tả:** Lịch tháng inline hiển thị task theo ngày.

**Chi tiết:**
- Navigate tháng prev/next + nút "Hôm nay"
- **1 query cho cả tháng** (`getCompletedTasksRange`), group theo ngày **địa
  phương** ở client. Click ngày chỉ filter mảng đã fetch — không fetch thêm
- **Ô các ngày cao bằng nhau (v6.1.0):** `grid-auto-rows: 124px`, ô trống bỏ `aspect-ratio: 1`
  (trước đây ô trống bị ép vuông theo bề rộng cột nên hàng đầu cao gấp 3 hàng khác). Ngày thường
  hiện **tối đa 4 chip**, ngày lễ tối đa **3 chip** để chừa một dòng tên lễ; `+N nữa…` tính theo
  đúng giới hạn của từng ô. Chip xanh (đã xong) và chip tím (sắp tới) đứng CHUNG 1 danh sách —
  trước đây ngày vừa có việc xong vừa có việc sắp tới thì chip tím bị nuốt hẳn
- **Âm lịch + ngày lễ (v6.1.0):** mỗi ô hiện số ngày âm nhỏ ở góc phải (mùng 1 hiện `1/7`), tính
  bằng `src/utils/lunarUtils.js` (thuật toán Hồ Ngọc Đức/Meeus, không thêm thư viện, có self-check
  trong `npm test`). Ngày lễ lấy từ `src/data/holidays.json` (11 lễ dương + 11 lễ âm) → ô tô vàng,
  hiện **tên lễ ngay trong ô** dưới nội dung task và không đè ngày âm; panel chi tiết ngày vẫn hiện
  huy hiệu **Âm lịch d/m** và **tên ngày lễ** đầy đủ
- **Hôm nay (v6.1.0):** viền tím + số ngày nằm trong viên tròn tím đặc (trước là viền cyan, dễ lẫn
  với ô đang chọn)
- **Light mode (v6.1.0):** nav button, khung thống kê, panel chi tiết, viền ô, ngày chưa tới và chip
  đều có override `[data-theme="light"]` — trước đây toàn `rgba(255,255,255,…)` nên vô hình trên nền sáng
- Ngày quá khứ không có task xong là **transparent, không tô đỏ**
- Stats: X task xong / X ngày có việc xong / TB mỗi ngày
- Click ngày → panel chi tiết: 1 danh sách gộp task đã xong + task sắp tới, expand
  mô tả, giờ hoàn thành, nút xoá

> **v5.0.0: bỏ hẳn "habit mode"** (prop `habitData` + `skipLog`). Người gọi duy
> nhất là `TrackerPage`, đã xoá. Đúng như comment cũ dự liệu: cắt feature habit
> thì xoá nhánh habit là xong, không có prop cấu hình nào phải dọn.

---

## 10-12. ~~📝 Skip Reasons~~ + ~~🔔 Notification Reminder~~ + ~~📊 Daily Challenge~~ — ĐÃ GỠ HẲN (v5.0.0)

Cả ba đều chỉ sống bên trong `TrackerPage`, chết theo nó ở đợt 4.

- **Skip Reasons** — `useMoodSkip.js`, bảng `skip_reasons`. Lý do bỏ habit hôm nay.
- **Notification Reminder** — `NotificationSettings.jsx`, `useNotifications.js`.
  Nhắc "chưa tick streak hôm nay". Lưu ý: đây **không phải** thông báo nhắc hạn
  Nhiệm vụ — cái đó chạy độc lập qua Service Worker (`public/sw.js` + `SYNC_TASKS`
  trong `useUserTasks`) và **vẫn hoạt động**.
- **Daily Challenge** — `DailyChallenge.jsx`, `daily.css`, `data/challenges.json`.

## 13. 👋 Onboarding Modal (v1.3.0 → viết lại v5.0.0)

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

## 14-15. ~~🗺 Lộ Trình~~ + ~~🗺 Journey Detail~~ — ĐÃ GỠ HẲN (v5.0.0)

Chương trình 21 ngày. Xoá `JourneyPage.jsx`, `JourneyDetailPage.jsx` (608),
`useJourney.js`, `JourneyContext.jsx`, `src/components/journey/*` (5 file),
`journey.css` (800), `data/programs.json`. Route `/journey` + `/journey/:id`
redirect về `/tasks`.

SQL: `DROP TABLE programs, program_habits, user_journeys, journey_habits` +
bỏ seed 5 lộ trình mẫu.

`JourneyContext` từng bọc toàn bộ App và bị 4 hook import — đây là lý do Habit và
Lộ Trình **bắt buộc** phải gỡ cùng một đợt.

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
  - **Tab 📅 Lịch** — việc **ĐÃ** xong theo ngày. Reuse `MonthCalendar`: ô ngày hiện **chip tên task**, bấm ngày → list task đã xong + expand mô tả + giờ hoàn thành.
  - **Dải màu priority** 3px bên trái mỗi task card, màu từ `PRIORITY_OPTIONS` — quét mắt thấy ngay cái nào gấp.
  - **Animation tick** thuần CSS (`::after` + `:active` + `--transition-spring` + `--shadow-green`), không cần state React. Có escape `prefers-reduced-motion`.
  - **Empty state** có icon + tiêu đề, không còn là dòng text trơn.
- **1 query/tháng thay 30 (v4.29.0):** `getCompletedTasks(dateStr)` → `getCompletedTasksRange(start, end)`. Calendar fetch 1 lần/tháng rồi group theo ngày **địa phương** ở client — vừa bớt N+1, vừa sửa luôn lỗi lệch ngày do `completed_at` được so sánh theo UTC.
- **Cố ý KHÔNG làm:** week/day time-grid kiểu Google Calendar. `due_time` mặc định `23:59` nên mọi task sẽ dồn vào 1 hàng đáy — phần đắt nhất của GCal (cột giờ, thuật toán xếp event chồng, drag-resize) không đem lại gì cho dữ liệu all-day. Cũng không làm Board/Gantt/assignee/custom field (xem `docs/TASKS.md`).
- **Add form:** Tên (required), mô tả (optional), ngày (default hôm nay), giờ (optional)
- **Task card:** Checkbox + title + badge hạn/ưu tiên/liên kết. **Bấm thân task bung mô tả tại chỗ**;
  nút con mắt mở Task Detail Modal nên mỗi vùng chỉ có một nghĩa. Trên mobile có item **Chi tiết**
  trong menu hành động.
- **Task Detail Modal (v5.0.0)** — `src/components/TaskDetailModal.jsx` + `src/styles/task-detail.css`:
  - Mặc định đọc field (hạn chót, độ ưu tiên, lặp lại, tag, bài viết liên kết, thời điểm hoàn thành,
    tạo lúc, cập nhật lúc) + full mô tả. Nút **Sửa** chuyển ngay nội dung popup sang đúng form edit
    của `TaskListSection`; không đóng popup, không navigate về list và không tạo đường ghi DB mới.
    Hủy sửa quay lại detail. Xoá/Hoàn thành vẫn uỷ quyền về handler sẵn có.
  - **Tab 🕘 Hoạt động** — lịch sử thay đổi kiểu Jira, mỗi dòng 1 field: "Đổi Hạn chót: 05/08/2026 →
    10/08/2026". Nhóm theo ngày (Hôm nay / Hôm qua / dd/MM/yyyy), mới nhất trước. Giá trị dài (mô tả)
    cắt 80 ký tự + nút "Xem thêm". Có nút 🗑 xoá từng dòng (qua `useConfirm`).
  - **Tab 📝 Ghi chú** — ghi chú cá nhân theo thời gian ("đã xong nhưng chưa đúng tiến độ" → sau đó
    "đã xong hết"), ô nhập ở TRÊN CÙNG (Ctrl+Enter lưu), đọc xuôi theo thời gian. Sửa được inline +
    xoá được. Đây KHÔNG phải comment kiểu team (app 1 người).
  - Cả 2 tab dùng chung 1 lần fetch `getTaskLogs(taskId)`; badge đếm có ngay không cần query thứ hai.
  - Mở được từ cả task pending lẫn task đã hoàn thành. Task lịch sử chỉ có 5 cột nên lưới field **tự
    ẩn hàng thiếu** thay vì hiện `—` sai sự thật.
  - Guest: hiện "Đăng nhập để xem lịch sử và ghi chú" (RLS bắt buộc `auth.uid()`).
- **Tick hoàn thành** → lưu `completed_at`; `completedList` nhận cùng timestamp bằng optimistic
  update nên hàng vừa xong xuất hiện ngay trong filter hiện tại, rollback cùng task nếu ghi DB lỗi
- **Khối "Đã hoàn thành" (v6.1.0)** — hộp bo góc RIÊNG, nằm ngoài card danh sách, viền + chữ xanh lá:
  - **Lọc theo khoảng ngày A→B.** 7 preset tính lùi từ hôm nay (Hôm nay / Hôm qua / 7 ngày / 2 tuần /
    3 tháng / 6 tháng / 1 năm) + 2 ô Từ–Đến (`DatePickerPopover`, tự kẹp `from <= to`). Mới nhất
    trước; khoảng nhiều ngày thì "Xong lúc" kèm cả ngày.
  - Hàng đã xong: bo góc xanh lá, **không gạch ngang**, "Xong lúc …" là huy hiệu xanh nổi bật, nút
    chữ **Xóa** (thay icon 🗑).
  - **Bấm vòng tròn ✓ = bỏ hoàn thành** (`uncompleteTask` — có sẵn trong hook từ v5.0.0 nhưng tới
    v6.1.0 mới có đường vào từ danh sách). Hover đổi đỏ để báo trước. Task của ngày CŨ không nằm
    trong `tasks` state nên bỏ tích chỉ làm nó rời khối này; nó về danh sách pending ở lần fetch kế.
- Sau ngày hôm đó → task biến mất khỏi danh sách chính
- **Layout full-bleed (v6.1.0):** `/tasks` bỏ khổ đọc 900px, chiếm trọn bề ngang lẫn bề dọc body
  (`min-height: 100dvh`, mobile trừ top bar + bottom tabs). Nút **Thêm** đứng cùng hàng 2 tab
  Danh sách/Lịch nhưng dạt mép phải — `showForm` vì thế nâng lên `TasksPage` và truyền xuống bằng prop.
- **Header nhóm rõ hơn (v6.1.0):** Hôm nay / Sắp tới trước đây `0.75rem --text-muted` gần như tàng
  hình; nay cùng cỡ với Quá hạn, mỗi nhóm một màu vai trò + số đếm dạng huy hiệu. Ô tick vuông → tròn,
  thêm vạch `|` ngăn tick ↔ nội dung, tiêu đề gói trong 1 dòng (ellipsis).
- **Hàng task 1 dòng (v6.1.0):** toàn bộ nhãn (ngày, giờ, quá hạn, lặp, ưu tiên, KB, tag) nằm CÙNG
  hàng với tiêu đề; dưới 820px mới xuống dòng. Nút hành động dùng `.task-act-btn` (ô 30px, icon
  Phosphor `weight="bold"`) thay cho icon mờ `opacity: 0.5`.
- **Bấm thân task = bung mô tả tại chỗ (v6.1.0)** — đảo lại quyết định của v5.0.0. Popup Chi tiết
  giờ đi bằng **nút con mắt** riêng nên 1 click không còn 2 nghĩa. Ô nhập mô tả (form Thêm + Sửa)
  tự cao theo nội dung bằng `field-sizing: content`.
- **Overdue Triage (v3.5.0):** Task list chia 3 khối: ⚠️ Quá hạn (nền đỏ, nút 🔄 Dời sang hôm nay) / 📅 Hôm nay / 🔮 Sắp tới (collapsed). Bắt user đối mặt và dọn dẹp backlog.
- **Rollover (v3.5.0):** Nút 🔄 trên overdue task → `updateTask(id, { due_date: today })` → task chuyển sang section Hôm nay.
- **Priority (v4.9.0):** Thay thế Energy Tag + Duration Estimate của v3.6.0. `priority SMALLINT` 0=None / 1=Lowest / 2=Low / 3=Medium / 4=High / 5=Urgent (`PRIORITY_OPTIONS` trong `TaskListSection.jsx`). Badge màu trên task card khi `priority > 0`. Cột `energy_level` + `duration_est` đã bị DROP khỏi schema.
- **Recurring Tasks (v3.6.0 → v4.31.0):** Toggle 🔁 Lặp lại: Mỗi N ngày / Hàng tuần thứ X / Hàng tháng ngày Y. Khi tick xong task recurring → task cũ ở lại "Hoàn thành hôm nay" (dopamine hit) → task mới insert ẩn với `due_date` tương lai (đã fix clamp cuối tháng — ngày lặp không tồn tại ở tháng đích thì rơi vào ngày cuối tháng đó, không tràn sang tháng sau nữa). Tag + link KB của task cũ được copy sang occurrence mới (best-effort, không rollback task chính nếu bước copy lỗi). Chống sinh trùng: nếu task đã có occurrence tiếp theo rồi (tích/bỏ tích/tích lại nhanh) thì không sinh thêm. Sinh task lỗi hẳn sau khi hết retry → báo lỗi qua toast (trước đây chỉ log console, user không biết chuỗi lặp đã chết).
  - **Quan hệ chuỗi (`recurrence_parent_id`, v4.31.0):** mỗi task lặp lưu lại "được sinh ra từ task nào". **Sửa** 1 task trong chuỗi không bao giờ đụng task khác đã tồn tại (chỉ ảnh hưởng occurrence tương lai chưa sinh). **Xoá** task **gốc** (chưa từng được sinh ra) → chỉ xoá đúng nó, chuỗi phía sau giữ nguyên. Xoá task **không phải gốc** (tự nó được sinh ra) → xoá luôn toàn bộ hậu duệ phía sau. **Bỏ tích** 1 task → tự xoá occurrence nó đã sinh ra (kèm hậu duệ xa hơn nếu có), tránh trùng khi tích/bỏ tích nhiều lần — có toast báo.
  - Logic thuần (tính ngày kế tiếp + tính chuỗi cần xoá) tách ra `src/utils/recurrenceUtils.js`, unit test ở `src/__tests__/recurrenceUtils.test.js` (`npm test`).
- **DB columns:** `priority SMALLINT`, `recurrence_rule JSONB` trên `user_tasks`.
- **Calendar integration:** Tab Lịch → click ngày → 1 danh sách "Nhiệm vụ ngày này" gồm cả task đã
  hoàn thành ngày đó (expandable description + giờ hoàn thành, có nút xoá) và task sắp tới/chưa hoàn
  thành due ngày đó. Chip xanh = đã xong, tím = sắp tới; ngày lễ giảm 4→3 chip để tên lễ luôn còn chỗ.
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

## 17. ~~💛 Hành Trình Cuộc Đời~~ — ĐÃ GỠ HẲN (v5.0.0)

Biểu đồ cảm xúc theo tuổi (SVG Catmull-Rom). Xoá `LifeJourneyPage.jsx`, `useLifeJourney.js`,
`life-journey.css`, route `/life-journey`, mục Navbar. Đợt 1 của kế hoạch dọn module — cô lập hoàn
toàn, 0 phụ thuộc chéo, 0 bảng Supabase.

⚠️ Dữ liệu cột mốc nằm ở localStorage `vl_life_journey_events` + `vl_journey_title`. Xoá code
KHÔNG xoá localStorage — dữ liệu vẫn nằm trong trình duyệt nhưng không còn đường vào. Muốn lấy lại:
`git revert` hoặc đọc thẳng key đó trong DevTools.

---

## 18. 📥 Inbox (`/inbox`)

**File:** `src/pages/InboxPage.jsx` + `src/styles/inbox.css`
**Hook:** `src/hooks/useCollections.js`, `src/hooks/useActivityLog.js`

**Mô tả:** Nơi ghi nhanh mọi thứ (link, ý tưởng, ghi chú) — phân loại sau. Trạm triage với luồng chuyển đổi nhanh.

**Chi tiết:**
- Quick-add form (text input + submit)
- Inbox items list với thời gian tạo
- Classify action: phân loại nhanh qua `<select>` dropdown (lấy dữ liệu tĩnh từ `knowledge.json`)
- **📌 Task action:** Chuyển inbox item thành Task (v3.0.1)
- **✓ Xong nhanh (v4.20.0):** Nút "✓ Xong" trên mỗi inbox item và trong Reader view. Nhấp vào sẽ tự động chuyển item thành Task, đánh dấu hoàn thành (completed) trong ngày hôm nay ngay lập tức, ghi nhận vào activity log (`task_done`), và xoá/dọn dẹp item đó khỏi inbox.
- **💸 Giao dịch (v6.0.0):** Chuyển sang module Chi tiêu › Nhập nhanh, prefill (regex bóc số tiền), giao dịch tạo ra mang `inbox_item_id`; module xoá item Inbox sau khi ghi. Handoff qua `sessionStorage lh_inbox_to_finance` kind `tx`.
- **🔁 Hóa đơn (v6.0.0):** Chuyển sang Chi tiêu › Hóa đơn (segment Phải trả), prefill tên. Kind `out`.
- Delete action
- **🕔 Snooze (v3.8.0):** Ẩn inbox item tạm thời. 4 options: 1 tuần / 2 tuần / 1 tháng / 3 tháng. Badge "🕔 X snoozed" trong header.
- **··· Overflow Menu (v4.0.1, cập nhật v6.0.0):** 2 primary buttons (📌 Task + 🗑) luôn hiện. Actions phụ (📂 Phân loại, 💸 Giao dịch, 🔁 Hóa đơn, 🥚 Ấp Trứng, 🕔 Snooze) gom vào dropdown ···. Click-outside auto-close.
- **📊 Filter Chips (v4.3.0):** 3 chip lọc: Tất cả / Có URL / Gần đây (7 ngày). Client-side filtering trên data đã fetch. Smart empty state khi không có item khớp.
- Tự động detect URL
- Empty state khi inbox trống

- **Data source:** `collections` table (Supabase, type='inbox'), `knowledge.json` cho danh sách phân loại. Giao dịch/Hóa đơn tạo ở module Finance (handoff).

---

## 19. 🏷️ Tags — Hệ Thống Trung Tâm (v3.7.0)

**Added:** v3.7.0
**Files:** `src/hooks/useTags.js`, `src/components/TagPicker.jsx`
**DB:** `tags`, `finance_transaction_tags` (v6.0.0), `collection_tags` (§27), `task_tags` (v4.31.0)

**Mô tả:** Hệ thống tag trung tâm dùng chung cho giao dịch (v6.0.0), collections (§27) và tasks
(v4.31.0). Từ v6.2.0, tag của Vault nằm trong ciphertext của từng item nên không tham gia hệ tag
plaintext dùng chung.

**Chi tiết:**
- `useTags` hook: fetchTags, addTag (upsert), deleteTag, linkTag, unlinkTag, `getTagUsageBreakdown` — `ENTITY_CONFIG` hỗ trợ `finance`, `collection`, `task`
- `TagPicker` component: searchable dropdown, multi-select toggle, inline tạo tag mới bằng Enter
- Tích hợp vào module Finance (chi tiết giao dịch), CollectPage (§27), TaskListSection
- Tags link qua junction tables (finance_transaction_tags, collection_tags, task_tags)
- Task dùng optimistic wrapper riêng (`linkTaskTag`/`unlinkTaskTag` trong `useUserTasks.js`) thay vì gọi `useTags.linkTag` trực tiếp — cần sync state `task._tags` ngay để hiện badge, `useTags` không giữ state đó
- RLS policies đảm bảo user chỉ thấy tags của mình

---

## 20. ~~📅 Cashflow Calendar~~ — ĐÃ GỠ (v6.0.0)

`CashflowBar.jsx` đã xoá cùng module Finance cũ. Chức năng "nhịp chi / lịch nghĩa vụ" thay bằng
biểu đồ **Nhịp chi** ở màn Tổng quan và countdown ở màn Hóa đơn của module Finance mới (§23).

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
    - 💰 Ghi nhận Chi tiêu → `useFinance().addTransaction()` (v6.0.0) + dropdown nhóm chi
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

**Data source:** `intentions` + `intention_logs` (Supabase). Cross-module: `finance_transactions` (v6.0.0), `user_tasks`

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
- **DB:** `knowledge_groups`/`collection_groups` đã **DROP** (2026-08-02); `tags.emoji`/`tags.description` (thêm tạm ở bước gộp) cũng đã **DROP** vì không còn UI nào đọc. Xem `data/RUNBOOK.sql` Phần 3.
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

## 23. 💰 Finance / Chi tiêu (`/finance`) — làm lại v6.0.0 (thiết kế Nocturne)

**File:** `src/pages/FinancePage.jsx` (module shell + child bar trong sidebar chính) + `src/components/finance/*` (5 màn + `parts.jsx`) + `src/styles/finance.css` + `src/styles/finance-handoff.css`
**Hook:** `src/hooks/useFinance.js` (một hook cho 10 bảng + junction) · **Logic thuần:** `src/utils/financeLogic.js` (+ test) · **Content:** `src/data/finance-categories.json`
**Thiết kế đầy đủ:** `docs/DESIGN_FINANCE.md`

**Nguyên lý:** app **không tính số dư** (thu vẫn ghi nhưng không là mẫu số của tỉ lệ nào); **một
bảng giao dịch, mọi báo cáo = đếm lại lọc theo `occurred_at`**; **app không trả hộ — chỉ nhắc, tới
ngày user bấm ghi ra một giao dịch mang FK trỏ về quy tắc**. 50/30/20 tính trên **hạn mức tự đặt**.

**Điều hướng:** child sidebar lồng trong app (desktop) / sub-tab ngang (<760px), 5 màn:
- **Tổng quan:** một màn có ba tab Tổng quan / Ngân sách / Thống kê. Tổng quan gồm cảnh báo thẻ tới hạn · picker tháng/năm (tháng bất kỳ / Cả năm / Tất cả, ‹ › kỳ trước/sau, **chung state với Giao dịch**) · 4 chỉ số (đã chi / so kỳ trước / TB ngày / phần cố định %) · donut "Tiền đi đâu" (legend bấm được) + "Bắt buộc đến đâu" (must/need/want) · nhịp chi (đổi đơn vị ngày↔tháng theo kỳ) · khoản lớn nhất · quỹ tiết kiệm. Ngân sách ghim tháng chạy, có vòng tiến độ, ngưỡng cố định 50/30/20 của tổng hạn mức, hạn mức nhóm sửa được, quỹ + bảng nơi gửi, ngày đáo hạn tự tính, khóa kỳ hạn/rút chờ 48 giờ và hiệu chỉnh từ 5 tháng trọn. Thống kê có bộ chọn 3/6/12 tháng và 4 chế độ danh mục / so sánh / hóa đơn / thẻ.
- **Nhập nhanh (phím N):** ô ngôn ngữ tự nhiên (NL_DICT 15 luật) · 5 shortcut (không chốt số tiền) · form (Chi/Thu/Để dành, nguồn tiền bắt buộc, mức cần thiết auto, **gắn Task**) · hộp "Cần bạn ghi" (hóa đơn `ask`) · cảnh báo trùng quy tắc.
- **Giao dịch:** bộ lọc kỳ chung + tìm + chip lọc · nhóm theo ngày thật (Hôm nay/Hôm qua/thứ) · nhãn `auto` · **cột chi tiết 340px** (sửa, gắn Task, tag, hiện nguồn Inbox) — ẩn hẳn <760px (bottom sheet).
- **Danh mục:** 11 nhóm chi + 7 nhóm thu; parent là tập đóng; editor mở ngay trong card và đẩy hàng dưới xuống (không popup), cho sửa/ẩn nhãn, màu, Phosphor icon, mức cần thiết, tính chất và danh mục con; tab Schema tài liệu đầy đủ.
- **Hóa đơn:** 4 segment — Phải trả (fixed/ask, trả góp), Sẽ nhận (không quá hạn), Khoản vay (interest/amort, gốc `excluded`), Thẻ (chốt≠đến hạn, float, lãi ước từ blended rate, cảnh báo phí).
**Liên kết:** giao dịch có FK `task_id` (gắn Task) và `inbox_item_id` (từ Inbox). Inbox → Giao dịch
(handoff `lh_inbox_to_finance` kind `tx`) và Inbox → Hóa đơn (kind `out`). Finance không có hàng
chờ duyệt Inbox tự động; chỉ xử lý mục người dùng chủ động gửi sang.

**Nhập tiền:** mọi ô tiền/số nguyên loại ký tự không phải chữ số ngay khi nhập; lãi suất/phần trăm
chỉ nhận số thập phân. Riêng ô ngôn ngữ tự nhiên tiếp tục dùng `parseCurrencyInput`
(`50`/`50k`/`89$`/`1.5m`, Auto-K, quy đổi USD).

**Data source:** 10 bảng `finance_*` chính + `finance_transaction_tags` (11 bảng Finance, Supabase, auth-gated). Taxonomy mặc định từ JSON và phần người dùng sửa ở `finance_category_overrides`. Xem DATABASE.md.

**Icon:** toàn app dùng `@phosphor-icons/react` qua `AppIcon`; không dùng emoji làm icon UI.

🔜 Hoãn: tự sinh task nhắc từ nghĩa vụ; activity_logs khi trả.

---

## 24. ~~📅 Life Log~~ — ĐÃ GỠ HẲN (v5.0.0)

Route `/life-log`, `LifeLogPage.jsx`, `ActivityHeatmap.jsx`, `lifelog.css` đã xoá; mục Navbar và
KPI "🔥 Hoạt động hôm nay" trên Dashboard cũng gỡ theo. Lý do: heatmap chỉ **đếm số dòng
`activity_logs`** chứ không đọc nội dung, nên nó là người dùng duy nhất của các dòng "sự kiện rời
rạc". Gỡ Life Log → gỡ luôn 11 điểm ghi `logActivity` ở Inbox/Finance/DailyChallenge và insert trực
tiếp trong `useFocusTimer`, nếu không sẽ thành ghi-mà-không-ai-đọc.

`activity_logs` giờ **chỉ phục vụ Task** (lịch sử thay đổi + ghi chú, xem §16). Lấy lại được từ git
history nếu đổi ý.

---

## 25. 🔔 Sidebar Widgets

**Files:** `src/components/SubAlert.jsx` + `src/styles/widgets.css`

**Mô tả:** Widget nhỏ gắn trong sidebar Navbar, tự động ẩn khi không có data.

**Chi tiết:**
- **SubAlert (cập nhật v6.0.0):** Nhắc nghĩa vụ tài chính sắp tới hạn (hóa đơn `finance_bills` + thẻ `finance_cards`, ≤7 ngày) + đếm ngược. Urgent style khi ≤2 ngày.

> **Note:** `DailyReview` widget đã bị xóa v4.7.1 để giảm UI clutter.

**Data source:** SubAlert → `finance_bills` + `finance_cards` (v6.0.0)

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
| Finance | `finance_transactions` + 8 bảng `finance_*` (v6.0.0) | — (cần login, cố ý không có guest mode) |
| Incubator | `intentions`, `intention_logs` | — (cần login) |
| Vault | `accounts` (ciphertext/item) + `vault_config` (wrapped DEK/user) | — (cần login, cố ý không có guest mode) |
| Notifications | `notification_settings` + `vl_notif_settings` | localStorage |
| Life milestones | `vl_life_journey_events` (localStorage-only) | localStorage |

---

## Routes

| Route | Page | Auth |
|-------|------|:---:|
## 28. 🏠 Trang chủ (`/`) — viết lại v5.0.0

**Files:** `src/pages/LandingPage.jsx` + `src/styles/landing.css`

**Mô tả:** Cửa vào app. **Không phải landing marketing** — bản cũ (v2.x, 923 dòng qua 7 section:
Hero typewriter, Problem, Knowledge, Roadmap, demo Tracker, Reverse, Testimonials, Pricing) quảng
cáo sản phẩm "Thử Thách Vượt Lười 21 ngày" đã không còn tồn tại; kèm đánh giá bịa và bảng giá cho
một app không bán.

**Chi tiết:**
- **Hero:** tên + 1 câu mô tả + CTA. Chưa đăng nhập → nút mở `AuthModal` + link "Dùng thử không cần
  tài khoản" (kèm cảnh báo dữ liệu guest chỉ nằm trong bộ nhớ tạm). Đã đăng nhập → vào thẳng Inbox.
- **Nút đổi theme riêng** (`.lp__theme`, fixed góc phải trên) — `Navbar` tự ẩn ở `/` khi chưa đăng
  nhập (`Navbar.jsx:154`) nên đây là lối duy nhất đổi sáng/tối trước khi login.
- **"Cách nó chạy":** 3 bước Ghi vào Inbox → Phân loại sau → Xử lý đúng chỗ.
- **"Có những gì":** lưới 6 card module (Inbox, Nhiệm Vụ, Knowledge, Finance, Incubator, Focus),
  mỗi card có dải màu riêng + 3-5 gạch đầu dòng mô tả thật. Card là `<Link>` đi thẳng tới module.
- **Cố ý KHÔNG liệt kê** Habit / Lộ Trình — đang chờ gỡ ở đợt 4 của kế hoạch dọn
  module (`docs/TASKS.md`). Quảng cáo chúng ở đây là viết để xoá lại.

**Data source:** không có — nội dung là 2 mảng hằng `FLOW` + `MODULES` ngay trong file.

---

| `/` | LandingPage (eager) | ❌ |
| `/inbox` | InboxPage | ✅ |
| `/collect` | CollectPage | ✅ |
| `/finance` | FinancePage | ✅ |
| `/incubator` | IncubatorPage | ✅ |
| `/settings` | SettingsPage | ✅ |
| `/focus` | FocusPage | ❌ |
| `/accounts` | AccountsPage (Vault mã hóa v6.2.0) | ✅ |
| `/tracker`, `/habits`, `/dashboard`, `/journey` | `<Navigate to="/tasks">` (route đã gỡ) | — |
| `*` | LandingPage (catch-all) | ❌ |

Auth ✅ = trang tự hiện empty/login state khi guest (không có route guard tập trung).

---

## 29. 🔐 Vault (`/accounts`) — v6.2.0 (full-content encryption)

**Files:** `src/pages/AccountsPage.jsx` · `src/components/AccountDetail.jsx` ·
`src/hooks/useAccounts.js` · `src/utils/vaultCrypto.js` · `src/utils/vaultLogic.js` (+ test) ·
`src/data/account-templates.json` · `src/styles/accounts.css`

**Mô tả:** Vault lưu **mọi thứ về một tài khoản**, không chỉ mật khẩu — dựng theo bản thiết kế
Keyplate. Một *item* gồm field theo loại, phương thức đăng nhập, sheet mã dự phòng và lịch sử thay
đổi. Chữ trên UI giữ **tiếng Anh** đúng bản thiết kế (khác phần còn lại của app).

**Mã hóa v6.2:** mỗi item là một JSON AES-256-GCM chứa `title`, `tpl`, `favorite`, `notes`,
`tags`, `fields`, `auth`, `codes` và `log`. PBKDF2-SHA256 600.000 vòng biến Vault
passphrase thành KEK; KEK chỉ dùng để mở DEK ngẫu nhiên riêng của user. Supabase chỉ giữ ciphertext,
nonce, version, owner/timestamps và DEK đã bọc trong `vault_config`; passphrase, KEK và DEK thô
không được lưu. AES-GCM AAD khóa config theo user và item theo user + item id để chặn tráo ciphertext.

**Trạng thái khóa:** user mới tạo passphrase riêng tối thiểu 12 ký tự; user cũ phải unlock trước khi
query/decrypt danh sách. Khóa thủ công, sign-out hoặc reload sẽ xóa DEK khỏi memory, xóa item khỏi
React state và không còn title/metadata nội dung trong DOM. Sai passphrase hoặc item hỏng không làm
thay đổi ciphertext; item hỏng bị bỏ khỏi danh sách và hiện cảnh báo.

**Bố cục (breakpoint 900px, xử lý hoàn toàn bằng CSS):**
- **Header:** brand "Keyplate · Vault 01" · ô search · nút New item.
- **Filter bar:** hàng chip **Types** (All / Favourites / 10 template theo mã) + hàng chip **#Tags**.
  Mỗi cell khai `grid-column`/`grid-row` tường minh vì nút Clear có điều kiện (không khai thì cả
  thanh nhảy layout khi Clear ẩn/hiện). Chip wrap ở desktop, cuộn ngang ở mobile.
- **Body 2 pane cuộn độc lập:** danh sách item (mã 3 chữ + tiêu đề + dòng phụ + ★) và chi tiết.
- **< 900px:** 1 cột, list và detail thành 2 màn hình, có nút `← All items`. React chỉ giữ
  `selectedId` + `screen`; **không** hook đo bề rộng, **không** resize listener.

**Pane chi tiết — 9 khối theo thứ tự đặc tả:** tiêu đề (kicker `<template> · <CODE>`, ★, Edit) →
**card preview** (chỉ item loại card; số thẻ mask tới khi reveal) → **Fields** → add-custom-field
(chỉ khi sửa) → **Sign-in methods** → **Single-use codes** + paste import (chỉ khi sửa) → **Notes**
→ **History** → footer meta ("Updated … · N fields · N sign-in methods" + Delete item).

**10 loại field** (`vaultLogic.TYPES`): `text` · `password` (mask, có **strength bar**, có nút
Generate dùng CSPRNG của Web Crypto) · `secret` (mask, **không** chấm điểm — PIN/CVV/số
giấy tờ) · `url` · `email` · `phone` · `multi` (nhiều giá trị, index 0 là primary) · `link` (**nhiều
link/field**, mỗi link mượn 1 giá trị của item đích) · `number` · `date`. `password` và `secret`
**không gộp** — đó là phân biệt sản phẩm dựa vào.

**Liên kết (`link`)** là điểm khác Bitwarden/1Password: một field trỏ tới **nhiều** item khác trong
vault, mỗi chip hiện mã 3 chữ + tiêu đề + giá trị mượn + `↗`, bấm là nhảy sang. Link tới item đã xoá
hiện chip xám **"Missing item / link broken"** (jsonb không FK — hành vi đặc tả, không phải lỗi).

**Phương thức đăng nhập** (9 kiểu: password/prompt/totp/passkey/sms/key/codes/email/oauth): mỗi item
nhiều phương thức, **đúng ≤1 primary** (hook hạ primary cũ trước). Bật/tắt/đặt-primary được ngay ngoài chế độ sửa và
**ghi log tức thì**. Thêm phương thức `codes` mà item chưa có sheet → tự sinh 10 mã.

**Sheet mã dự phòng dùng 1 lần:** hiện "N of M unused", Reveal/Copy sheet/Regenerate. Đánh dấu một
mã đã dùng → gạch ngang chạy 300ms + mờ ô + ghi log ngay. **Paste import** (khi sửa): dán khối text
từ nhà cung cấp, parser giữ khoảng trắng trong mã (Google `1234 5678` là MỘT mã), Replace/Append.

**Sửa inline + lịch sử:** "Edit" clone item vào draft cục bộ, mọi thao tác sửa draft, "Save changes"
đẩy lên. `diffLog` chạy **trong hook** (`useAccounts.saveItem`) — không có đường lưu mà không ghi
log. Log được lưu trong cùng ciphertext, giới hạn 500 entry/item; `diffLog` vẫn mask secret =
`•` × min(len,24) trước khi ghi. History hiện 4 dòng mới nhất + "Show all N".

**Tạo item:** New item → chọn 1 trong 10 template (LGN/ACC/CRD/IDN/NTE/API/WIF/DBS/SRV/LIC) → item
mới có sẵn bộ field + phương thức đăng nhập + sheet mã đúng theo template.

**Tìm & lọc:** search theo tiêu đề / tag / ghi chú / nhãn field / giá trị field **không phải
secret** (`matchesQuery`); filter theo template và theo tag.

**Tag:** tag Vault là chuỗi nằm trong ciphertext của item, không còn dùng `tags`/`account_tags`
plaintext. Ở chế độ sửa, `TagEditor` cho bật/tắt tag đã thấy trong các item đã giải mã và tạo tag
mới trong memory; save sẽ mã hóa lại cả item. Filter chỉ chạy sau unlock trên dữ liệu đã giải mã.

**UX của việc tạo item:** dialog **ở nguyên** trong lúc tạo, card được bấm hiện "Creating…", các
card khác disable (chặn double-click sinh 2 item). Xong thì mở item và vào **thẳng chế độ sửa**, con
trỏ chọn sẵn tiêu đề tạm để gõ đè. Danh sách sắp theo `updated_at` **giảm dần** nên item vừa
tạo/vừa sửa luôn ở đầu — đó cũng là lý do mỗi dòng có cột thời gian bên phải.

**Logo dịch vụ (`AccountAvatar.jsx`)** — ô 36px đầu mỗi dòng danh sách, 2 tầng tự rơi:
favicon của chính dịch vụ (`/apple-touch-icon.png` → `/favicon.ico`) → plate màu + chữ cái đầu
(hue hash từ tiêu đề nên cùng dịch vụ luôn cùng màu). URL suy từ **field `type='url'` đầu tiên**
của item, không cần cột riêng. **Không lưu ảnh** — hotlink lúc render; client không thể cache
favicon vì CORS chặn đọc byte ảnh cross-origin.
**Cố ý KHÔNG dùng dịch vụ favicon bên thứ ba** (`google.com/s2/favicons`, DuckDuckGo, Clearbit,
logo.dev): đây là vault, gửi cả danh sách domain mình có tài khoản cho một bên là tự khai mình
dùng dịch vụ nào. Nút **Logos** ở header bật/tắt việc gọi ảnh (`vl_acc_favicon`, mặc định tắt) —
khi tắt, trang không phát request favicon nào ra ngoài. Site không có icon → rơi về chữ cái, **console có
404 là bình thường, không phải bug**. Mã 3 chữ của template vẫn hiện dạng badge nhỏ cạnh tiêu đề.

**Data source:** `accounts` (một ciphertext/item) + `vault_config` (một wrapped DEK/user) trên
Supabase. **Không có guest mode** — chưa đăng nhập thì trang hiện lời nhắc đăng nhập.

**Chưa làm:** reset/recovery/đổi passphrase, export/restore, rotate DEK hoặc nâng version hàng loạt,
auto-lock timer, TOTP thật, clipboard auto-clear và dọn link mồ côi. Vì chưa có recovery/export,
không dùng Vault làm bản lưu duy nhất của bí mật không thể cấp lại.

---

## Archived / Removed

Không còn là tính năng đang chạy. Giữ lại đây để không ai mô tả chúng như đang hoạt động.

| Tính năng | Trạng thái |
|-----------|-----------|
| 🤝 **Team Mode** (`/team`) | Huỷ v3.0.0, code xoá hẳn v4.25.0 (`TeamPage.jsx`, `useTeam.js`, `team/*` — lấy lại được từ git history). Route redirect `/tracker`. Bảng `teams`/`reactions`/`partner_queue` **chưa từng** tồn tại trong schema |
| 👥 **Friends** (`/friends`) | Archived v3.0.0, code xoá hẳn v4.25.0 (`FriendsPage.jsx` — lấy lại được từ git history). Route redirect `/tracker`. Bảng `friendships` còn trong schema nhưng không hook nào dùng — an toàn để DROP |
| 📋 **Habits Page** (`/habits`) | Gộp vào TrackerPage v1.9.0, file xoá v2.2.1. Cả TrackerPage cũng gỡ ở v5.0.0; route giờ redirect `/tasks` |
| 🏋️ **Fitness Log / Sức Khỏe** (tab 5 của `/tracker`) | Xoá v4.26.0 — `useFitnessLog.js`, tab TrackerPage, card Dashboard, XP `fitness_done` (lấy lại được từ git history). Bảng `fitness_logs` đã **DROP** ở v5.0.0 (đợt 5). Row `activity_logs` với `action='fitness_done'` đã bị xoá ở v5.0.0 cùng Life Log |
| 😊 **Mood Log** | Bỏ v4.10.1 (`useMoodLog` + bảng `mood_logs`). Chỉ còn `useSkipReasons` (§10) |
| 🔗 **Inbox Link Preview** | Bỏ v4.23.0 cùng với `api/meta.js`. Inbox chỉ tự detect URL, không fetch metadata |
| 📊 **DailyReview widget** | Xoá v4.7.1 để giảm UI clutter |
| ⚡ **Energy Tag + Duration Estimate** (task) | Thay bằng `priority` v4.9.0, cột DB đã DROP |
| 🎚 **"Dạng Drive" media option** | Xoá v4.23.0 — Drive URL mặc định render audio player |
| 📤 **`useFileUpload` hook** | Xoá v4.22.0 (dead code, chưa từng được import) |
