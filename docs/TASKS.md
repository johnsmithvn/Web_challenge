# TASKS — Personal Life Hub (formerly Thử Thách Vượt Lười)
**Updated:** 2026-07-29

---

## v4.29.0 — ✅ DONE (2026-07-29) — `/tasks` rõ ràng + view Lịch (ponytail ultra)

### Done ✅
- [x] **Hero** — số việc cần làm ở display scale + `.gradient-text`, 3 tile Quá hạn/Hôm nay/Sắp tới với độ nổi mã hoá độ gấp
- [x] **Tab 📋 Danh sách / 📅 Lịch** — pill switcher, `role="tablist"` + `aria-selected`
- [x] **Xoá** block "Đã hoàn thành hôm nay" (~45 dòng) + tiêu đề/badge trùng trong card. Lint 64 → 62 warning
- [x] **`MonthCalendar` task mode** — ô cao 76px, chip tên task (tối đa 2 + `+N nữa`) thay dot. Ngày quá khứ không có task = transparent, **không** tô đỏ như habit miss
- [x] **Dải màu priority** 3px border-left, màu từ `PRIORITY_OPTIONS` (không tạo 5 class)
- [x] **Animation tick** thuần CSS `::after` + `:active`, **0 state React**, có `prefers-reduced-motion`
- [x] **Empty state** có icon + tiêu đề + hint
- [x] **`getCompletedTasks(dateStr)` → `getCompletedTasksRange(start, end)`** — 30 query/tháng → 1. Bỏ luôn `loadingTasks` + async click handler
- [x] **Sửa kèm bug lệch ngày:** group theo ngày **địa phương** (`toDateStr`) thay UTC bucket → task xong 00:00–07:00 giờ VN không còn rơi vào ô ngày hôm trước. `MonthCalendar.todayStr` cũng đổi từ `toISOString()` sang `toDateStr()` (1 trong 5 chỗ đã ghi nợ ở v4.26.1)
- [x] `npm run build` 0 lỗi · `lint` 0 error/62 warning · `test` 3/3 · `design:lint` **0 error**/76 warning (baseline: token màu chưa dùng)
- [x] Docs: `DESIGN.md` (2 section mới), `FEATURES.md` §9 viết lại 2 mode + §16 + §24, `ARCHITECTURE.md`, `PROJECT.md`, `CHANGELOG.md`

### Fixed sau khi user gửi screenshot ✅
- [x] **🔴 Root cause "trông như lỗi": `grid-template-columns: repeat(7, 1fr)`.** `1fr` = `minmax(auto, 1fr)` nên chip `nowrap` đẩy cột rộng ra → ô 28 rộng ~2.5× ô 29. Sửa `minmax(0, 1fr)` + `min-width: 0`. **Đo lại: 7 cột đều 147px**, chip trong ô (thừa 5px), ellipsis chạy
- [x] Ô ngày thêm hairline `1px --bg-glass-border` + `--bg-card` — không có viền thì lưới chỉ là số trôi
- [x] Ô done bỏ fill xanh (giữ `--bg-card`, viền `rgba(0,255,136,0.28)`) — ô xanh + chip xanh = khối nặng
- [x] `min-height` 76px → 62px, số ngày `opacity 0.75`
- [x] Bỏ progress bar ở task mode — thanh 6% trong track rộng nhìn như lỗi
- [x] `.tasks-page--calendar` nới 900 → 1180px, bớt khoảng trống 2 bên trên màn rộng
- [x] Ngày chưa tới: viền `dashed` + `opacity 0.45`, giữ ô cho lưới liền mạch
- [x] `DESIGN.md` ghi rõ quy tắc `minmax(0,1fr)` để không tái phạm

### ⏳ User tự verify (agent browser là guest, không đăng nhập được)
- [ ] Mở `/tasks` → tab **📅 Lịch** → xem chip tên task trong ô ngày có hiện đúng không
- [ ] Bấm 1 ngày → list task đã xong + expand mô tả + giờ hoàn thành
- [ ] Tick 1 task → xem animation `:active` (scale + lóe xanh)
- [ ] `/tracker` tab 📅 Lịch + `/life-log` — habit mode phải **y như cũ**, không regression

### Cố ý KHÔNG làm (ponytail ultra — model là Things 3 / Linear, KHÔNG phải ClickUp/Lark Base)
- [ ] ~~Week/day time-grid kiểu Google Calendar~~ — `due_time` mặc định `23:59` nên mọi task dồn vào 1 hàng đáy, nhìn như hỏng. Phần đắt nhất của GCal (cột giờ, thuật toán xếp event chồng, drag-resize, vạch giờ hiện tại) = 0 lợi ích cho dữ liệu all-day
- [ ] ~~Board view (kanban theo priority)~~ — hoãn: chưa chắc mở lần nào. Data đã đủ (`priority` 0–5), làm được lúc nào cũng được
- [ ] ~~Saved view~~ — chờ dùng thật để biết hay filter cái gì. Đừng thiết kế trước khi biết query (bài học `activity_logs`)
- [ ] ~~Assignee, comment, sprint, custom field, custom status, Gantt, workload, report, time tracking~~ — tool cho đội, 1 user = 0 giá trị. Custom field còn là bẫy schema-động làm mất khả năng enforce rule
- [ ] ~~Task ID ngắn (`Task #30`)~~ — hay thật, nhưng cần migration (`SERIAL` + backfill). Để đợt sau
- [ ] ~~Chiếu occurrence ảo của recurring lên lịch (kiểu Google Calendar)~~ — `spawnRecurringTask` hiện chỉ tạo occurrence **kế tiếp** và **chỉ khi** hoàn thành cái hiện tại, nên tối đa thấy 1 instance tương lai. Làm đúng = **tính occurrence ảo, không insert row** (task hàng tuần không nên tạo 52 row). Trade-off cần user xác nhận: occurrence ảo **không có `id`** nên không tick trực tiếp được, phải materialize thành row thật trước — giống cách Google Calendar tách 1 lần xuất hiện khỏi chuỗi

---

## v4.28.0 — ✅ CODE DONE / ⏳ SQL CHỜ USER CHẠY (2026-07-29) — Audit + refactor DB trục Inbox·Knowledge·Task·Tags

### Done ✅ (code, đã build + lint pass)
- [x] **Sửa bug link mất từ v4.5.0:** `CollectPage.onCreateTask` truyền `collectionId` → ghi vào cột deprecated không ai đọc → task tạo từ bài KB không có badge `🔗 N bài`, không hiện trong filter `📌 Task`. Nay dùng `linkCollection()` → junction
- [x] `useUserTasks.addTask` — bỏ tham số `collectionId` + cột `collection_id`
- [x] `IncubatorPage` — bỏ `durationEst` (tham số không tồn tại, bị bỏ qua im lặng từ v4.9.0)
- [x] `useCollections` — bỏ ghi `priority`; `status` default + classify → `'unread'`
- [x] Viết `data/migration_v4.28.0_tags_rls_indexes.sql` (an toàn) + `data/migration_v5.0.0_cleanup_dead_columns.sql` (breaking)
- [x] `docs/DATABASE.md` — `task_tags`, section Views, section "Kiến trúc Tag — tại sao N junction"

### ⏳ User phải tự chạy (agent không kết nối Supabase) — ĐÚNG THỨ TỰ
- [ ] **B0.** Kiểm schema drift: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='chk_collections_type';` → có `podcast` không? Kết quả cho biết P0-1 là bug thật hay file lệch prod
- [ ] **B1.** Deploy code v4.28.0 lên prod
- [ ] **B2.** Chạy `migration_v4.28.0_tags_rls_indexes.sql` (an toàn, idempotent)
- [ ] **B3.** Backup DB
- [ ] **B4.** Chạy mục "KIỂM TRƯỚC" trong `migration_v5.0.0` — 6 câu SELECT phải = 0
- [ ] **B5.** Chạy `migration_v5.0.0_cleanup_dead_columns.sql` + smoke test 5 bước trong file
- [ ] **B6.** Hợp nhất 2 migration vào `data/schema_v4.24.0.sql` (cần chỉ thị rõ ràng — RULES §3)

### 7 lỗ hổng đã tìm — trạng thái
| # | Lỗ hổng | Xử lý |
|---|---|---|
| P0-1 | `chk_collections_type` có `emotion` chết, **thiếu `podcast`** → classify Podcast fail constraint | migration v4.28.0 |
| P0-2 | 4 junction RLS chỉ kiểm ownership 1 phía → ghi được rác cross-user (đọc không leak) | migration v4.28.0 |
| P1-3 | `expense_tags`/`subscription_tags` thiếu index `tag_id` → filter theo tag full scan | migration v4.28.0 |
| P1-4 | `type` và `status` trùng nghĩa (cả 2 default `'inbox'`) | code v4.28.0 + CHECK ở v5.0.0 |
| P2-5 | 5 cột chết trên `collections` | DROP ở v5.0.0 |
| P2-6 | `user_tasks.collection_id` deprecated nhưng vẫn được ghi | code v4.28.0 + DROP ở v5.0.0 |
| P2-7 | `knowledge_groups` là taxonomy M:N **thứ 3** trên `collections`, trùng việc với `tags` | ⏳ quyết định sản phẩm, chưa làm |

### Còn nợ
- [ ] `TODO: decision needed` — **P2-7:** gộp `knowledge_groups` vào `tags` (thêm `is_group BOOLEAN`) hay bỏ hẳn groups? Hiện `collections` bị phân loại bởi 3 hệ độc lập: `type` (CHECK 8), `tags` (M:N), `knowledge_groups` (M:N). Hai hệ M:N làm cùng một việc
- [ ] **`parent_id` subtask — 6 chỗ vỡ ở tầng list, phải sửa cùng lúc với migration:**
  1. `pendingTasks` không lọc `parent_id` → subtask render **2 lần** (lồng dưới parent + card riêng)
  2. `due_date DATE **NOT NULL**` → subtask buộc có ngày riêng → nesting **đứt ngang section** (subtask ở "Sắp tới", parent ở "Hôm nay"). Fix: subtask kế thừa `due_date` của parent
  3. `LinkKBModal` tìm task trong `[...todayTasks,...overdueTasks,...futureTasks]` → bấm 🔗 trên subtask trả **null**, modal trống. Fix: tìm trong `tasks` gốc
  4. `spawnRecurringTask` chỉ INSERT field của parent → lần lặp sau **mất hết subtask**
  5. `deleteTask` optimistic chỉ filter parent → subtask **treo trên UI** tới lần refetch; rollback cũng chỉ khôi phục parent
  6. `getCompletedTasks` + SW `SYNC_TASKS` không lọc parent → mỗi subtask 1 dòng calendar + 1 notification
- [ ] `task_tags` đã có bảng nhưng **chưa có UI/hook** — cần `useTags` mở rộng + TagPicker trên task card
- [ ] VIEW `tagged_items` chưa có consumer nào — chờ làm unified search
- [ ] `alert()` ở `CollectPage.onCreateTask` vi phạm RULES (cấm `window.alert`) — cần component toast

---

## v4.27.0 — ✅ DONE (2026-07-29) — Task thành module riêng (`/tasks`)

> **Bối cảnh chiến lược (2026-07-29):** thu hẹp trọng tâm về **Inbox + Knowledge + Tasks**, sau đó Finance.
> Habit / Lộ Trình / Quiz / BXH / XP / Life Journey đang cân nhắc bỏ. `TaskListSection` vốn nằm
> **bên trong** TrackerPage nên không thể cắt habit mà không mất Task → đây là việc phải làm đầu tiên.
> Bộ lọc cho mọi feature tiếp theo: **"Notion làm được cái này không?"** Nếu có → cân nhắc bỏ.
> Nếu không (rule enforcement, automation xuyên module) → đó là việc đáng làm.

### Done ✅
- [x] `src/pages/TasksPage.jsx` — route `/tasks` lazy, container mỏng (không `<h1>` để tránh trùng header của card)
- [x] `src/styles/tasks.css` — tách 105 dòng CSS task khỏi `tracker.css` (vì `tracker.css` sẽ bị xoá khi cắt habit)
- [x] `App.jsx` — lazy import + `<Route path="/tasks">` + `ROUTE_META`
- [x] `Navbar` — `📌 Nhiệm Vụ` vào PRIMARY, `Life Log` xuống SECONDARY (giữ bottom-tabs mobile ở 6 + "Thêm")
- [x] `TrackerPage` — xoá `<TaskListSection />` + import
- [x] Bonus: main chunk 906 → 876 kB (−30 kB) nhờ TaskListSection ra khỏi eager chunk
- [x] `npm run build` 0 lỗi, `npm run lint` 64 = baseline, verify browser 0 console error

### Chưa làm — cần migration SQL user tự chạy trên Supabase
- [ ] **Subtask** — thêm `user_tasks.parent_id UUID REFERENCES user_tasks(id) ON DELETE CASCADE`, render lồng **1 cấp** (không đệ quy vô hạn). Đây là khoảng trống thật duy nhất so với task manager cá nhân
- [ ] **`task_tags` junction** — `(task_id, tag_id)` composite PK, tái dùng bảng `tags` đã có (dùng chung với KB). **Chọn 1 trong 2** cách phân loại này với subtask, đừng làm cả hai — hiện đã có 3 taxonomy (`tags`, `knowledge_groups`, `collections.type`), thêm nữa là tê liệt
- [ ] **Inline quick-add theo từng nhóm** — nút `+ Thêm` ngay trong khối Quá hạn / Hôm nay / Sắp tới (không cần DB, nhưng để chung phase 2 cho gọn)

### Cố ý KHÔNG làm (chống bloat — model là Things 3 / Linear, KHÔNG phải ClickUp)
- [ ] ~~Assignee, comment, mention~~ — 1 user, giá trị 0
- [ ] ~~Custom status pipeline, custom field~~ — bẫy schema động: mất khả năng enforce rule, đúng lý do Notion không ép được gì
- [ ] ~~Space > Folder > List hierarchy~~ — taxonomy thứ 4/5/6
- [ ] ~~Gantt / Workload / Mind Map / Sprint~~ — 1 user, giá trị 0
- [ ] ~~Time tracking~~ — đã có Focus Timer

---

## v4.26.2 — ✅ DONE (2026-07-29) — Dọn dead code + doc sai của Activity Log

### Done ✅
- [x] Xoá `useActivityLog.getTimelineByDate()` (31 dòng) — 0 caller, JSDoc nhắc tới "DailyTimeline component" chưa bao giờ tồn tại
- [x] JSDoc `useActivityLog` — bỏ 6 action bịa (`task_add`, `collect_add`, `mood_set`, `xp_earned`, `journey_start`, `journey_complete`), thêm 5 action thật đang thiếu (`subscription_add`, `inbox_snooze`, `inbox_classify`, `inbox_bulk_delete`, `inbox_bulk_classify`) → bảng 11 action verify từ call site
- [x] `docs/FEATURES.md` §24 — xoá bullet "Daily drill-down" (không tồn tại: `handleHeatmapClick` là no-op), thêm MonthCalendar, sửa list action 7 → 11
- [x] `npm run build` 0 lỗi, `npm run lint` 64 = baseline, `npm test` 3/3 OK

### Nợ Activity Log — chờ redesign SAU KHI xong feature
> Quyết định 2026-07-29: **đóng băng**, không xoá. Heatmap + KPI đang dùng thật, mà read-side
> hiện chỉ là `COUNT` nên chưa biết cần query gì → thiết kế schema bây giờ sẽ lặp lại sai lầm cũ.
> **Không thêm `logActivity` vào feature mới** cho tới khi redesign.

- [ ] `TODO: decision needed` — `amount` nhồi **4 đơn vị** vào 1 cột: XP / VNĐ / số ngày (`inbox_snooze`) / số item (`inbox_bulk_*`). Không có cột unit → không SUM/so sánh được. Redesign: tách `amount` + `unit`
- [ ] `TODO: decision needed` — **Không có `entity_type` / `entity_id`.** `meta` tuỳ hứng mỗi chỗ (`{habit_id}` / `{source:'inbox'}` / `{type,days,until}`) → không join lại record gốc, không trả lời được "item inbox này đi đâu"
- [ ] `TODO: decision needed` — **`label` là câu tiếng Việt render sẵn** (`"85,000₫ Ăn trưa"`). Formatting nằm trong data → đổi format tiền hoặc i18n thì data cũ lệch vĩnh viễn. Redesign: derive label từ `action` + `meta` lúc render
- [ ] `TODO: decision needed` — **`action` là free-form text**, không CHECK constraint, không hằng số dùng chung. Gõ sai (`'taskDone'`) vẫn insert thành công
- [ ] `TODO: decision needed` — **Coverage lệch:** `useUserTasks.completeTask` (cách hoàn thành task bình thường) không log gì; chỉ Inbox quick-done phát `task_done`. Cũng chưa log: quick-add, single delete, Inbox→Task/Intention/Sub, Collect/KB, Journey, Incubator, Quiz, Mood
- [ ] `TODO: decision needed` — **`useFocusTimer.js:154` insert trực tiếp vào `activity_logs`**, bypass hook → hook không phải chokepoint duy nhất
- [ ] `TODO: decision needed` — **Row orphan `action='fitness_done'`** (feature xoá ở v4.26.0) vẫn cộng vào heatmap vĩnh viễn vì bảng append-only
- [ ] `TODO: decision needed` — `getHeatmapData` SELECT **cả năm** `created_at` về client rồi group bằng JS. Comment tự nhận "Supabase JS doesn't support GROUP BY" nhưng RPC/view làm được
- [ ] `TODO: decision needed` — Gọi là "audit trail" nhưng fire-and-forget, fail chỉ `logger.warn` → không đảm bảo ghi được

---

## v4.26.1 — ✅ DONE (2026-07-28) — Refactor P2 (4/6): tầng data

### Done ✅
- [x] `useUserTasks`/`useIntentions`/`useTags` — bỏ `getSb()` lazy-import, dùng `import { supabase }` tĩnh như 17 hook khác. Xoá 29 cặp `const sb = await getSb()` + `if (!sb) return …`; guard chuyển vào `isAuth = isSupabaseEnabled && !!user`
- [x] `useCollections` — `getSnoozedCount` + `fetchSnoozedItems` dùng chung `snoozedFilter()`
- [x] `mediaUtils` — gộp `isAudioUrl`/`isVideoUrl` → `isMediaUrl(url, kind, extRe)`
- [x] `dateUtils.toDateStr()` — gộp 4 bản copy (TaskListSection, useIntentions, IncubatorPage, DatePickerPopover), 17 callsite
- [x] `npm test` + 2 self-check mới (`dateUtils.test.js`, `mediaUtils.test.js`) — không thêm framework
- [x] `npm run build` 0 lỗi, `npm run lint` 64 = baseline, `npm test` 3/3 OK

### Chờ quyết định (2 mục còn lại của P2)
- [ ] `TODO: decision needed` — Xoá 2 thang fallback migration (`useCollections` 3 tầng, `useUserTasks` 1 tầng, ~71 dòng)? Cần biết migration `task_collections`/`collection_tags` đã chạy trên prod chưa
- [ ] `TODO: decision needed` — Bỏ retry của `spawnRecurringTask` (~35 dòng)? RULES §7 đang liệt kê nó là pattern bắt buộc

### Phát hiện thêm — bug, không phải over-engineering
- [ ] `TODO: decision needed` — **5 chỗ dùng `toISOString().split('T')[0]` (UTC) làm "hôm nay"**: `useUserTasks`, `useSubscriptions`, `DashboardPage`, `CashflowBar`, `MonthCalendar`. Ở GMT+7 từ 00:00–06:59 hiểu thành *ngày hôm qua*. Sửa = đổi cách chốt ngày của task/subscription/calendar → cần approve riêng, không gộp vào refactor

---

## v4.26.0 — ✅ DONE (2026-07-28) — Xoá feature Fitness Log (🏋️ Sức Khỏe)

### Done ✅
- [x] Xoá `src/hooks/useFitnessLog.js`
- [x] `TrackerPage` — xoá tab `fitness` (209 dòng JSX), 6 state `fit*`/`editFit`, entry `TABS`, import → **còn 4 tab**
- [x] `DashboardPage` — xoá section "🏋️ Sức Khỏe" (29 dòng), hook, import
- [x] XP `fitness_done` + `logActivity('fitness_done')` biến mất cùng tab (không có caller khác)
- [x] Docs: `FEATURES.md` (xoá §22 + đánh số lại §23–§28 → §22–§27, bảng XP, Data Architecture, "5 tabs" → "4 tabs", thêm vào Archived), `DATABASE.md` (fitness_logs → archived, đánh số lại 23–30 → 22–29, table count, Entity Overview, bảng XP), `ARCHITECTURE.md` (domain + hooks count + số bảng), `RULES.md` (§16 XP), `PROJECT.md` (module map), `PLAN.md`, `CHANGELOG.md`
- [x] `npm run build` 0 lỗi, `npm run lint` 64 warning = baseline

### Cố ý KHÔNG làm
- [ ] `TODO: decision needed` — **DROP bảng `fitness_logs`?** Master schema `data/schema_v4.24.0.sql` chỉ sửa khi có chỉ thị rõ ràng (RULES §3). Bảng còn trên prod, không hook nào dùng
- [x] ~~Xoá `tpl-fitness` trong `programs.json`~~ — **KHÔNG xoá**: đó là journey template "Kỷ Luật Thể Chất" thuộc feature Journey, không phải Fitness Log
- [x] ~~Xoá row `activity_logs` có `action='fitness_done'`~~ — **KHÔNG xoá**: bảng append-only audit trail

---

## v4.25.1 — ✅ DONE (2026-07-28) — Refactor P1 (phần 3/5): dọn `api/`

### Done ✅
- [x] Tạo `api/_lib/driveToken.js` — gộp 2 bản `getDriveToken` trùng ở `upload.js` + `stream.js`, cache token **theo scope** (rw vs readonly)
- [x] `verifyAuth.js` — bỏ `createClient` + `withTimeout` tự viết → 1 `fetch` + `AbortSignal.timeout`
- [x] 6 chain `.replace()` → `.toString('base64url')` native
- [x] `generateFileName()` 15 dòng → 4, **format tên file không đổi**
- [x] `api/_lib/smoke.test.js` — self-check `node api/_lib/smoke.test.js`

### Cố ý CHƯA làm (rủi ro cao, chờ quyết định)
- [ ] Thay `parseMultipart()` (45 dòng tự viết) bằng `Response.formData()` — undici từng lỗi với filename non-ASCII và file lớn; chỉ làm nếu test upload thật pass
- [ ] Thay vòng `pump` + `res.once('drain')` (28 dòng) bằng `Readable.fromWeb(body).pipe(res)`

### ⚠️ Cần test tay (build không chạy `api/`)
- [ ] Upload 1 ảnh qua `/collect`
- [ ] Upload 1 file audio, phát được
- [ ] Seek thanh audio Drive → response 206 Partial Content
- [ ] `curl` `/api/upload` không token → 401

---

## v4.25.0 — ✅ DONE (2026-07-28) — Refactor P0: Xoá code chết

Phase 0 của đợt refactor chống over-engineering (xem review đầy đủ trong CHANGELOG v4.25.0).

### Dead Code Removal ✅
- [x] Xoá `src/_archived/` — 11 file, 2.524 dòng, 0 import (khôi phục được từ git history)
- [x] Bỏ `src/_archived` khỏi `.gitignore` (dòng này vô tác dụng — file đã được track)
- [x] Gỡ `@uiw/react-md-editor` + `@uiw/react-markdown-preview` — 0 import (−43 package)
- [x] Xoá `logger.debug()` — không caller
- [x] Xoá `useCollections`: `toggleStar`, `archiveItem`, `getInboxCount` — không caller
- [x] Xoá 8/10 export không caller trong `dateUtils.js`

### Deduplication ✅
- [x] `CollectPage` — xoá `formatDate` local trùng `dateUtils`, gộp 2 `slugify` → 1, `h1`–`h4` → 1 vòng lặp
- [x] `TaskListSection` — xoá 3 alias `filtered*`
- [x] `@keyframes fadeIn` — gộp 5 định nghĩa (2 shape khác nhau) về `global.css`: `fadeIn` + `fadeInSlide`

### Docs Sync ✅
- [x] `docs/RULES.md` — bỏ 2 luật cấm sửa `src/_archived/`
- [x] `docs/ARCHITECTURE.md`, `PROJECT.md`, `docs/DATABASE.md`, `docs/FEATURES.md` — cập nhật tham chiếu `src/_archived/`
- [x] `npm run build` 0 lỗi, `npm run lint` 64 warning = baseline

### Chờ approve
- [ ] P1 — `api/`: 3/5 mục xong ở v4.25.1, còn 2 mục rủi ro cao (xem dưới)
- [ ] P2 — hooks: bỏ `getSb()` lazy, bỏ 2 thang fallback migration, gộp query snooze, thống nhất `todayStr`
- [ ] P3 — `TaskListSection`: gộp form Add/Edit, 22 `useState` → 1 draft object
- [ ] P4 — Modal: `GenericModal` viết lại trên `<dialog>`, gộp 6 overlay
- [ ] P5 — 872 inline style → CSS (1 page/PR)
- [x] ~~P6 — bỏ markdown mode~~ **HUỶ** — mất TOC, mất tính portable của plain text, lợi ích thật chỉ ~120 dòng chứ không phải 250

---

## v4.23.0 — ✅ DONE (2026-06-14) — Remove Drive Format Toggle + Audio-First Default

### Drive Format Cleanup ✅
- [x] `MediaPreview.jsx` — Remove "Dạng Drive" toggle button, default Drive URLs to audio player
- [x] `CollectPage.jsx` — Remove "📁 Auto" format pill from editor, keep Audio + Video only
- [x] `CustomAudioPlayer.jsx` — Clean up iframe fallback UI (remove verbose warning, use compact card)
- [x] `MediaNode.jsx` — Sync Tiptap renderHTML: default Drive height 80px (audio), only #video → 360px

### Proxy Stream (CORS Fix) ✅
- [x] `api/stream.js` — NEW: Vercel serverless proxy for Drive file streaming (CORS bypass)
- [x] `mediaUtils.js` — NEW: `getDriveStreamUrl()` helper
- [x] `MediaPreview.jsx` — Use proxy URL for Drive audio (custom player now works!)
- [x] `GlobalAudioPlayer.jsx` — Use proxy URL for podcast playback
- [x] `CHANGELOG.md` — v4.23.0 entry
- [x] `docs/TASKS.md` — Updated

---

## v4.22.0 — ✅ DONE (2026-06-13) — Codebase Audit Cleanup

### Dead Code Removal ✅
- [x] Delete `src/hooks/useFileUpload.js` — never imported
- [x] Delete `src/components/KnowledgeResurface.jsx` — never imported
- [x] Delete `src/App.css` — Vite scaffolding, zero imports
- [x] Delete `src/assets/react.svg` + `src/assets/vite.svg` — unused Vite defaults
- [x] Delete `src/constants/` — empty directory
- [x] Add `src/_archived` to `.gitignore`

### Code Deduplication ✅
- [x] `FinancePage.jsx` — Remove inline `CustomSelect` duplicate (40 lines), import shared component
- [x] `FinancePage.jsx` — Migrate Edit Expense modal from `incubator-modal*` → `GenericModal`
- [x] `TrackerPage.jsx` — Remove duplicate `SubAlert` render (already in Navbar)
- [x] Create `src/components/GenericModal.jsx` — Shared modal component
- [x] Create `src/styles/generic-modal.css` — Shared modal styles
- [x] Create `src/utils/dateUtils.js` — Centralized Vietnamese date formatting

### Structural Fixes ✅
- [x] Move `src/pages/LifeJourneyPage.css` → `src/styles/life-journey.css`
- [x] Update CSS import in `LifeJourneyPage.jsx`

### Documentation Fixes ✅
- [x] `ARCHITECTURE.md` — Fix Router v6 → v7, lazy count 8 → 13, remove useMoodLog, remove KnowledgeResurface, add new files
- [x] `CHANGELOG.md` — v4.22.0 entry
- [x] `package.json` — Bump version → 4.22.0

### Verification ✅
- [x] `npx vite build` — 0 errors (689ms)

---

## v4.21.0 — ✅ DONE (2026-05-24) — Optional Journey & Onboarding Redirect Polish
- [x] `src/App.jsx` — Remove the forced journey redirect logic from AppShell.
- [x] `docs/ARCHITECTURE.md` — Remove reference to redirected session state.
- [x] `docs/FEATURES.md` — Update Journey & Onboarding behavior descriptions.
- [x] `docs/PLAN.md` — Add v4.21.0 milestone.
- [x] `CHANGELOG.md` — Record changes under v4.21.0.
- [x] `package.json` — Bump version to 4.21.0.

---

## v4.20.1 — ✅ DONE (2026-05-24) — Smart Money Input Parsing & Configurable Currency Settings
- [x] `src/utils/currencyUtils.js` — Created helper utility to manage settings persistence (USD exchange rate and Auto-K toggle in `localStorage`) and parse freeform user string amount inputs to clean integer VND values.
- [x] `src/pages/SettingsPage.jsx` — Added `FinanceSettingsSection` under the "Chung" (General) settings tab to let users change the USD rate and toggle Auto-K.
- [x] `src/pages/FinancePage.jsx` — Updated expense, subscription, and edit modal amount inputs to type `text`, added live formatted previews, and integrated currency parsing and context logging on submit.
- [x] `src/pages/InboxPage.jsx` — Refactored the Quick Expense modal amount input to `text`, integrated live preview, and parsed values using currencyUtils.
- [x] `src/pages/IncubatorPage.jsx` — Refactored the estimated cost inputs in the Add form and Detail Edit view to support text entries, live formatted previews, and currency parsing.
- [x] `package.json` — Bumped version to `4.20.1`.

---

## v4.20.0 — ✅ DONE (2026-05-24) — Inbox Quick Done Feature
- [x] `src/hooks/useUserTasks.js` — Extended `addTask` function to accept `completed` and `completedAt` parameters, facilitating atomic task creation in completed state.
- [x] `src/styles/inbox.css` — Added `.inbox-item__action-btn--done` class with theme-aware green accents supporting both light and dark modes.
- [x] `src/pages/InboxPage.jsx` — Added `handleQuickDone` and `handleDetailQuickDone` callback handlers to convert inbox items into task records completed today, logging `task_done` activity and removing the items from inbox. Rendered the "✓ Xong" buttons in both the list view and detail view.
- [x] `package.json` — Bumped version to `4.20.0`.

---

## v4.19.9 — ✅ DONE (2026-05-24) — Fix Light Mode Task Form Inputs & Buttons Visibility
- [x] `src/styles/auth.css` — Appended Light Mode overrides for the `.auth-input` class to guarantee visible border outlines and input backgrounds.
- [x] `src/styles/tracker.css` — Added styling and Light Mode adjustments for `.task-item`, `.task-option-btn`, `.task-form-rec-panel`, `.task-desc-box`, and `.task-checkbox-btn`.
- [x] `src/components/TaskListSection.jsx` — Refactored the task creation form and inline task editor card components to replace hardcoded inline dark-mode styles with the new theme-aware CSS classes.

---

## v4.19.8 — ✅ DONE (2026-05-24) — Fix Editor Title Input & CustomSelect Alignment
- [x] `src/components/CustomSelect.jsx` — Updated wrapper div display to `inline-flex` and vertical-align to `middle` to eliminate inline line-height descender margins.
- [x] `src/styles/collect.css` — Standardized CustomSelect wrapper `.kb-custom-select` with `display: inline-flex !important; vertical-align: middle; align-items: center;`. Synchronized vertical sizing by setting `.kb-custom-select.kb-type-select` to `height: 38px !important`.

---

## v4.19.7 — ✅ DONE (2026-05-24) — Unified Custom Dropdowns & Task Overdue UX Fixes

### Refactoring & Bug Fixes ✅
- [x] `src/hooks/useUserTasks.js` — Set default fallback task due time to `'23:59'`.
- [x] `src/components/TaskListSection.jsx` — Changed default `dueTime` state and submit reset to `'23:59'`, updated `isOverdue` to ignore `'23:59'` and `'00:00'` on current day, hid default times from task label, and added a yellow warning badge for today's active pending tasks.
- [x] `src/pages/InboxPage.jsx` — Refactored bulk, inline, and detail view type selects to use the reusable `<CustomSelect>` component.
- [x] `src/pages/CollectPage.jsx` — Refactored editor type select to use `<CustomSelect>`.
- [x] `src/pages/IncubatorPage.jsx` — Refactored execute modal expense category select to use `<CustomSelect>`.
- [x] `src/styles/collect.css` — Added Light Mode overrides and custom selector styling for popovers.
- [x] `src/styles/incubator.css` — Standardized styling for `.incubator-exec-category` wrapper.
- [x] `package.json` — Bump version to `4.19.7`.

## v4.19.6 — ✅ DONE (2026-05-24) — Hotfix: Enhance Sidebar, Input, Dropdown, and Tag borders/contrast in Light Mode

### UX & Styling Fixes ✅
- [x] `src/styles/navbar.css` — Refactored sidebar bottom footer into a horizontal `.sidebar__actions` row layout. Placed user profile/avatar on the left and the theme toggle on the right (`justify-content: space-between`), aligning them with the XP bar and the rightmost edge. Added outlines for circular buttons in Light Theme.
- [x] `src/styles/xpbar.css` — Added Light Mode overrides to make the XP track progress background and fill gradient clearly visible on light backgrounds.
- [x] `src/styles/collect.css` — Added Light Mode overrides for input fields, selects, group/tag creators, category pills, format badges (`🎨 Visual` / `✍️ MD`), and tag chips to establish clear borders and increase text contrast (`#4f46e5` for tags). Copied `.inbox-bulk-bar` styling to fix the unstyled "Chọn tất cả" button.
- [x] `src/pages/CollectPage.jsx` — Refactored the Task filter button (`📌`) and sorting select to use custom CSS dropdown buttons and popovers. Added Z → A sorting option (`rev-alpha`) to the sort configurations.
- [x] `package.json` — Bump version to `4.19.6`.



## v4.19.5 — ✅ DONE (2026-05-24) — Hotfix: Fix Task Filter popover readability and theme sync

### UX & Styling Fixes ✅
- [x] `src/pages/CollectPage.jsx` — Refactored task filter popover markup to use CSS classes instead of hardcoded dark background and border values.
- [x] `src/styles/collect.css` — Added `.kb-task-filter-popover`, `.kb-task-filter-header`, `.kb-task-filter-search-container`, `.kb-task-filter-search-input`, `.kb-task-filter-list`, `.kb-task-filter-item`, and `.kb-task-filter-checkbox` classes that dynamically sync colors with Light/Dark CSS variables.
- [x] `package.json` — Bump version to `4.19.5`.

## v4.19.4 — ✅ DONE (2026-05-24) — Hotfix: Optimize ArticleCard list borders and container backgrounds in Light Theme

### UX & Styling Fixes ✅
- [x] `src/styles/collect.css` — Fixed intermediate `kb-card` borders in Light mode by establishing a cohesive `1px solid rgba(99, 102, 241, 0.16)` border (with `border-top: none` on sub-items) instead of a single faint bottom border.
- [x] `src/styles/collect.css` — Replaced the transparent card background with a solid `#ffffff` background in Light Mode, making cards look distinct and clean on top of the page background.
- [x] `src/styles/collect.css` — Refactored `:first-child` and `:last-child` card border-radius rules to target nested cards under list item wrapper divs (`.kb-list > div:first-child .kb-card`).
- [x] `src/pages/CollectPage.jsx` — Moved the bulk actions bar (`inbox-bulk-bar`) outside of the `.kb-list` element to ensure it does not break list child-selection pseudo selectors.
- [x] `package.json` — Bump version to `4.19.4`.

## v4.19.3 — ✅ DONE (2026-05-24) — Hotfix: Format Badges in list/reader view

### Features & Refactoring ✅
- [x] `src/pages/CollectPage.jsx` — Added format badges ('🎨 Visual' or '✍️ MD') in `ArticleCard` metadata row to identify article editor format at a glance from the main list.
- [x] `src/pages/CollectPage.jsx` — Unified format badge rendering in `ReaderView` to use the same CSS styling as the card badges.
- [x] `src/styles/collect.css` — Appended `.kb-format-badge--visual` and `.kb-format-badge--markdown` styling using purple and cyan glassmorphism designs.
- [x] `package.json` — Bump version to `4.19.3`.

## v4.19.2 — ✅ DONE (2026-05-24) — Hotfix: Markdown Editor Preview Reload Fix

### Bug Fixes & Optimizations ✅
- [x] `src/pages/CollectPage.jsx` — Declared static `REMARK_PLUGINS` outside the render lifecycle to prevent `ReactMarkdown` from rebuilding the parser pipeline and recreating the entire DOM tree on every keystroke.
- [x] `src/components/MediaPreview.jsx` — Wrapped with `React.memo` using custom comparison targeting `url`, `type`, and stringified `title` children to completely prevent re-renders unless the media source actually changes.
- [x] `src/components/CustomAudioPlayer.jsx` — Wrapped with `React.memo` using custom comparison to prevent audio state resets when typing in the markdown editor.
- [x] `src/pages/CollectPage.jsx` — Refactored markdown inline component `a` to delegate YouTube rendering to `MediaPreview` (bringing it under the same memoization rules as other media links).
- [x] `package.json` — Bump version to `4.19.2`.

## v4.19.0 — ✅ DONE (2026-05-24) — Custom Glassmorphic Audio Player

### Features & Refactoring ✅
- [x] `src/components/CustomAudioPlayer.jsx` [NEW] — Premium glassmorphic custom audio player component with Play/Pause state, progress/volume sliders, and time tracking.
- [x] `src/components/MediaPreview.jsx` — Integrated `CustomAudioPlayer` to stream public Drive files and direct audio links.
- [x] `src/pages/CollectPage.jsx` — Updated Markdown editor preview components to support dynamic URL formatting toggles that automatically rewrite the raw Markdown source text. Also auto-tags inserted audio links with `#audio`.
- [x] `src/styles/collect.css` & `src/styles/tiptap.css` — Appended detailed responsive styles for the custom audio player widget.
- [x] `package.json` — Bump version to `4.19.0`.

## v4.18.0 — ✅ DONE (2026-05-24) — Advanced Media Classification and Hashtag System

### Features & Refactoring ✅
- [x] `src/utils/mediaUtils.js` — Core media utilities supporting `getMediaType`, `stripMediaTag`, `isYoutubeUrl`, and `getYoutubeEmbedUrl` (with YouTube Shorts support).
- [x] `src/components/MediaPreview.jsx` — Centralized switch-case media player layout rendering Drive embeds with custom height (`90px` / `360px`) and YouTube, audio, and video embeds with format toggles.
- [x] `src/extensions/MediaNode.jsx` [NEW] — Custom Tiptap node view extension rendering `MediaPreview` with inline toggles.
- [x] `src/components/TiptapEditor.jsx` — Integrated `MediaNode`, updated media inserting to use `setMediaBlock`, and implemented dynamic JSON tree migration to map legacy `audioBlock` nodes to `mediaBlock` at runtime.
- [x] `src/pages/CollectPage.jsx` — Added format pill selectors in the URL editor and connected player toggles in ReaderView to write updates directly back to the database.
- [x] `api/upload.js` — Automatic backend tagging of uploaded files (`#audio` / `#video`) based on verified MIME types.
- [x] `src/styles/collect.css` & `src/styles/tiptap.css` — Appended design styles for format pills and interactive players. Also added `.kb-reader__source` line-clamp styling to truncate long URLs to a maximum of 3 lines.
- [x] `package.json` — Bump version to `4.18.1`.

## v4.17.0 — ✅ DONE (2026-05-24) — Compact Audio Preview Redesign

### Features & Refactoring ✅
- [x] `src/components/MediaPreview.jsx` [NEW] — Reusable media component that centralizes all Drive and direct audio/video player rendering. Bypasses CORS/cookies for Drive files via iframe, and uses compact height (90px) for audio.
- [x] `src/pages/CollectPage.jsx` — Replaced duplicate inline rendering logic in both `ReaderView` and `mdComponents.a` with the unified `<MediaPreview>` component.
- [x] `src/extensions/AudioNode.js` — Updated Tiptap audio node `renderHTML` to use a compact `90px` iframe preview for Drive files and native `<audio>` controls for direct audio links.
- [x] `src/utils/mediaUtils.js` — Updated `isAudioUrl` to automatically check for query parameters or hash anchors (like `#audio`, `#podcast`, or `type=audio`). This allows users to paste raw Drive links and force-render them as compact player bars by simply appending `#audio` at the end.
- [x] `package.json` — Bump version to `4.17.0`.

## v4.16.3 — ✅ DONE (2026-05-24) — Google Drive iframe Preview Fix

### Bug Fixes ✅
- [x] `src/utils/mediaUtils.js` — Added `extractDriveFileId` helper and refactored `extractDriveDirectUrl` to use a clean `drive.google.com/uc?id=` format to bypass account session mismatch issues (`authuser=0`) and file download header blocks.
- [x] `src/pages/CollectPage.jsx` — Render Google Drive links in a native Google iframe preview (using `https://drive.google.com/file/d/FILE_ID/preview`) instead of HTML5 video/audio elements to bypass third-party cookie restrictions and CORS errors.
- [x] `src/extensions/AudioNode.js` — Update Tiptap inline media node to render Drive links using the same secure iframe preview.
- [x] `package.json` — Bump version to `4.16.3`.

## v4.16.2 — ✅ DONE (2026-05-24) — Documentation: Upload Naming Convention

### Tasks ✅
- [x] Docs — Bổ sung quy tắc đặt tên file (`LifeHub_{folder}_{date}_{hex}.ext`) vào `FEATURES.md`.

## v4.16.1 — ✅ DONE (2026-05-24) — Unified Google Drive Upload + URL Fix

### Tech Debt & UX Fixes ✅
- [x] `api/upload.js` — Changed Drive URL to use `uc?export=view` for direct image embedding without CORS/Frame issues.
- [x] Docs — Updated `FEATURES.md` and `ARCHITECTURE.md` to reflect 100% Google Drive proxying (removed stale Imgur/R2 references).
- [x] `.env.local.example` — Removed Imgur & R2. Added Google Drive Service Account info.

## v4.16.0 — ✅ DONE (2026-05-23) — Hybrid Storage & Podcast Player

### Phase 1: Utility Core ✅
- [x] `src/utils/mediaUtils.js` [NEW] — `extractDriveDirectUrl`, `isAudioUrl`, `isDriveUrl` regex logic.

### Phase 2: Reader View & Tiptap Parser ✅
- [x] `src/pages/CollectPage.jsx` — Render native audio/video player if type='podcast' or drive url.
- [x] `src/components/TiptapEditor.jsx` & `AudioNode.js` — Tiptap extension to parse Drive links inline via PasteRules.

### Phase 3: Global Audio Player ✅
- [x] `src/components/GlobalAudioPlayer.jsx` [NEW] — Floating mini player.
- [x] `src/hooks/useRandomPodcast.js` [NEW] — Fetch random podcast logic.
- [x] `App.jsx` — Mount GlobalAudioPlayer.
- [x] `global.css` — Styling for the floating player.

### Phase 4: Hybrid Upload API ✅
- [x] `api/upload.js` — Refactored to route images to Imgur, media to Google Drive Service Account via JWT and Multipart upload (No external dependencies needed).
- [x] `src/hooks/useFileUpload.js` — Keep logic as is, API transparently handles routing.

---

## v4.14.0 — ✅ DONE (2026-05-18) — KB Category Expansion + DB Type Sync

### New Categories ✅
- [x] `entertainment` type — Giải trí (🎮 Gamepad2, red #ef4444) — anime, music, movies, games
- [x] `emotion` type — Cảm xúc (❤️ Heart, pink #f472b6) — healing, reflections, diary

### DB Fix ✅
- [x] `migration_v4.14.0_collection_types.sql` — expands CHECK constraint from 6 → 11 types
- [x] Fixed type desync: `ai`, `knowledge`, `experience` were in UI but blocked by DB since v4.4.1

### ⚠️ USER ACTION REQUIRED
- [ ] Run `migration_v4.14.0_collection_types.sql` in Supabase SQL Editor

### Docs ✅
- [x] `CHANGELOG.md` v4.14.0 entry
- [x] `docs/TASKS.md` updated
- [x] `package.json` → v4.14.0
- [x] `npm run build` — 0 errors

---

## v4.13.0 — DONE — Postcard Gallery + QuoteWidget KB Integration

### Postcard Gallery UI ✅
- [x] `PostcardCard` component — gradient card with serif italic text, line-clamp, audio badge
- [x] `postcardGradientClass()` helper — 8-color gradient palette
- [x] `detectAudioUrl()` helper — regex audio URL detection from body text
- [x] `CollectPage.jsx` — Render postcard grid when `typeFilter === 'quote'`
- [x] `collect.css` — `.kb-postcard-grid`, `.kb-postcard`, hover lift, truncation fade, light mode
- [x] Empty state updated: 💬 icon + "Tạo trích dẫn đầu tiên" CTA for quote tab

### QuoteWidget KB Integration ✅
- [x] `QuoteWidget.jsx` — Accept `kbQuotes` prop, merge KB quote items into shuffle pool
- [x] `CollectPage.jsx` — Pass `kbQuotes={items.filter(type === 'quote')}` to QuoteWidget

### Docs ✅
- [x] `CHANGELOG.md` v4.13.0 entry
- [x] `docs/FEATURES.md` updated (Postcard Gallery + QuoteWidget KB integration)
- [x] `docs/TASKS.md` updated
- [x] `package.json` → v4.13.0
- [x] `npm run build` — 0 errors

---

## v4.12.0 — ✅ DONE (2026-05-10) — Media Infrastructure

### Phase 1: Image + YouTube trong bài viết ✅
- [x] Install `@tiptap/extension-image@3.22.4` + `@tiptap/extension-youtube@3.22.4`
- [x] `src/utils/mediaUtils.js` [NEW] — YouTube/audio URL utils
- [x] `src/components/TiptapEditor.jsx` — Image/YouTube extensions + toolbar buttons
- [x] `src/components/SlashCommand.jsx` — /image + /youtube commands
- [x] `src/pages/CollectPage.jsx` — mdComponents: img, YouTube embed, audio player
- [x] `src/pages/CollectPage.jsx` — Markdown toolbar: 🖼️ Image + ▶️ YouTube buttons
- [x] `src/styles/collect.css` — Media embed CSS
- [x] `npm run build` — 0 errors

### Phase 2: Cloudflare R2 + Upload API ✅ (code ready, cần user tạo Cloudflare account)
- [x] `api/upload.js` [NEW] — Vercel serverless upload proxy (AWS Sig V4, zero deps)
- [x] `src/hooks/useFileUpload.js` [NEW] — Upload hook (25MB limit, loading state)
- [x] `npm run build` — 0 errors
- [ ] **USER ACTION:** Tạo Cloudflare account → R2 bucket → env vars trên Vercel

### Phase 3: Shared UrlInputPopover ✅
- [x] `src/components/UrlInputPopover.jsx` [NEW] — ClickUp-style popover (label, input, Hủy/Chèn)
- [x] `src/styles/url-input-popover.css` [NEW] — Glassmorphism, animation, dark/light
- [x] `src/components/TiptapEditor.jsx` — Refactored: xóa inline MediaPopover, dùng UrlInputPopover
- [x] `src/components/SlashCommand.jsx` — Xóa window.prompt, dùng placeholder
- [x] `npm run build` — 0 errors

### Phase 4: QuoteWidget (text + shuffle, mọi page) ✅
- [x] `src/components/QuoteWidget.jsx` [NEW] — Daily-seeded random, shuffle 🔀, audio support, crossfade animation
- [x] `src/styles/quote-widget.css` [NEW] — Purple accent, shuffle spin, dark/light
- [x] `src/pages/TrackerPage.jsx` — Replace inline quote → QuoteWidget, xóa getDailyQuote/QUOTES_DATA
- [x] `src/pages/InboxPage.jsx` — Mount QuoteWidget (seed: 'inbox')
- [x] `src/pages/CollectPage.jsx` — Mount QuoteWidget (seed: 'knowledge')
- [x] `npm run build` — 0 errors

### Phase 5: Audio Player trong bài viết ✅
- [x] `src/extensions/AudioNode.js` [NEW] — Custom Tiptap node (atom, src+title attrs)
- [x] `src/components/TiptapEditor.jsx` — AudioNode extension + 🎵 toolbar + UrlInputPopover audio
- [x] `src/components/SlashCommand.jsx` — /audio slash command
- [x] `src/styles/tiptap.css` — Audio player block CSS (dark/light)
- [x] `npm run build` — 0 errors

### Phase 6: User Quotes Infrastructure ✅
- [x] `data/migration_v4.12.0_quotes.sql` [NEW] — `inspirational_quotes` table + RLS
- [x] `src/hooks/useQuotes.js` [NEW] — CRUD + merge system/user quotes, graceful fallback
- [x] `npm run build` — 0 errors
- [ ] **USER ACTION:** Run SQL migration in Supabase dashboard

### Phase 7: Imgur Auto-Upload + Quote Manager UI ✅
- [x] `api/upload.js` — Refactored: dual provider (Imgur + R2), auto-detect image → Imgur
- [x] `src/components/TiptapEditor.jsx` — Paste/drop image handler → auto-upload → insert
- [x] `src/pages/CollectPage.jsx` — Markdown toolbar: xóa tất cả `window.prompt`, dùng UrlInputPopover
- [x] `src/pages/SettingsPage.jsx` — QuoteManagerSection: CRUD quotes, toggle active, view system quotes
- [x] `src/styles/settings.css` — Quote Manager CSS
- [x] `npm run build` — 0 errors
- [ ] **USER ACTION:** Tạo Imgur App → `IMGUR_CLIENT_ID` env var trên Vercel
- [ ] **USER ACTION:** Cloudflare R2 bucket + env vars trên Vercel
- [ ] **USER ACTION:** Run `migration_v4.12.0_quotes.sql` in Supabase

---

## v4.11.0 — ✅ DONE (2026-05-10) — Knowledge Groups (M:N) + Sub-Notes

### Changes
- [x] `data/migration_v4.11.0_knowledge_groups.sql` — 3 tables: `knowledge_groups`, `collection_groups`, `collection_notes`
- [x] `src/hooks/useKnowledgeGroups.js` [NEW] — CRUD groups, link/unlink articles, fetchGroupArticles
- [x] `src/hooks/useCollectionNotes.js` [NEW] — CRUD threaded sub-notes
- [x] `src/hooks/useCollections.js` — Join `collection_groups` in fetchItems
- [x] `src/pages/CollectPage.jsx` — Phase 1: 📁 Nhóm tab + Group Cards + drill-down with contextual search
- [x] `src/pages/CollectPage.jsx` — Phase 2: GroupPicker in EditorView (inline group creation)
- [x] `src/pages/CollectPage.jsx` — Phase 3: SubNotes section in ReaderView
- [x] `src/pages/CollectPage.jsx` — Phase 4: Group Badge on ArticleCard (click → navigate)
- [x] `src/styles/collect.css` — Group cards, breadcrumb, group picker, sub-notes styles
- [x] Docs: FEATURES.md, ARCHITECTURE.md, DATABASE.md, PLAN.md, CHANGELOG.md
- [x] `npm run build` — 0 errors

---

## v4.10.1 — ✅ DONE (2026-05-10) — Task Start Time + Always-Visible Time Input

### Changes
- [x] DatePicker: Remove "Thêm giờ" toggle, always show time input
- [x] DatePicker: Default draft time to current local time (`nowHHMM()`)
- [x] DatePicker: Add "Bây giờ" quick-set button
- [x] DatePicker: Label "📅 Khi nào" → "📅 Bắt đầu lúc"
- [x] DatePicker: Label time row "⏰ Giờ bắt đầu"
- [x] TaskListSection: Default `dueTime` form state to current time
- [x] TaskListSection: Hide `⏰` badge when time is `00:00`
- [x] useUserTasks: Default `due_time` to `'00:00'` (not null)
- [x] useUserTasks: Filter `00:00` tasks from SW notification sync
- [x] Service Worker: Skip notifications for `00:00` tasks
- [x] Quick date picker on cards: pass `timeValue` + `onTimeChange`
- [x] CSS: `.dp-time__now-btn` styles
- [x] **BUG FIX:** `spawnRecurringTask` xóa cột `energy_level`/`duration_est` (đã drop v4.9.0), thêm `priority` clone
- [x] **Mobile DatePicker:** Bottom-sheet layout ≤520px, ẩn shortcuts, chỉ show calendar
- [x] **Mobile Task Overflow:** Action buttons → `⋯` overflow dropdown ≤520px
- [x] CSS: `.task-overflow-menu`, `.task-overflow-item` (dark/light mode)
- [x] **Mood Tracker Removal:** Removed from `habits.json`
- [x] **Mood Tracker Removal:** Removed hook logic from `useMoodSkip.js`
- [x] **Mood Tracker Removal:** Removed from `TrackerPage`, `MonthCalendar`, `DashboardPage`, `LifeLogPage`, `JourneyDetailPage`
- [x] **Mood Tracker Removal:** Cleaned up CSS (`dashboard.css`, `calendar.css`)
- [x] **Mood Tracker Removal:** Updated Docs (`FEATURES.md`, `ARCHITECTURE.md`, `DATABASE.md`)
- [x] **Mood Tracker Removal:** Created SQL migration (`migration_v4.10.1_drop_mood.sql`) + updated `reset_user_data.sql`
- [x] `npm run build` — 0 errors

---

## v4.10.0 — ✅ DONE (2026-05-09) — ClickUp-style DatePicker

### Changes
- [x] New `DatePickerPopover.jsx` (shortcuts + calendar grid)
- [x] New `datepicker.css` (2-column layout, dark theme)
- [x] Replace native date/time inputs in Add form
- [x] Replace native date/time inputs in Edit form
- [x] Replace 🔄 rollover with 📅 quick date button on cards
- [x] `npm run build` — 0 errors

---

## v4.9.0 — ✅ DONE (2026-05-09) — Task Priority System

### Changes
- [x] Remove Energy Level (⚡🔋🪫) from UI
- [x] Remove Duration Estimate (5p-2h+) from UI
- [x] Remove Energy Filter bar
- [x] Add Priority 5-level (⬇️→⚡) to Add/Edit/View
- [x] DB migration: drop `energy_level`, `duration_est`, add `priority`
- [x] Fix label: 📅 Ngày → 📅 Khi nào
- [x] Fix InboxPage `metaCache` crash (dead code cleanup)

### Verification
- [x] `npm run build` — 0 errors

---

## v4.8.0 — ✅ DONE (2026-05-09) — Incubator UI Redesign

### UI Changes
- [x] Tab bar: Đang ấp / Đã bỏ qua
- [x] Card redesign: inline action buttons
- [x] Abandoned tab: restore + permanent delete
- [x] Hook: `restoreIntention()`
- [x] CSS: tabs + card improvements

### Verification
- [x] `npm run build` — 0 errors (498ms)

---

## v4.7.3 — ✅ DONE (2026-05-09) — Fix Conversion Flow Bugs

### Bug Fixes
- [x] BUG #1: Inbox → Task (card view) mất `body` → thêm `item.body ||`
- [x] BUG #2: Incubator → Task mất metadata → `buildTaskDescription()` ghép toàn bộ
- [x] BUG #3: `todayStr` stale → dùng `localDateStr()` trực tiếp

### Documentation Sync
- [x] `CHANGELOG.md` — v4.7.3 entry
- [x] `docs/TASKS.md` — This section

### Verification
- [x] `npm run build` — 0 errors (462ms)

---

## v4.7.2 — ✅ DONE (2026-05-09) — Phase 1: Incubator UX Enhancement

### Incubator Rich Text Upgrade
- [x] Add `description TEXT` to `intentions` DB schema
- [x] Update `useIntentions` to support `description` parameter
- [x] UI: Render `description` as Markdown in `kb-prose` block in Detail View
- [x] UI: Add `kb-split` pane to edit `description`
- [x] UI: Add `📝 Có mô tả` badge to Incubator card
- [x] Integration: Map Inbox `body` to Incubator `description` when transferring

### Documentation Sync
- [x] `CHANGELOG.md` — v4.7.2 entry
- [x] `docs/TASKS.md` — This section

---

## v4.7.1 — ✅ DONE (2026-05-09) — Phase 1: UI Cleanup

### Minor Cleanup
- [x] Remove `DailyReview` from Sidebar
- [x] Delete `DailyReview.jsx` component

---

## v4.7.0 — ✅ DONE (2026-05-09) — Phase 1: Dead Code Cleanup + QuickCapture Upgrade

### Tier 1: Dead Code Removal
- [x] 1.1 Delete `DailyTimeline.jsx` (dead component, no import)
- [x] 1.2 Delete `useLinkMeta.js` + remove import from InboxPage
- [x] 1.3 `user_tasks.collection_id` — already removed in v4.5.4 ✅
- [x] 1.4 `handleDetailTitleSave` — already removed in v4.6.1 ✅
- [x] 1.5 Remove `XP_REWARDS.duo_streak` (unused, Team Mode not planned)
- [x] 1.6 QuickCapture: remove `maxLength={500}`
- [x] 1.7 Life Journey: replace hardcoded demo events with empty `[]`

### Quick Wins
- [x] 2.3 QuickCapture: use `useCollections.addItem()` instead of raw Supabase
- [x] 2.1 QuickCapture: convert `<input>` to `<textarea>` for format preservation

### Documentation Sync
- [x] CHANGELOG.md — v4.7.0 entry
- [x] FEATURES.md — update Life Log DailyTimeline reference
- [x] package.json — version bump → 4.7.0

### Verification
- [x] `npm run build` — 0 errors (446ms)

---

## v4.5.4 — ✅ DONE (2026-05-09) — Audit Cleanup: DB Docs + Habit Sort Persist

### P0-1: DATABASE.md SQL Block Cleanup
- [x] Remove phantom SQL block (teams, reactions, quiz_attempts, daily_challenge_completions, partner_queue, friendships RLS)
- [x] Replace with reference to `data/schema_v4.4.0.sql` as single source of truth
- [x] Remove stale RLS policies referencing non-existent tables (team_members, is_teammate, etc.)

### P0-4: Document friendships as ARCHIVED
- [x] Add `[ARCHIVED]` label to friendships in DATABASE.md Entity Overview
- [x] Add note: code in `src/_archived/FriendsPage.jsx`, not used since v3.0.0

### P1-5: Document collection_id as DROPPED
- [x] Confirm `user_tasks.collection_id` fully removed from hook code (✅ verified)
- [x] Add migration note in DATABASE.md: column deprecated, use `task_collections` junction

### P1-6: Persist reorderHabits sort_order to Supabase
- [x] `useCustomHabits.js` — `reorderHabits()` batch UPDATE `sort_order` to Supabase
- [x] Verify existing `sort_order` column in `habits` table schema

### Documentation Sync
- [x] `CHANGELOG.md` — v4.5.4 entry
- [x] `package.json` — version bump → 4.5.4

### Verification
- [x] `npm run build` — 0 errors (718ms)

---

## v4.5.2 — ✅ DONE (2026-05-07) — Recovery: Corrupted Files + Meta Tag Fix

### Recovery
- [x] `src/hooks/useUserTasks.js` — Restored from git (empty 0 bytes in HEAD). Re-applied v4.5.0 upgrades: task_collections embedded select + fallback + linkCollection/unlinkCollection.
- [x] `src/hooks/useCollections.js` — Restored from git (empty 0 bytes). Re-applied v4.5.0 upgrades: task_collections join + 2-step fallback + _linkedTaskIds/_linkedTaskCount.
- [x] `src/components/LinkKBModal.jsx` — Rebuilt from scratch (no git history). Search + checkbox modal, max 10 results, linked items sorted first, glassmorphism.

### Bug Fix
- [x] `index.html` — Replace deprecated `apple-mobile-web-app-capable` meta tag with `mobile-web-app-capable`.

### Documentation
- [x] `CHANGELOG.md` — v4.5.2 entry
- [x] `package.json` — version bump → 4.5.2

### Verification
- [x] `npm run build` — 0 errors (804ms)

---

## v4.5.1 — ✅ DONE (2026-05-03) — Bug Fixes + UX Improvements

### Bug Fixes
- [x] `useUserTasks.js` — Fallback query when `task_collections` table doesn't exist (400 error → retry plain select)
- [x] `useCollections.js` — 2-step fallback: retry without `task_collections` → retry plain `select('*')`
- [x] `LinkKBModal.jsx` — Fix empty modal: trigger `fetchCollections({})` when modal opens
- [x] `LinkKBModal.jsx` — Search both `title` AND `body_text`/`body` fields
- [x] `schema_v4.4.0.sql` — Add missing `profiles_insert_own` INSERT RLS policy

### UX Improvements
- [x] `Navbar.jsx` — Add "⚙️ Cài Đặt" to avatar dropdown menu
- [x] `LinkKBModal.jsx` — Max results 20 → 10
- [x] `TaskListSection.jsx` — Add 🔗 link KB button in edit form
- [x] `TaskListSection.jsx` — Add "💡 Tạo xong... nhấn 🔗" hint in add form
- [x] `CollectPage.jsx` — Replace inline task chip row with 📌 icon + dropdown popup in toolbar

### Documentation (Rule #13 compliance)
- [x] `docs/TASKS.md` — This section
- [x] `CHANGELOG.md` — v4.5.1 entry
- [x] `package.json` — version bump → 4.5.1

---

## v4.5.0 — ✅ DONE (2026-05-03) — Task ↔ KB Many-to-Many + KB Task Filter

### Phase 10.5A: Database — Junction Table
- [x] `data/schema_v4.4.0.sql` — Add `task_collections` junction table (composite PK, RLS, CASCADE, index)
- [x] Migration: INSERT existing `user_tasks.collection_id` data into junction table
- [x] Deprecate `user_tasks.collection_id` column (COMMENT, keep for rollback)

### Phase 10.5B: Hooks — Embedded Select + Link/Unlink
- [x] `useUserTasks.js` — Fetch with embedded select `task_collections(collection_id, collections(id, title, type))` → `_collections` array (1 query, no N+1)
- [x] `useUserTasks.js` — `linkCollection(taskId, collectionId)` + `unlinkCollection(taskId, collectionId)` with optimistic updates
- [x] `useUserTasks.js` — `addTask` backward compat: inserts into junction when `collectionId` provided
- [x] `useCollections.js` — Fetch with `task_collections(task_id)` join → `_linkedTaskIds` + `_linkedTaskCount` per item

### Phase 10.5C: UI — Task Side
- [x] `LinkKBModal.jsx` [NEW] — Search + checkbox modal, max 20 results, linked items sorted first
- [x] `TaskListSection.jsx` — Badge `🔗 KB` → `🔗 N bài`, new 🔗 button per task opens LinkKBModal, imports `useCollections`

### Phase 10.5D: UI — KB Side
- [x] `CollectPage.jsx` — `📌 Task:` filter chip row (active tasks only), `filterTaskId` state + filter logic
- [x] `CollectPage.jsx` — ArticleCard `📌 N tasks` badge when linked
- [x] `CollectPage.jsx` — Fix ArticleCard excerpt: extract text from Tiptap JSON when `body_text` is empty

### Phase 10.5E: Documentation
- [x] `docs/TASKS.md` — This section
- [x] `docs/ARCHITECTURE.md` — Add task_collections table + LinkKBModal + data flow
- [x] `docs/FEATURES.md` — Update Task + KB sections
- [x] `docs/PLAN.md` — Add Phase 10.5
- [x] `CHANGELOG.md` — v4.5.0 entry
- [x] `package.json` — version bump → 4.5.0

### Verification
- [x] `npm run build` — 0 errors

---

## v4.4.0 — ✅ DONE (2026-05-02) — Bug Fixes + Task↔Knowledge Link + Inbox Bulk Actions

### Phase 10.1: Bug Fixes
- [x] `IncubatorPage.jsx` — Fix `EXPENSE_DATA.map()` crash → `.categories.map()` + fix `cat.id`→`cat.key`, `cat.name`→`cat.label`
- [x] `useSubscriptions.js` — Fix `getMonthlyCost()` for `3month` (÷3) and `6month` (÷6) cycles

### Phase 10.2: Activity Log for Inbox Actions
- [x] `InboxPage.jsx` — `handleClassify()` → logActivity('inbox_classify')
- [x] `InboxPage.jsx` — `handleSnooze()` → logActivity('inbox_snooze')

### Phase 10.3: Task ↔ Knowledge Link
- [x] `data/migration_v4.4.0_task_knowledge_link.sql` [NEW] — `ALTER TABLE user_tasks ADD COLUMN collection_id UUID REFERENCES collections(id) ON DELETE SET NULL`
- [x] `useUserTasks.js` — `addTask()` accepts optional `collectionId` parameter
- [x] `CollectPage.jsx` — ReaderView: 📌 Task button creates task linked to knowledge item
- [x] `TaskListSection.jsx` — 🔗 KB badge on tasks with `collection_id`, click navigates to /collect

### Phase 10.4: Inbox Bulk Actions
- [x] `InboxPage.jsx` — Toggle bulk mode (☑ Chọn nhiều), checkbox per item, select all/none
- [x] `InboxPage.jsx` — Bulk classify (📂 Phân loại → type picker), bulk delete (🗑)
- [x] `InboxPage.jsx` — Activity log for bulk operations
- [x] `inbox.css` — Bulk bar, classify menu, checkbox, selected item highlight (dark/light)

---

## v4.3.0 — ✅ DONE (2026-05-01) — Inbox Filters + Incubator Archive + Tags Cleanup

### Phase 9.4: Inbox Filter Chips (#10)
- [x] `InboxPage.jsx` — filter chips: Tất cả / Có URL / Gần đây (7 ngày)
- [x] `inbox.css` — chip styling (dark/light mode)

### Phase 9.5: Incubator Archive View (#8)
- [x] `useIntentions.js` — `fetchAbandoned()` returns abandoned items
- [x] `IncubatorPage.jsx` — toggle "Đã bỏ qua" section (read-only cards)

### Phase 9.6: Drop deprecated `collections.tags TEXT[]` (#7)
- [x] Verified: `useCollections.js` has zero references to `tags` column
- [x] `data/migration_v4.3.0_drop_tags_column.sql` — `ALTER TABLE DROP COLUMN IF EXISTS`

---

## v4.2.1 — ✅ DONE (2026-05-01) — Edit Expense + Sub Auto-Advance + Incubator Review Banner

### Phase 9.1: Edit Expense (Quick Win)
- [x] `useExpenses.js` — thêm `updateExpense(id, { amount, category, note })`
- [x] `FinancePage.jsx` — inline edit modal (click expense → edit form)
- [x] `finance.css` — edit button styling

### Phase 9.2: Subscription auto-advance `next_due`
- [x] `useSubscriptions.js` — auto-advance expired subs trong `fetchSubs()` (bounded MAX=24)

### Phase 9.3: Incubator review banner on Today page
- [x] `TrackerPage.jsx` — 🥚 yellow banner khi reviewDueCount > 0, link tới `/incubator`
- [x] `useIntentions.js` — `reviewDueCount` (đã có sẵn, chỉ import)

---


### Phase A: Database Migration
- [x] `data/migration_v4.2.0_incubator_v2.sql` [NEW] — ALTER `converted_to` TEXT → TEXT[], ADD `converted_ids` JSONB

### Phase B: Hook Changes
- [x] `useIntentions.js` — `executeIntention` nhận `convertedTypes[]` + `convertedIds{}` thay `convertTo`/`convertedId`

### Phase C: UI — Form + Card
- [x] `IncubatorPage.jsx` — Form: thêm dropdown `⏱ Cam kết thời gian` (15m/30m/1h/1.5h/2h/nửa ngày)
- [x] `IncubatorPage.jsx` — Card: thêm badge `⏱` hiển thị `estimated_time` (format h/m)

### Phase D: UI — Execute Modal (Multi-Output Router)
- [x] `IncubatorPage.jsx` — Replace Radio → 3 Checkbox cards (💰 Expense + 🔁 Habit + 📌 Task)
- [x] `IncubatorPage.jsx` — Multi-dispatch handler (addExpense + addHabit + addTask đồng thời)
- [x] `IncubatorPage.jsx` — Import useExpenses + useCustomHabits + expense-categories.json
- [x] `IncubatorPage.jsx` — Auto-suggest: cost→Expense, time→Habit, nothing→Task

### Phase E: CSS
- [x] `incubator.css` — time select, duration badge, exec option cards, checkbox visual, category dropdown, light mode

### Phase F: Documentation
- [x] `docs/FEATURES.md` — Update section #25
- [x] `docs/ARCHITECTURE.md` — Update data flow + DB tables
- [x] `docs/TASKS.md` — This section
- [x] `docs/PLAN.md` — Add Phase 8.7
- [x] `CHANGELOG.md` — v4.2.0 entry
- [x] `package.json` — version bump → 4.2.0

### Phase G: Verification
- [x] `npm run build` — 0 errors (638ms)

---


- [x] `Navbar.jsx` — Sidebar user dropdown: rewrite with **React Portal + getBoundingClientRect** → escapes `overflow-y` sidebar clipping. Menu appears above avatar, correct size.
- [x] `navbar.css` — Clean up `.nav-user-menu` (remove dead position classes). Add `position: relative; z-index: 10` to `.sidebar__bottom`.
- [x] `useCollections.js` — Remove optional AI columns (`content_format`, `body_text`, `word_count`) from `addItem` insert payload — prevents insert failure on instances without migration v3.2.0.
- [x] `global.css` — Add `.btn-primary:disabled` style (opacity 0.4, cursor not-allowed) so disabled state is visually clear.

---

## v4.1.0 — ✅ DONE (2026-04-30) — Tag Unification + Settings Page

### Phase A: Database Migration
- [x] `data/migration_v4.1.0_tag_unification.sql` — collection_tags table + RLS + indexes + data migration

### Phase B: Hook Changes
- [x] `useTags.js` — extend: updateTag, collection linkTag/unlinkTag, getTagUsageCount, getAllTagUsageCounts, getTagsForEntity
- [x] `useCollections.js` — refactor: join collection_tags, remove TEXT[] write, _tags mapping

### Phase C: CollectPage Refactor
- [x] `CollectPage.jsx` — central tags, TagInput color dots, tag filter color dots, linkTag/unlinkTag save

### Phase D: SettingsPage (NEW)
- [x] `SettingsPage.jsx` — Tag Manager UI (CRUD, rename, recolor, usage count, delete w/ confirmation)
- [x] `settings.css` — Glassmorphism, color picker, responsive, dark/light

### Phase E: Navigation
- [x] `App.jsx` — lazy import + route `/settings` + SEO meta
- [x] `Navbar.jsx` — ⚙️ Cài Đặt link in SECONDARY_NAV

### Phase F: Documentation
- [x] `CHANGELOG.md` — v4.1.0 entry
- [x] `FEATURES.md` — sections #22 + #23
- [x] `ARCHITECTURE.md` — SettingsPage, useTags, collection_tags, settings.css
- [x] `PLAN.md` — version table + header bump
- [x] `package.json` — version bump → 4.1.0

### Verification
- [x] `npm run build` — 0 errors

---

## v4.0.3 — ✅ DONE (2026-04-30) — Fitness Edit + Dashboard Fitness Card

### Debt #4: Fitness edit support
- [x] `useFitnessLog.js` — thêm `updateLog(id, fields)`
- [x] TrackerPage fitness tab — inline edit mode cho từng log
- [x] Dashboard — compact fitness card (tuần này)
- [x] Docs sync

---

## v4.0.2 — ✅ DONE (2026-04-30) — Tech Debt: Recurring Task Retry

### Debt #2: spawnRecurringTask no retry
- [x] Bounded retry (max 2 retries, 1s backoff) on insert fail
- [x] Return success/failure status for logging
- [x] Structured console.error on final failure
- [x] `CHANGELOG.md`

---

## v4.0.1 — ✅ DONE (2026-04-30) — Tech Debt: InboxPage Overflow Menu

### Debt #1: InboxPage Action Overflow
- [x] Refactor 7 action buttons → 2 primary (📌 Task + 🗑) + overflow menu (···)
- [x] overflow menu CSS (dropdown, dark/light, click-outside close)
- [x] `docs/FEATURES.md` + `CHANGELOG.md`

---

## v4.0.0 — ✅ DONE (2026-04-30) — Health Tab + Reader View

### Feature 7A: Health/Fitness Tab (🏋️ Sức Khỏe)
- [x] `data/migration_v4.0.0_fitness.sql` [NEW] — fitness_logs table + RLS
- [x] `src/hooks/useFitnessLog.js` [NEW] — addLog, deleteLog, todayLogs, weekSummary
- [x] `src/pages/TrackerPage.jsx` — Thêm tab 🏋️ Sức Khỏe (tab thứ 5)
- [x] XP + logActivity integration

### Feature 7B: Reader View (Metadata Preview)
- [x] `api/meta.js` [NEW] — Vercel Edge Function fetch OG metadata
- [x] `src/hooks/useLinkMeta.js` [NEW] — Cache + fetch link metadata
- [x] `src/pages/InboxPage.jsx` — Preview cards for URL items
- [x] `src/styles/inbox.css` — Link preview styles

### Docs Sync
- [x] `docs/FEATURES.md` + `CHANGELOG.md` + `docs/ARCHITECTURE.md` + `docs/PLAN.md` + `package.json`

---

## v3.9.0 — ✅ DONE (2026-04-30) — 🥚 Incubator Module

### Feature 6A: Incubator (Trạm Ấp Trứng)
- [x] `data/migration_v3.9.0_incubator.sql` [NEW] — intentions + intention_logs + RLS
- [x] `src/hooks/useIntentions.js` [NEW] — CRUD + deferIntention + executeIntention + abandonIntention + getLogs
- [x] `src/pages/IncubatorPage.jsx` [NEW] — Card UI + Defer modal (friction) + Execute modal
- [x] `src/styles/incubator.css` [NEW] — Page + card + modal styles
- [x] `src/App.jsx` — Route /incubator + lazy import
- [x] `src/components/Navbar.jsx` — Link 🥚 Incubator
- [x] `src/pages/InboxPage.jsx` — Nút 🥚 Ấp Trứng action

### Docs Sync
- [x] `docs/FEATURES.md` + `CHANGELOG.md` + `package.json`

---

## v3.8.0 — ✅ DONE (2026-04-30) — Inbox Snooze

### Feature 5A: Inbox Snooze
- [x] `data/migration_v3.8.0_snooze.sql` [NEW] — ALTER TABLE collections ADD snoozed_until
- [x] `src/hooks/useCollections.js` — snoozeItem(), fetchItems filter snoozed
- [x] `src/pages/InboxPage.jsx` — Snooze menu (1 tuần/2 tuần/1 tháng/3 tháng) + snoozed count badge
- [x] `src/styles/inbox.css` — snooze button + menu styles

### Docs Sync
- [x] `docs/FEATURES.md` + `CHANGELOG.md` + `package.json`

---

## v3.7.0 — ✅ DONE (2026-04-30) — Cashflow Calendar + PARA Tag

### Feature 4A: Cashflow Calendar
- [x] `src/components/CashflowBar.jsx` [NEW] — thanh 30 ngày hiển thị sub due dots
- [x] `src/pages/FinancePage.jsx` — mount CashflowBar dưới summary cards
- [x] `src/styles/finance.css` — styles cho CashflowBar

### Feature 4B: PARA Tags
- [x] `data/migration_v3.7.0_para.sql` [NEW] — tags + expense_tags + subscription_tags + RLS
- [x] `src/hooks/useTags.js` [NEW] — CRUD tags, fetchTags, addTag, deleteTag
- [x] `src/components/TagPicker.jsx` [NEW] — searchable dropdown + tạo tag mới
- [x] `src/pages/FinancePage.jsx` — integrate TagPicker vào expense + sub forms

### Docs Sync
- [x] `docs/FEATURES.md` + `CHANGELOG.md` + `package.json`

---

## v3.6.0 — ✅ DONE (2026-04-30) — Energy Tag + Recurring Tasks

### Feature 2B: Energy-based Tagging
- [x] `data/migration_v3.6.0_tasks.sql` — ALTER TABLE thêm energy_level, duration_est, recurrence_rule
- [x] `src/hooks/useUserTasks.js` — addTask nhận energyLevel/durationEst/recurrenceRule, completeTask spawn recurring
- [x] `src/components/TaskListSection.jsx` — Energy picker + Duration picker + Recurrence toggle trong form, badges + filter chips

### Feature 3A: Recurring Tasks
- [x] `spawnRecurringTask()` helper tách riêng trong hook — tránh vòng lặp
- [x] Date helpers: addDays, nextWeekday, nextMonthDay

### Docs Sync
- [x] `docs/FEATURES.md` — update Task section
- [x] `CHANGELOG.md` — v3.6.0 entry
- [x] `package.json` — version bump → 3.6.0

---

## v3.5.0 — ✅ DONE (2026-04-30) — Quick Expense từ Inbox + Overdue Task Triage

### Feature 1A: Quick Expense Modal (Inbox → Finance)
- [x] `src/pages/InboxPage.jsx` — thêm nút 💸 Chi tiêu + QuickExpenseModal inline
- [x] `src/styles/inbox.css` — style cho QuickExpenseModal
- [x] Import `useExpenses` + `useActivityLog` vào InboxPage
- [x] Regex bóc tách số tiền từ text (50k → 50000)

### Feature 2A: Overdue Rollover / Triage
- [x] `src/hooks/useUserTasks.js` — thêm todayTasks, overdueTasks, futureTasks, rolloverTask
- [x] `src/components/TaskListSection.jsx` — tách UI 3 khối: Quá hạn / Hôm nay / Sắp tới

### Docs Sync
- [x] `docs/FEATURES.md` — update Inbox + Task sections
- [x] `CHANGELOG.md` — v3.5.0 entry
- [x] `package.json` — version bump → 3.5.0

---

## v3.4.0 — ✅ DONE (2026-04-27) — Google Docs UI Upgrade cho Tiptap Editor

- [x] **Cài đặt thư viện:** Thêm `lucide-react`, `@tiptap/extension-underline`, `@tiptap/extension-text-align`, `@tiptap/extension-text-style`, `@tiptap/extension-color`.
- [x] **Tái thiết kế Toolbar:** Sử dụng Lucide Icons, thêm dropdown chọn Heading, thêm bộ chọn màu sắc (Text Color). Nhóm các công cụ hợp lý bằng vách ngăn (Divider).
- [x] **Tính năng mới:** Căn lề (Left, Center, Right, Justify), Gạch chân, Màu chữ.
- [x] **Phím tắt mới:** Thêm `Ctrl+U`, `Ctrl+Shift+L/E/R/J` vào Shortcuts Modal.
- [x] **CSS Upgrade:** Định dạng `tiptap.css` cho `.tp-toolbar-dropdown`, `.tp-color-picker`, nút icon phẳng chuẩn UX của Google Docs.

---

## v3.3.1 — ✅ DONE (2026-04-27) — Tiptap Bug Fixes & Polish

- [x] **Light mode CSS** — ~200 lines comprehensive overrides cho toolbar, slash menu, shortcuts modal, footer, editor content (mark, code, blockquote, table, links)
- [x] **Word count realtime** — Dùng `CharacterCount.words()` (chính xác), pass qua `onChange(json, text, words)`. EditorView header cập nhật ngay
- [x] **Expanded shortcuts** — Thêm section "✍️ Gõ tắt Markdown" (9 auto-format rules), Tab/Shift+Tab, Shift+Enter
- [x] **Markdown keyboard shortcuts** — Ctrl+B/I/E/K/1/2/3, Ctrl+Shift+X/B/C/7/8/9, Ctrl+S save, Ctrl+P block, Ctrl+. shortcuts panel, ⌨ toolbar button
- [x] Build ✓ (293ms, 0 errors)

---

## v3.3.0 — ✅ DONE (2026-04-27) — Tiptap Slash Command + Shortcuts + Browser Key Override

### Install
- [x] `npm install @tiptap/suggestion@^3.22.4`

### Slash Command Menu
- [x] `src/components/SlashCommand.jsx` [NEW] — Extension + React dropdown UI
- [x] `src/components/TiptapEditor.jsx` — Import + register SlashCommandExtension

### Keyboard Shortcuts Panel
- [x] `src/components/TiptapEditor.jsx` — `ShortcutsModal` component + toolbar button `⌨`

### Browser Shortcut Override
- [x] `src/components/TiptapEditor.jsx` — `handleKeyDown` (Ctrl+S save, Ctrl+P block, Ctrl+. shortcuts)

### CollectPage Wire
- [x] `src/pages/CollectPage.jsx` — Pass `onSave` prop to TiptapEditor

### CSS
- [x] `src/styles/tiptap.css` — Slash menu + Shortcuts modal styles

### Docs Sync
- [x] `docs/FEATURES.md`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`, `docs/PLAN.md`
- [x] `package.json` — bump → 3.3.0

### Verification
- [x] `npm run build` — No compile errors (✓ built in 280ms)

---

## v3.2.1 — ✅ DONE (2026-04-27) — Polish + Debt Cleanup

### Housekeeping
- [x] `package.json` — Bump version 3.1.0 → 3.2.1
- [x] `docs/TASKS.md` — Clean Team v3 debris, add v3.2.1 section
- [x] `docs/PLAN.md` — Fix Phase 7 incomplete items → move to Phase 8

### Dashboard Widgets
- [x] `DashboardPage.jsx` — `MoodTrendChart`: 7/30 day toggle, dot-line SVG, color-coded
- [x] `DashboardPage.jsx` — `FocusBreakdown`: per-habit horizontal bars, 7 days, Supabase query
- [x] `DashboardPage.jsx` — `WeeklyReview`: 7-day summary digest, week-over-week comparison

### CSS
- [x] `dashboard.css` — Styles for MoodTrendChart, FocusBreakdown, WeeklyReview

### Docs Sync
- [x] `docs/FEATURES.md` — Update Dashboard section (#5)
- [x] `docs/ARCHITECTURE.md` — Update DashboardPage data sources (add useMoodLog)
- [x] `CHANGELOG.md` — Add v3.2.1 entry

### Verification
- [x] `npm run build` — No compile errors (✓ built in 426ms)

---

## v3.2.0 — ✅ DONE (2026-04-26) — Knowledge Base Dual-Mode Editor + UX Polish

### Knowledge Base
- [x] `TiptapEditor.jsx` — WYSIWYG editor: Bold/Italic/Strike/Highlight/Code/H1-H3/Lists/TaskList/Blockquote/CodeBlock/HR/Link/Table/Undo/Redo + `TiptapReadOnly`
- [x] `tiptap.css` — Dark theme, toolbar, prose styles, table, task list, link popover
- [x] `EditorView` — Dual-mode: Markdown (default) / Visual toggle, mode-lock per article, `isNew` prop
- [x] `CollectPage.jsx` — `isTiptapBody()` auto-detect helper, `safeHostname()` URL guard
- [x] `CollectPage.jsx` — `markdownToPlainText()` helper, `EDITOR_MODE_KEY` localStorage
- [x] `CollectPage.jsx` — `ReaderView` auto-detect format: render `TiptapReadOnly` hoặc `ReactMarkdown`
- [x] `CollectPage.jsx` — `ArticleCard` dùng `body_text` cho excerpt (không hiện JSON raw)
- [x] `CollectPage.jsx` — `handleSave` truyền đủ `content_format`, `body_text`, `word_count`
- [x] `CollectPage.jsx` — Xóa dead code `makeExcerpt()`
- [x] `useCollections.js` — `addItem` nhận đủ `content_format`, `body_text`, `word_count`
- [x] `TagInput` — Searchable dropdown (max 10), scroll, tạo tag mới Enter, lưu khi save bài
- [x] `migration_v3.2.0_knowledge.sql` — `ADD COLUMN content_format / body_text / word_count`

### ConfirmModal System
- [x] `ConfirmModal.jsx` — Promise-based `useConfirm()` hook, drop-in `window.confirm()`
- [x] `confirm-modal.css` — Glassmorphism, scale-in animation, danger/default variants, light mode
- [x] `CollectPage.jsx` — Thay tất cả `confirm()` bằng `useConfirm` modal
- [x] `HabitManager.jsx` — Thay `confirm()` bằng `useConfirm` modal
- [x] `LifeJourneyPage.jsx` — Thay `window.confirm()` bằng `useConfirm` modal

### Tiptap Bug Fixes
- [x] Fix import named exports: `{ Table }`, `{ Link }`, `{ TaskList }`, v.v. (Vite runtime error)
- [x] Inline link popover (thay `window.prompt`)
- [x] `new URL(item.url)` → `safeHostname()` guard crash

---

## v3.1.2 — ✅ DONE (2026-04-26) — UX Polish + Mood Chart + Performance

- [x] `FinancePage.jsx` — Replace native `<select>` with `CustomSelect` glassmorphic dropdown (both category + cycle)
- [x] `FinancePage.jsx` — Subscription cycle: 4 options (1/3/6 tháng, 1 năm)
- [x] `FinancePage.jsx` — Smart date auto-fill from cycle, "Tự tính ↻" button, labeled date field
- [x] `finance.css` — Custom dropdown styles: trigger, dropdown panel, options, scrollbar, animation
- [x] `LifeLogPage.jsx` — selectedDate default = today, timeline visible on page load immediately
- [x] `DashboardPage.jsx` — `MoodChart7Day` component: inline SVG bar chart, emoji overlay, color-coded by mood level
- [x] `DashboardPage.jsx` — Import `useMoodLog` hook, wire into dashboard
- [x] `DashboardPage.jsx` — `todayStr` + `monthStart` use `useMemo` (stable refs, avoid re-render)
- [x] `DashboardPage.jsx` — `useExpenses` effect dependency fixed (no more infinite re-fetch)
- [x] `migration_v3.0.0.sql` — Fix `ERROR: 42P17` IMMUTABLE index error on `activity_logs`
- [x] `schema_v3.1.1.sql` — Consolidated migration (456 lines, fresh Supabase setup)
- [x] `CHANGELOG.md` — v3.1.2 entry
- [x] `docs/TASKS.md` — Updated (this file)
- [x] `implementation_plan.md` — New roadmap v3.2.0+ (4 phases, 10+ features)

---

## v3.1.1 — ✅ DONE (2026-04-26) — Modal UX Fix


- [x] `DashboardPage.jsx` — Rewrite: Today 4-KPI row (activity/focus/chi tiêu/XP hôm nay)
- [x] `DashboardPage.jsx` — Finance section: 3 KPI cards + Finance Pie SVG donut chart
- [x] `DashboardPage.jsx` — ActivityHeatmap thay ContributionGraph
- [x] `DashboardPage.jsx` — SectionTitle dividers, TodayKpi cards với hover animations
- [x] `dashboard.css` — Full rewrite: today-row, finance-kpi-row, db-fin-pie, section-title
- [x] `CHANGELOG.md` — v3.1.0 entry
- [x] `docs/TASKS.md` — Updated
- [x] `docs/FEATURES.md` — Section #5 updated

---

## v3.0.0 — ✅ DONE (2026-04-25) — Personal Life Hub Foundation

### Phase 6.1 — Cleanup + Migration SQL
- [x] Archive team/friends code → `src/_archived/` (7 files + team/ folder)
- [x] Remove `useTeam` from TrackerPage + DailyChallenge
- [x] Remove Team/Friends nav links from Navbar
- [x] Remove Team/Friends routes from App.jsx (→ redirect /tracker)
- [x] Create `data/migration_v3.0.0.sql` (collections, expenses, subscriptions, activity_logs + RLS)
- [x] Create `src/data/expense-categories.json` (8 categories)
- [x] Update `package.json` version → 3.0.0 + name → life-hub
- [x] Rebrand `index.html` + `manifest.json` → Life Hub
- [ ] User runs `migration_v3.0.0.sql` in Supabase SQL Editor

### Phase 6.2 — Navigation Restructure
- [x] Sidebar (desktop) + Bottom tabs (mobile) — `Navbar.jsx` rewrite + `navbar.css` rewrite
- [x] Global floating [+] Quick Capture button — `QuickCapture.jsx` + `quick-capture.css`
- [x] Gamification dropdown (Journey, Quiz, BXH) — sidebar "Khác" section + mobile "Thêm" dropdown
- [x] Landing page flow: sidebar hidden when unauthenticated on `/`
- [x] `.app-content` wrapper in App.jsx for sidebar offset
- [x] 4 placeholder pages: InboxPage, CollectPage, FinancePage, LifeLogPage + `placeholder-page.css`
- [x] SEO meta updated for all new routes (Life Hub branding)
- [x] Build verification ✅

### Phase 6.3 — Activity Log System
- [x] `useActivityLog.js` hook — logActivity(), getHeatmapData(), getTimelineByDate(), getTodayCount()
- [x] Wire into TrackerPage — habit_done / habit_undo / mood_set
- [x] Wire into DailyChallenge — challenge_done
- [x] Wire into QuickCapture — collect_add
- [x] Wire into useFocusTimer — focus_done (direct supabase insert, avoids circular import)

### Phase 6.4 — Inbox + Collect
- [x] `useCollections.js` hook — CRUD, classify, star, archive, inboxCount
- [x] `InboxPage.jsx` — Quick-add form + inbox items list + classify/delete actions + `inbox.css`
- [x] `CollectPage.jsx` — Tabbed view (All/Links/Quotes/Want/Learn/Ideas) + search + card grid + `collect.css`
- [x] `DailyReview.jsx` widget — today-recap (activity count + last 5 actions) wired to sidebar

### Phase 6.5 — Finance
- [x] `useExpenses.js` — CRUD, date-range fetch, getTotal/getByCategory aggregation
- [x] `useSubscriptions.js` — CRUD, cycle management, toggleActive, getUpcoming, getMonthlyCost
- [x] `FinancePage.jsx` — 2 tabs (Chi tiêu + Đăng ký), summary cards, category breakdown bars, expense list, sub cards + `finance.css`
- [x] `expense-categories.json` (already created in Phase 6.1)
- [x] `SubAlert.jsx` widget — upcoming sub renewals alert, wired to sidebar

### Phase 6.6 — Life Log
- [x] `ActivityHeatmap.jsx` — GitHub-style SVG heatmap, 53×7 grid, purple color scale, click-to-drill
- [x] `DailyTimeline.jsx` — Vertical timeline with action icons, timestamps, labels
- [x] `LifeLogPage.jsx` — Heatmap + today stat + drill-down timeline + `lifelog.css`

---

## v3.0.1 — ✅ DONE (2026-04-25) — Plan Gap Fix

### Phase 6.7 — Finalize Plan Gaps
- [x] `KnowledgeResurface.jsx` — "Hôm nay nhớ lại" widget (random Collect resurface, spaced repetition)
- [x] Wire `SubAlert` + `KnowledgeResurface` inline into TrackerPage (between XpBar and Hero)
- [x] `FinancePage.jsx` — Add inline SVG Pie chart (category donut) + 7-day bar chart trend
- [x] `InboxPage.jsx` — Add "→ Task" action (creates `user_task` from inbox item)
- [x] `InboxPage.jsx` — Add "→ Sub" action (navigates to Finance, passes item text)
- [x] `widgets.css` — Add KnowledgeResurface styles (cyan accent)
- [x] `finance.css` — Add PieChart + WeekBarChart styles

---

## v2.3.0 — ✅ DONE (2026-04-25) — Mood/Skip History on Calendar

### Code
- [x] `src/components/MonthCalendar.jsx` — Accept `moodLog` + `skipLog` props, show emoji on cells + detail panel
- [x] `src/pages/TrackerPage.jsx` — Pass `moodLog` + `skipLog` to MonthCalendar
- [x] `src/styles/calendar.css` — `.cal-cell__mood` positioning

### Docs
- [x] `CHANGELOG.md` — v2.3.0 entry

---

## v2.2.3 — ✅ DONE (2026-04-25) — XP Dedup Fixes

### Code
- [x] `src/hooks/useXpStore.js` — `isReady` flag + server-side dedup in `addXp()`
- [x] `src/components/DailyChallenge.jsx` — Sync done state with XP log
- [x] `CHANGELOG.md` — v2.2.3 entry

---

## v2.2.2 — ✅ DONE (2026-04-25) — Database Security Fix

### SQL Fix (user runs manually)
- [x] `data/migration_v2.2.2_security.sql` — Fix RLS policies (5 fixes)
- [x] Update `docs/DATABASE.md` — Sync column names + fix schema conflicts
- [x] Update `CHANGELOG.md`

---

## v2.2.1 — ✅ DONE (2026-04-25) — Refactor: Remove HabitsPage

### Cleanup
- [x] `src/pages/HabitsPage.jsx` — DELETED (deprecated redirect since v1.9.0)
- [x] `src/App.jsx` — Removed lazy import + SEO meta for `/habits`. Route `/habits` now uses inline `<Navigate to="/tracker" replace />`
- [x] `src/pages/JourneyPage.jsx` — Fixed dead link `/habits` → `/tracker` in success toast
- [x] `src/hooks/useFocusTimer.js` — Updated stale comment "HabitsPage" → "TrackerPage"
- [x] `src/components/TrackerSection.jsx` — Updated stale comment "HabitsPage" → "TrackerPage"
- [x] `src/styles/journey.css` — Updated CSS comment header "HabitsPage" → "TrackerPage"

### Docs
- [x] `docs/ARCHITECTURE.md` — Removed HabitsPage from folder tree + routes table
- [x] `docs/FEATURES.md` — Section #2 marked REMOVED v2.2.1
- [x] `CHANGELOG.md` — Added v2.2.1 entry

---

## v2.2.0 — ✅ DONE (2026-04-22) — Life Journey Visualization + Theme Toggle

### Page
- [x] `src/pages/LifeJourneyPage.jsx` — Emotion timeline SVG (Catmull-Rom), dual view (compact/expanded), event list grid
- [x] `src/pages/LifeJourneyPage.css` — Co-located CSS for Life Journey page

### Hook
- [x] `src/hooks/useLifeJourney.js` — CRUD milestones (add/update/delete/resetToDefault), localStorage-only

### Context
- [x] `src/contexts/ThemeContext.jsx` — Dark/Light theme toggle, persist `vl_theme` in localStorage

### Integration
- [x] `src/App.jsx` — Add route `/life-journey`, wrap with ThemeProvider, lazy-load LifeJourneyPage
- [x] `src/components/Navbar.jsx` — Add "💛 Hành Trình" link, add theme toggle button (☀️/🌙)

---

## v2.1.0 — ✅ DONE (2026-04-21) — Personal Tasks (Nhiệm Vụ Cá Nhân)

### Database
- [x] `data/migration_v2.1.0.sql` — `user_tasks` table + RLS + indexes

### Hook
- [x] `src/hooks/useUserTasks.js` — CRUD (addTask, completeTask, deleteTask, getCompletedTasks). Supabase-first, guest in-memory

### Components
- [x] `src/components/TaskListSection.jsx` — Task list UI: add form, pending/completed display, overdue indicator, expandable description
- [x] `src/components/MonthCalendar.jsx` — Accept `getCompletedTasks` prop, show completed tasks in day detail panel

### Service Worker
- [x] `public/sw.js` — Background notification scheduler (check every 60s, fire when task due)
- [x] `src/App.jsx` — Register SW on mount

### Integration
- [x] `src/pages/TrackerPage.jsx` — Import TaskListSection + useUserTasks, wire getCompletedTasks to calendar

### Pending (user responsibility)
- [ ] Run `data/migration_v2.1.0.sql` in Supabase SQL Editor

---

## v2.0.0 — ✅ DONE (2026-04-20) — Journey Owns Habits

### Architecture: Journey-scoped habits
- [x] `src/hooks/useJourney.js` — startJourney rewritten: each journey creates FRESH habit rows. No name-match reuse. Replace mode closes all old habits. Append mode keeps old + adds new.
- [x] `src/hooks/useCustomHabits.js` — fetch query filters `.eq('active', true)` so manage tab only shows current journey's habits

### Lifecycle fixes
- [x] `completeJourney` — now closes all active habits (`active=false, status='completed'`) alongside the journey
- [x] `renewJourney` — snapshots old habits BEFORE completing, then clones them as fresh rows for the new cycle with `journey_id` pointing to the new journey

### New UI
- [x] `src/components/journey/MyJourneys.jsx` — [NEW] "Của Tôi" tab showing past journeys with "Bắt đầu lại" button (fetches journey_habits snapshot)
- [x] `src/components/journey/ActiveJourneyPanel.jsx` — completion celebration UI: when completedDays >= targetDays shows 🎉 banner + 3 actions (Renew / Extend / Complete)
- [x] `src/pages/JourneyPage.jsx` — added "📂 Của Tôi" tab + wired onComplete handler



### Journey switch modal (replace vs append)
- [x] `src/components/journey/ProgramBrowser.jsx` — SwitchModeModal with 2 radio options: 🔄 Thay thế toàn bộ habits / ➕ Ghi thêm habits
- [x] `src/hooks/useJourney.js` — `startJourney` accepts `habitMode`: replace deactivates old habits, append keeps them + re-points to new journey

### History sort fix
- [x] `src/hooks/useJourney.js` — history sorted by `created_at` DESC (not `started_at` which is DATE-only)

### Stale chunk resilience
- [x] `src/pages/TrackerPage.jsx` — `lazyRetry()` wrapper auto-reloads on chunk load failure after redeployment

---

## v1.9.4 — ✅ DONE (2026-04-19) — Bulletproof Redirect Fix

### The REAL root cause of the redirect bug
- [x] `src/contexts/JourneyContext.jsx` — Fixed a deeper React `useEffect` batching race condition. Previously, when `AuthContext` finished loading and `isAuthenticated` became `true`, there was exactly **one render cycle (tick)** where `AppShell` evaluated `isAuthenticated=true`, but `JourneyContext` hadn't fired its effect yet, so `isLoadingJourney` was still `false` (set by the guest initialization).
- **Solution:** Converted `isLoadingJourney` into a **synchronous derived state** (`loadedUserId !== user.id`) instead of relying on `useEffect`. Now, the moment `user` is available, `isLoadingJourney` evaluates to `true` instantly, blocking the `AppShell` redirect until the fetch truly finishes.

---### Remove manual tick button
- [x] `src/pages/TrackerPage.jsx` — removed `handleMainTick` + big "Tick Hôm Nay" button. Hero area now shows auto-calculated status (X/Y habits). Daily day-complete is auto-derived from habit ticks (all done = day done). Fixes cross-journey stale tick state bug.

---

## v1.9.1 — ✅ DONE (2026-04-19) — Hotfixes

### Fix firstTime redirect loop (attempt 1 → superseded by v1.9.2)
- [x] `src/App.jsx` — use `useRef` to fire redirect ONCE + skip if already on /journey

### Fix signup → can't login
- [x] `src/contexts/AuthContext.jsx` — pass username in auth metadata + `ignoreDuplicates: false` for profile upsert
- [x] `data/migration_v1.9.0.sql` — update trigger `handle_new_user` to extract username+email from metadata + `ON CONFLICT DO UPDATE`

### Seed template habits in Supabase
- [x] `data/migration_v1.9.0.sql` — seed `program_habits` for all 5 template programs

### Month summary UI for journey detail
- [x] `src/pages/JourneyDetailPage.jsx` — added `MonthSummary` component with per-month progress rings (Hoàn thành / Bỏ qua / Còn lại)

---



### Step 1 — Fix template habits loading (Bug 1)
- [x] `src/components/journey/ProgramBrowser.jsx` — join `program_habits(*)` + normalize vào `habits[]`

### Step 2 — Xóa fake habits khi login (Bug 2)
- [x] `src/hooks/useCustomHabits.js` — authenticated → real data only, no DEFAULT_HABITS fallback

### Step 3 — Gộp HabitsPage → TrackerPage (Bug 4+5)
- [x] `src/pages/TrackerPage.jsx` — merged: 4 tabs (Hôm Nay/Lịch/Tuần/Quản Lý), lazy MonthCalendar+HabitManager, memo PerHabitWeeklyGrid, single mood, empty state CTA
- [x] `src/pages/HabitsPage.jsx` — `<Navigate to="/tracker" replace />`
- [x] `src/components/Navbar.jsx` — removed Habits link
- [x] `src/App.jsx` — route exists, HabitsPage handles redirect

### Step 4 — JourneyDetailPage full dashboard (Bug 3)
- [x] `src/pages/JourneyDetailPage.jsx` — JourneyCalendar (🟢/🟡/⬜ per day) + DayDetailModal (habits ✅/❌, mood, focus sessions)

---

## v1.8.0 — ✅ DONE (2026-04-19) — Journey-as-Core-Context

### Step 1 — DB: add `journey_id` to `focus_sessions`
- [x] `data/migration_v1.6.2.sql` — ALTER TABLE focus_sessions ADD COLUMN journey_id

### Step 2 — JourneyContext
- [x] `src/contexts/JourneyContext.jsx` — NEW: expose activeJourney globally, 1 Supabase fetch per login
- [x] `src/App.jsx` — wrap AppShell với JourneyProvider

### Step 3 — useHabitLogs: pass journey_id khi tick
- [x] `src/hooks/useHabitLogs.js` — import useActiveJourney, effectiveJourneyId, pass vào habit_logs upsert

### Step 4 — useFocusTimer: tag journey_id
- [x] `src/hooks/useFocusTimer.js` — useRef pattern để pass activeJourney.id vào focus_sessions insert

### Step 5 — useCustomHabits: gắn journey_id khi tạo habit
- [x] `src/hooks/useCustomHabits.js` — addHabit() thêm journey_id: activeJourney?.id

### Step 6 — Onboarding: redirect /journey nếu chưa có journey
- [x] `src/App.jsx` — AppShell: sau login, nếu !activeJourney → Navigate to /journey?firstTime=true

### Step 7 — Journey Detail Page
- [x] `src/pages/JourneyDetailPage.jsx` — NEW full page /journey/:id với stats: completion%, focus hours, XP, mood, habits
- [x] `src/components/journey/JourneyHistory.jsx` — click card → navigate /journey/:id
- [x] `src/App.jsx` — add route /journey/:id

### ⚠️ Pending (manual action required)
- [ ] Chạy phần SQL mới trong `data/migration_v1.6.2.sql` (phần 4 — ADD COLUMN to focus_sessions) trong Supabase SQL Editor

---

## v1.6.0 — ✅ DONE (2026-04-19)

### Phase B — JourneyPage UI ✅ Done
- [x] `src/pages/JourneyPage.jsx` — 3 tabs: Đang chạy / Khám Phá / Lịch Sử
- [x] `src/App.jsx` — Thêm route `/journey`
- [x] `src/components/Navbar.jsx` — Thêm link "🗺 Lộ Trình"
- [x] `src/pages/HabitsPage.jsx` — Journey banner (active: Ngày X/Y + link; inactive: CTA)
- [x] `src/styles/journey.css` — Full CSS cho tất cả journey components
- [x] `src/data/programs.json` — 5 system templates (Rule 14 compliant)

### Phase C — Templates & History ✅ Done
- [x] `src/components/journey/ProgramBrowser.jsx` — Grid templates, category filter, Supabase + local fallback
- [x] `src/components/journey/JourneyHistory.jsx` — List lịch sử + status badges
- [x] `src/components/journey/ActiveJourneyPanel.jsx` — Progress ring, habit snapshot, quit/renew/extend
- [x] `src/components/journey/CustomJourneyModal.jsx` — Tự tạo lộ trình

### Phase D — Completion Flow ✅ Done
- [x] `src/pages/TrackerPage.jsx` — Dots tính từ `user_journeys.started_at` thay `vl_program_round`
- [x] `src/components/CompletionModal.jsx` — Thêm "🗺 Chọn Lộ Trình Mới" button → navigate /journey

---

### HabitsPage v1.4.x — Action Tracking + Per-Habit Grid + Streak
- [x] `src/data/quotes.json` — Tạo mới: 30 câu trích dẫn động lực theo Rule 14
- [x] `src/pages/HabitsPage.jsx` — Daily quote card xoay theo ngày (import từ `quotes.json`)
- [x] `src/pages/HabitsPage.jsx` — Header: thêm stat card "🎯 Habits" + "⏳ Ngày còn lại"
- [x] `src/pages/HabitsPage.jsx` — Per-habit streak 🔥N trong today list (tính ngược từ `vl_habit_progress`)
- [x] `src/pages/HabitsPage.jsx` — Counter badge X/N habits done hôm nay
- [x] `src/pages/HabitsPage.jsx` — Tab "📊 Theo Tuần": PerHabitWeeklyGrid 14 ngày
  - Header row: % toàn bộ habits per-day
  - Per-habit: streak badge + tỷ lệ 14 ngày + gradient cell (partial = tint màu)
- [x] `src/pages/HabitsPage.jsx` — `computeHabitStreak()` + `dayPct()` helper functions
- [x] `docs/FEATURES.md` — Cập nhật section #2 HabitsPage
- [x] `docs/TASKS.md` — File này
- [x] `CHANGELOG.md` — Cập nhật v1.4.x

---

## v1.4.0 — ✅ DONE (2026-04-18)

### Phase 3 — Polish & Tech Debt
- [x] `src/hooks/useFocusTimer.js` — Focus XP +15 mỗi session (deduped by sessionId, write trực tiếp vào vl_xp_store để tránh circular import)
- [x] `src/hooks/useXpStore.js` — Thêm `focus_session: 15` vào XP_REWARDS cho nhất quán
- [x] `src/hooks/useMoodSkip.js` — Thêm `getAllSkips()` API
- [x] `src/pages/DashboardPage.jsx` — Widget "Phân Tích Bỏ Qua" 14 ngày gần đây, top reasons bar chart + smart tip theo lý do
- [x] `src/hooks/useHabitStore.js` — Fix `week_num` hardcode: tính từ ngày đầu tiên tick, capped tại 3

---


## v1.3.0 — ✅ DONE (2026-04-18)

### Phase 1 — Quick Wins
- [x] `src/components/CompletionModal.jsx` — Modal ăn mừng 21 ngày, confetti, summary XP/habits/round
- [x] `src/styles/completion.css` — Gold theme, burst animation
- [x] `src/pages/TrackerPage.jsx` — Wire CompletionModal: show once per milestone, "Bắt đầu vòng 2" reset
- [x] `src/components/OnboardingModal.jsx` — 3-step guide: chào mừng, MVA, cách dùng app
- [x] `src/styles/onboarding.css` — Dot progress, step animation
- [x] `src/App.jsx` — AppShell wrapper: show OnboardingModal once (localStorage vl_onboarded)
- [x] `src/hooks/useFocusTimer.js` — Auto-tick habit khi session complete >= habit.durationMin

### Phase 2 — Feature Completion
- [x] `src/pages/FriendsPage.jsx` — Fetch streak + XP thật từ Supabase cho từng bạn bè, hiển thị 🔥 streak
- [x] `src/pages/LeaderboardPage.jsx` — Query xp_logs table thay công thức hardcode streak*10

### Skipped (deferred)
- [ ] Push Notification thực sự (Web Push) — để sau
- [ ] Cross-tick Team (Tuần 2 accountability) — để sau

---


## v1.2.0 — ✅ DONE (2026-04-18)

### Custom Habits + Focus Timer + Dashboard v2 + Tracker Redesign

- [x] `src/hooks/useCustomHabits.js` — CRUD custom habits, dual-mode sync (localStorage / Supabase `habits` table)
- [x] `src/components/HabitManager.jsx` — UI tạo/sửa/xóa habit, icon/color/category picker, live preview
- [x] `src/components/MonthCalendar.jsx` — Lịch tháng, VN holidays, done/miss/future states, click detail
- [x] `src/hooks/useFocusTimer.js` — Pomodoro logic (work/break phases, session log, DB sync)
- [x] `src/components/FocusTimer.jsx` — SVG ring countdown, custom dropdown habit picker, settings slider
- [x] `src/pages/FocusPage.jsx` — 2 cột: timer + session history + daily breakdown
- [x] `src/pages/HabitsPage.jsx` — Today quick-tick per-habit, mood, skip modal, calendar tab, manage tab
- [x] `src/hooks/useMoodSkip.js` — useMoodLog + useSkipReasons, dual-mode upsert
- [x] `src/pages/TrackerPage.jsx` — Redesign: streak ring SVG, plant growth, big tick button, 21-day dot grid
- [x] `src/pages/DashboardPage.jsx` — Redesign: flower journey, monthly donut, weekly table, contribution graph
- [x] `src/styles/dashboard.css` — CSS riêng cho dashboard v2
- [x] `src/styles/focus.css` — Custom dropdown styles thay native select
- [x] `src/styles/tracker.css` — Tracker v2 styles (streak ring, tick btn, week dots)
- [x] `docs/FEATURES.md` — Tạo mới: tài liệu giải thích 16 tính năng
- [x] `data/migration_v1.2.0.sql` — SQL migration chỉ chứa 4 bảng mới (habits, focus_sessions, mood_logs, skip_reasons)
- [x] `docs/DATABASE.md` — Thêm v1.2 additions section
- [x] `docs/ARCHITECTURE.md` — Cập nhật cấu trúc thư mục + routes
- [x] `docs/TASKS.md` — Cập nhật (file này)

### Pending (cần làm thủ công)
- [ ] Chạy `data/migration_v1.2.0.sql` trong Supabase SQL Editor (thêm 4 bảng mới)
- [ ] Điền real keys vào `.env.local` → test toàn bộ flow với DB thật
- [ ] Test: habit tick → mood → skip reason → focus session → all synced DB

---

## v1.1.1 — ✅ DONE (2026-04-18 sáng)

- [x] Fix checkbox per-habit: mỗi habit có state riêng `vl_habit_progress`
- [x] Fix mood handler: `handleMood(m)` thay vì `saveMood(m)` sai
- [x] Fix WeekDots: tính từ ngày bắt đầu thật, không phải ngược về từ hôm nay
- [x] Fix FocusTimer custom dropdown: thay native `<select>` bằng glassmorphism panel
- [x] Fix CSS import: `HabitManager.jsx` dùng `calendar.css` không phải `habits.css`

---

## v3.0.0 — ❌ CANCELLED (Team Mode v3 — archived to `src/_archived/`)

> Team features archived in v3.0.0. App repositioned as Personal Life Hub.
> Components and hooks moved to `src/_archived/`. DB tables remain but unused.

---

## v2.0.0-auth — ✅ DONE (Cloud + Auth, trước Journey v2.0.0)

- [x] Auth system (email, Google OAuth)
- [x] AuthContext, AuthModal
- [x] useHabitStore dual-mode (localStorage → Supabase migration on first login)
- [x] TeamPage: create/join team, realtime, reactions
- [x] FriendsPage: search, send/accept/decline
- [x] Supabase schema: profiles, progress, streaks, xp_logs, teams, reactions, friendships

---

## v1.1.0 — ✅ DONE (2026-04-14)

- [x] useXpStore + XpBar (6 levels)
- [x] DailyChallenge component (+20 XP)
- [x] QuizPage (10 MCQ, score-based XP)
- [x] LeaderboardPage (3 tabs, podium)
- [x] useNotifications + NotificationSettings
- [x] TrackerSection +10 XP per check (deduped)

---

## v1.0.0 — ✅ DONE

- [x] Navbar, Landing, TrackerPage, DashboardPage, TeamPage (mock)
- [x] useHabitStore (streak, badge, localStorage)
- [x] Design system (dark mode, glassmorphism, CSS variables)
- [x] BrowserRouter + routes
