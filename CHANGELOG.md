# CHANGELOG

## v4.29.0 — 2026-07-29
> Làm `/tasks` rõ ràng + thêm view Lịch. Ponytail **ultra**: mọi thứ dưới đây
> dùng token/component đã có, **không thêm dependency, không migration, không token mới**.

### Added
- **Hero cho `/tasks`** — số việc cần làm (quá hạn + hôm nay) ở display scale với `.gradient-text` clip `--grad-hero`, kèm 3 tile Quá hạn / Hôm nay / Sắp tới. **Độ nổi mã hoá độ gấp**, không phải bảng màu: quá hạn nền đỏ-alpha, hôm nay tím, sắp tới `opacity 0.6`. Trước đó cả trang cùng cỡ `0.8rem` → không có điểm nhìn
- **Tab 📋 Danh sách / 📅 Lịch** — pill switcher `role="tablist"` + `aria-selected`, dùng lại đúng formula của `.inbox-filter-chip`
- **`MonthCalendar` task mode** — không truyền `habitData` thì ô ngày cao `76px` và hiện **chip tên task** (tối đa 2 + `+N nữa`) thay 1 dấu dot. Đây là thứ làm calendar trông giống Google Calendar
- **Dải màu priority** — `3px border-left` trên `.task-item`, màu lấy từ `PRIORITY_OPTIONS` đã có. Inline chứ không tạo 5 class cho 5 màu
- **Animation tick** — `✓` là `::after`, `:hover` hé mờ, `:active` `scale(1.35)` + `--shadow-green`. **Zero state React, zero DOM thêm.** Kèm escape `prefers-reduced-motion`
- **Empty state** có icon disc + tiêu đề + hint, thay dòng text trơn

### Fixed — lỗi hiển thị lịch (phát hiện khi user gửi screenshot)
- **🔴 `grid-template-columns: repeat(7, 1fr)` làm lệch cả 7 cột.** `1fr` = `minmax(auto, 1fr)`, nên chip task (`white-space: nowrap`) **đẩy cột rộng ra**: trong screenshot ô ngày 28 rộng ~2.5× ô ngày 29. Đây là nguyên nhân thật của "trông như lỗi", không phải padding. Sửa thành `repeat(7, minmax(0, 1fr))` + `min-width: 0` trên `.cal-cell--tasks` và `.cal-cell__chips`. Đo lại: **7 cột đều 147px**, chip nằm trong ô và ellipsis đúng
- **Ô ngày không có viền** → lưới không đọc ra là lưới, chỉ là số trôi lơ lửng. Thêm hairline `1px var(--bg-glass-border)` + fill `--bg-card` theo DESIGN.md ("the 1px hairline that defines every glass edge")
- **Ô "done" tô xanh + chip cũng xanh = khối xanh nặng.** Task mode bỏ fill xanh của ô (`--bg-card`), chỉ đậm viền lên `rgba(0,255,136,0.28)` — màu do chip mang
- **Ô cao 76px mà trống hoác** → `62px` min, padding chặt hơn, số ngày `opacity 0.75`
- **Progress bar vô nghĩa trong task mode** — nó vẽ `% ngày có task`, hiện ra thanh 6% trong track rộng, nhìn như đang lỗi. Bỏ bar ở task mode, giữ con số
- **Khoảng trống hai bên trên màn rộng** — `.tasks-page` nới `900px → 1180px` khi ở view lịch (`.tasks-page--calendar`); view danh sách giữ 900px vì đó là khổ đọc tốt
- Ngày chưa tới ở task mode: viền `dashed` + `opacity 0.45` — giữ ô để lưới liền mạch thay vì biến mất

### Changed
- **`getCompletedTasks(dateStr)` → `getCompletedTasksRange(start, end)`** — calendar cần chip trên **mọi** ô, cách cũ là 1 query/ngày = **30 query/tháng**. Nay 1 query/tháng, group ở client. Đệm ±1 ngày vì `completed_at` là timestamptz so sánh theo **UTC** còn ta group theo ngày **địa phương**
  - **Sửa kèm 1 bug lệch ngày:** cách cũ bucket theo UTC, nên task xong lúc 00:00–07:00 giờ VN rơi vào ô ngày **hôm trước**. Nay group bằng `toDateStr()` (local) → đúng ngày
  - `MonthCalendar` bỏ luôn `loadingTasks` + handler async: click ngày chỉ là filter mảng đã fetch
- **`MonthCalendar`** — `todayStr` đổi từ `toISOString().split('T')[0]` (UTC) sang `toDateStr()` (local). Đây là 1 trong 5 chỗ đã ghi nợ ở v4.26.1

### Removed
- **Block "✅ Đã hoàn thành hôm nay"** khỏi `TaskListSection` (~45 dòng, cả nút ↩ uncomplete + 🗑). Task xong giờ xem ở tab 📅 Lịch — theo đúng yêu cầu. Kéo theo bỏ `completedToday` + `uncompleteTask` khỏi destructure và `totalCount`
- **Tiêu đề + badge đếm** trong card `TaskListSection` — đã có ở hero, để lại là trùng
- Lint: **64 → 62 warning** nhờ code bị xoá

### Notes
- **Cố ý KHÔNG làm week/day time-grid kiểu Google Calendar.** `due_time` mặc định `23:59` nên mọi task sẽ dồn vào 1 hàng đáy — nhìn như hỏng. Phần đắt nhất của GCal (cột giờ, thuật toán xếp event chồng nhau, drag-resize, vạch giờ hiện tại) không đem lại gì cho dữ liệu all-day
- **Cố ý KHÔNG làm** Board view, Gantt, assignee, sprint, custom field, custom status (xem `docs/TASKS.md` § "Cố ý KHÔNG làm")
- `habitData` là **prop optional**, không phải flag cấu hình. Khi cắt feature habit thì xoá nhánh `habitMode` là xong. `/tracker` + `/life-log` giữ nguyên hành vi cũ, **không regression**
- **Chưa verify được bằng browser:** chip task trong ô lịch cần đăng nhập (session browser của agent là guest). Đã verify: route, hero (60px, gradient clip), 3 tile, tab switch, guest gate, CSS `.cal-chip`/`.cal-cell--tasks`/`.cal-cell--empty`/`.task-checkbox-btn::after` đều load, không scroll ngang. **Mày tự mở `/tasks` → tab 📅 Lịch để xem chip.**
- `npm run build` 0 lỗi · `npm run lint` 0 error / 62 warning · `npm test` 3/3 · `npm run design:lint` **0 error** / 76 warning (toàn bộ là `'<color>' defined but never referenced` — baseline sẵn có, không thêm token mới)

### Files Added
- (không có)

### Files Modified
- `src/pages/TasksPage.jsx` (hero + view switcher), `src/components/TaskListSection.jsx`, `src/components/MonthCalendar.jsx`, `src/hooks/useUserTasks.js`
- `src/pages/TrackerPage.jsx`, `src/pages/LifeLogPage.jsx` (đổi tên prop)
- `src/styles/tasks.css`, `src/styles/calendar.css`
- `DESIGN.md` (2 section mới: Tasks page atoms, Calendar task mode), `docs/FEATURES.md` (§9 viết lại 2 mode, §16, §24), `docs/ARCHITECTURE.md`, `docs/TASKS.md`, `PROJECT.md`, `CHANGELOG.md`, `package.json`

## v4.28.0 — 2026-07-29
> Audit thiết kế DB cho trục **Inbox — Knowledge — Task — Tags**. Tìm được 7 lỗ hổng.
> 2 file migration **user tự chạy trên Supabase** (agent không kết nối được).

### Fixed — code (ship TRƯỚC khi chạy `migration_v5.0.0`)
- **`CollectPage.onCreateTask` link bị mất từ v4.5.0.** Nó truyền `collectionId` vào `addTask()` → ghi vào `user_tasks.collection_id`, cột **deprecated từ v4.5.0 và không được đọc ở đâu**. Kết quả: task tạo từ bài Knowledge **không hiện badge `🔗 N bài`** và **không xuất hiện trong filter `📌 Task`** ở Knowledge. Nay gọi `linkCollection(result.id, item.id)` → vào junction `task_collections`
- **`useUserTasks.addTask`** — bỏ tham số `collectionId` + cột `collection_id`. Hai đường link song song cho cùng 1 quan hệ đã hết
- **`IncubatorPage`** — bỏ `durationEst` truyền vào `addTask`. Tham số này **không tồn tại** trong signature (cột `duration_est` DROP ở v4.9.0) nên đang bị bỏ qua im lặng, để lại chỉ gây tưởng `estimated_time` được mang sang task
- **`useCollections.addItem`** — bỏ ghi `priority` (cột chết); `status` default `'inbox'` → `'unread'`
- **`useCollections.classifyItem`** — `status` luôn `'unread'`, bỏ giá trị `'inbox'` (trùng nghĩa với `type='inbox'`, không query nào filter theo nó)

### Added — `data/migration_v4.28.0_tags_rls_indexes.sql` (AN TOÀN, chạy được ngay)
- **P0-1 · `chk_collections_type` sai.** CHECK có `'emotion'` (grep `src/` = 0 hit) và **thiếu `'podcast'`** (có trong `knowledge.json`, UI cho chọn) → nếu constraint đã áp trên prod thì classify sang 🎧 Podcast **fail constraint violation**. Nếu chưa áp thì đây là **schema drift** (file ≠ prod). Migration `UPDATE ... SET type='note' WHERE type='emotion'` trước rồi áp CHECK mới
- **P0-2 · 4 junction RLS chỉ kiểm ownership 1 phía.** `task_collections` chỉ kiểm `task_id`; 3 bảng `*_tags` chỉ kiểm entity, **không kiểm `tag_id`**. Ghi được row trỏ sang collection/tag của user khác. **Không leak khi đọc** (RLS bảng đích chặn) nhưng tạo rác render thành link trắng. Nay `USING` + `WITH CHECK` kiểm cả 2 phía
- **P1-3 · Thiếu index chiều ngược.** `expense_tags` và `subscription_tags` chỉ có index theo entity, **không có `tag_id`** → query "mọi expense có tag X" full scan. (`collection_tags` đã có đủ 2 chiều.) Thêm 2 index
- **`task_tags` junction** — Task trước đây **không có tag nào**. Composite PK + CASCADE + RLS 2 phía. Chỉ index `tag_id`, **không** tạo index `task_id` vì PK đã index nó làm cột dẫn đầu (3 junction cũ tạo index trùng PK — dư thừa, không copy)
- **VIEW `tagged_items`** — `UNION ALL` 4 junction → 1 query cho "mọi thứ có tag X" thay vì 4 query + ghép client. Dùng **`WITH (security_invoker = true)`**, bắt buộc: view mặc định chạy bằng quyền OWNER và **bỏ qua RLS** → sẽ leak data mọi user

### Added — `data/migration_v5.0.0_cleanup_dead_columns.sql` (🚨 BREAKING, CHƯA CHẠY)
- DROP 5 cột chết trên `collections`: `resolved`, `course_name`, `duration_min`, `reviewed_at`, `priority` (grep 0 hit; `priority` chỉ passthrough INSERT)
- DROP `user_tasks.collection_id` + FK + index, kèm backfill nốt vào junction trước khi xoá
- Chuẩn hoá `collections.status` → CHECK `(unread, read, archived)`. **Giữ `archived`** — đó là soft-delete đang dùng thật ([CollectPage.jsx:1075](src/pages/CollectPage.jsx:1075), [useCollections.js:32](src/hooks/useCollections.js:32)); chuẩn hoá về `unread|read` như dự định ban đầu **sẽ xoá mất chức năng archive**
- File có mục "KIỂM TRƯỚC" (6 câu SELECT phải = 0), điều kiện tiên quyết, và smoke test 5 bước

### Notes
- **Không** đụng `data/schema_v4.24.0.sql` (RULES §3 + §15 — master schema chỉ sửa khi có chỉ thị rõ ràng). Sau khi chạy 2 migration, master schema sẽ lệch với prod cho tới lần hợp nhất tiếp theo
- **Thứ tự bắt buộc:** deploy code v4.28.0 → chạy `migration_v4.28.0` → (backup) → chạy `migration_v5.0.0`. Chạy v5.0.0 trước khi deploy code sẽ làm mọi INSERT `collections`/`user_tasks` fail
- **Tag KHÔNG bị thừa bảng** — đã có 1 bảng `tags` trung tâm, không có cột `tags TEXT[]` nào lặp. N junction là giá của FK integrity; cố ý **không** làm `taggables` polymorphic vì `entity_id` không FK được → rác vĩnh viễn (đúng bệnh `activity_logs`)
- **Chưa làm:** `parent_id` subtask — có **6 chỗ vỡ ở tầng list** (subtask render 2 lần, nesting đứt ngang section do `due_date NOT NULL`, LinkKBModal trả null, recurring mất checklist, delete để lại rác UI, calendar/notification ồn). Cố ý không trộn với refactor DB. Xem `docs/TASKS.md`
- Còn 1 vi phạm RULES chưa sửa: `alert()` ở `CollectPage.onCreateTask` (RULES cấm `window.alert`). Cần component toast — ngoài scope đợt này
- `npm run build` 0 lỗi · `npm run lint` 64 warning = baseline · `npm test` 3/3 OK

### Files Added
- `data/migration_v4.28.0_tags_rls_indexes.sql`, `data/migration_v5.0.0_cleanup_dead_columns.sql`

### Files Modified
- `src/hooks/useCollections.js`, `src/hooks/useUserTasks.js`, `src/pages/CollectPage.jsx`, `src/pages/IncubatorPage.jsx`
- `docs/DATABASE.md` (thêm `task_tags`, section Views, section Kiến trúc Tag, sửa CHECK + deprecated columns), `docs/TASKS.md`, `CHANGELOG.md`, `package.json`

## v4.27.0 — 2026-07-29
### Added
- **Route `/tasks` — Task thành module độc lập.** Trước đây `TaskListSection` **chỉ** render bên trong `TrackerPage` tab "⚡ Hôm Nay" ([TrackerPage.jsx:782](src/pages/TrackerPage.jsx:782)), nghĩa là module Task bị ràng cứng vào trang habit — không thể cắt habit mà không mất Task. Nay:
  - `src/pages/TasksPage.jsx` — container mỏng, lazy-loaded. **Không** thêm `<h1>` vì card của `TaskListSection` đã có header (tiêu đề + đếm + nút "+ Thêm") — thêm nữa là trùng tiêu đề
  - `src/styles/tasks.css` — tách 105 dòng CSS task (`.task-item`, `.task-checkbox-btn`, `.task-option-btn`, `.task-form-rec-panel`, `.task-desc-box` + light-mode overrides) khỏi `tracker.css`, `TaskListSection` tự import (theo tiền lệ `TrackerSection.jsx`). Lý do tách: `tracker.css` sẽ bị xoá khi cắt feature habit
  - `ROUTE_META['/tasks']` cho SEO title/description

### Changed
- **`Navbar` — `📌 Nhiệm Vụ` vào PRIMARY_NAV, `Life Log` xuống SECONDARY_NAV.** Bottom-tabs mobile đang 6 link + nút "Thêm" = 7; thêm Tasks mà không dời gì sẽ thành 8 tab, quá chật. Life Log là trang xem heatmap (drill-down còn chưa có — xem v4.26.2), phù hợp SECONDARY hơn
- **`TrackerPage`** — xoá `<TaskListSection />` + import. TrackerPage giờ chỉ còn habit/mood/challenge/insight/notification
- **Bonus code-splitting:** main chunk **906.48 kB → 876.53 kB (−30 kB)**. `TaskListSection` (30.42 kB) trước đây nằm trong main chunk vì `TrackerPage` là eager-loaded; nay đi theo chunk `TasksPage` lazy

### Notes
- `.task-list-card`, `.task-actions--desktop/mobile`, `.task-overflow-menu/item` **vẫn ở `global.css`** — cố ý không dời: `global.css` luôn được load nên không có nguy cơ mất khi `tracker.css` bị xoá. Hệ quả: CSS của Task hiện nằm ở 2 file
- **Chưa làm** (cần migration SQL user tự chạy): subtask `parent_id`, junction `task_tags`, inline quick-add theo từng nhóm. Xem `docs/TASKS.md`
- Verify: `npm run build` 0 lỗi · `npm run lint` 64 warning = baseline · `/tasks` render + `tasks.css` áp đúng (`.tasks-page` max-width 900px, `.task-option-btn` padding 4.8/10.4px, `.task-form-rec-panel` bg `rgba(6,182,212,0.04)`) · `/tracker` không còn `.task-list-card` và vẫn render bình thường · 0 console error

### Files Added
- `src/pages/TasksPage.jsx`, `src/styles/tasks.css`

### Files Modified
- `src/App.jsx` (lazy import + route + ROUTE_META), `src/components/Navbar.jsx`, `src/components/TaskListSection.jsx` (thêm import CSS), `src/pages/TrackerPage.jsx`, `src/styles/tracker.css`
- `docs/FEATURES.md` §16, `docs/ARCHITECTURE.md`, `docs/TASKS.md`, `PROJECT.md`, `CHANGELOG.md`, `package.json`

## v4.26.2 — 2026-07-29
### Removed
- **`useActivityLog.getTimelineByDate()`** (31 dòng) — dead code. JSDoc ghi *"for DailyTimeline component"*, nhưng component đó chưa bao giờ tồn tại. Grep toàn `src/`: **0 caller**. Hàm được export nên trông như API sẵn có, thực chất là lời hứa chưa thực hiện. Hook nay còn 3 hàm: `logActivity`, `getHeatmapData`, `getTodayCount`

### Fixed (tài liệu sai — không đổi hành vi runtime)
- **JSDoc `useActivityLog`** khai **6/13 `action` không có caller nào**: `task_add`, `collect_add`, `mood_set`, `xp_earned`, `journey_start`, `journey_complete`. Đồng thời **thiếu 5 action đang ghi thật**: `subscription_add`, `inbox_snooze`, `inbox_classify`, `inbox_bulk_delete`, `inbox_bulk_classify`. Thay bằng bảng 11 action verify từ call site, kèm cột "Written by"
- **`docs/FEATURES.md` §24** mô tả *"Daily drill-down: Click ngày → vertical timeline với action icons, timestamps, labels, XP amounts"* — feature này **không tồn tại**: `handleHeatmapClick` trong `LifeLogPage.jsx:40` là no-op (`() => {}`). Xoá bullet, thêm dòng MonthCalendar (thứ thực sự đang render), sửa list action 7 → 11

### Notes
- ⚠️ **Không** xoá/thêm call site `logActivity` nào (12 chỗ) — heatmap `/life-log` + KPI "Hoạt động" `/dashboard` vẫn chạy nguyên
- Ghi lại 3 giới hạn đã phát hiện vào JSDoc + `docs/TASKS.md` (không giấu TODO chỉ trong code — RULES §"General Practices"):
  - `amount` nhồi **4 đơn vị** vào 1 cột: XP (`habit_done`) / VNĐ (`expense_add`) / số ngày (`inbox_snooze`) / số item (`inbox_bulk_*`), không có cột unit → không SUM/so sánh được
  - Read-side **chỉ COUNT row**. `action`, `label`, `amount`, `meta` ghi vào DB nhưng **chưa được đọc ở đâu**
  - Coverage lệch: `useUserTasks.completeTask` (cách hoàn thành task bình thường) **không log gì** — chỉ Inbox quick-done phát `task_done`
- Cố ý **chưa** thiết kế lại schema: read-side hiện chỉ là 1 con số đếm, chưa biết cần query gì thì thiết kế event schema sẽ lặp lại đúng sai lầm cũ. Chờ xong feature
- `npm run build` 0 lỗi · `npm run lint` 64 warning = baseline · `npm test` 3/3 OK

### Files Modified
- `src/hooks/useActivityLog.js` (−31 dòng logic, JSDoc viết lại)
- `docs/FEATURES.md` §24, `docs/TASKS.md`, `CHANGELOG.md`, `package.json`

## v4.26.1 — 2026-07-28
### Added
- **`npm test`** — chạy cả 3 self-check: `api/_lib/smoke.test.js`, `src/utils/dateUtils.test.js`, `src/utils/mediaUtils.test.js`. Không thêm test framework nào, chỉ `node:assert` + `node <file>`
- **`src/utils/dateUtils.test.js`** — khoá hợp đồng "`toDateStr` phải theo giờ **địa phương**". Case 00:30 sáng sẽ fail ngay nếu ai đó đổi lại thành `toISOString()`. Đã chạy pass ở TZ `Asia/Ho_Chi_Minh`, `UTC`, `America/New_York`
- **`src/utils/mediaUtils.test.js`** — 30 case khoá hành vi trước khi gộp `isAudioUrl`/`isVideoUrl`, gồm các chỗ 2 hàm cũ lệch nhau: `#podcast` chỉ tính audio, `.webm`/`.ogg` khớp cả hai, URL không parse được thì chỉ dựa vào đuôi file

### Changed (Refactor P2 — tầng data, không đổi hành vi)
- **`useUserTasks` / `useIntentions` / `useTags`** — bỏ singleton `getSb()` + `await import('../lib/supabase')` (8 dòng/file), dùng `import { supabase, isSupabaseEnabled }` như 17 hook còn lại. Lazy-import này vốn không tiết kiệm gì: `AuthContext` (provider gốc) đã import tĩnh `supabase`, nên module luôn nằm trong main chunk. Xoá **29 cặp** `const sb = await getSb()` + `if (!sb) return …`; lớp bảo vệ chuyển vào `const isAuth = isSupabaseEnabled && !!user` — mọi hàm DB trong 3 hook đều đã gate bằng `isAuth`, nên không mất guard nào
- **`useCollections`** — `getSnoozedCount` và `fetchSnoozedItems` dùng chung `snoozedFilter()`. Trước đây định nghĩa "snoozed là gì" (3 điều kiện `.eq/.eq/.gt`) bị copy ở 2 nơi, đổi rule phải sửa 2 chỗ
- **`mediaUtils`** — `isAudioUrl` + `isVideoUrl` giống nhau ~90% (mỗi hàm lặp regex đuôi file 2 lần: 1 trong `try`, 1 trong `catch`) → gộp về `isMediaUrl(url, kind, extRe)`, 2 export thành wrapper 1 dòng
- **`dateUtils`: thêm `toDateStr(date?)`** — gộp **4 bản copy y hệt** của hàm sinh chuỗi `yyyy-MM-dd` theo giờ local: `todayStr` (TaskListSection), IIFE `_today` (useIntentions), `localDateStr` (IncubatorPage), `toStr` (DatePickerPopover). 17 callsite đổi tên, hành vi không đổi (cả 4 bản đều là local)

### Notes
- ⚠️ **Còn 5 chỗ dùng `toISOString().split('T')[0]` (UTC) làm "hôm nay"** — `useUserTasks`, `useSubscriptions`, `DashboardPage`, `CashflowBar`, `MonthCalendar`. Ở GMT+7 từ 00:00–06:59 chúng hiểu là *ngày hôm qua*. Đây là **bug timezone**, không phải over-engineering, và sửa nó đổi cách chốt ngày của task/subscription/calendar → cố ý KHÔNG gộp vào đợt refactor này. `TODO: decision needed`
- **Chưa làm** 2 mục còn lại của P2 vì đang chờ quyết định: (a) xoá 2 thang fallback migration ở `useCollections`/`useUserTasks` — cần biết migration `task_collections`/`collection_tags` đã chạy trên prod chưa; (b) bỏ retry của `spawnRecurringTask` — RULES §7 đang liệt kê nó là pattern bắt buộc
- `npm run build` 0 lỗi · `npm run lint` 64 warning = baseline · `npm test` 3/3 OK

### Files Added
- `src/utils/dateUtils.test.js`, `src/utils/mediaUtils.test.js`

### Files Modified
- `src/hooks/useUserTasks.js`, `src/hooks/useIntentions.js`, `src/hooks/useTags.js`, `src/hooks/useCollections.js`
- `src/utils/dateUtils.js`, `src/utils/mediaUtils.js`
- `src/components/TaskListSection.jsx`, `src/components/DatePickerPopover.jsx`, `src/pages/IncubatorPage.jsx`
- `package.json` (script `test` + version), `CHANGELOG.md`, `docs/TASKS.md`, `docs/PLAN.md`, `docs/ARCHITECTURE.md`, `README.md`, `PROJECT.md`

## v4.26.0 — 2026-07-28
### Removed
- **Feature Fitness Log / 🏋️ Sức Khỏe (tab 5 của `/tracker`)** — xoá toàn bộ code frontend:
  - `src/hooks/useFitnessLog.js` (203 dòng) — xoá file
  - `src/pages/TrackerPage.jsx` — xoá tab `fitness` (209 dòng JSX: form nhập, list hôm nay, inline edit, week summary), 5 state `fit*` + `editFit`, entry `{ key: 'fitness' }` trong `TABS`, import hook. **TrackerPage nay còn 4 tab**: ⚡ Hôm Nay · 📅 Lịch · 📊 Tuần · ⚙️ Quản Lý
  - `src/pages/DashboardPage.jsx` — xoá section "🏋️ Sức Khỏe" + card "Tuần Này" (29 dòng), hook `useFitnessLog`, import
  - XP `fitness_done` (+10/buổi) và `logActivity('fitness_done')` biến mất cùng tab — không có chỗ nào khác gọi
- Tổng: **-455 dòng** code

### Notes
- **Bảng `fitness_logs` KHÔNG bị DROP.** `data/schema_v4.24.0.sql` là master schema, RULES §3 cấm sửa khi không có chỉ thị rõ ràng. Bảng vẫn tồn tại trên production, không hook/page nào dùng → an toàn để DROP khi bạn muốn. Ghi nhận trong `docs/DATABASE.md` như bảng archived (giống tiền lệ `friendships`). `TODO: decision needed` — có DROP bảng + data không?
- **Row `activity_logs` cũ với `action = 'fitness_done'` vẫn còn** và vẫn được tính vào heatmap Life Log. Đây là bảng append-only audit (RULES: no UPDATE/DELETE) nên cố ý không xoá. Không gây lỗi render: LifeLogPage không map `action` → label, chỉ đếm.
- **`tpl-fitness` trong `src/data/programs.json` KHÔNG bị xoá** — đó là journey template "Kỷ Luật Thể Chất" (21 ngày: tập luyện / uống nước / ngủ sớm) thuộc feature Journey (§14), không liên quan tới Fitness Log. Xoá nó sẽ mất 1 trong 5 template hệ thống và phá journey đang chạy của user.
- `npm run build` 0 lỗi · `npm run lint` 64 warning = baseline · `node api/_lib/smoke.test.js` OK

### Files Removed
- `src/hooks/useFitnessLog.js`

### Files Modified
- `src/pages/TrackerPage.jsx`, `src/pages/DashboardPage.jsx`, `package.json`
- `docs/FEATURES.md` — xoá §22, **đánh số lại §23–§28 → §22–§27** (header khai báo "§1–§27 đang chạy, số duy nhất và tăng dần"), bỏ dòng XP Fitness, bỏ dòng Data Architecture, sửa "5 tabs" → "4 tabs", thêm dòng vào bảng **Archived / Removed**
- `docs/DATABASE.md` — `fitness_logs` chuyển xuống nhóm archived, **đánh số lại inventory 23–30 → 22–29**, table count `30 active + 1 archived` → `29 active + 2 archived`, bỏ `fitness_logs` khỏi Entity Overview, bỏ dòng XP Fitness
- `docs/ARCHITECTURE.md` — bỏ domain `Fitness`, thêm `fitness_logs` vào `Archived`, `hooks/ (21)` → `(20)`, sửa số bảng active
- `docs/RULES.md` — bỏ dòng `Fitness Log +10` khỏi bảng XP §16
- `PROJECT.md` — module map `/tracker`: `5 tab` → `4 tab`, bỏ `useFitnessLog` + `fitness_logs`; sửa `§1–§28` → `§1–§27`
- `docs/PLAN.md`, `docs/TASKS.md` — ghi nhận việc xoá
- Entry lịch sử của v4.0.0 / v4.0.3 trong `PLAN.md`, `TASKS.md`, `README.md`, CHANGELOG cũ **giữ nguyên** — là log quá khứ, không phải mô tả trạng thái hiện tại

## v4.25.1 — 2026-07-28
### Added
- **`api/_lib/driveToken.js`** — Helper ký JWT Service Account + đổi access token, dùng chung cho `/api/upload` và `/api/stream` (trước đó mỗi file 1 bản copy). Cache token **theo scope** (`Map` scope → token): upload cần `/auth/drive` (ghi), stream chỉ cần `/auth/drive.readonly`. Nếu cache chung 1 biến thì upload có thể nhận token readonly → 403 khó hiểu, nên key theo scope là bắt buộc chứ không phải tùy chọn
- **`api/_lib/smoke.test.js`** — Self-check chạy bằng `node api/_lib/smoke.test.js`, phủ 3 điều `npm run build` không kiểm được: (1) `base64url` cho ra đúng chuỗi như chain `.replace()` cũ (sai là JWT chết âm thầm), (2) format tên file upload không đổi, (3) sign/verify RS256 round-trip với key thật. Đặt trong `_lib/` nên Vercel không route thành endpoint

### Changed
- **`api/upload.js` + `api/stream.js`** — Bỏ 2 bản `getDriveToken` trùng nhau (~27 dòng/file), import từ `_lib/driveToken.js`. Upload nay **cũng cache token** (trước không cache, mỗi request ký JWT mới) — hệ quả: đổi Service Account key thì token cũ còn sống tối đa ~58 phút, giống hành vi `/api/stream` vốn có
- **`api/_lib/*.js`** — 6 chuỗi `.toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_')` → `.toString('base64url')` (native Node)
- **`api/_lib/verifyAuth.js`** — Bỏ `createClient()` + helper `withTimeout` tự viết (10 dòng `Promise.race`), thay bằng 1 `fetch` tới `/auth/v1/user` với `AbortSignal.timeout(8000)`. Hành vi giữ nguyên: token sai/hết hạn → `null` → handler trả 401. Thêm `.replace(/\/$/, '')` cho `SUPABASE_URL` (trước `createClient` tự lo dấu `/` cuối). Phụ: `api/` không còn import `@supabase/supabase-js` → bundle serverless nhỏ hơn
- **`api/upload.js`** — `generateFileName()` từ 15 dòng (6 biến `padStart`) còn 4 dòng. **Format tên file giữ y nguyên** `LifeHub_<folder>_<yyyymmdd>_<HHMMSS>_<hex6>.<ext>`, có test khẳng định. Giữ nguyên `Math.floor(Math.random()*0xffffff).padStart(6,'0')` — không đổi nguồn entropy, và `padStart` là cái bảo đảm luôn đủ 6 ký tự

### Docs
- **`docs/PLAN.md`** — Thêm **Phase 12 — Refactor chống over-engineering** (bảng P0–P6 kèm trạng thái, 2 `TODO: decision needed` đang treo) + 2 dòng v4.25.0/v4.25.1 vào bảng version. Bump header v4.22.0 → v4.25.1. Ghi rõ bảng version thiếu v4.23.0/v4.24.x — sai lệch có từ trước, không fix vì ngoài scope
- **`docs/ARCHITECTURE.md`** — Cây `api/` nay liệt kê cả `_lib/driveToken.js` + `_lib/smoke.test.js` (trước chỉ có `verifyAuth.js`)
- **`README.md`** — Cây `api/` bổ sung 2 file `_lib/` mới. Sửa luôn `data/schema_v4.4.0.sql` → `schema_v4.24.0.sql` + `reset_user_data.sql`: file cũ đã bị gộp/xoá từ v4.24.1 nên người mới làm theo README sẽ đi tìm file không tồn tại
- **Header version** — `RULES.md`, `ARCHITECTURE.md`, `DATABASE.md`, `FEATURES.md`, `PROJECT.md` đồng bộ v4.24.1 → **v4.25.1**, Updated 2026-07-28

### Notes
- **Chưa làm** 2 mục còn lại của P1, cố ý bỏ vì rủi ro cao: (a) thay parser multipart tự viết bằng `Response.formData()` — undici từng có vấn đề với filename non-ASCII/file lớn; (b) thay vòng `pump` bằng `Readable.fromWeb().pipe()`. Cả hai vẫn nằm trong `docs/TASKS.md`
- **Không sửa gì thuộc security**: authz folder-boundary của stream, rate limit per-IP, cap 50MB, CORS allowlist, sanitize mimeType — giữ 100%
- `npm run build` 0 lỗi (chỉ build frontend), `npm run lint` 64 warning = baseline, `node api/_lib/smoke.test.js` OK
- ⚠️ **Vẫn cần test tay sau deploy** — build không chạy `api/` bao giờ: upload 1 ảnh, upload 1 audio, seek thanh audio Drive (kiểm 206 Partial Content), gọi `/api/upload` không token phải ra 401

## v4.25.0 — 2026-07-28
### Removed
- **`src/_archived/` (11 file, 2.524 dòng)** — Team + Friends code huỷ từ v3.0.0, 0 import trong toàn repo. Xoá hẳn thay vì giữ làm "tham khảo". Khôi phục được từ git history (thư mục **có** được track, dòng `src/_archived` trong `.gitignore` không untrack file đã commit — ghi chú v4.23.0 "prevents dead code from being committed" là sai). Bỏ luôn dòng đó khỏi `.gitignore`
- **`@uiw/react-md-editor` + `@uiw/react-markdown-preview`** — 0 lần import trong `src/`, editor markdown đang dùng `react-markdown` + Tiptap. `npm install` gỡ **43 package**
- **`logger.debug()`** — không caller
- **`useCollections`: `toggleStar()`, `archiveItem()`, `getInboxCount()`** — không caller (wrapper 1 dòng của `updateItem` + 1 query đếm không ai gọi)
- **`dateUtils`: 8/10 export** — `formatWeekdayDate`, `formatMonthYear`, `formatMonth`, `formatWeekdayNarrow`, `formatDateShort`, `formatWeekdayShort`, `parseDateLocal`, `formatDayMonth` đều không có caller. Giữ `formatDate` + `formatDateTime`

### Fixed
- **`@keyframes fadeIn` xung đột toàn cục** — có 2 định nghĩa khác nhau cùng tên: `global/journey/generic-modal` (chỉ opacity) và `collect/inbox` (opacity + `translateY(-3px)`). Vì `@keyframes` là global và bản load sau thắng, hiệu ứng fadeIn của cả app phụ thuộc vào page nào được lazy-load trước. Nay: `global.css` giữ `fadeIn` (opacity) + thêm `fadeInSlide` (có translateY) dùng chung; xoá 4 bản định nghĩa trùng ở `journey/generic-modal/collect/inbox`; 7 usage trong `inbox.css` + 1 trong `collect.css` đổi sang `fadeInSlide`

### Changed
- **`CollectPage.jsx`** — Xoá `formatDate()` local (trùng `dateUtils.formatDate`, file đã import từ đó rồi); gộp 2 hàm `slugify` khác nhau trong cùng file thành 1 (bản dùng chung nay có `.trim()`, tránh slug bắt đầu bằng dấu `-`); `h1`–`h4` override giống hệt nhau → 1 vòng `Object.fromEntries`
- **`TaskListSection.jsx`** — Xoá 3 alias `filteredToday`/`filteredOverdue`/`filteredFuture` (gán thẳng từ `todayTasks`/`overdueTasks`/`futureTasks`, không filter gì), 14 callsite dùng biến gốc
- **`docs/RULES.md`** — Bỏ 2 luật "Do NOT touch `src/_archived/`" (§3 + §Scope & Restrictions) vì thư mục không còn tồn tại
- **`docs/ARCHITECTURE.md` / `PROJECT.md` / `docs/DATABASE.md` / `docs/FEATURES.md`** — Bỏ/cập nhật các tham chiếu tới `src/_archived/` đang mô tả như trạng thái hiện tại. Ghi rõ code Team/Friends xoá ở v4.25.0, lấy lại được từ git history. Các entry lịch sử trong `docs/PLAN.md`, `docs/TASKS.md` và CHANGELOG cũ giữ nguyên (là log quá khứ, không phải mô tả hiện tại)

### Files Removed
- `src/_archived/` (toàn bộ: `TeamPage.jsx`, `FriendsPage.jsx`, `useTeam.js`, `useTeamCheck.js`, `useTeamRules.js`, `team/*` 4 file, `team.css`, `friends.css`)

### Files Modified
- `.gitignore`, `package.json`, `CHANGELOG.md`
- `src/utils/logger.js`, `src/utils/dateUtils.js`, `src/hooks/useCollections.js`
- `src/pages/CollectPage.jsx`, `src/components/TaskListSection.jsx`
- `src/styles/global.css`, `src/styles/collect.css`, `src/styles/inbox.css`, `src/styles/journey.css`, `src/styles/generic-modal.css`
- `docs/RULES.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/FEATURES.md`, `PROJECT.md`

### Notes
- `npm run build` — 0 lỗi. `npm run lint` — 64 warning, **bằng đúng baseline trước khi sửa**, không phát sinh warning mới
- `docs/_archived/` (PDF + 2 file md) **không** bị chạm — khác scope
- Đây là Phase 0 của đợt refactor chống over-engineering. P1–P5 còn lại chờ approve từng phase

## v4.24.1 — 2026-07-27
### Changed (Documentation only — không sửa code app)
- **`docs/DATABASE.md`** — Sửa mâu thuẫn số bảng (26 / 28 / 30 → **31 `CREATE TABLE` = 30 active + `friendships` archived**, đối chiếu trực tiếp `data/schema_v4.24.0.sql`). Bỏ tham chiếu tới `schema_v4.4.0.sql` và các `migration_*.sql` đã bị gộp/xoá. Sửa `collections.type` thành đúng 8 loại của CHECK constraint. Thay query leaderboard cũ (join view `user_xp` không tồn tại) bằng RPC `get_leaderboard()`. Bảng XP: bỏ "Duo streak (v3 planned)", thêm Fitness +10, sửa Quiz thành `score × 5`. Thêm mục **Streak — Source of Truth** ghi rõ `refresh_streak()` không tồn tại + `TODO: decision needed`. Thêm cột deprecated `user_tasks.energy_level/duration_est` (DROPPED v4.9.0) và `collections.tags` (không còn trong schema)
- **`docs/FEATURES.md`** — Dọn active/archived: đánh số lại §1–§28 (trước đó 17/18/19/20/21/22/23 bị trùng, thiếu 13), gom Team Mode / Friends / Habits Page / Mood Log / Link Preview / DailyReview / Energy-Duration tag vào bảng **Archived / Removed** ở cuối file. Sửa Tracker 4 tab → 5 tab, Leaderboard sang RPC, task Energy/Duration → `priority`, đường dẫn `life-journey.css`, bỏ claim `collections.tags` còn tồn tại. Chuyển Data Architecture + Routes xuống cuối file và cập nhật (thêm `/incubator`, `/settings`, catch-all; bỏ Teams/Friends)
- **`docs/ARCHITECTURE.md`** — Rút gọn cây thư mục từ ~150 dòng annotate từng file xuống ~30 dòng (thư mục + số lượng + vai trò). Thay danh sách "Supabase Tables" (có 5 bảng không tồn tại + trỏ tới migration files đã xoá) bằng bảng nhóm theo domain + trỏ về DATABASE.md. Sửa `Routes (12 lazy)` → 13 lazy, sửa Key Design Decision #3 (streak client-side, không có DB trigger)
- **`PROJECT.md`** (mới) — Bản đồ cấp cao 127 dòng: stack, chỉ mục tài liệu, module map (route → page → hook → table), data flow, 9 luật không được phá, cách chạy, và danh sách sai lệch đã biết
- **`package.json`** — version 4.23.0 → 4.24.1 (v4.24.0 là patch RLS/email chỉ sửa schema SQL, không bump package)
- **`docs/RULES.md`** — Sửa 3 tham chiếu `data/schema_v4.4.0.sql` → `data/schema_v4.24.0.sql` (§3, §Scope & Restrictions, §15) vì file cũ đã bị gộp và xoá. §localStorage Rules: ghi rõ ngoại lệ legacy thay cho tuyên bố "NEVER user data" (đang bị `vl_life_journey_events` phản chứng). Đánh số `README Requirement` thành §11 để bịt khoảng trống §10 → §12 (không đánh số lại §12–§16 để không phá các tham chiếu "Rule 14" ở file khác)
- **Ngoại lệ legacy localStorage** — `docs/ARCHITECTURE.md` + `docs/RULES.md` + `PROJECT.md`: `vl_life_journey_events` và `vl_journey_title` là user data thật, chưa migrate sang Supabase. Trước đây 3 file đều tuyên bố localStorage "không chứa user data" trong khi vẫn liệt kê 2 key này. Quyết định: giữ nguyên, ghi rõ là ngoại lệ legacy, kèm hệ quả (không sync đa thiết bị) và cảnh báo không lấy làm tiền lệ
- **`docs/FEATURES.md`** — Bỏ tham chiếu `KnowledgeResurface` trong Incubator Review Banner (component đã xoá ở v4.22.0)
- **Header version** — `RULES.md`, `ARCHITECTURE.md`, `DATABASE.md`, `FEATURES.md`, `PROJECT.md` đồng bộ về v4.24.1. Tên file `data/schema_v4.24.0.sql` giữ nguyên (cố ý — không đổi tên file schema theo patch tài liệu)

## v4.23.0 — 2026-06-14
### Added
- **`api/stream.js`** — Vercel serverless proxy that streams Google Drive files through our server, bypassing CORS. Supports `Range` headers for seeking. Caches Service Account token across hot invocations. Enables custom HTML5 `<audio>` player for Drive audio (previously always fell back to ugly Drive iframe)
- **`getDriveStreamUrl()`** in `mediaUtils.js` — Returns proxy URL (`/api/stream?id=xxx`) for Drive files

### Removed
- **"Dạng Drive" toggle** from MediaPreview — unused option, all Drive content now defaults to audio player format
- **"📁 Auto" format pill** from CollectPage editor — redundant with audio-first default
- **AlertCircle import** from CustomAudioPlayer — no longer used after fallback UI cleanup
- **Verbose iframe fallback warning** ("Đang sử dụng trình phát dự phòng bảo mật của Drive") — replaced with cleaner compact layout

### Changed
- **MediaPreview.jsx** — Drive audio now uses proxy stream URL (`/api/stream?id=xxx`) as primary source, with iframe fallback if proxy fails. Removes CORS dependency
- **GlobalAudioPlayer.jsx** — Switched from direct Drive URL to proxy stream URL for podcast playback
- **CustomAudioPlayer.jsx** — Iframe fallback uses cleaner card layout (`.kb-custom-audio-player.card`) instead of warning header + dark box
- **MediaNode.jsx** — Tiptap `renderHTML()` Drive case synced: default height 80px (audio), only `#video` gets 360px
- **CollectPage.jsx** — Editor format pills reduced from 3 (Auto/Audio/Video) to 2 (Audio/Video)

## v4.22.0 — 2026-06-13
### Removed (Dead Code Cleanup)
- **`useFileUpload.js`** — Hook never imported anywhere in the codebase
- **`KnowledgeResurface.jsx`** — Component never imported by any page or component
- **`App.css`** — Vite scaffolding leftover, zero imports
- **`src/assets/react.svg`** + **`src/assets/vite.svg`** — Default Vite template files, unused
- **`src/constants/`** — Empty directory
- **SubAlert duplicate** from TrackerPage — already rendered globally in Navbar

### Added
- **`GenericModal.jsx`** — Shared modal component (backdrop + container + Body/Footer slots). Replaces cross-module `incubator-modal*` CSS coupling between FinancePage and IncubatorPage
- **`src/styles/generic-modal.css`** — Shared modal styles (previously hardcoded in incubator.css)
- **`src/utils/dateUtils.js`** — Centralized Vietnamese date formatting helpers (`formatDate`, `formatDateTime`, `formatWeekdayDate`, `formatMonthYear`, `formatMonth`, `formatWeekdayNarrow`). Replaces 20+ scattered `toLocaleDateString('vi-VN')` calls
- **`src/_archived`** added to `.gitignore` — Prevents dead archived code from being committed

### Changed
- **FinancePage.jsx** — Removed inline `CustomSelect` re-implementation (40 lines), now imports from `src/components/CustomSelect.jsx`. Migrated Edit Expense modal from `incubator-modal*` classes to `GenericModal`
- **LifeJourneyPage.css** — Moved from `src/pages/` to `src/styles/life-journey.css` to follow project CSS convention

### Fixed (Documentation)
- **ARCHITECTURE.md** — Updated React Router v6 → v7, fixed lazy page count 8 → 13, removed stale `useMoodLog` from DashboardPage data sources, removed dead `KnowledgeResurface` reference, added new files
- **ARCHITECTURE.md** — Removed co-located CSS note for LifeJourneyPage

### Files Added
- `src/components/GenericModal.jsx`
- `src/styles/generic-modal.css`
- `src/utils/dateUtils.js`

### Files Deleted
- `src/hooks/useFileUpload.js`
- `src/components/KnowledgeResurface.jsx`
- `src/App.css`
- `src/assets/react.svg`
- `src/assets/vite.svg`
- `src/constants/` (empty dir)

### Files Modified
- `src/pages/FinancePage.jsx`
- `src/pages/TrackerPage.jsx`
- `src/pages/LifeJourneyPage.jsx`
- `docs/ARCHITECTURE.md`
- `.gitignore`


## v4.21.0 — 2026-05-24
### Changed
- **Optional Journey & Onboarding Redirect Polish:**
  - Loại bỏ hoàn toàn cơ chế tự động chuyển hướng người dùng mới hoặc người dùng không có lộ trình đang hoạt động (active journey) sang trang `/journey`.
  - Loại bỏ logic kiểm tra lộ trình, cờ `vl_journey_redirected` và state `redirectToJourney` trong `AppShell` (`src/App.jsx`).
  - Dọn dẹp các biến và import không sử dụng (`useAuth`, `useActiveJourney`) trong `App.jsx`.
  - Cho phép người dùng tự do truy cập trang Today Tracker (`/tracker`), Inbox, Finance, Collect mà không bị chặn điều hướng.
  - TrackerPage vẫn giữ nguyên banner kêu gọi "Chọn lộ trình" ở dạng không ngăn cản (non-blocking) để người dùng có thể thao tác với thói quen tự do (custom habits) và nhiệm vụ.

## v4.20.1 — 2026-05-24
### Added
- **Smart Money Input Parsing & Configurable Currency Settings:**
  - Triển khai tệp tiện ích `src/utils/currencyUtils.js` để xử lý việc lưu trữ cấu hình tỷ giá USD và Toggle Auto-K trong `localStorage`.
  - Bổ sung cấu phần cấu hình "Cấu Hình Tiền Tệ & Chi Tiêu" trong tab Chung của trang Cài đặt để quản lý tỷ giá quy đổi USD ➔ VND và bật/tắt Auto-K (tự thêm 3 số 0).
  - Chuyển đổi các ô nhập số tiền (chi tiêu, đăng ký, ấp trứng) từ `type="number"` sang `type="text"` để hỗ trợ nhập tự do (ví dụ: `50`, `50k`, `89$`, `1.5m`).
  - Thêm dòng chữ Xem trước (Live Preview) mượt mà có phân tách hàng nghìn theo chuẩn VND (`50.000₫`, `2.260.600₫`) phía dưới các ô nhập tiền.
  - Tự động quy đổi ngoại tệ USD sang VND theo tỷ giá tùy chỉnh của người dùng, đồng thời tự động nối thêm ngữ cảnh gốc (ví dụ: `"(Quy đổi từ 89$)"`) vào ghi chú chi tiêu/tên đăng ký để lưu trữ vết.
  - Loại bỏ các khai báo hàm trùng lặp `formatVND` trong `InboxPage.jsx`, `FinancePage.jsx` và `IncubatorPage.jsx`.

## v4.20.0 — 2026-05-24
### Added
- **Inbox Quick Done Feature:**
  - Bổ sung nút "✓ Xong" bên cạnh "⚡ Task" cho từng inbox item tại danh sách chính và trong Reader view của chi tiết inbox item.
  - Tự động chuyển đổi inbox item thành một Task chính thức với trạng thái đã hoàn thành (completed) trong ngày hôm nay ngay lập tức.
  - Tự động lưu vết hoạt động `task_done` vào `activity_logs` để đồng bộ với Life Log heatmap và lịch sử cá nhân.
  - Tự động xóa/dọn dẹp nguồn inbox item ban đầu sau khi chuyển đổi thành công.
  - Hỗ trợ đầy đủ CSS Light/Dark mode thích ứng cho nút "✓ Xong" với gam màu xanh lục (green) dịu nhẹ.

## v4.19.9 — 2026-05-24
### Fixed
- **Light Mode Task Form Inputs & Buttons Visibility:**
  - Thiết lập các lớp CSS Light Mode cho lớp `.auth-input` trong `auth.css` để bảo đảm các viền (border) và nền (background) của ô nhập tên nhiệm vụ, mô tả, và ô nhập chuỗi ngày lặp lại hiển thị rõ ràng trên nền sáng.
  - Tách biệt và chuẩn hóa các lớp CSS trong `tracker.css` bao gồm `.task-item`, `.task-option-btn` (nút độ ưu tiên, lặp lại, và các nút chọn tần suất lặp lại), `.task-form-rec-panel`, `.task-desc-box`, và `.task-checkbox-btn`.
  - Thay thế toàn bộ mã màu nền/viền tối hardcode (inline style) trong `TaskListSection.jsx` bằng các lớp CSS có hỗ trợ Light Mode overrides tương ứng, giúp toàn bộ form và các nút bấm hiển thị trực quan sắc nét.

## v4.19.8 — 2026-05-24
### Fixed
- **CustomSelect & Title Input Alignment:**
  - Cập nhật hiển thị wrapper div của CustomSelect từ `display: inline-block` sang `display: inline-flex` và bổ sung `vertical-align: middle` nhằm loại bỏ khoảng trống biên (descender spacing) mặc định của trình duyệt.
  - Đồng bộ hóa kích thước bằng cách thiết lập chiều cao cố định `height: 38px !important` cho `.kb-custom-select.kb-type-select`, đảm bảo bộ chọn loại (Type Select) và ô nhập tiêu đề (.kb-editor__title) căn chỉnh hàng ngang chuẩn xác pixel-perfect.

## v4.19.7 — 2026-05-24
### Added
- **Unified Custom Dropdowns:**
  - Thay thế toàn bộ dropdown thẻ `<select>` mặc định của hệ điều hành bằng component `CustomSelect` kính mờ (glassmorphic) tuyệt đẹp tại Inbox page, Collect editor và Incubator execute modal.
  - Đồng bộ màu sắc, đường viền và tương phản chữ cho dropdown list trong cả 2 chế độ Sáng/Tối.
- **Task Overdue UX & Warning Badge:**
  - Bổ sung badge màu vàng vui nhộn `⏳ Nhanh lên sắp hết ngày rồi` cho các nhiệm vụ ngày hôm nay chưa hoàn thành để nhắc nhở và tạo động lực cho người dùng.

### Changed
- **Default Due Time:**
  - Mặc định giờ cho các nhiệm vụ mới tạo là `23:59` thay vì tự lấy giờ hiện tại (tránh việc nhiệm vụ lập tức biến thành quá hạn sau khi tạo).
  - Ẩn nhãn giờ `23:59` và `00:00` trên giao diện danh sách để hiển thị ngày gọn gàng.

### Fixed
- **isOverdue Logic:**
  - Cập nhật logic `isOverdue` trong `TaskListSection.jsx` bỏ qua giờ `23:59` và `00:00` của ngày hiện tại để tránh cảnh báo quá hạn sai lệch cho các nhiệm vụ cả ngày.
- **Style Refinements:**
  - Khắc phục lỗi hiển thị 2 viền (double borders) của custom select bằng cách loại bỏ viền/nền của thẻ div bọc ngoài `.kb-custom-select`.
  - Tăng độ tương phản (contrast) của viền các icon định dạng văn bản `.tp-btn`, dropdown `.tp-toolbar-dropdown` và bộ chọn màu `.tp-color-picker` trong chế độ Sáng (Light Mode) từ 0.18 lên 0.28.
  - Bổ sung viền rõ nét, padding và chiều cao cố định `38px` cho ô nhập tiêu đề bài viết `.kb-editor__title` ở cả hai chế độ Sáng/Tối. Đồng bộ hóa kích thước và căn chỉnh dòng (vertical alignment) hoàn hảo pixel-perfect với nút bấm custom select bên cạnh.

## v4.19.6 — 2026-05-24
### Fixed
- **Light Theme Usability & Borders:**
  - Khắc phục các đường viền (border outlines) và giao diện các nút điều hướng, ô tìm kiếm, bộ lọc trong chế độ Sáng (Light Theme) bị quá mờ hoặc biến mất hoàn toàn.
  - Đồng bộ và bổ sung viền rõ nét cho các nút chức năng ở Sidebar/Topbar (`.sidebar__theme-toggle`, `.topbar__theme-toggle`, `.nav-avatar`) và chỉnh nền trắng/indigo nhạt để nổi bật rõ ràng.
  - Sửa lỗi mờ và thiếu viền cho ô tìm kiếm (`.kb-search`), dropdown lọc (`.kb-sort`), bộ chọn loại (`.kb-type-select`), trường nhập nguồn URL (`.kb-editor__url`), input tạo nhóm (`.kb-create-group__input`), bộ chọn tag (`.kb-tag-input`), và bộ chọn nhóm (`.kb-group-picker`).
  - Refactor nút lọc task (`📌`) từ việc dùng inline styles sang class `.kb-task-filter-btn` để hỗ trợ hiển thị đường viền rõ nét và đổi màu linh hoạt khi được kích hoạt hoặc khi đổi sang chế độ Sáng (Light Mode).
  - Định nghĩa lại màu chữ tags trong Light Mode sang màu tím indigo rõ nét (`#4f46e5`) trên nền tag nhạt để tăng contrast và cải thiện khả năng đọc.
  - Sửa lỗi chữ màu trắng siêu mờ của nhãn định dạng (`🎨 Visual` và `✍️ MD`) trong Light Mode bằng các màu chữ tím đậm (`#6d28d9`) và xanh mòng két (`#0e7490`) có tương phản cao.
  - Khắc phục thanh tiến trình kinh nghiệm (`XpBar`) bị tàng hình trong Light Mode bằng cách hiển thị rõ rãnh tiến trình màu indigo (`rgba(99,102,241,0.16)`) và thanh điền tiến trình gradient rõ nét.
- **Layout & Alignment Updates:**
  - Tái cấu trúc khu vực chân trang của Sidebar: nhóm nút chuyển Theme và Avatar người dùng vào chung một hàng ngang `.sidebar__actions` thay vì xếp dọc lệch nhau. Sử dụng `justify-content: space-between` đẩy Avatar sang góc trái (dưới icon Ngọn lửa) và nút chuyển Theme sang sát lề phải bên ngoài để giao diện cân đối, gọn gàng.
- **Interactive Sorting Dropdown:**
  - Thay thế dropdown lựa chọn cách sắp xếp bài viết (`kb-sort`) từ thẻ `<select>` mặc định của trình duyệt (vốn bị đen/trắng lệch lạc tùy hệ điều hành) thành một menu popover tùy chỉnh (`.kb-sort-dropdown`) dạng kính mờ (glassmorphic) tuyệt đẹp và căn chỉnh thẳng hàng hoàn hảo.
  - Bổ sung thêm tùy chọn sắp xếp bài viết theo thứ tự ngược bảng chữ cái **Z → A** (`rev-alpha`) đáp ứng yêu cầu của người dùng.



## v4.19.5 — 2026-05-24
### Fixed
- **Task Filter Popover UX & Theme Sync:**
  - Khắc phục lỗi hiển thị của bộ lọc Task (`📌 Lọc theo Task`) bị đen sì, chữ tối màu không thể nhìn thấy gì khi chuyển sang chế độ Sáng (Light Mode).
  - Loại bỏ hoàn toàn các mã màu inline hardcode tối màu của popover. Thay thế bằng các class CSS động trong `collect.css` (`.kb-task-filter-popover`, `.kb-task-filter-item`, v.v.) tự động đồng bộ theo biến môi trường sáng/tối của hệ thống (`var(--bg-secondary)`, `var(--text-primary)`).
  - Tối ưu màu sắc của ô tìm kiếm, danh sách tác vụ và checkbox trạng thái trong popover hiển thị sắc nét trên cả 2 theme.

## v4.19.4 — 2026-05-24
### Fixed
- **ArticleCard List Styling & Borders in Light Theme:**
  - Khắc phục lỗi các đường viền bài viết không rõ ràng (quá mờ hoặc mất nét trên/dưới) trong chế độ Sáng (Light Theme).
  - Định nghĩa lại đường viền `.kb-card` sắc nét hơn (`1px solid rgba(99,102,241,0.16)`) và thiết lập nền trắng `#ffffff` thay vì trong suốt để các thẻ nổi bật rõ ràng trên nền trang.
  - Sửa lỗi vỡ border-radius khi render thẻ: chuyển từ CSS selector trực tiếp `.kb-card:first-child` sang selector thông qua div bọc (`.kb-list > div:first-child .kb-card`) do cấu trúc React component chứa wrapper.
  - Di chuyển thanh tác vụ hàng loạt (`inbox-bulk-bar`) ra ngoài thẻ container `.kb-list` để tránh ảnh hưởng đến các selector chọn phần tử đầu/cuối của danh sách bài viết.

## v4.19.3 — 2026-05-24
### Added
- **Format Badges on Article Card and ReaderView:**
  - Bổ sung nhãn định dạng trực quan (`🎨 Visual` hoặc `✍️ MD`/`✍️ Markdown`) hiển thị ngay tại dòng metadata của mỗi thẻ bài viết (`ArticleCard`) ở danh sách ngoài trang Knowledge Base.
  - Đồng bộ thiết kế nhãn định dạng trong `ReaderView` bằng cách sử dụng các CSS class dùng chung mới.
  - Định nghĩa các class màu sắc kính mờ riêng biệt trong `collect.css`: tím nhạt (`rgba(139,92,246,0.12)`) cho Visual Editor và xanh cyan (`rgba(6,182,212,0.12)`) cho Markdown Editor để dễ nhận diện tức thì.

## v4.19.2 — 2026-05-24
### Fixed
- **Markdown Editor Preview Reload:**
  - Khắc phục triệt để lỗi reload lại video/audio player hoặc iframe Google Drive ở khung Preview khi người dùng gõ chữ trong Markdown editor.
  - Chuyển `remarkPlugins={[remarkGfm]}` thành biến hằng số tĩnh `REMARK_PLUGINS` định nghĩa ngoài component để tránh việc ReactMarkdown hủy và khởi dựng lại (remount) toàn bộ cây DOM của preview trên mỗi keystroke.
  - Sử dụng `React.memo` với hàm so sánh tùy biến (custom comparison) cho các component `MediaPreview` và `CustomAudioPlayer` nhằm bỏ qua các thay đổi không liên quan đến tệp nguồn (chỉ re-render khi URL hoặc nội dung tệp thay đổi).
  - Tích hợp phát YouTube qua `MediaPreview` trong Markdown component `a` để thừa hưởng cơ chế memoization này.

## v4.19.0 — 2026-05-24
### Added
- **Custom Glassmorphic Audio Player:**
  - Thiết kế trình phát âm thanh HTML5 tùy chỉnh dạng kính mờ (glassmorphism) tuyệt đẹp thay thế cho player mặc định của trình duyệt hoặc iframe đen của Drive.
  - Tích hợp cơ chế tự động chuyển đổi thông minh (error fallback): tự động hiển thị iframe Drive nếu stream trực tiếp thất bại (do phân quyền/cookies).
- **Markdown Mode Format Toggles:**
  - Hỗ trợ đầy đủ các nút chuyển đổi định dạng (`🎵 Dạng audio`, `📺 Dạng video`, `📁 Dạng Drive`) ngay trên player ở khung Preview của Markdown Editor.
  - Khi click chuyển đổi, hệ thống sẽ tự động tìm kiếm và thay đổi link tương ứng trực tiếp trong textarea viết Markdown ở bên trái (thêm `#audio` / `#video` hoặc xóa tag).
  - Tự động gắn tag `#audio` khi người dùng chèn audio qua nút công cụ 🎵 trên toolbar của Markdown editor.

## v4.18.1 — 2026-05-24
### Fixed
- **Source Link Truncation:** Giới hạn chiều dài của link nguồn (`.kb-reader__source`) hiển thị tối đa 3 dòng bằng cơ chế CSS line-clamp và tự động bẻ chữ (`word-break: break-all`) để tránh tình trạng URL siêu dài (như log terminal) che hết giao diện bài viết.
- **TrackerSection React Keys:** Sửa lỗi thiếu prop `key` trên thẻ Fragment ở vòng lặp render tiến độ tuần trong `TrackerSection.jsx` nhằm loại bỏ cảnh báo lỗi trong console của browser.

## v4.18.0 — 2026-05-24
### Added
- **Advanced Media Classification System:**
  - Tích hợp `getMediaType`, `stripMediaTag`, `isYoutubeUrl`, và `getYoutubeEmbedUrl` vào `mediaUtils.js` để tự động nhận dạng định dạng các link YouTube, YouTube Shorts, Google Drive, direct audio, và direct video.
  - Hỗ trợ parser YouTube Shorts tự động chuyển đổi định dạng link `youtube.com/shorts/...` sang link nhúng `youtube.com/embed/...`.
- **Unified MediaPreview Player:**
  - Giao diện phát đa phương tiện thống nhất với switch-case phân loại các dạng file.
  - Tự động điều chỉnh chiều cao linh hoạt cho Google Drive (90px cho audio, 360px cho video/preview chung).
  - Bổ sung nút bấm chuyển đổi định dạng trực quan (`🎵 Dạng audio`, `📺 Dạng video`, `📁 Dạng Drive`) giúp người dùng thay đổi trực tiếp trên player và đồng bộ tức thì vào database.
- **Tiptap MediaNode Extension:**
  - Tạo mới `MediaNode.js` thay thế cho `AudioNode.js` lỗi thời. Sử dụng `ReactNodeViewRenderer` để nhúng trực tiếp `<MediaPreview>` với các nút chuyển đổi vào visual editor.
  - Hỗ trợ cơ chế tương thích ngược (Backward Compatibility) tự động migrate cấu trúc JSON bài viết từ `audioBlock` sang `mediaBlock` hoàn toàn trên client mà không cần chạy SQL migration.
- **Format Selector Pills in Editor:** Bổ sung bộ chọn dạng pill ở ô nhập link nguồn của editor giúp người dùng gắn tag định dạng thủ công (`#audio` hoặc `#video`) một cách thuận tiện.

## v4.17.0 — 2026-05-24
### Added
- **MediaPreview Component:** Phát triển component React dùng chung `src/components/MediaPreview.jsx` để tập trung hóa toàn bộ logic hiển thị trình phát đa phương tiện. Hỗ trợ tự động phân loại tệp (Audio/Video) và nhà cung cấp (Google Drive vs Direct Link).
- **Compact Audio Player Design:**
  - Nhúng Google Drive Audio thông qua `<iframe>` với chiều cao thu nhỏ (`height="90px"`) để hiển thị giao diện thanh điều khiển phát nhạc tinh gọn của Google mà không bị khoảng đen thừa của khung phát video.
  - Sử dụng thẻ `<audio>` nguyên bản của HTML5 thay thế cho thẻ `<video>` cho các tệp âm thanh trực tiếp (đường dẫn ngoài Google Drive) để hiển thị thanh phát nhạc trực quan và tiết kiệm diện tích.
  - Bổ sung viền thủy tinh (glassmorphic border) và bóng mờ nhẹ (`box-shadow`) cho khung iframe để đồng bộ với ngôn ngữ thiết kế chung của hệ thống.
- **Visual Editor Sync:** Cập nhật Tiptap `AudioNode` sử dụng khung hiển thị `iframe` 90px tương tự đối với tệp Drive âm thanh và thẻ `<audio>` đối với các tệp âm thanh trực tiếp khác.
- **Manual Audio Override:** Cập nhật `isAudioUrl` hỗ trợ tự động phát hiện tham số `type=audio` hoặc mã neo (hashtag) như `#audio` hoặc `#podcast` ở cuối URL nguồn. Giúp người dùng có thể tự cấu hình ép buộc hiển thị thanh phát nhạc thu nhỏ (chiều cao 90px) khi dán các liên kết Google Drive bằng cách thêm ký tự `#audio` vào cuối đường dẫn.

## v4.16.3 — 2026-05-24
### Fixed
- **Google Drive Preview:** Bổ sung helper `extractDriveFileId` và cập nhật `extractDriveDirectUrl` để chuyển đổi link Google Drive sang định dạng `/uc?id=FILE_ID` chuẩn xác hơn thay vì hardcode `authuser=0` và `export=download`. Điều này khắc phục lỗi 403 Forbidden đối với người dùng đăng nhập nhiều tài khoản Google đồng thời và loại bỏ các header bắt buộc tải file (download attachment).
- **Google Drive iframe Embedding:** Cập nhật hiển thị link Google Drive trong `CollectPage` (Markdown + Reader View) và Tiptap `AudioNode` (Visual Editor) sang thẻ `<iframe>` trỏ tới `/preview`. Điều này giải quyết triệt để các rào cản về CORS và chặn cookie bên thứ ba (third-party cookies) trong Chrome.

## v4.16.2 — 2026-05-24
### Changed
- **Documentation:** Bổ sung quy chuẩn đặt tên file upload (`LifeHub_{folder}_{yyyyMMdd}_{HHMMSS}_{hex6}.{ext}`) vào tài liệu `FEATURES.md` để đồng bộ chuẩn mực thiết kế.

## v4.16.1 — 2026-05-24
### Changed
- **Unified Upload Architecture:** Cập nhật `api/upload.js` để định tuyến 100% tất cả các loại file (ảnh, audio, video, pdf) lên Google Drive thông qua Service Account, thay vì cơ chế Hybrid (Imgur + Drive) trước đó.
- **Direct Drive URLs:** Định dạng lại Google Drive link trả về từ `open?id=...` thành `uc?export=view&id=...` giúp trình duyệt có thể render trực tiếp hình ảnh thông qua thẻ `<img>` mà không bị lỗi hiển thị.
- Cập nhật `.env.local.example` và tài liệu hệ thống loại bỏ các dependency về Imgur và R2, hoàn toàn quy chuẩn về một backend lưu trữ duy nhất.

## v4.16.0 — 2026-05-23
### Added
- **Hybrid Storage Architecture:** Updated `/api/upload.js` to route image uploads to Imgur and audio/video/document uploads to Google Drive via a Service Account.
- **Global Mini Player:** Implemented `GlobalAudioPlayer.jsx` to float at the bottom of the screen. Randomly auto-plays podcasts using the new `useRandomPodcast.js` hook.
- **Universal Google Drive Parser:** Added helpers `extractDriveDirectUrl` to parse any Google Drive sharing links into direct stream URLs.
- **Tiptap Audio/Video Node:** Extended `AudioNode` with PasteRules to automatically intercept Google Drive links and standard audio links, rendering an inline media player.
- **Reader View Media Player:** `CollectPage` now renders a native audio/video player if the item type is `podcast` or its source URL is a media/Drive link.

## v4.15.0 — 2026-05-23
### Changed
- **Knowledge Base Categories (JSON Refactor):** Consolidated `TYPES` array from `InboxPage` and `CollectPage` into a central static JSON file `src/data/knowledge.json`.
- **Inbox UI Refactor:** Replaced inline classification buttons with `<select>` dropdowns in `InboxPage` (Detail View, Inline Menu, Bulk Actions) to save space and match the unified types.
- **Collect UI Refactor:** `CollectPage` now dynamically builds `TYPE_META` from `knowledge.json`.
- **SubNotes UX Improvement:** Redesigned the "Thêm ghi chú" (Add sub-note) section in the Knowledge Reader View to behave like Confluence (inline expandable comment box instead of a toggle button).
- **Knowledge Categories Config:** Removed `link` type and replaced `emotion` type with `podcast` type in `knowledge.json` as part of the Audio prep.
### Fixed
- **ReaderView Light Mode Contrast:** Fixed invisible dividers and borders in Light Theme for the ReaderView and SubNotes section.

## v4.14.0 — 2026-05-18
### Added
- **KB Category: Giải trí (Entertainment):** New `entertainment` type with 🎮 Gamepad2 icon (red). Use for anime, music, movies, games.
- **KB Category: Cảm xúc (Emotion):** New `emotion` type with ❤️ Heart icon (pink). Use for healing, reflections, diary, emotional content.

### Changed
- **Removed `link` type:** Links merged into `note`. URL field preserved — no data loss.
- **Merged `knowledge` + `experience` + `learn`:** All consolidated into single `learn` type ("Học"). Covers learning material, knowledge articles, lessons, and experiences.
- **SQL Migration:** `migration_v4.14.0_collection_types.sql` — migrates `link→note`, `experience→learn`, `knowledge→learn`, restructures CHECK constraint (8 types).

### Fixed
- **DB ↔ UI type desync:** The DB CHECK constraint only allowed 6 types but the UI had 8+. Now all 9 types are aligned.

---

## v4.13.1 — 2026-05-18
### Changed
- `docs/PLAN.md` — Version header synced `v4.5.4` → `v4.13.0`, added v4.9.0–v4.13.0 to Semantic Version Map.
- `docs/ARCHITECTURE.md` — Version header synced `v4.11.0` → `v4.13.0`. Removed 3 ghost entries (`DailyTimeline.jsx`, `DailyReview.jsx`, `useLinkMeta.js` — deleted v4.7.0/v4.7.1). Added 5 missing CSS files + `DatePickerPopover.jsx`. Fixed `useMoodSkip.js` + `habits.json` descriptions (mood removed v4.10.1).
- `docs/FEATURES.md` — Cleaned stale `DailyTimeline` ref in Life Log section, cleaned `DailyReview` ref in Sidebar Widgets section (deleted v4.7.1).
- `docs/TASKS.md` — Fixed v4.12.0 status `IN PROGRESS` → `✅ DONE`.

---

## v4.13.0 — 2026-05-17
### Added
- **Postcard Gallery:** Quote-type KB items now render as gradient-backed postcard cards (2-column grid) instead of standard article list. 8-color gradient palette, serif italic typography, line-clamp truncation with fade.
- **PostcardCard component:** Large quote text display, author attribution from title, audio badge detection, responsive (1-col on mobile).
- **QuoteWidget KB integration:** `QuoteWidget` now accepts optional `kbQuotes` prop — KB quote items appear in random rotation alongside system quotes on the Knowledge Base page.

### Changed
- `src/pages/CollectPage.jsx` — Added PostcardCard component, PostcardGrid rendering when `typeFilter === 'quote'`, empty state with 💬 icon, kbQuotes passed to QuoteWidget.
- `src/components/QuoteWidget.jsx` — Accepts `kbQuotes` prop, merges KB quote items into shuffle pool (backward-compatible).
- `src/styles/collect.css` — Postcard gallery CSS (gradients, typography, hover lift, truncation fade, light mode overrides, responsive grid).

---

## v4.12.0 — 2026-05-10
### Added
- **Media in KB Articles (Phase 1):** Image + YouTube support for both Tiptap Visual and Markdown editors.
  - Tiptap: `@tiptap/extension-image` + `@tiptap/extension-youtube` with toolbar buttons (🖼️ + 🎥)
  - Slash commands: `/image` and `/youtube` for quick insertion
  - Markdown: auto-detect YouTube URLs → embed iframe, audio URLs → native player, responsive images
  - CSS: 16:9 responsive video embeds, styled audio players, responsive images
- **Media Utils:** `src/utils/mediaUtils.js` — shared YouTube ID extraction + audio URL detection
- **Upload API (Phase 2):** `api/upload.js` — Vercel serverless proxy to Cloudflare R2 (AWS Sig V4, zero external deps). `useFileUpload.js` hook.
- **UrlInputPopover (Phase 3):** Shared ClickUp-style popover component — replaces `window.prompt()` for Image/YouTube URL input. Labeled input, Hủy/Chèn buttons, Escape/click-outside close, glassmorphism dark/light.
- **QuoteWidget (Phase 4):** Dynamic inspirational quote widget with daily-seeded selection (different quote per page), 🔀 shuffle with crossfade animation, optional audio playback. Mounted on Today, Inbox, Knowledge pages.
- **AudioNode (Phase 5):** Custom Tiptap extension for inline audio players. Toolbar 🎵 + `/audio` slash command + styled player block.
- **User Quotes (Phase 6):** `inspirational_quotes` Supabase table + `useQuotes.js` hook with CRUD and graceful fallback.
- **Imgur Auto-Upload (Phase 7):** `api/upload.js` refactored — dual provider (Imgur auto for images, R2 for audio). Paste/drop images in Tiptap → auto upload + insert.
- **Quote Manager UI (Phase 7):** New Settings tab "Quotes" — add/edit/delete/toggle personal quotes, view system quotes. `SettingsPage.jsx` + CSS.

### Changed
- `src/components/SlashCommand.jsx` — 3 new slash items (Image, YouTube, Audio), no `window.prompt()`
- `src/components/TiptapEditor.jsx` — AudioNode extension + 🎵 toolbar + paste/drop image auto-upload + UrlInputPopover
- `src/pages/TrackerPage.jsx` — Replaced inline hardcoded quote with `<QuoteWidget>`
- `src/pages/InboxPage.jsx` — Added QuoteWidget between quick-add and items list
- `src/pages/CollectPage.jsx` — QuoteWidget + UrlInputPopover (Markdown toolbar: **all `window.prompt` removed**)
- `src/pages/SettingsPage.jsx` — New "Quotes" sidebar tab + QuoteManagerSection component

---

## v4.11.0 — 2026-05-10
### Added
- **Knowledge Groups (M:N):** New organizational layer for Knowledge Base. Users can create named groups (with emoji) and assign articles to multiple groups simultaneously (Many-to-Many). Includes full drill-down view with contextual search, breadcrumb navigation, and group management.
- **Sub-Notes (Threaded Notes):** Personal annotations attached to KB articles. Thread-style notes for book reading highlights, follow-up thoughts, and review notes. Inline editing with Ctrl+Enter to save.
- **Group Picker (Editor):** Searchable group selector with inline creation — type a new name and create group instantly without leaving the editor.
- **Group Badge (Article Cards):** Articles show group badges in list view. Click a badge to navigate directly to that group's drill-down view.
- **Delete UX:** Deleting a group only removes the link (articles preserved). Separate "Delete All" option with strong confirmation for destructive delete.

### Database
- `knowledge_groups` table — user-created folders (title, emoji, description)
- `collection_groups` junction table — M:N link between collections and groups (CASCADE delete)
- `collection_notes` table — threaded sub-notes per article
- Migration: `data/migration_v4.11.0_knowledge_groups.sql`

### Files Added
- `src/hooks/useKnowledgeGroups.js` — CRUD groups, link/unlink articles
- `src/hooks/useCollectionNotes.js` — CRUD sub-notes

### Files Modified
- `src/hooks/useCollections.js` — Added collection_groups join to fetchItems
- `src/pages/CollectPage.jsx` — 📁 Nhóm tab, GroupPicker, SubNotesSection, group badges
- `src/styles/collect.css` — Group cards, breadcrumb, picker, sub-notes styles

---

## v4.10.1 — 2026-05-10
### Changed
- **DatePicker — Always-visible time input:** Time input now always shown (removed "Thêm giờ" toggle). Defaults to current local time (`HH:MM`) when opening picker. "Bây giờ" quick-set button added.
- **DatePicker — Start-time semantics:** Header label changed from "📅 Khi nào" → "📅 Bắt đầu lúc" to clarify the date/time represents when user should START the task, not a deadline.
- **Task default time:** If user doesn't explicitly set a time, defaults to `00:00` (midnight = "start of day / unspecified"). Previously stored as `null`.
- **Task card time badge:** `⏰` badge only shows for tasks with explicitly set time (not `00:00`).
- **Notification logic:** Service Worker skips `00:00` tasks for notifications — only tasks with user-set times trigger reminders.

### Fixed
- **Recurring task spawn bug:** `spawnRecurringTask` was referencing deleted columns `energy_level`/`duration_est` (dropped in v4.9.0). Fixed to use `priority` instead — spawned tasks now inherit the original's priority level.

### Added
- `dp-time__now-btn` CSS class for the "Bây giờ" quick-set button in DatePicker.
- `hideTime` prop on `DatePickerPopover` for contexts where time input should be hidden.
- `nowHHMM()` helper function in DatePicker and TaskListSection.
- **DatePicker mobile responsive:** Bottom-sheet layout on ≤520px, shortcuts hidden (calendar only), safe-area for notch phones.
- **Task card mobile overflow:** Action buttons (📅 ✏️ 🔗 🗑) collapse into `⋯` overflow dropdown on ≤520px. Click-outside auto-close.
- `task-actions--desktop` / `task-actions--mobile` CSS visibility toggle.
- `.task-overflow-menu` / `.task-overflow-item` dropdown styles (dark/light).

### Removed
- **Mood Tracker Feature:** Completely purged the "😊 Tâm Trạng Hôm Nay" feature to simplify the architecture. Removed `useMoodLog`, `MoodTrendChart`, and mood-related UI from `TrackerPage`, `DashboardPage`, `LifeLogPage`, and `JourneyDetailPage`.
- **Database:** Prepared SQL migration to drop `mood_logs` table (`data/migration_v4.10.1_drop_mood.sql`).

### Files Modified
- `src/components/DatePickerPopover.jsx` — always-visible time, smart defaults, label change
- `src/components/TaskListSection.jsx` — default dueTime to now, hide 00:00 badges, mobile overflow menu
- `src/hooks/useUserTasks.js` — default due_time to '00:00', filter SW sync, fix spawn columns
- `src/styles/datepicker.css` — .dp-time__now-btn + mobile bottom-sheet layout
- `src/styles/global.css` — task overflow menu styles (dark/light)
- `src/styles/dashboard.css`, `src/styles/calendar.css` — removed mood-related classes
- `src/data/habits.json` — removed `moods` object
- `docs/FEATURES.md`, `docs/ARCHITECTURE.md`, `docs/DATABASE.md` — purged mood tracker refs
- `data/migration_v4.10.1_drop_mood.sql` — new migration file
- `public/sw.js` — skip 00:00 notifications
- `package.json` — version bump → 4.10.1

## v4.10.0 — 2026-05-09
### Added
- **DatePickerPopover:** ClickUp-style date picker with quick shortcuts (Hôm nay, Ngày mai, Tuần sau, 2/4/8 tuần) + mini calendar grid.
- **Quick date edit:** 📅 button on each task card to change due date instantly via popover.
- New CSS: `src/styles/datepicker.css`

### Changed
- **Task forms:** Replaced native `<input type="date">` + `<input type="time">` with DatePickerPopover trigger button in both Add and Edit forms.
- **Task card actions:** Replaced 🔄 rollover button with 📅 quick date picker.

## v4.9.0 — 2026-05-09
### Changed
- **Task Priority:** Replaced Energy Level (⚡🔋🪫) + Duration Estimate (5p-2h+) with 5-level Priority system (⬇️ Rất thấp → ⚡ Khẩn cấp).
- **Label clarity:** `📅 Ngày` → `📅 Khi nào` to clarify due date meaning.

### Removed
- Energy Level selector (add/edit/view badges)
- Duration Estimate selector (add/edit/view badges)
- Energy Filter chips bar
- DB columns: `energy_level`, `duration_est` (via migration)

### Added
- `priority SMALLINT` column in `user_tasks` (0=None, 1-5)
- Priority selector in Add + Edit forms
- Priority badge on task cards

## v4.8.0 — 2026-05-09
### Changed
- **Incubator UI Redesign:** Replaced single-list + archive toggle with 2-tab layout (🥚 Đang ấp / 🗑 Đã bỏ qua).
- **Card Actions:** Action buttons (Thực thi, Dời, Bỏ) now shown directly on each card instead of hidden in detail view.
- **Abandoned Tab:** Items can be restored (♻️ Khôi phục) or permanently deleted (🗑 Xóa vĩnh viễn).
- **Add Button:** Redesigned with dashed border style for clearer visual hierarchy.

### Added
- `useIntentions.restoreIntention()` — Restores abandoned intentions back to incubating status with activity log.

## v4.7.3 — 2026-05-09
### Fixed
- **Inbox → Task (card view):** `handleToTask` now includes `item.body` in description — previously only passed `item.url`, losing long text content.
- **Incubator → Task (Execute):** Now composes a rich Markdown description with all metadata (💰 cost, ⏱ time, 💡 original reason, 📜 history logs, 📝 description) instead of only `original_reason`.
- **Incubator → Expense date:** Replaced stale `todayStr` closure with `localDateStr()` call to prevent wrong date when app stays open overnight.

## v4.7.2 — 2026-05-09
### Added
- **Incubator Description Field:** `intentions` table now supports a `description` column for long-form content.
- **Incubator Detail UI:** Detail view renders Markdown descriptions. Editor features a split-pane (Write/Preview) layout.
- **Incubator Cards:** Added `📝 Có mô tả` badge indicator.
### Changed
- **Inbox "Ấp Trứng" Action:** Now perfectly maps the item's `body` and `url` to the new `description` field in `intentions`.

## v4.7.1 — 2026-05-09
### Removed
- **`DailyReview` widget** — Removed from Sidebar (`Navbar.jsx`) to reduce UI clutter.
- **`DailyReview.jsx`** — Component completely deleted.

## v4.7.0 — 2026-05-09

### Removed (Dead Code Cleanup)
- **`DailyTimeline.jsx`** — dead component, no import anywhere in codebase
- **`useLinkMeta.js`** — dead hook calling non-existent `/api/meta` endpoint
- **`XP_REWARDS.duo_streak`** — unused constant for unimplemented Team Mode
- **`useLinkMeta` import/usage** in `InboxPage.jsx` — always silently failed
- **Life Journey default events** — replaced hardcoded personal demo data with empty array

### Changed
- **`QuickCapture.jsx`** — rewrote to use `useCollections.addItem()` instead of raw Supabase insert. Now uses `<textarea>` with Shift+Enter for newlines. Added auto-split logic for long text (>25 words → title truncation + body preservation).

### Files Modified
- `src/components/DailyTimeline.jsx` — DELETED
- `src/hooks/useLinkMeta.js` — DELETED
- `src/pages/InboxPage.jsx` — removed useLinkMeta import + destructuring
- `src/hooks/useXpStore.js` — removed duo_streak from XP_REWARDS
- `src/hooks/useLifeJourney.js` — DEFAULT_EVENTS = []
- `src/components/QuickCapture.jsx` — full rewrite (useCollections + textarea)
- `src/styles/quick-capture.css` — textarea support (resize, min-height)
- `docs/FEATURES.md` — removed DailyTimeline reference from Life Log

---



### Added
- **Incubator Detail View:** Click any intention card to open a full detail panel with title, reason, cost/time estimates, meta info, and timeline history. Inline edit mode via "✏️ Sửa" button. Action bar at bottom (Thực thi / Dời lại / Bỏ qua).

### Changed
- **Incubator cards:** Now clickable with hover lift effect. Action buttons moved from card to detail panel for cleaner card UI.
- **Incubator edit flow:** Replaced small edit modal with inline editing in the detail panel.

### Files Modified
- `src/pages/IncubatorPage.jsx` — detail view state, handlers, panel UI
- `src/styles/incubator.css` — detail panel styles, clickable card hover, light mode

---

## v4.6.0 — 2026-05-09

### Added
- **Inbox Detail View:** Click any inbox item to open an inline reader view (reusing Knowledge Base `kb-reader` CSS) with rendered Markdown, metadata, and action buttons (📌 Task, ✏️ Sửa, 🗑 Xóa). Edit mode uses KB-style split-pane (✍️ Write / 👁 Preview).
- **Inbox Description:** Quick-add form now has a 📝 toggle to add an optional description when creating inbox items. Body preview shown on item cards.
- **Settings Profile Section:** New "Hồ sơ" tab in Settings with sidebar navigation. Users can edit display name, email, and bio. Email duplicate check on save.
- **Settings Sidebar:** Extensible sidebar navigation in Settings page ("Chung" + "Hồ sơ"). Responsive — collapses to horizontal tabs on mobile.
- **Auth Form Improvements:** Signup now accepts email as username (auto-fill email field). Smart display_name fallback. Email duplicate check on registration.

### Changed
- **Inbox detail architecture:** Replaced `@uiw/react-md-editor` overlay with inline reader/editor views reusing KB CSS classes (`kb-reader`, `kb-editor`, `kb-split`, `kb-prose`). Bundle size reduced from 915KB → 19.7KB.
- **Quick-add form layout:** Wrapped in row container to accommodate description toggle button.
- **Inbox item cards:** Now clickable (cursor pointer). URL links use `stopPropagation` to avoid opening detail view when clicking links.

### Files Modified
- `src/pages/InboxPage.jsx` — detail view + description toggle + body preview
- `src/styles/inbox.css` — detail panel, desc toggle, body preview, clickable items
- `src/pages/SettingsPage.jsx` — sidebar layout + profile section
- `src/styles/settings.css` — sidebar + profile styles
- `src/components/AuthModal.jsx` — smart signup form
- `src/contexts/AuthContext.jsx` — (no changes, hooks already support body)

---

### Changed
- **`DATABASE.md` overhaul (P0):** Removed 560-line stale SQL block containing 6 phantom tables (`teams`, `reactions`, `quiz_attempts`, `daily_challenge_completions`, `partner_queue` + their RLS policies). Replaced with concise Table Inventory reference to `schema_v4.4.0.sql` as single source of truth.
- **`friendships` marked ARCHIVED:** Entity Overview and Table Inventory now clearly label `friendships` as `[ARCHIVED v3.0.0]`. Table exists in production but is not used by any active code.
- **`user_tasks.collection_id` documented as DEPRECATED:** Added Deprecated Columns section in DATABASE.md. Column superseded by `task_collections` junction table (M:N, v4.5.0). Will be DROPped in v5.0.

### Fixed
- **Habit sort_order not persisted (P1):** `useCustomHabits.reorderHabits()` now batch-updates `sort_order` column in Supabase (fire-and-forget). Previously reorder was UI-only and lost on page refresh. Fetch query now orders by `sort_order ASC, created_at ASC`.

### Files Modified
- `docs/DATABASE.md` — complete rewrite of SQL block + Entity Overview cleanup
- `src/hooks/useCustomHabits.js` — sort_order persist + fetch order + rowToHabit mapping
- `docs/TASKS.md` — v4.5.4 section
- `CHANGELOG.md` — this entry
- `package.json` — version bump → 4.5.4

---

## v4.5.3 — 2026-05-07

### Changed
- **`useCollections.js` JSDoc:** Fixed stale type list — removed deprecated `'want'`, added missing `'note'` to match DB CHECK constraint.
- **`reset_user_data.sql`:** Synced with v4.5.0 schema — added `DELETE FROM task_collections` (was missing), updated table count 24 → 25.

### Removed
- **`placeholder-page.css`:** Orphan CSS with zero imports — dead code from early development.

### Archived
- **`docs/TEAM_DESIGN.md`** → `docs/_archived/` — Team feature fully archived, design doc orphaned.
- **`docs/implementation_plan.md.resolved`** → `docs/_archived/implementation_plan_ai_v3.md` — Resolved AI roadmap from v3.x era.
- **`Chương Trình Kỷ Luật.pdf`** → `docs/_archived/Chuong_Trinh_Ky_Luat.pdf` — Non-code file removed from repo root.
- **`dist/` directory** — Stale build output cleaned (already in .gitignore).

---

## v4.5.2 — 2026-05-07

### Fixed
- **3 empty files recovered:** `useUserTasks.js`, `useCollections.js`, and `LinkKBModal.jsx` were corrupted to 0 bytes in commit `d7c29de`. Restored from `cfff3b2` and re-applied v4.5.0/v4.5.1 upgrades.
  - `useUserTasks.js` — Restored + re-added `task_collections` embedded select with fallback, `linkCollection()`, `unlinkCollection()`, `_collections` array on each task.
  - `useCollections.js` — Restored + re-added `task_collections(task_id)` join for `_linkedTaskIds`/`_linkedTaskCount`, 2-step fallback (full → tags-only → plain).
  - `LinkKBModal.jsx` — Rebuilt from scratch: search + checkbox modal, max 10 results, searches title + body_text/body, linked items sorted first, glassmorphism UI.
- **Deprecated meta tag:** Replaced `<meta name="apple-mobile-web-app-capable">` with `<meta name="mobile-web-app-capable">` in `index.html` to fix Chrome deprecation warning.

### Files Modified
- `src/hooks/useUserTasks.js` — restored + v4.5.0 upgrades
- `src/hooks/useCollections.js` — restored + v4.5.0 upgrades
- `src/components/LinkKBModal.jsx` — rebuilt from spec
- `index.html` — meta tag fix

---

## v4.5.1 — 2026-05-03

### Fixed
- **useUserTasks query crash:** Embedded select `task_collections(...)` returns 400 when junction table not yet created. Added graceful fallback → retry with plain `select('*')`. Tasks now load even without migration.
- **useCollections query crash:** Same `task_collections` join failure. Fallback now retries without `task_collections` (keeps `collection_tags` join), then falls back to plain `select('*')` if both fail.
- **LinkKBModal empty state:** Modal showed "Chưa có bài viết" because `useCollections()` in `TaskListSection` never called `fetchItems()`. Added `useEffect` to trigger `fetchCollections({})` when modal opens (`linkTaskId` set).
- **LinkKBModal search:** Now searches both `title` AND `body_text`/`body` fields (previously title only).
- **profiles INSERT RLS policy missing:** Signup "Database error saving new user" caused by missing INSERT policy on `profiles` table. Added `profiles_insert_own` policy.

### Changed
- **LinkKBModal max results:** Reduced from 20 → 10 for cleaner UX. Scroll for overflow.
- **Settings in avatar dropdown:** Added "⚙️ Cài Đặt" menu item between "Phím Tắt" and "Đăng Xuất" in user avatar dropdown.
- **Edit form KB link button:** Added 🔗 link KB button inside task edit form (opens LinkKBModal inline).
- **Add form KB hint:** Shows "💡 Tạo xong nhiệm vụ rồi nhấn 🔗 để liên kết bài viết Knowledge" in add form.
- **CollectPage Task Filter:** Replaced inline chip row with 📌 icon button + dropdown popup in toolbar. Click-outside auto-close. Scrollable task list.
### Files Modified
- `src/hooks/useUserTasks.js` — fallback query
- `src/hooks/useCollections.js` — 2-step fallback query
- `src/components/LinkKBModal.jsx` — search body, max 10
- `src/components/TaskListSection.jsx` — fetchCollections trigger, edit form 🔗 button, add form hint
- `src/components/Navbar.jsx` — Settings in avatar dropdown
- `data/schema_v4.4.0.sql` — profiles INSERT policy
- `package.json` — version bump → 4.5.1

---

## v4.5.0 — 2026-05-03

### Added
- **Task ↔ Knowledge Base Many-to-Many:** Tasks can now link to MULTIPLE Knowledge Base articles, and each article can be linked to multiple tasks. Replaces the old 1:1 `collection_id` FK.
  - `task_collections` junction table [NEW] — `(task_id, collection_id)` composite PK + RLS + CASCADE delete
  - `useUserTasks.linkCollection(taskId, collectionId)` [NEW] — optimistic junction insert
  - `useUserTasks.unlinkCollection(taskId, collectionId)` [NEW] — optimistic junction delete
  - Embedded Supabase select — 1 query fetches tasks WITH linked collections (no N+1)
- **LinkKBModal component** [NEW] — Search + checkbox modal to link/unlink Knowledge articles to a task. Max 20 search results. Linked items sorted first.
- **CollectPage Task Filter:** New `📌 Task:` filter chip row — filter Knowledge articles by linked task. Shows only active (pending) tasks.
- **CollectPage Task Badge:** Each article card shows `📌 N tasks` badge when linked to tasks.

### Fixed
- **ArticleCard Tiptap excerpt:** When `body_text` is empty (pre-migration articles), ArticleCard now extracts plain text from Tiptap JSON content instead of showing raw JSON.

### Changed
- `useUserTasks.js` — Fetch uses embedded select `task_collections(collection_id, collections(id, title, type))`. Each task exposes `_collections` array.
- `useCollections.js` — Fetch includes `task_collections(task_id)` join. Items expose `_linkedTaskIds` array and `_linkedTaskCount`.
- `TaskListSection.jsx` — Badge `🔗 KB` → `🔗 N bài`. New 🔗 button per task opens LinkKBModal. Imports `useCollections` + `LinkKBModal`.
- `CollectPage.jsx` — `pendingTasks` destructured from `useUserTasks`. `filterTaskId` state + filter logic. Task filter chip row. ArticleCard excerpt fix.

### Database
- `data/schema_v4.4.0.sql` — v4.5.0 section: `task_collections` table + RLS + index + data migration from `user_tasks.collection_id`
- **Migration:** Run the v4.5.0 section of `schema_v4.4.0.sql` in Supabase SQL Editor BEFORE deploying frontend v4.5.0

### Files Modified
- `src/hooks/useUserTasks.js`
- `src/hooks/useCollections.js`
- `src/components/TaskListSection.jsx`
- `src/components/LinkKBModal.jsx` [NEW]
- `src/pages/CollectPage.jsx`
- `data/schema_v4.4.0.sql`
- `package.json` — version bump → 4.5.0

---

## v4.4.0 — 2026-05-02

### Fixed
- **IncubatorPage Execute Modal crash:** `EXPENSE_DATA.map()` called on object root instead of `.categories` array. Also fixed field names `cat.id`→`cat.key`, `cat.name`→`cat.label`. Without this fix, selecting "💰 Ghi nhận Chi tiêu" in Execute Modal would throw `TypeError`.
- **Subscription monthly cost miscalculation:** `getMonthlyCost()` returned full cycle amount for `3month` and `6month` subscriptions instead of dividing by 3 and 6 respectively. A 300k/3-month sub now correctly shows 100k/month.

### Added
- **Task ↔ Knowledge Link:** Tasks can now reference a Knowledge Base item via `collection_id` FK. Create linked tasks from the Knowledge reader view (📌 Task button). Tasks with links show a clickable 🔗 KB badge.
  - `migration_v4.4.0_task_knowledge_link.sql` [NEW] — `ALTER TABLE user_tasks ADD COLUMN collection_id UUID REFERENCES collections(id)`
  - `useUserTasks.addTask()` accepts optional `collectionId`
  - `CollectPage.jsx` ReaderView — 📌 Task action button
  - `TaskListSection.jsx` — 🔗 KB badge with navigate-to-collect
- **Inbox Bulk Actions:** Toggle "☑ Chọn nhiều" mode → checkboxes appear on each item. Bulk classify (📂 picks type for all selected) and bulk delete (🗑). Select all/none toggle. Activity log for bulk operations.
- **Activity Log for Inbox:** `handleClassify()` and `handleSnooze()` now log to activity_logs for traceability in Life Log heatmap/timeline.

### Changed
- `useSubscriptions.js` — `getMonthlyCost()` now handles all 4 cycles correctly
- `InboxPage.jsx` — Bulk mode state + UI + handlers + activity log integration
- `CollectPage.jsx` — Import `useUserTasks`, pass `onCreateTask` to ReaderView
- `TaskListSection.jsx` — Import `useNavigate`, render 🔗 KB badge
- `inbox.css` — ~100 lines: bulk bar, classify menu, checkbox, selected highlight (dark/light)

### Database
- `data/migration_v4.4.0_task_knowledge_link.sql` — Run BEFORE deploying frontend v4.4.0

### Files Modified
- `src/pages/IncubatorPage.jsx`
- `src/hooks/useSubscriptions.js`
- `src/pages/InboxPage.jsx`
- `src/pages/CollectPage.jsx`
- `src/hooks/useUserTasks.js`
- `src/components/TaskListSection.jsx`
- `src/styles/inbox.css`
- `data/migration_v4.4.0_task_knowledge_link.sql` [NEW]

---

## v4.3.0 — 2026-05-01

### Added
- InboxPage: Filter chips (Tất cả / Có URL / Gần đây 7 ngày) — client-side filtering, no search bar
- IncubatorPage: "▼ Xem dự định đã bỏ qua" toggle — collapsible archive view for abandoned intentions
- `useIntentions.fetchAbandoned()` — fetches intentions with status='abandoned'

### Changed
- `InboxPage.jsx` — filter state + chip UI + filtered rendering with smart empty state
- `IncubatorPage.jsx` — archive toggle + read-only abandoned cards
- `inbox.css` — `.inbox-filter-chip` styles (dark/light mode)
- `useIntentions.js` — added `fetchAbandoned` export

### Removed
- `data/migration_v4.3.0_drop_tags_column.sql` — drops deprecated `collections.tags TEXT[]` column

### Files Modified
- `src/pages/InboxPage.jsx`
- `src/pages/IncubatorPage.jsx`
- `src/hooks/useIntentions.js`
- `src/styles/inbox.css`
- `data/migration_v4.3.0_drop_tags_column.sql` [NEW]

---

## v4.2.1 — 2026-05-01

### Added
- `useExpenses.updateExpense(id, updates)` — optimistic update + rollback
- FinancePage: ✏️ edit button on each expense → modal with amount/category/note
- `useSubscriptions.fetchSubs` auto-advances expired `next_due` by cycle (bounded MAX_ADVANCES=24)
- TrackerPage: 🥚 Incubator Review Banner — yellow alert when intentions have review_date ≤ today, links to `/incubator`

### Changed
- `useExpenses.js` — added `updateExpense` export
- `useSubscriptions.js` — `fetchSubs` now auto-advances expired subs
- `TrackerPage.jsx` — imports `useIntentions`, adds review banner widget
- `FinancePage.jsx` — wrapped return in Fragment for edit modal overlay
- `finance.css` — added `.finance-list__edit` styling

### Files Modified
- `src/hooks/useExpenses.js`
- `src/hooks/useSubscriptions.js`
- `src/pages/FinancePage.jsx`
- `src/pages/TrackerPage.jsx`
- `src/styles/finance.css`

---

## v4.2.0 — 2026-05-01

### Added
- **🥚 Incubator Multi-Output Router:** Execute Modal chuyển từ Radio (chọn 1) sang Checkbox (đa lựa chọn). Khi thực thi một dự định, user có thể tạo đồng thời:
  - 💰 **Chi tiêu** → `addExpense()` + dropdown chọn 1 trong 8 category. Tự động điền `estimated_cost`.
  - 🔁 **Thói quen** → `addHabit()` + tự động điền `durationMin` từ `estimated_time`.
  - 📌 **Công việc** → `addTask()` + tự động điền `durationEst` từ `estimated_time`.
- **Auto-suggest:** Pre-check options dựa trên data: cost > 0 → Expense, time > 0 → Habit, cả 2 = 0 → Task.
- **estimated_time UI:**
  - Form: Dropdown `⏱ Cam kết thời gian` (15m/30m/1h/1.5h/2h/nửa ngày) thay vì ô số.
  - Card: Badge `⏱ 1h` / `⏱ 30m` hiển thị cạnh badge 💰 chi phí.
- **Migration:** `data/migration_v4.2.0_incubator_v2.sql` — `converted_to` TEXT → TEXT[], thêm `converted_ids` JSONB.

### Changed
- `useIntentions.js` — `executeIntention(id, { convertedTypes, convertedIds })` thay `{ convertTo, convertedId }`.
- `IncubatorPage.jsx` — Import thêm `useExpenses`, `useCustomHabits`, `expense-categories.json`. Multi-dispatch handler.
- `incubator.css` — Thêm ~150 dòng: exec option cards, checkbox visual, category dropdown, duration badge, light mode.

### Database
- `data/migration_v4.2.0_incubator_v2.sql` — Run BEFORE deploying frontend v4.2.0.

---


### Fixed
- **Sidebar avatar dropdown** (`Navbar.jsx`) — Rewritten with React Portal + `getBoundingClientRect`. Menu no longer clipped by `overflow-y: auto` on sidebar. Renders correctly above avatar at fixed viewport position.
- **Inbox add button** (`useCollections.js`) — Removed `content_format`, `body_text`, `word_count` from `addItem` insert payload. These optional columns (migration v3.2.0) caused insert failure on instances where migration hadn't been applied.
- **Button disabled state** (`global.css`) — Added `.btn-primary:disabled` style with `opacity: 0.4` + `cursor: not-allowed` — previously disabled buttons looked identical to enabled ones.
- **Sidebar layout** (`navbar.css`) — Moved `overflow-y: auto` from `.sidebar` to `.sidebar__nav`. Added `position: relative; z-index: 10` to `.sidebar__bottom` to allow dropdown to escape nav stacking context.

---

## v4.1.0 — 2026-04-30

### Added
- **⚙️ Settings Page (`/settings`):** Trang cài đặt mới — hiện tại quản lý Tags (CRUD, rename, recolor, usage count). Future: Theme, Notifications, Account.
  - `SettingsPage.jsx` [NEW] — Tag Manager UI: danh sách tag + form thêm mới + inline edit + color picker + delete with confirmation.
  - `settings.css` [NEW] — Glassmorphism layout, color picker grid, responsive, dark/light mode.
- **🏷️ Tag Unification (Collection Tags):** Chuyển `collections.tags` (TEXT[]) sang central `tags` + `collection_tags` junction table.
  - `migration_v4.1.0_tag_unification.sql` [NEW] — `collection_tags` table + RLS + indexes + data migration script (TEXT[] → junction).
  - `useTags.js` — `updateTag(id, {name, color})` [NEW], `getTagsForEntity()` [NEW], `getTagUsageCount()` [NEW], `getAllTagUsageCounts()` [NEW]. `linkTag`/`unlinkTag` now support `entityType='collection'`.
  - `useCollections.js` — `fetchItems()` joins `collection_tags(tags(id,name,color))` → `item._tags`. `addItem()` no longer writes to `collections.tags` TEXT[] column.
  - `CollectPage.jsx` — Switched to central tags: TagInput shows color dots, tag filter chips show color dots, save/edit uses `linkTag`/`unlinkTag`.
- **Navbar:** ⚙️ Cài Đặt link in SECONDARY_NAV.

### Changed
- `App.jsx` — Route `/settings` + lazy import SettingsPage + SEO meta.
- `Navbar.jsx` — Added ⚙️ Settings nav link.
- `collections.tags` column — Marked DEPRECATED (comment). Will be removed in v5.0.

### Database
- `data/migration_v4.1.0_tag_unification.sql` — Run BEFORE deploying frontend v4.1.0.

---

## v4.0.3 — 2026-04-30

### Added
- **Fitness edit (Phase 2):** `updateLog(id, fields)` in `useFitnessLog.js` — optimistic update + rollback.
- **Fitness inline edit UI:** Click log item or ✏️ button → inline edit form (session name, duration, energy, notes) + Save/Huỷ.
- **Dashboard Fitness card:** Compact "🏋️ Tuần Này" section with 3 KPI cards + today summary. CTA → Tracker fitness tab.

### Changed
- `useFitnessLog.js` — Phase 2 docstring, full CRUD (add + update + delete).
- Resolves Technical Debt #4 (fitness edit).

---

## v4.0.2 — 2026-04-30

### Fixed
- **spawnRecurringTask retry:** Bounded retry (max 3 attempts, 1s/2s backoff) khi insert recurring task thất bại. Trước đây: silent fail → task lặp lại không được tạo. Bây giờ: retry + structured `console.error` log khi hết retry.

---

## v4.0.1 — 2026-04-30

### Changed
- **InboxPage overflow menu:** Refactor 7 inline action buttons → 2 primary (📌 Task + 🗑) + overflow menu (···) dropdown.
  - Overflow contains: 📂 Phân loại, 💸 Chi tiêu, 🔄 Đăng ký, 🥚 Ấp Trứng, 🕔 Snooze.
  - Click-outside auto-close.
  - Glassmorphic dark/light theme dropdown.
  - Fixes Technical Debt #1 (action overflow since v3.5.0).

---

## v4.0.0 — 2026-04-30

### Added
- **🏋️ Health/Fitness Tab (Phase 1):** Tab thứ 5 trong TrackerPage.
  - `migration_v4.0.0_fitness.sql` [NEW] — `fitness_logs` table + RLS + index.
  - `useFitnessLog.js` [NEW] — addLog, deleteLog, todayLogs, weekSummary.
  - TrackerPage — Form nhập (tên buổi tập + thời gian + năng lượng + ghi chú), today log list, week summary cards.
  - XP integration: +10 XP/buổi tập + logActivity('fitness_done').
- **🔗 Reader View (Metadata Preview):**
  - `api/meta.js` [NEW] — Vercel Edge Function fetch OG metadata (title, image, desc) với 5s timeout + graceful fallback.
  - `useLinkMeta.js` [NEW] — Client-side cache + fetch hook.
  - InboxPage — Preview card (thumbnail + title + desc) cho inbox items có URL.
  - `inbox.css` — Link preview styles (dark/light).

### Changed
- `TrackerPage.jsx` — 5 tabs (thêm 🏋️ Sức Khỏe).
- `InboxPage.jsx` — Auto-fetch link meta, render preview card.

---

## v3.9.0 — 2026-04-30

### Added
- **🥚 Incubator Module (Trạm Ấp Trứng):** Module mới cho "someday-maybe" items.
  - `IncubatorPage.jsx` [NEW] — Card UI với review-due highlighting, expandable timeline logs.
  - `useIntentions.js` [NEW] — CRUD + deferIntention (reason bắt buộc) + executeIntention (→ Task/Expense) + abandonIntention + getLogs.
  - `incubator.css` [NEW] — Full page styles, modals, timeline, dark/light theme.
  - `migration_v3.9.0_incubator.sql` [NEW] — `intentions` + `intention_logs` tables + RLS.

### Changed
- `App.jsx` — Route `/incubator` + lazy import.
- `Navbar.jsx` — Link 🥚 Incubator trong main nav.
- `InboxPage.jsx` — Nút 🥚 Ấp Trứng chuyển inbox item vào Incubator.

---

## v3.8.0 — 2026-04-30

### Added
- **Inbox — Snooze (🕔):** Nút 🕔 Snooze trên inbox item → dropdown 4 options (1 tuần / 2 tuần / 1 tháng / 3 tháng). Item ẩn khỏi danh sách, tự xuất hiện lại khi đến ngày. Badge "🕔 X snoozed" trong header.
- **Migration:** `data/migration_v3.8.0_snooze.sql` — `ALTER TABLE collections ADD snoozed_until DATE`.

### Changed
- `src/hooks/useCollections.js` — `snoozeItem(id, untilDate)`, `getSnoozedCount()`, `fetchItems` filter snoozed inbox items, `getInboxCount` excludes snoozed.
- `src/pages/InboxPage.jsx` — Snooze button + dropdown menu, snoozed count badge in header, handleSnooze helper.
- `src/styles/inbox.css` — Snooze button + menu styles (amber theme, dark/light mode).

---

## v3.7.0 — 2026-04-30

### Added
- **Finance — Cashflow Calendar (📅):** `CashflowBar.jsx` [NEW] — thanh timeline 30 ngày hiển thị subscription due dates. Dot đỏ + tooltip + legend. Mount dưới summary cards trong FinancePage.
- **PARA Tags (🏷️):** `useTags.js` [NEW] — CRUD tags, linkTag/unlinkTag cho expenses + subscriptions. `TagPicker.jsx` [NEW] — searchable dropdown, multi-select, tạo tag mới bằng Enter.
- **Migration:** `data/migration_v3.7.0_para.sql` — `tags`, `expense_tags`, `subscription_tags` tables + RLS + indexes.

### Changed
- `src/pages/FinancePage.jsx` — Import CashflowBar, TagPicker, useTags. Mount CashflowBar sau upcoming alert. TagPicker trong cả expense và subscription forms. Link tags on save.
- `src/styles/finance.css` — Thêm ~130 dòng `.cashflow-bar-*` styles (track, cells, dots, legend, dark/light theme).

---

## v3.6.0 — 2026-04-30

### Added
- **Task — Energy Tag (⚡):** Mỗi task gắn energy level (high/medium/low). Picker 3 nút trong form. Badge emoji trên task card. Filter chips (Tất cả/Cao/Vừa/Thấp) đầu danh sách.
- **Task — Duration Estimate (⏱):** 5 mức thời gian (5p/15p/30p/1h/2h+). Picker trong form, badge hiển thị trên card.
- **Task — Recurring Tasks (🔁):** Toggle "Lặp lại" trong form → chọn Mỗi N ngày / Hàng tuần thứ X / Hàng tháng ngày Y. `recurrence_rule` JSONB lưu vào DB. Spawn-one strategy: completeTask → `spawnRecurringTask()` insert 1 row mới với `due_date` tương lai. Không batch, không vòng lặp.
- **Date helpers:** `addDays()`, `nextWeekday()`, `nextMonthDay()` trong `useUserTasks.js`.
- **Migration:** `data/migration_v3.6.0_tasks.sql` — `ALTER TABLE user_tasks ADD COLUMN energy_level / duration_est / recurrence_rule`.

### Changed
- `src/hooks/useUserTasks.js` — `addTask()` nhận `energyLevel/durationEst/recurrenceRule`. `completeTask()` fire-and-forget `spawnRecurringTask()` khi task có recurrence_rule.
- `src/components/TaskListSection.jsx` — Thêm ENERGY_OPTIONS, DURATION_OPTIONS, WEEKDAYS constants. Form: Energy picker + Duration picker + Recurrence toggle (interval/weekly/monthly). Task cards: 🔁/⚡/⏱ badges. Filter chips trước danh sách. filterFn áp dụng trên filteredToday/filteredOverdue/filteredFuture.

---

## v3.5.0 — 2026-04-30

### Added
- **Inbox — Quick Expense (💸):** Nút "💸 Chi tiêu" trên mỗi inbox item → QuickExpenseModal inline. Regex tự bóc tách số tiền từ text Việt Nam ("Cafe 50k" → 50,000). Pre-fill amount + note + category dropdown 8 loại. Lưu → `addExpense()` + `logActivity()` + xóa item khỏi inbox.
- **Task — Overdue Triage (⚠️):** Task list chia 3 khối: ⚠️ Quá hạn (nền đỏ) / 📅 Hôm nay / 🔮 Sắp tới (collapsed mặc định).
- **Task — Rollover (🔄):** Nút 🔄 trên overdue task → cập nhật `due_date = today` → task chuyển sang section Hôm nay.
- **useUserTasks hook:** Thêm `todayTasks`, `overdueTasks`, `futureTasks` derived state + `rolloverTask()` function.

### Changed
- `src/pages/InboxPage.jsx` — Thêm import `useExpenses`, `useActivityLog`, `EXPENSE_DATA`. Thêm `extractAmount()` regex, `QuickExpenseModal` component, `handleToExpense()`, `handleExpenseSave()`.
- `src/styles/inbox.css` — Thêm ~180 dòng: `.inbox-expense-modal-*` styles (backdrop blur, glassmorphism modal, category grid, amount preview, light mode variants).
- `src/components/TaskListSection.jsx` — Tái cấu trúc: dùng `todayTasks/overdueTasks/futureTasks` thay `pendingTasks`. Extract `renderTask()` helper. Thêm Overdue section, collapsed Future section, Rollover button.
- `src/hooks/useUserTasks.js` — Thêm derived splits + `rolloverTask()`. Export 3 fields mới.

---

## v3.4.0 — 2026-04-27

### Added
- **Google Docs UI for Tiptap Editor:**
  - Integrated `lucide-react` for clean, professional icons replacing text buttons.
  - Added new extensions: `@tiptap/extension-underline`, `@tiptap/extension-text-align`, `@tiptap/extension-text-style`, `@tiptap/extension-color`.
  - Added dropdown for Heading levels (Normal text, H1, H2, H3).
  - Added native color picker for text coloring.
  - Added alignment buttons (Left, Center, Right, Justify).
  - Redesigned toolbar with grouping and vertical dividers.
- **Shortcuts:** Added shortcuts for Underline (`Ctrl+U`) and Alignments (`Ctrl+Shift+L/E/R/J`).

### Changed
- `tiptap.css`: Rewrote `.tp-btn` for icon layout, added `.tp-toolbar-dropdown`, `.tp-select`, and `.tp-color-picker` styling to match Google Docs flat aesthetic.

---

## v3.3.1 — 2026-04-27

### Fixed
- **Light mode CSS:** Comprehensive overrides for Tiptap editor — toolbar buttons, active states, divider, link popover, slash menu, shortcuts modal, footer, code/blockquote/highlight/table/mark all now visible and properly contrasted.
- **Word count realtime:** Tiptap mode now uses `CharacterCount.words()` (accurate) instead of manual text split. Passed as 3rd arg in `onChange(json, text, words)`. EditorView header updates in realtime.
- **Expanded shortcuts panel:** Added 3rd section "✍️ Gõ tắt Markdown" (9 auto-format rules: `# `, `## `, `- `, `1. `, `> `, `---`, etc.). Added Tab/Shift+Tab, Shift+Enter to Khối section.
- **Markdown keyboard shortcuts [NEW]:** `Ctrl+B/I/E/K/1/2/3`, `Ctrl+Shift+X/B/C/7/8/9`, `Ctrl+S` save, `Ctrl+P` block, `Ctrl+.` shortcuts panel. Also added `⌨` button to Markdown toolbar.

### Changed
- `TiptapEditor.jsx` — Export `ShortcutsModal` + `MD_SHORTCUT_SECTIONS` for Markdown reuse. `sections` prop for ShortcutsModal.
- `CollectPage.jsx` — MarkdownEditor now accepts `onSave`, has `handleKeyDown`, `mdShortcutsOpen` state, ShortcutsModal.
- `tiptap.css` — ~200 lines of light mode overrides (was 8 lines).
- `collect.css` — Added `.kb-tb-divider` style.

---

## v3.3.0 — 2026-04-27

### Added
- **Tiptap — Slash Command Menu (`/`):** Gõ `/` trong editor → dropdown 12 block types (Paragraph, H1-H3, Bullet/Ordered/Task List, Blockquote, Code Block, Divider, Table, Highlight). Filter theo text (`/hea` → Heading 1/2/3). Arrow keys + Enter + Escape navigation. Dùng `@tiptap/suggestion` plugin.
- **Tiptap — Keyboard Shortcuts Panel (`Ctrl+.`):** Modal glassmorphism hiển thị 25+ phím tắt, chia 4 nhóm (Văn bản, Khối, Chèn, Chung). Toggle bằng nút `⌨` trên toolbar hoặc `Ctrl+.`.
- **Tiptap — Browser Shortcut Override:** `Ctrl+S` → save article (thay vì Save Page), `Ctrl+P` → blocked (không Print), `Ctrl+.` → toggle shortcuts panel. Xử lý qua `editorProps.handleKeyDown`.
- **SlashCommand.jsx [NEW]:** Component riêng cho Slash Command extension + UI dropdown.
- **`@tiptap/suggestion`** package (0 production deps, peer deps đã có).

### Changed
- `TiptapEditor.jsx` — Thêm `onSave` prop, `SlashCommandExtension`, `ShortcutsModal`, `handleKeyDown` browser override, footer hint (`/` + `Ctrl+.`).
- `CollectPage.jsx` — Pass `onSave={handleSaveDraft}` to TiptapEditor cho Ctrl+S save.
- `tiptap.css` — Thêm styles cho slash menu, shortcuts modal, footer hint, light mode variants.
- `package.json` — Bump version 3.2.1 → 3.3.0.

---

## v3.2.1 — 2026-04-27

### Added
- **Dashboard — Mood Trend Chart:** Thay MoodChart7Day bar chart bằng dot-line SVG chart mới, toggle 7/30 ngày. Hiển thị average mood score, color-coded dots, emoji overlay, grid lines. Import `useMoodLog` vào Dashboard.
- **Dashboard — Focus Breakdown:** Per-habit horizontal bar chart 7 ngày gần nhất. Query trực tiếp `focus_sessions` + join `habits` table từ Supabase. Hiển thị icon, tên habit, progress bar, phút, %.
- **Dashboard — Weekly Review Digest:** Collapsible summary card: Habits hoàn thành, XP, Chi tiêu, Mood TB — so sánh với tuần trước (↑/↓/→). Expand/collapse animation.

### Changed
- `package.json` — Bump version 3.1.0 → 3.2.1 (3.2.0 was documented but never bumped)
- `dashboard.css` — Add styles for MoodTrendChart, FocusBreakdown, WeeklyReview
- `DashboardPage.jsx` — Import `useAuth`, `supabase`, `useMoodLog`. Add 3 new widget components.
- `docs/FEATURES.md` — Update Dashboard section #5 with 3 new widgets
- `docs/ARCHITECTURE.md` — Update DashboardPage data sources diagram
- `docs/PLAN.md` — Fix Phase 7 incomplete items → Phase 8 backlog, add Phase 7.6 v3.2.1
- `docs/TASKS.md` — Mark Team v3 as ❌ CANCELLED, add v3.2.1 section

---

## v3.2.0 — 2026-04-26

### Added
- **Knowledge Base — Dual-Mode Editor:** Tích hợp Tiptap WYSIWYG editor bên cạnh Markdown. Mặc định = Markdown, có toggle sang Visual khi tạo bài mới.
- **Knowledge Base — Mode Lock:** Bài viết lock mode khi tạo (tiptap/markdown), không thể đổi khi edit lại.
- **Knowledge Base — Tag Autocomplete:** TagInput với searchable dropdown (tối đa 10 tags), phân trang scroll, tạo tag mới bằng Enter, lưu DB khi bài được save.
- **Knowledge Base — AI-ready schema:** 3 columns mới: `content_format`, `body_text` (plain text extracted), `word_count` (pre-computed) → sẵn sàng Phase 2 AI (embedding, RAG, semantic search).
- **TiptapEditor component:** `src/components/TiptapEditor.jsx` — WYSIWYG full toolbar (Bold/Italic/Strike/Highlight/Code/H1-H3/Lists/TaskList/Blockquote/CodeBlock/HR/Link/Table/Undo/Redo) + `TiptapReadOnly` cho reader view.
- **Inline Link Popover:** Thay `window.prompt` bằng inline link input bar hiện ngay dưới toolbar khi bấm 🔗.
- **ConfirmModal component:** `src/components/ConfirmModal.jsx` — Promise-based `useConfirm()` hook, drop-in thay toàn bộ `window.confirm()`. Glassmorphism UI, danger variant, Escape key, backdrop click, auto-focus.
- **isTiptapBody auto-detect:** Tự nhận dạng bài Tiptap từ body JSON shape khi `content_format` column chưa được migrate.
- **safeHostname helper:** Guard `new URL(url)` crash với URL invalid/relative.

### Changed
- `useCollections.addItem` — Nhận đầy đủ `content_format`, `body_text`, `word_count` thay vì hardcode fixed fields.
- `ArticleCard` — Dùng `body_text` (plain text) cho excerpt thay vì `body` raw (tránh hiển thị JSON Tiptap).
- `ReaderView` — Auto-detect format, render `TiptapReadOnly` hoặc `ReactMarkdown` tương ứng.
- `handleSave` — Truyền đủ payload mới vào DB khi save/update.
- `HabitManager` — Nút xóa dùng `useConfirm` modal thay `window.confirm`.
- `LifeJourneyPage` — Nút Reset dùng `useConfirm` modal thay `window.confirm`.

### Removed
- `makeExcerpt()` — Dead code, đã thay bằng `body_text.slice(0, 180)`.
- Tất cả `window.confirm()`, `window.alert()`, `window.prompt()` trong active code.

### Fixed
- `TiptapEditor` imports — Đổi từ default sang named exports (`{ Table }`, `{ Link }`, v.v.) để tránh Vite runtime error.
- `new URL(item.url).hostname` không được guard → crash khi URL invalid.

### Database
- `data/migration_v3.2.0_knowledge.sql` — `ALTER TABLE collections ADD COLUMN content_format / body_text / word_count`

---

## v3.1.2 — 2026-04-26

### Added
- **Dashboard:** Mood 7-day chart — inline SVG line chart với emoji overlay, hiển thị xu hướng cảm xúc 7 ngày gần đây
- **Finance:** `CustomSelect` component — thay native `<select>` bằng glassmorphic dropdown với animation slide-down, icon emoji, active highlight
- **Finance Subscription:** 4 chu kỳ: `1 tháng / 3 tháng / 6 tháng / 1 năm` (thay vì chỉ 2)
- **Finance Subscription:** Nút "Tự tính ↻" — auto-fill ngày gia hạn dựa theo chu kỳ chọn
- **Finance Subscription:** Label rõ "📅 Ngày gia hạn tiếp theo" + date field styled với `color-scheme`
- **Life Log:** `selectedDate` mặc định = hôm nay → vào trang là thấy timeline ngay, không cần click heatmap

### Fixed
- `migration_v3.0.0.sql` — Index `idx_activity_logs_user_date` dùng `created_at::date` gây lỗi `ERROR: 42P17` (function not IMMUTABLE) → đổi thành `created_at` plain

### Performance
- `DashboardPage` — `monthStart` và `todayStr` dùng `useMemo` tránh recreation mỗi render
- `DashboardPage` — Chart components bọc `React.memo` tránh re-render không cần thiết
- Bundle: lazy-load tất cả heavy pages

### Database
- `data/schema_v3.1.1.sql` — **Migration gộp mới**: 1 file duy nhất (456 dòng) thay 8 file lịch sử. Dùng cho fresh Supabase project. Gộp tất cả tables trừ Team (archived)

---

## v3.1.1 — 2026-04-26

### Fixed
- **UX Bug:** Bôi đen text bên trong bất kỳ popup/modal nào đều bị đóng popup (close-on-text-select)
- **Root cause:** Các overlay backdrop dùng `onClick` — khi user drag để bôi text, `mouseup` bubble lên backdrop → trigger close
- **Fix:** Thay `onClick` backdrop bằng `onMouseDown` + `onMouseUp` target check — chỉ đóng khi cả mousedown VÀ mouseup đều hit đúng backdrop element (không phải từ bên trong modal)
- **Files affected:**
  - `QuickCapture.jsx` — `.qc-backdrop`
  - `LifeJourneyPage.jsx` — `EventModal .lj-overlay`
  - `CustomJourneyModal.jsx` — `.journey-modal-overlay`
  - `CompletionModal.jsx` — `.completion-overlay`
  - `ContentSections.jsx` — `MiniLesson .modal-overlay`

---

## v3.1.0 — 2026-04-26

### Added
- `DashboardPage.jsx` — Unified Life Hub Dashboard: tổng hợp stats từ tất cả modules
- **Today Overview row:** 4 KPIs hôm nay (Hoạt động từ activity_logs, Focus phút từ useFocusTimer, Chi tiêu hôm nay từ expenses, XP kiếm được hôm nay)
- **Finance Section:** 3 KPI cards (Chi tháng / Đăng ký/tháng / Sắp hết hạn) + Finance Pie donut SVG chart (category breakdown tháng này)
- **Activity Heatmap:** Thay ContributionGraph habit-only bằng ActivityHeatmap (reuse component từ LifeLogPage) — lịch sử toàn hệ thống
- **Section Dividers:** `SectionTitle` component với gradient underline, icon, action link
- **TodayKpi component:** Card với hover lift effect, gradient overlay
- **FinancePie component:** SVG donut chart với legend (category + amount + %)
- `dashboard.css` — Hoàn toàn rewrite: Today KPI row, Finance KPI row, Finance Pie, Section Title dividers, hover animations

### Changed
- `DashboardPage.jsx` — Tích hợp thêm hooks: `useExpenses`, `useSubscriptions`, `useActivityLog`, `useFocusTimer`
- `DashboardPage.jsx` — Giữ nguyên: FlowerJourney, MonthDonut, WeeklyTable, SkipInsight, streak insight
- `DashboardPage.jsx` — Xóa inline `ContributionGraph` (habit-only) → thay bằng `ActivityHeatmap` (all modules)

---

## v3.0.1 — 2026-04-25

### Added
- `KnowledgeResurface.jsx` — "Hôm nay nhớ lại" spaced repetition widget (random Collect resurface, dismiss per session)
- `FinancePage` — Inline SVG Pie chart (category donut) + 7-day bar chart trend
- `InboxPage` — "→ Task" action (📌 converts inbox item to user_task) + "→ Sub" action (🔄 navigates to Finance)
- `TrackerPage` — SubAlert + KnowledgeResurface wired inline between XpBar and Hero section

### Changed
- `widgets.css` — Added KnowledgeResurface styles (cyan accent)
- `finance.css` — Added chart row layout, pie chart, bar chart styles

---

## v3.0.0 — 2026-04-25

### BREAKING — Personal Life Hub Pivot
- **Archived** Team/Friends modules → `src/_archived/` (pages, hooks, components, CSS)
- `/team` and `/friends` routes now redirect to `/tracker`

### Added
- `data/migration_v3.0.0.sql` — 4 new tables: `collections`, `expenses`, `subscriptions`, `activity_logs` + RLS + indexes
- `src/data/expense-categories.json` — 8 default expense categories (Rule 14)

### Changed
- `App.jsx` — Removed TeamPage/FriendsPage lazy imports, routes redirect
- `Navbar.jsx` — Removed Team/Friends nav links
- `TrackerPage.jsx` — Removed `useTeam` import (unused)
- `DailyChallenge.jsx` — Removed `useTeam`, always uses solo challenge pool

### Removed
- `src/pages/TeamPage.jsx` → archived
- `src/pages/FriendsPage.jsx` → archived
- `src/hooks/useTeam.js` → archived
- `src/hooks/useTeamCheck.js` → archived
- `src/hooks/useTeamRules.js` → archived
- `src/styles/team.css` → archived
- `src/styles/friends.css` → archived
- `src/components/team/` (4 components) → archived

### Added — Navigation Restructure (Phase 6.2)
- `Navbar.jsx` — Complete rewrite: Sidebar (desktop, fixed left 220px) + Top bar (mobile) + Bottom tabs (mobile, 6 items)
- `navbar.css` — New sidebar + bottom tabs + topbar layout with glassmorphism, light/dark theme support
- `QuickCapture.jsx` — Global floating [+] button → saves to `collections` table as type='inbox'
- `quick-capture.css` — FAB with gradient + pulse animation, slide-up capture modal
- `placeholder-page.css` — Shared "Coming Soon" layout for unreleased pages
- `InboxPage.jsx` — Placeholder (lazy-loaded)
- `CollectPage.jsx` — Placeholder (lazy-loaded)
- `FinancePage.jsx` — Placeholder (lazy-loaded)
- `LifeLogPage.jsx` — Placeholder (lazy-loaded)

### Changed — Navigation Restructure
- `App.jsx` — Added `.app-content` wrapper for sidebar offset; 4 new routes; QuickCapture component; SEO meta rebranded "Life Hub"
- `Navbar.jsx` — Primary nav (Today, Inbox, Collect, Finance, Life Log) + Secondary nav (Focus, Journey, Stats, Quiz, BXH, Hành Trình)

### Added — Activity Log System (Phase 6.3)
- `useActivityLog.js` — Append-only hook: `logActivity()`, `getHeatmapData()`, `getTimelineByDate()`, `getTodayCount()`
- Wired into TrackerPage (habit_done, habit_undo, mood_set), DailyChallenge (challenge_done), QuickCapture (collect_add), useFocusTimer (focus_done)

### Added — Inbox + Collect Module (Phase 6.4)
- `useCollections.js` — CRUD hook for collections table (add, classify, star, archive, delete, inboxCount)
- `InboxPage.jsx` + `inbox.css` — Quick-add form, inbox items list, classify→type actions, delete
- `CollectPage.jsx` + `collect.css` — Tabbed view (All/Links/Quotes/Want/Learn/Ideas), search, card grid with type-accent borders

### Added — Finance Module (Phase 6.5)
- `useExpenses.js` — CRUD for expenses (VNĐ, date-range fetch, getTotal, getByCategory)
- `useSubscriptions.js` — CRUD for subscriptions (monthly/yearly, toggleActive, getUpcoming, getMonthlyCost)
- `FinancePage.jsx` + `finance.css` — 2 tabs (Chi tiêu + Đăng ký), summary cards, category breakdown bars, expense list, subscription cards with expiry countdown

### Added — Life Log Module (Phase 6.6)
- `ActivityHeatmap.jsx` — GitHub-style SVG heatmap (53×7 grid, purple scale, click-to-drill)
- `DailyTimeline.jsx` — Vertical timeline with action icons, timestamps, labels
- `LifeLogPage.jsx` + `lifelog.css` — Yearly heatmap + today stat badge + drill-down daily timeline

### Added — Sidebar Widgets (Phase 6.7)
- `SubAlert.jsx` — Compact alert showing upcoming subscription renewals (≤7 days), auto-hides when empty
- `DailyReview.jsx` — Today-recap widget (total activity count + last 5 actions), auto-hides when empty
- `widgets.css` — Shared styles for sidebar widgets
- Wired both widgets into `Navbar.jsx` sidebar bottom section

### Changed — Branding
- `package.json` — name: `life-hub`, version: `3.0.0`
- `index.html` — All meta tags + title rebranded to "Life Hub — Personal Life OS"
- `manifest.json` — name/short_name/description updated to Life Hub

---

## v2.3.0 — 2026-04-25

### Added
- `MonthCalendar.jsx` — Display mood emoji on calendar cells (top-left corner indicator)
- `MonthCalendar.jsx` — Show mood + skip reason in day detail panel when clicking a date
- `calendar.css` — `.cal-cell__mood` positioning style

### Changed
- `TrackerPage.jsx` — Pass `moodLog` and `skipLog` to MonthCalendar component

---

## v2.2.3 — 2026-04-25

### Fixed
- `useXpStore.js` — Added `isReady` flag: `hasMilestone()` returns `true` conservatively until DB log loads, preventing double XP awards during async window
- `useXpStore.js` — Server-side dedup in `addXp()`: queries existing entry before INSERT (belt-and-suspenders with client dedup)
- `DailyChallenge.jsx` — Syncs `done` state with XP log on load; prevents re-awarding if localStorage was cleared

### Changed
- `useXpStore.js` — Now exports `isReady` flag for consumers to check load status
- `useXpStore.js` — `duo_streak` marked as TODO (planned for Team v3, not wired yet)

---

## v2.2.2 — 2026-04-25

### Added
- `data/migration_v2.2.2_security.sql` — 5 database security fixes (run manually in Supabase SQL Editor)

### Security Fixes
- `progress` RLS — Teammates can now read each other's progress (was owner-only in team v3 SQL)
- `team_check_logs` RLS — Blocked self-check (checked_id != auth.uid()) + require same team
- `streaks` RLS — Removed client INSERT/UPDATE policies (write only via trigger)
- `xp_logs` — Added CHECK constraint: amount BETWEEN -200 AND 200
- `handle_new_user` trigger — Merged legacy + team v3 versions (creates username + streaks + notification_settings)

### Fixed
- `docs/DATABASE.md` — Synced xp_logs column names to match actual schema (amount/meta, not xp_amount/metadata)

---

## v2.2.1 — 2026-04-25

### Removed
- `src/pages/HabitsPage.jsx` — Deleted deprecated redirect file (dead code since v1.9.0). Route `/habits` now uses inline `<Navigate>` in `App.jsx`

### Changed
- `src/App.jsx` — Removed lazy import + SEO meta for `/habits`. Route kept as inline redirect
- `src/pages/JourneyPage.jsx` — Fixed dead link `/habits` → `/tracker` in success toast
- `src/hooks/useFocusTimer.js` — Updated stale comment reference
- `src/components/TrackerSection.jsx` — Updated stale comment reference
- `src/styles/journey.css` — Updated CSS comment header

---

## v2.2.0 — 2026-04-22

### Added
- `src/pages/LifeJourneyPage.jsx` + `LifeJourneyPage.css` — Life emotion timeline: SVG chart (Catmull-Rom), dual view (compact/expanded), event list grid, stats cards
- `src/hooks/useLifeJourney.js` — CRUD milestones (add/update/delete/resetToDefault), localStorage-only (`vl_life_journey_events`)
- `src/contexts/ThemeContext.jsx` — Dark/Light theme toggle, persist preference in `vl_theme` localStorage key
- Route `/life-journey` + Navbar link "💛 Hành Trình"
- SEO meta for `/life-journey` route in `App.jsx`

### Changed
- `src/App.jsx` — Wrap with `ThemeProvider` (outermost), lazy-load `LifeJourneyPage`
- `src/components/Navbar.jsx` — Add theme toggle button (☀️/🌙), add "💛 Hành Trình" nav link

---

## v2.1.0 — 2026-04-21

### Added
- `src/components/TaskListSection.jsx` — Personal task UI (📌 Nhiệm Vụ) in TrackerPage "Hôm Nay" tab
- `src/hooks/useUserTasks.js` — Task CRUD hook (Supabase-first, guest in-memory)
- `public/sw.js` — Service Worker for background task due-time notifications
- `data/migration_v2.1.0.sql` — `user_tasks` table + RLS + indexes
- Task list: title, description, due date/time, overdue indicator, completion with timestamp
- Calendar integration: click day → see completed tasks with expandable description + completion time
- Service Worker registered in `App.jsx` — notifications work even when tab is closed

### Changed
- `src/components/MonthCalendar.jsx` — Accept `getCompletedTasks` prop, show tasks in day detail panel
- `src/pages/TrackerPage.jsx` — Add `TaskListSection` between Mood and Daily Challenge, pass `getCompletedTasks` to calendar

---

## v2.0.0 — 2026-04-20

### Changed
- **Journey owns its habits.** Each journey creates its own fresh habit rows. When a journey is archived/completed, all its habits are closed (`active=false`). No reuse across journeys.
- **Replace mode:** Archive old journey + close all its habits → create fresh habits from template
- **Append mode:** Archive old journey, keep old habits active → add fresh template habits on top

### Fixed
- **completeJourney:** Now properly closes all active habits (`active=false, status='completed'`) when journey completes.
- **renewJourney:** Now snapshots old habits BEFORE completing, then clones them as fresh rows for the new cycle.
- **XP deduction on un-check:** Added `removeXp()` to `useXpStore`. Un-ticking a daily challenge or habit now properly deducts the XP. Previously XP was only added, never removed.

### Added
- **"Của Tôi" tab:** New tab on Journey page showing user's past journeys with "🔄 Bắt đầu lại" button.
- **Completion celebration UI:** When `completedDays >= targetDays`, ActiveJourneyPanel shows 🎉 banner with 3 actions: "Tiếp Tục Cycle N" (renew), "+21 Ngày" (extend), "✅ Hoàn Thành" (complete & close).

---

## v1.9.5 — 2026-04-20

### Fixed
- **Manage tab shows old habits after replace:** `useCustomHabits` fetched ALL habits from Supabase without filtering `active=true`. After replacing journey, deactivated habits still appeared in Quản Lý tab. Fix: added `.eq('active', true)` to the fetch query.

---

## v1.9.4 — 2026-04-19

### Fixed
- **Redirect loop:** Fixed a deep React batching race condition where `isLoadingJourney` flipped to `false` for exactly one render tick when authentication finished, before the journey fetch could begin. This caused the app to instantly redirect. Converted loading state to a synchronous derived variable to completely eliminate the race condition.

---

## v1.9.3 — 2026-04-19

### Added
- **Journey switch modal:** When switching to a new template, shows modal with 2 options: 🔄 Replace all habits / ➕ Append new habits. Warning: tick state resets, old journey saved to history.
- **lazyRetry wrapper:** Auto-reload on stale chunk errors after Vercel redeployment

### Fixed
- **History sort:** `started_at` (DATE, no time) → `created_at` (TIMESTAMPTZ) for newest-first ordering

---

## v1.9.2 — 2026-04-19

### Fixed
- **Redirect loop persists across reload:** `useRef` resets on page reload → redirect fires again every time. Fix: replaced with `sessionStorage` flag that survives reloads but clears on tab close
- **Cross-journey stale tick:** Switching journeys kept old "Hôm nay ✓" state from `useHabitStore` (localStorage). Fix: removed manual tick button entirely. Daily completion is now **auto-derived** from habit ticks (all habits done = day done)

### Changed
- Hero section now shows read-only status indicator (`X/Y habits` or `Hoàn thành! 🎉`) instead of clickable button

---

## v1.9.1 — 2026-04-19

### Fixed
- **firstTime redirect loop:** `AppShell` redirect fired on every render when `!activeJourney`, even when user was already on /journey. Fix: `useRef` + location check to fire redirect only ONCE
- **Signup → can't login:** DB trigger `handle_new_user` created profile WITHOUT username/email → `signIn` couldn't find profile by username. Fix: pass `username` in auth metadata + update trigger to extract it + change profile upsert `ON CONFLICT DO UPDATE`

### Added
- **Template habits seeded:** SQL migration seeds `program_habits` for all 5 templates (Buổi Sáng Kỷ Luật, Thói Quen Đọc Sách, Mindful Morning, Kỷ Luật Thể Chất, Deep Work 30 Ngày)
- **Month summary cards** in JourneyDetailPage: per-month progress rings with Hoàn thành/Bỏ qua/Còn lại stats

### Migration Required
- Run `data/migration_v1.9.0.sql` in Supabase SQL Editor

---

## v1.9.0 — 2026-04-19

### Fixed
- **Bug 1 — Templates show same 3 habits:** `ProgramBrowser` không join `program_habits` → `prog.habits = undefined`. Fix: `select('*, program_habits(*)')` + normalize
- **Bug 2 — Thêm habit thì mất defaults:** `useCustomHabits` fallback `DEFAULT_HABITS` cho authenticated user khi Supabase trả 0 rows → ghi đè khi user thêm 1 habit. Fix: authenticated user chỉ thấy real data từ DB, không fallback. Guest vẫn thấy demo habits
- **Bug 4 — Mood duplicate:** Cả TrackerPage lẫn HabitsPage đều render Mood section riêng. Fix: gộp thành 1 page duy nhất
- **Bug 5 — Weekly grid "mất data":** Label gây hiểu nhầm. Fix: thêm note "14 ngày gần nhất · lịch đầy đủ ở tab 📅"

### Changed (Page Consolidation)
- `src/pages/TrackerPage.jsx` — **Rewrite toàn bộ.** Absorb all HabitsPage features: per-habit tick, mood (1x), skip reason, calendar, weekly grid, habit manager. 4-tab navigation: ⚡ Hôm Nay | 📅 Lịch | 📊 Tuần | ⚙️ Quản Lý. Performance: `MonthCalendar` + `HabitManager` lazy-loaded, `PerHabitWeeklyGrid` memoized. Empty state CTA khi user chưa có habits
- `src/pages/HabitsPage.jsx` — Deprecated: redirect `/habits` → `/tracker`
- `src/components/Navbar.jsx` — Xóa "📋 Habits" khỏi nav (chỉ còn: Tracker, Focus, Lộ Trình, Team, Stats, Quiz, BXH)

### Added (Journey Dashboard)
- `src/pages/JourneyDetailPage.jsx` — **Rewrite thành full dashboard.** Thêm `JourneyCalendar` (month view, 🟢 all done / 🟡 partial / ⬜ missed / ⚫ outside range). Click ngày → `DayDetailModal` hiển thị: danh sách habits ✅/❌, tâm trạng, focus sessions với timestamp. Giữ stats grid, habit chips, mood distribution

---

## v1.8.1 — 2026-04-19

### Fixed (Critical)
- `src/hooks/useJourney.js` — **Bug:** Sau `startJourney()`, `JourneyContext.activeJourney` vẫn là `null` (stale) vì `useJourney` quản lý local state riêng. **Fix:** Rewrite toàn bộ `useJourney` để đọc `activeJourney` từ `JourneyContext` (single source of truth). Mọi mutation (`start/complete/renew/extend`) đều gọi `setActiveJourney` và `saveLocalJourney` để context + localStorage đồng bộ ngay lập tức → `useHabitLogs`, `useFocusTimer` pick up đúng `journey_id` ngay sau khi bắt đầu journey
- `src/pages/JourneyPage.jsx` — Detect `?firstTime=true` param, hiển thị welcome banner "Chọn lộ trình đầu tiên"

---

## v1.8.0 — 2026-04-19

### Added
- `src/contexts/JourneyContext.jsx` — Single source of truth cho `activeJourney`. Fetch 1 lần khi login, expose qua `useActiveJourney()`. Tránh redundant Supabase calls từ nhiều hooks
- `src/pages/JourneyDetailPage.jsx` — Full page `/journey/:id`: stats đầy đủ của 1 journey (hoàn thành % thực tế, focus hours, XP, mood distribution, danh sách ngày đã tick đủ)
- `data/migration_v1.6.2.sql` — ALTER TABLE focus_sessions ADD COLUMN journey_id (phần 4 — cần chạy thủ công trong Supabase)

### Changed
- `src/App.jsx` — Wrap với `JourneyProvider`. Thêm redirect `/journey?firstTime=true` nếu user login nhưng chưa có journey. Thêm route `/journey/:id`
- `src/hooks/useHabitLogs.js` — Import `useActiveJourney`, tự động pass `journey_id` vào mọi `habit_logs` write (upsert + auto-tick). Không cần truyền prop nữa
- `src/hooks/useFocusTimer.js` — Import `useActiveJourney`, dùng `useRef` pattern để pass `journey_id` vào `focus_sessions` insert
- `src/hooks/useCustomHabits.js` — `addHabit()` tự động gắn `journey_id: activeJourney?.id` khi tạo habit mới
- `src/components/journey/JourneyHistory.jsx` — Mỗi card clickable → navigate `/journey/:id`

### Flow hoàn chỉnh sau v1.8.0
```
User login → JourneyContext fetch activeJourney
  → Nếu không có journey → redirect /journey?firstTime=true
  → Mọi habit tick → habit_logs.journey_id = activeJourney.id
  → Mọi focus session → focus_sessions.journey_id = activeJourney.id  
  → Mọi habit tạo mới → habits.journey_id = activeJourney.id
  → Journey kết thúc → click trong History → /journey/:id → xem full stats
```

---

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

## v2.0.0-auth — 2026-04-15

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
