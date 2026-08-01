# Báo Cáo Audit — Duplicate Source-of-Truth / Logic Trùng Lặp

> **Ngày:** 2026-08-01 · **Phiên bản:** v4.29.0 · **Phạm vi:** toàn bộ `src/`, `data/*.sql`
> **Phương pháp:** quét song song 4 góc (taxonomy/enum lệch JS↔SQL, business-logic copy-paste giữa hook/page,
> bypass component chung theo `docs/RULES.md`, mapping icon/màu/label dựng lại độc lập) — mỗi góc qua
> 1 bước xác minh đối kháng (skeptic đọc lại trực tiếp code, có quyền bác bỏ) trước khi vào báo cáo.
> **Không lặp lại** phát hiện đã fix (VD: `collections.type` `emotion`/`podcast` — đã xác nhận đúng trên
> prod 2026-08-01, xem `docs/TASKS.md` P0-1) hoặc đã tracked ở nơi khác (VD: `knowledge_groups` vs `tags`
> — P2-7, `parent_id` subtask 6 chỗ vỡ — đều đã ghi trong `docs/TASKS.md`).

---

## Tổng quan

**10 phát hiện xác nhận thật** — 3 cao · 6 trung bình · 1 phòng ngừa (chưa lệch, chỉ có rủi ro).
Tất cả đều đúng loại vấn đề: **1 sự thật (giá trị hợp lệ hoặc 1 phép tính) được giữ độc lập ở ≥2 nơi,
không có cơ chế đồng bộ tự động** — sửa 1 nơi mà quên nơi kia thì hỏng, thường hỏng âm thầm (không
exception, không lỗi build/lint).

| # | Phát hiện | Mức | Đang hỏng thật hay chỉ rủi ro? |
|---|---|---|---|
| D1 | `toISOString().split('T')[0]` (UTC) thay `toDateStr()` — 66 chỗ/21 file | 🔴 CAO | **Đang hỏng thật**, mỗi đêm 00:00–06:59 giờ VN |
| D2 | Enum chu kỳ subscription — giá trị + phép tính lặp ở ≥5 nơi, không hằng số chung | 🔴 CAO | Rủi ro cao, đã từng vỡ thật (v4.4.0) |
| D3 | `reset_user_data.sql` thiếu xoá `knowledge_groups` + `inspirational_quotes` | 🔴 CAO | **Đang sai thật** — "reset toàn bộ" nhưng để sót |
| D4 | Streak/longest-streak tính lặp giữa `useHabitStore` và `TrackerPage` | 🟠 TB | Rủi ro (audit 2026-06-27 đã ghi, vẫn còn) |
| D5 | Công thức "tuần bắt đầu Thứ Hai" viết lại ở 5 nơi | 🟠 TB | Rủi ro — hiện 5 bản khớp nhau |
| D6 | 6 nơi tự dựng modal thay `GenericModal` (kể cả nơi tự nhận đã migrate) | 🟠 TB | Đang tồn tại — UI không đồng nhất |
| D7 | `DashboardPage` tự dựng bảng màu category chi tiêu, keyed sai | 🟠 TB | **Đang sai thật** — luôn ra màu xám |
| D8 | `<input type="date">` native ở FinancePage thay `DatePickerPopover` | 🟠 TB | Đang tồn tại — UI không đồng nhất |
| D9 | `window.alert()` thứ 2 (IncubatorPage), chưa được ghi nhận | 🟠 TB | Đang tồn tại, vi phạm RULES.md |
| D10 | Enum `recurrence_rule.type` lặp ở 4 nơi (task lặp lại) | 🟡 phòng ngừa | Hiện khớp — chỉ là rủi ro tương lai |

---

## 🔴 Mức cao

### D1. `toISOString().split('T')[0]` (UTC) — 66 chỗ, 21 file, đang gây lệch ngày thật mỗi đêm
Dự án **đã có bug thật từ đúng anti-pattern này** trước đây (fix ở `MonthCalendar` bằng cách đổi sang
`toDateStr()`, ghi trong `docs/TASKS.md` v4.29.0). `src/utils/dateUtils.js:10-13` tự viết rõ:
`toISOString()` trả giờ UTC, ở GMT+7 khoảng 00:00–06:59 giờ VN nó lùi về **ngày hôm trước**; `toDateStr()`
là "hàm duy nhất trong repo sinh chuỗi ngày local" — có test-case chứng minh (`dateUtils.test.js:17-19`).
Nhưng còn **66 occurrence khác** vẫn dùng `toISOString().split('T')[0]` để tính "hôm nay", trong đó có
2 hook quyết định trực tiếp dữ liệu người dùng thấy:

- [useUserTasks.js:6,12,22,34](../src/hooks/useUserTasks.js#L6) — `todayStr()` dùng để chia
  `todayTasks`/`overdueTasks`/`futureTasks` ([:483-485](../src/hooks/useUserTasks.js#L483)) và trong
  `spawnRecurringTask`
- [useSubscriptions.js:32,42,51,160,161](../src/hooks/useSubscriptions.js#L32) — auto-advance + `getUpcoming`
- [useJourney.js:73,123,245,290](../src/hooks/useJourney.js#L73)
- [useHabitLogs.js:80,174](../src/hooks/useHabitLogs.js#L80)
- [useCollections.js:35,259](../src/hooks/useCollections.js#L35) — snooze-until
- [FinancePage.jsx:23-24,120](../src/pages/FinancePage.jsx#L23)

**Hỏng gì:** từ 00:00–06:59 giờ VN, `todayStr()` trả về **ngày hôm trước**. Task có `due_date` = hôm nay
thật sẽ thoả `due_date > today` (today bị lùi 1 ngày) → rơi vào `futureTasks` thay vì `todayTasks` — task
biến mất khỏi "Hôm nay" khoảng 7 giờ mỗi đêm, không có lỗi/exception nào hiển thị. Tương tự,
`useSubscriptions.js` dùng `today` bị lùi cho auto-advance (`sub.next_due > today` → bị skip) và cửa sổ
due-soon của `getUpcoming` — sub đến hạn đúng hôm nay trong khung giờ đó chưa được coi là quá hạn.

**Xử lý:** thay `new Date().toISOString().split('T')[0]` bằng `toDateStr()`
([src/utils/dateUtils.js](../src/utils/dateUtils.js)) — ưu tiên `useUserTasks.js`, `useSubscriptions.js`,
`useJourney.js`, `useHabitLogs.js`, `useCollections.js`, `FinancePage.jsx` (logic nghiệp vụ) trước; chỗ chỉ
dùng cho hiển thị/thống kê (chart Dashboard, heatmap) có thể làm sau.

### D2. Enum chu kỳ subscription (`monthly`/`3month`/`6month`/`yearly`) — không hằng số chung, không CHECK constraint
Giá trị + phép tính suy ra từ nó bị viết tay độc lập ở **≥5 nơi**:

- [FinancePage.jsx:114-121](../src/pages/FinancePage.jsx#L114) — `calcNextDue` (if/else)
- [FinancePage.jsx:446-451,500](../src/pages/FinancePage.jsx#L446) — option list `<select>` + label map hiển thị
- [useSubscriptions.js:35-49](../src/hooks/useSubscriptions.js#L35) — auto-advance loop (if/else riêng, có fallback `d.setMonth(+1)`)
- [useSubscriptions.js:169-178](../src/hooks/useSubscriptions.js#L169) — `getMonthlyCost` (if-chain riêng thứ 3, fallback `sum + s.amount`)
- [schema_v4.24.0.sql:357-364](../data/schema_v4.24.0.sql#L357) — `cycle TEXT NOT NULL DEFAULT 'monthly'`, **không CHECK constraint** nào ràng buộc giá trị hợp lệ

`docs/TASKS.md` (v4.4.0, 2026-05-02) đã từng ghi "Fix … `getMonthlyCost()` sai cho chu kỳ 3/6 tháng" —
xác nhận đây là **loại lỗi đã vỡ thật trong lịch sử project**, không phải suy đoán.

**Hỏng gì:** thêm 1 cycle mới (VD `weekly`) chỉ vào `<select>` + `calcNextDue` (nơi dễ sửa nhất) mà quên
sửa `useSubscriptions.js`: auto-advance rơi vào fallback `d.setMonth(+1)` → **ghi đè sai `next_due` vào
Supabase** (lùi ~1 tháng thay vì 1 tuần), lỗi dữ liệu âm thầm; `getMonthlyCost` cộng nguyên giá theo tuần
vào "chi phí/tháng" → Dashboard/FinancePage hiển thị sai số liệu tổng chi tiêu, không có lỗi nào bắt được.

**Xử lý:** tách 1 hằng số chung `CYCLE_MONTHS = { monthly:1, '3month':3, '6month':6, yearly:12 }` (hoặc
`advanceByCycle()`/`monthlyCostForCycle()`) trong `currencyUtils.js` hoặc file util mới, cho cả 4 vị trí
trên gọi lại.

### D3. `reset_user_data.sql` thiếu xoá 2 bảng thật — "reset toàn bộ" nhưng để sót data
Script tự khai **"⚠️ KHÔNG THỂ HOÀN TÁC"** và tổng kết cuối file nói đã xoá hết, nhưng
[reset_user_data.sql:1-71](../data/reset_user_data.sql) **không có dòng `DELETE FROM` nào** cho
`knowledge_groups` và `inspirational_quotes` — 2 bảng có thật, có RLS, có index trong
[schema_v4.24.0.sql:479-530](../data/schema_v4.24.0.sql#L479) (tạo ở v4.11.0/v4.12.0, **trước** dòng
"Last updated: 2026-06-28" ghi ở đầu script reset — không phải bảng mới hơn script, đúng là bị bỏ sót).
`collection_groups` và `collection_notes` (cũng tạo cùng thời điểm) thì **không sót** vì có FK
`ON DELETE CASCADE` về `collections` — dọn gián tiếp khi script `DELETE FROM collections` chạy.

**Hỏng gì:** chạy script để "reset toàn bộ" → các nhóm kiến thức (`knowledge_groups`, tên + emoji) và
trích dẫn cá nhân (`inspirational_quotes`) **vẫn còn nguyên** trong DB sau khi chạy — ngược mục đích tự
khai của script, không có cảnh báo nào cho biết.

**Xử lý:** thêm `DELETE FROM knowledge_groups;` và `DELETE FROM inspirational_quotes;`, cập nhật lại
tổng kết cuối file.

---

## 🟠 Mức trung bình

### D4. Streak/longest-streak tính lặp giữa `useHabitStore` và `TrackerPage`
Audit 2026-06-27 đã ghi nhận đúng vấn đề này ("logic streak bị nhân đôi giữa `useHabitStore` và
`TrackerPage`") — **vẫn còn nguyên**. `useHabitStore.js:30-41` (`calcStreak`, không export) và `:43-53`
(`getLongestStreak`, không export) bị copy nguyên văn thuật toán ở `TrackerPage.jsx:411-423`
(`effectiveStreak`) và `:425-435` (`effectiveLongest`) — có comment tự thừa nhận "inline — avoids
exporting from hook". Hiện 2 bản khớp nhau (chỉ khác input: đã filter theo `journeyStartStr`).

**Hỏng gì:** sửa thuật toán trong `useHabitStore.js` (VD fix off-by-one ở giới hạn 365 ngày) mà quên áp
dụng lại cho bản copy ở `TrackerPage.jsx` → `StreakRing`/"Best Streak" hiển thị số **cũ** (còn lỗi),
trong khi milestone XP + badge (dùng bản gốc từ hook) đã dùng thuật toán mới → 2 khu vực cùng trang lệch
số liệu.

**Xử lý:** export `calcStreak`/`getLongestStreak` từ `useHabitStore.js`, cho `TrackerPage.jsx` gọi lại
với `effectiveData`.

### D5. Công thức "tuần bắt đầu Thứ Hai" (`day===0?6:day-1`) viết lại độc lập ở 5 nơi
`src/utils/dateUtils.js` **không có** `getWeekStart()`/`startOfWeek()` dùng chung — mỗi nơi tự viết:

- [useHabitStore.js:18-28](../src/hooks/useHabitStore.js#L18) (`getWeekDates`, công thức dòng 22)
- [TrackerPage.jsx:438-452](../src/pages/TrackerPage.jsx#L438) (`effectiveCompletionPct`, dòng 443)
- [DashboardPage.jsx:130-137](../src/pages/DashboardPage.jsx#L130) (`WeeklyReview`, dòng 133)
- [DashboardPage.jsx:279-289](../src/pages/DashboardPage.jsx#L279) (`WeeklyTable`, dòng 284)
- [MonthCalendar.jsx:20-23](../src/components/MonthCalendar.jsx#L20) (`getFirstDayOfWeek`, dòng 22)

**Hỏng gì:** sửa 1 nơi (VD đổi sang tuần bắt đầu Chủ Nhật theo setting mới) mà quên 4 nơi còn lại → % hoàn
thành "Tuần Này" hiển thị lệch nhau giữa Dashboard và Tracker cho cùng 1 ngày thực tế.

**Xử lý:** thêm `getWeekStart(date)`/`getWeekDates(date)` vào `src/utils/dateUtils.js`, cho cả 5 nơi gọi lại.

### D6. 6 nơi tự dựng markup modal thay vì `GenericModal` — kể cả nơi tự nhận đã "replace"
[GenericModal.jsx:4-5](../src/components/GenericModal.jsx#L4) viết rõ: "Replaces
`incubator-modal-backdrop`/`incubator-modal` CSS class coupling across FinancePage and IncubatorPage" —
nhưng grep toàn `src/` cho thấy `GenericModal` **chỉ được dùng ở FinancePage.jsx**
([:523-563](../src/pages/FinancePage.jsx#L523)), chưa từng đụng tới `IncubatorPage`. Còn tồn tại độc lập:

- [IncubatorPage.jsx:645-679,683-748](../src/pages/IncubatorPage.jsx#L645) + `incubator.css:706-805` — Defer/Execute Modal, CSS gần như trùng cấu trúc 1:1 với `generic-modal.css`
- [InboxPage.jsx:434-481](../src/pages/InboxPage.jsx#L434) + `inbox.css:352-519` — bộ modal tay thứ 3
- [AuthModal.jsx:132-136](../src/components/AuthModal.jsx#L132) + `auth.css:4-49`, className bị copy nguyên sang [JourneyDetailPage.jsx:528-530](../src/pages/JourneyDetailPage.jsx#L528), [TrackerPage.jsx:869-871](../src/pages/TrackerPage.jsx#L869), [ProgramBrowser.jsx:133-135](../src/components/journey/ProgramBrowser.jsx#L133)

**Hỏng gì:** đổi 1 hành vi chung cho mọi modal (VD thêm ESC-to-close, focus-trap) chỉ ở `GenericModal.jsx`
theo đúng những gì docstring tuyên bố → **6/7 modal thực tế trong app không nhận được thay đổi**, chỉ lộ
ra khi test tay từng trang.

**Xử lý:** migrate dần sang `GenericModal` — ưu tiên `IncubatorPage` (nơi docstring nói đã làm nhưng
chưa làm), sau đó `InboxPage`, rồi 4 nơi copy className `modal-backdrop`/`auth-modal`.

### D7. `DashboardPage` tự dựng bảng màu category chi tiêu — keyed sai, luôn miss, luôn ra xám
[expense-categories.json:3-10](../src/data/expense-categories.json#L3) có `key` tiếng Anh
(`food`, `transport`...) tách biệt với `label` tiếng Việt (`Ăn uống`, `Di chuyển`...).
[FinancePage.jsx:17-18](../src/pages/FinancePage.jsx#L17) build map đúng, keyed theo `c.key`. Nhưng
[DashboardPage.jsx:18-22](../src/pages/DashboardPage.jsx#L18) tự chép `CAT_COLORS` **keyed theo label
tiếng Việt**, trong khi dữ liệu thật lưu category = key tiếng Anh
([FinancePage.jsx:93,168](../src/pages/FinancePage.jsx#L93), [useExpenses.js:122-132](../src/hooks/useExpenses.js#L122)) — nên `CAT_COLORS['food']` ở
[DashboardPage.jsx:329-334](../src/pages/DashboardPage.jsx#L329) **luôn `undefined`**, rơi về fallback
`#64748b` (xám), và [:354-361](../src/pages/DashboardPage.jsx#L354) in thẳng key tiếng Anh thô ra legend
thay vì label tiếng Việt.

**Hỏng gì:** đây **không phải rủi ro tương lai — đang sai ngay bây giờ**: biểu đồ tròn chi tiêu trên
Dashboard luôn hiện tất cả category cùng màu xám (không phân biệt được), legend hiện `"food"`,
`"transport"` thô giữa 1 dashboard tiếng Việt. Không mất dữ liệu, chỉ sai hiển thị, không lint/test nào
bắt được vì lookup miss rơi về default im lặng.

**Xử lý:** xoá `CAT_COLORS`, import `EXPENSE_DATA` từ `expense-categories.json`, build map theo `key`
giống `FinancePage.jsx` (`Object.fromEntries(EXPENSE_DATA.categories.map(c => [c.key, c]))`), dùng
`.color` cho dot và `.label` cho text legend.

### D8. Native `<input type="date">` ở FinancePage thay vì `DatePickerPopover`
[FinancePage.jsx:460-466](../src/pages/FinancePage.jsx#L460) — field "Ngày gia hạn tiếp theo" của
Subscription dùng `<input type="date">` gốc trình duyệt. `docs/RULES.md` ghi rõ: "Date picking uses
`DatePickerPopover` (not native `<input type="date">`)" — và đây là **input date native duy nhất** trong
toàn bộ `src/` (grep xác nhận). `TaskListSection.jsx` đã dùng đúng `DatePickerPopover` 3 lần.

**Hỏng gì:** chuẩn hoá UX chọn ngày toàn app (VD thêm shortcut, đổi theme) không ảnh hưởng tới
FinancePage — user vẫn thấy UI ngày gốc của OS/browser, khác hẳn lịch tuỳ biến ở chỗ khác trong cùng app.

**Xử lý:** thay bằng `<DatePickerPopover value={subDue} onChange={setSubDue} hideTime ... />` theo đúng
pattern đã dùng ở `TaskListSection.jsx`.

### D9. `window.alert()` thứ 2 chưa được ghi nhận — IncubatorPage
`docs/TASKS.md:83` đã ghi 1 vi phạm ("`alert()` ở CollectPage.onCreateTask vi phạm RULES"). Grep
`alert(` toàn `src/` ra đúng **2 kết quả**: [CollectPage.jsx:1286](../src/pages/CollectPage.jsx#L1286)
(đã biết) và [IncubatorPage.jsx:336-340](../src/pages/IncubatorPage.jsx#L336) (**chưa ai ghi**) — guard
của `handleExecute` khi `convertedTypes.length === 0`.

**Hỏng gì:** nếu sau này ai sửa `CollectPage.jsx:1286` sang toast/`ConfirmModal` theo đúng TASKS.md nhưng
không biết `IncubatorPage.jsx:336` cũng có `alert()` tương tự (vì TASKS.md không ghi) → app vẫn còn 1
native alert sống sót, không đồng bộ theme.

**Xử lý:** thay `alert(...)` bằng state lỗi hiển thị inline trong Execute Modal; thêm vào `docs/TASKS.md`
để không lặp lại việc bỏ sót.

---

## 🟡 Phòng ngừa (chưa lệch, chỉ có rủi ro)

### D10. Enum `recurrence_rule.type` (`interval`/`weekly`/`monthly`) định nghĩa riêng ở 4 nơi
[TaskListSection.jsx:90-92,134-136,267,577-579](../src/components/TaskListSection.jsx#L90) (encode ở form
Add + Edit, option list Add + Edit) và [useUserTasks.js:171-186](../src/hooks/useUserTasks.js#L171)
(decode trong `spawnRecurringTask`) — **hiện khớp nhau ở cả 4 nơi**, `recurrence_rule` là JSONB thuần,
không CHECK constraint. Điểm đáng lo: [useUserTasks.js:186](../src/hooks/useUserTasks.js#L186) —
`if (!nextDate) return false;` không log, không throw; caller duy nhất
([:260-263](../src/hooks/useUserTasks.js#L260)) gọi kiểu fire-and-forget, không kiểm tra kết quả trả về.

**Hỏng gì (nếu xảy ra):** thêm 1 loại lặp mới (VD `yearly`) chỉ vào option UI mà quên thêm branch tương
ứng trong `spawnRecurringTask` → task tạo được, hiển thị bình thường, nhưng khi tick hoàn thành lần đầu,
`nextDate` undefined → `return false` âm thầm → **task lặp lại biến mất hẳn**, không thông báo lỗi nào.

**Xử lý:** không bắt buộc sửa ngay (đang khớp) — nếu phòng ngừa, tách 1 cấu hình chung
`{key, label, computeNext(rule, today)}` dùng cho cả option UI và `spawnRecurringTask`; đồng thời log lỗi
khi `nextDate` undefined thay vì `return false` im lặng.

---

## Khuyến nghị thứ tự ưu tiên

1. **D1** (lệch ngày UTC 66 chỗ) và **D3** (reset script sót data) — ảnh hưởng trực tiếp dữ liệu người
   dùng thấy mỗi ngày / hành động không thể hoàn tác.
2. **D7** (Dashboard luôn ra màu xám) — 1 dòng sửa, ảnh hưởng UI thấy ngay khi test.
3. **D2** (enum subscription) — vì đã từng vỡ thật 1 lần (v4.4.0), nên khoá lại bằng hằng số chung trước
   khi thêm cycle mới.
4. **D4, D5** — dọn khi động tới `TrackerPage`/`DashboardPage` lần tới, không cần sprint riêng.
5. **D6, D8, D9** — gộp vào việc dọn `alert()`/modal đã ghi trong `docs/TASKS.md` "Còn nợ".
6. **D10** — chỉ cần khi có ý định thêm loại lặp mới.
