# TASKS — Personal Life Hub (formerly Thử Thách Vượt Lười)
**Updated:** 2026-08-01

> Các version-block đã ✅ DONE hoàn toàn và có đầy đủ trong `CHANGELOG.md` được rút gọn thành
> 1 dòng pointer. Checkbox chưa tick, TODO/decision needed, backlog, và runbook "user tự chạy"
> được giữ nguyên — đó là nội dung KHÔNG có trong CHANGELOG.

---

## 🧊 Backlog — Account Vault module (chưa triển khai)

Ý tưởng + kiến trúc đã chốt 2026-08-01, đầy đủ ở `docs/DESIGN_ACCOUNT_VAULT.md`. **Chưa
code.** Chỉ bắt đầu sau khi xong: subtask `parent_id` (6 chỗ vỡ), `task_tags` UI, migration
SQL v4.28.0/v5.0.0, các `TODO: decision needed` còn treo, và dọn dead code/lỗi hiện có.

---

## 🧊 Backlog — Task nâng cấp kiểu ClickUp/Jira (thảo luận 2026-08-02, chưa triển khai)

**Bối cảnh:** trước khi làm, cần đọc lại phần "Cố ý KHÔNG làm" ở v4.29.0/v4.27.0 bên dưới —
model là **Things 3 / Linear, KHÔNG phải ClickUp/Jira** (lý do: 1 user, phần lớn field kiểu
team-tool giá trị ~0). Danh sách dưới đây giữ nguyên ý tưởng gốc + khuyến nghị đã trao đổi,
**làm sau khi xong `task_tags` UI** (mục ngay dưới).

- [ ] **Phân loại task thêm (type/category)** — hiện đã có 2 trục (`priority` + `tags`).
  Khuyến nghị: KHÔNG thêm trục thứ 3 — hoàn thiện `task_tags` UI trước (đủ để phân loại).
- [ ] **Thời gian bắt đầu–kết thúc dự kiến** — trùng "time-grid kiểu Google Calendar" đã bị
  loại ở v4.29.0 (`due_time` mặc định `23:59` → mọi task dồn 1 hàng đáy). Nếu vẫn muốn, cân
  nhắc bản nhẹ hơn: chỉ *ước lượng thời lượng* (1 số), không phải 2 mốc giờ start/end.
- [ ] **Auto-fill giờ bắt đầu/kết thúc thực tế khi tick xong + cho sửa tay (chỉ sửa thực tế,
  không sửa dự kiến)** — trùng "time tracking" đã bị loại (đã có Focus Timer). Khuyến nghị:
  nếu cần biết thời gian thực làm task, **link Focus session vào task** (giống Focus đã link
  habit) thay vì thêm field trùng chức năng.
- [ ] **Activity log kiểu Jira (old value → new value mỗi lần update)** — nên là **bảng mới**,
  KHÔNG refactor `activity_logs` (bảng đó append-only, thô, chỉ đếm cho heatmap Life Log,
  khác hẳn audit field-diff). Nhưng cân nhắc kỹ: use-case chính của audit trail là
  collaboration/accountability — 1 user tự sửa task của mình thì giá trị thấp. Bản rẻ hơn:
  1 cột `updated_at` là đủ nếu chỉ cần biết "sửa lần cuối lúc nào".
- [ ] **Task detail view (click mở chi tiết đầy đủ)** — hợp lý về kiến trúc, nhưng chỉ đáng
  làm nếu có thêm dữ liệu thật để hiển thị (vd activity log ở trên). Chưa có gì mới thì detail
  view sẽ trống hơn cả expand ▸/▾ mô tả hiện có — đừng làm trước khi có nội dung.

---

## v4.31.0 — ✅ DONE (2026-08-02) — task_tags UI + 2 gap phát sinh + tag-delete rõ ràng hơn

**Đã làm** (chi tiết đầy đủ ở FEATURES.md §16/§19):
- `task_tags` UI hoàn thiện (`useTags.ENTITY_CONFIG` + `TagPicker` trên form Thêm/Sửa task +
  badge `🏷` trên card) — xem mục đã tick ở "Còn nợ" phía dưới v4.28.0.
- **Fix: recurring task giờ copy tag sang occurrence tiếp theo** — `spawnRecurringTask` trước
  chỉ clone `title/description/due_date/due_time/priority/recurrence_rule`, tag bị bỏ rơi (gap
  mới phát sinh từ việc thêm `task_tags`, không phải bug cũ). Giờ insert xong task mới → copy
  `task._tags` sang `task_tags` cho task đó (best-effort, không rollback task chính nếu bước
  copy tag lỗi — chỉ log warn).
- **Fix: xoá task pending giờ có confirm** — nút 🗑 trên task card (view mode) + trong overflow
  menu mobile trước xoá thẳng không hỏi. Gộp chung 1 `handleDeleteTask()` với 2 nút xoá task
  đã hoàn thành (List + Calendar) đã làm trước đó — cùng 1 confirm, không lặp code.
- **Xoá tag ở Settings rõ ràng hơn:** `useTags.js` thêm `getTagUsageBreakdown(tagId)` — đếm
  riêng theo từng loại (task/expense/subscription/collection) thay vì tổng gộp. Confirm dialog
  giờ liệt kê cụ thể ("Tag đang gắn ở: 3 nhiệm vụ, 2 khoản chi...") + khẳng định rõ **chỉ gỡ
  liên kết, KHÔNG xoá các mục đó** — đúng theo cascade thật của schema (`tag_id ON DELETE
  CASCADE` chỉ xoá dòng junction, không đụng bảng cha).
- **Quan hệ chuỗi task lặp (`recurrence_parent_id`)** — cột mới (self-FK, `ON DELETE CASCADE`),
  migration `data/migration_v4.31.0_recurrence_chain.sql` (bạn tự chạy trên Supabase). Quy tắc
  đã chốt sau thảo luận 2026-08-02 (chi tiết ở FEATURES.md §16):
  - Sửa task → không đụng row khác đã tồn tại.
  - Xoá task **gốc** → chỉ xoá đúng nó, không cascade.
  - Xoá task **không phải gốc** → cascade xoá hết hậu duệ phía sau.
  - Bỏ tích → tự xoá occurrence đã sinh (áp đúng rule "xoá không phải gốc" lên nó).
  - `ON DELETE CASCADE` thuần KHÔNG tự làm được rule bất đối xứng trên (Postgres cascade lan
    truyền vô điều kiện) — app phải tự "cắt dây" con của task gốc trước khi xoá nó, xem
    `useUserTasks.deleteTask`.
  - Chống sinh trùng: `spawnRecurringTask` check đã có occurrence tiếp theo chưa trước khi
    insert (tích/bỏ tích/tích lại nhanh không tạo thêm bản trùng).
  - **Mục 1 (chọn base date khi tick task lặp đã quá hạn: hôm nay/start_date/due_date) — GÁC
    LẠI**, chưa code, chờ nghiên cứu thêm logic + design cột `start_date` (khác ý tưởng
    "time-grid 2 mốc giờ" đã bị loại — đây chỉ là 1 cột DATE, nhẹ hơn nhiều).
  - Logic thuần tách ra `src/utils/recurrenceUtils.js` + test `src/__tests__/recurrenceUtils.test.js`.

---

## 🧪 Testing convention (mới, 2026-08-02)

Unit test cho logic phức tạp (không phải CRUD đơn giản) sống ở `src/__tests__/` — khác pattern
colocated cũ (`dateUtils.test.js` nằm cạnh `dateUtils.js`), cố ý không migrate cái cũ. Không
dùng framework (Jest/Vitest) — vẫn `node:assert/strict` script thường, chạy qua `npm test`.
**Rule bắt buộc:** chạy `npm test` sau khi sửa xong logic có test — nếu fail thì báo cáo cho
user trước khi tự sửa test hoặc logic (xem CLAUDE.md § Testing).

---

## v4.30.0 — ✅ CODE DONE / ⏳ SQL CHỜ USER CHẠY (2026-08-01) — P2-7: bỏ hẳn Nhóm, gộp về tags thường

**Quyết định (2 vòng cùng ngày):**
1. Vòng 1 — gộp hiển thị: thêm `emoji`/`description` vào `tags`, "nhóm" = 1 tag có `emoji`
   (KHÔNG dùng `is_group BOOLEAN`). Không giữ `collection_groups.sort_order` (không dùng).
2. Vòng 2 — sau khi user chạy Phase 1 + thấy nhóm cũ vẫn hiện y hệt trên UI, hỏi lại và **chốt bỏ
   hẳn tính năng Nhóm khỏi giao diện** (không phải chỉ gộp backend) — "xóa gọn gàng cả backend".
   → Revert: bỏ toàn bộ UI Nhóm khỏi `CollectPage.jsx`, revert `useTags.js` về chữ ký gốc, thêm
   `DROP COLUMN emoji/description` vào Phase 2 của migration.

### Đã làm ✅ (code, lint 0 lỗi)
- `data/migration_v4.30.0_merge_knowledge_groups_into_tags.sql` — Phase 1 (đã chạy: thêm cột,
  copy data) + Phase 2 breaking, comment sẵn (DROP TABLE `knowledge_groups`/`collection_groups`
  **+ DROP COLUMN `tags.emoji`/`description`** — thêm ở vòng 2)
- `data/RUNBOOK.sql` — gộp v4.28.0 + v5.0.0 + v4.30.0 thành 1 file chạy tuần tự, giữ nguyên
  các file gốc để tham khảo lịch sử
- `useTags.js` — về lại chữ ký gốc (`addTag`/`updateTag` không nhận `emoji`/`description` nữa,
  `getCollectionsForTag` đã xoá — không còn UI nào cần)
- `useCollections.js` — bỏ join `collection_groups`/`knowledge_groups`, select `tags(...)` không
  còn `emoji` (cột sắp bị drop)
- `CollectPage.jsx` — xoá sạch UI Nhóm: `GroupPicker`, tab 📁 Nhóm, drill-down view, group list,
  ArticleCard badge, mọi state liên quan (`activeGroupView`, `groupArticles`, `editGroups`,
  `groupNewName`, `plainTags`, `groupTags`). Chỉ còn tag thường (`#tag`)
- `FinancePage.jsx`/`SettingsPage.jsx` — bỏ filter `!tag.emoji` đã thêm ở vòng 1 (không cần nữa,
  mọi tag đều là tag thường)
- Xoá `src/hooks/useKnowledgeGroups.js`
- CSS: dọn sạch `collect.css` (`.kb-group-*`, `.kb-breadcrumb*`, `.kb-create-group*`) — dead code
- Docs: `DATABASE.md`, `ARCHITECTURE.md`, `FEATURES.md` §22 + §27 cập nhật theo quyết định cuối

### Verify đối kháng vòng 1 (4 lens độc lập) — 5 phát hiện, đã fix trước khi đổi hướng (chi tiết: CHANGELOG.md v4.30.0 "Fixed")
- [x] SQL: `INSERT...ON CONFLICT DO UPDATE` copy nhóm trùng tên có thể crash → thêm `DISTINCT ON` (vẫn giữ, áp dụng cho Phase 1 dù có đổi hướng ở vòng 2)
- [x] `addTag()` không đồng bộ emoji khi tên đã tồn tại (đã revert cùng việc bỏ emoji khỏi `addTag`)
- [x] `CollectPage.allTags` merge sai thứ tự làm mất `description` (không còn liên quan sau khi bỏ description)
- [x] `DATABASE.md` tự mâu thuẫn 27 vs 29 active (heading quên sửa) — vẫn giữ fix này
- [x] Tag-nhóm rò rỉ vào TagPicker Finance/Settings (đã revert filter cùng việc bỏ khái niệm tag-nhóm)

### ⏳ User phải tự chạy (agent không kết nối Supabase)
- [x] Chạy `data/RUNBOOK.sql` Phần 1+2 — **user xác nhận đã chạy** (SELECT kiểm tra thấy
      `knowledge_groups` còn tồn tại → đúng, Phần 3/Phase 2 chưa chạy)
- [ ] Deploy code này (bản đã bỏ UI Nhóm) lên prod
- [ ] Smoke test `/collect` → không còn tab 📁 Nhóm, bài viết cũ (từng ở trong nhóm) vẫn hiện đủ
      với tag thường (vd "tesst", "test 2" giờ là tag thường, không còn folder)
- [ ] Sau khi ổn định: bỏ comment PHẦN 3 trong RUNBOOK.sql để `DROP TABLE
      knowledge_groups, collection_groups` **+ `DROP COLUMN tags.emoji, tags.description`** —
      breaking, không hoàn lại được

---

## v4.29.0 — ✅ DONE (2026-07-29) — `/tasks` rõ ràng + view Lịch (ponytail ultra)

### Đã làm ✅ (chi tiết: CHANGELOG.md v4.29.0)
- Hero + tab 📋 Danh sách/📅 Lịch, `MonthCalendar` task mode (chip tên task), dải màu priority,
  animation tick thuần CSS, empty state, `getCompletedTasksRange` (30→1 query/tháng), fix bug
  lệch ngày UTC→local. Sau khi user gửi screenshot: fix layout lịch (`grid-template-columns:
  minmax(0,1fr)`, hairline viền, bỏ fill xanh ô done, bỏ progress bar vô nghĩa,
  `.tasks-page--calendar` nới 900→1180px, ngày chưa tới viền dashed).

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

### Đã làm ✅ (code, đã build + lint pass; chi tiết: CHANGELOG.md v4.28.0)
- Sửa bug link mất từ v4.5.0 (`CollectPage.onCreateTask` nay dùng `linkCollection()` → junction
  thay ghi cột `collection_id` deprecated); bỏ tham số chết `collectionId`/`durationEst`/`priority`
  khỏi `useUserTasks.addTask`, `IncubatorPage`, `useCollections`; viết 2 file migration
  (`v4.28.0_tags_rls_indexes.sql` an toàn + `v5.0.0_cleanup_dead_columns.sql` breaking);
  cập nhật `docs/DATABASE.md` (task_tags, Views, kiến trúc Tag).

### ⏳ User phải tự chạy (agent không kết nối Supabase) — ĐÚNG THỨ TỰ
- [x] **B0.** Kiểm schema drift — **2026-08-01 xác nhận trên prod:** `chk_collections_type` = `CHECK (type = ANY (ARRAY['inbox','note','quote','learn','idea','ai','entertainment','podcast']))` → **có `podcast`, không có `emotion`**. Kết luận: P0-1 **không phải bug thật** — constraint trên prod đã đúng, chỉ có `data/schema_v4.24.0.sql` (file snapshot trong repo) là bản cũ chưa gộp (việc của B6)
- [ ] **B1.** Deploy code v4.28.0 lên prod (chưa xác nhận riêng — B0 chỉ xác nhận phần constraint đã đúng)
- [ ] **B2.** Chạy `migration_v4.28.0_tags_rls_indexes.sql` (an toàn, idempotent) — phần `chk_collections_type` trong file này khớp với state hiện tại trên prod, nhưng file còn 2 phần khác (P0-2 RLS, P1-3 index) chưa xác nhận riêng
- [ ] **B3.** Backup DB
- [ ] **B4.** Chạy mục "KIỂM TRƯỚC" trong `migration_v5.0.0` — 6 câu SELECT phải = 0
- [ ] **B5.** Chạy `migration_v5.0.0_cleanup_dead_columns.sql` + smoke test 5 bước trong file
- [ ] **B6.** Hợp nhất 2 migration vào `data/schema_v4.24.0.sql` (cần chỉ thị rõ ràng — RULES §3)

### 7 lỗ hổng đã tìm — trạng thái
| # | Lỗ hổng | Xử lý |
|---|---|---|
| P0-1 | `chk_collections_type` có `emotion` chết, **thiếu `podcast`** → classify Podcast fail constraint | ✅ **đã đúng trên prod** (xác nhận 2026-08-01, xem B0) — không phải bug thật, chỉ do file schema trong repo lệch |
| P0-2 | 4 junction RLS chỉ kiểm ownership 1 phía → ghi được rác cross-user (đọc không leak) | migration v4.28.0 |
| P1-3 | `expense_tags`/`subscription_tags` thiếu index `tag_id` → filter theo tag full scan | migration v4.28.0 |
| P1-4 | `type` và `status` trùng nghĩa (cả 2 default `'inbox'`) | code v4.28.0 + CHECK ở v5.0.0 |
| P2-5 | 5 cột chết trên `collections` | DROP ở v5.0.0 |
| P2-6 | `user_tasks.collection_id` deprecated nhưng vẫn được ghi | code v4.28.0 + DROP ở v5.0.0 |
| P2-7 | `knowledge_groups` là taxonomy M:N **thứ 3** trên `collections`, trùng việc với `tags` | ✅ **đã quyết + code xong** (2026-08-01) — gộp vào `tags` (`emoji`/`description`), xem v4.30.0. Chỉ còn SQL chờ user chạy |

### Còn nợ
- [x] `TODO: decision needed` — **P2-7:** đã chốt 2026-08-01 — gộp `knowledge_groups` vào `tags` (thêm cột `emoji`/`description`, KHÔNG dùng `is_group BOOLEAN`). Xem v4.30.0 ở trên
- [ ] **`parent_id` subtask — 6 chỗ vỡ ở tầng list, phải sửa cùng lúc với migration:**
  1. `pendingTasks` không lọc `parent_id` → subtask render **2 lần** (lồng dưới parent + card riêng)
  2. `due_date DATE **NOT NULL**` → subtask buộc có ngày riêng → nesting **đứt ngang section** (subtask ở "Sắp tới", parent ở "Hôm nay"). Fix: subtask kế thừa `due_date` của parent
  3. `LinkKBModal` tìm task trong `[...todayTasks,...overdueTasks,...futureTasks]` → bấm 🔗 trên subtask trả **null**, modal trống. Fix: tìm trong `tasks` gốc
  4. `spawnRecurringTask` chỉ INSERT field của parent → lần lặp sau **mất hết subtask**
  5. `deleteTask` optimistic chỉ filter parent → subtask **treo trên UI** tới lần refetch; rollback cũng chỉ khôi phục parent
  6. `getCompletedTasks` + SW `SYNC_TASKS` không lọc parent → mỗi subtask 1 dòng calendar + 1 notification
- [x] `task_tags` đã có bảng nhưng **chưa có UI/hook** — **fix 2026-08-02:** `useTags.js` thêm `task: { table: 'task_tags', fk: 'task_id' }` vào `ENTITY_CONFIG` + `task_tags` vào `getTagUsageCount`/`getAllTagUsageCounts`. `useUserTasks.fetchTasks` join thêm `task_tags(tag_id, tags(...))` → `task._tags` (cùng pattern `_collections`). Thêm `linkTaskTag`/`unlinkTaskTag` optimistic riêng trong `useUserTasks.js` (không dùng `useTags.linkTag` trực tiếp — hook đó không cập nhật state `tasks` nên badge sẽ không hiện ngay). `TagPicker` gắn vào form Thêm + Sửa task trong `TaskListSection.jsx`, badge `🏷 tên` hiện trên task card
- [ ] VIEW `tagged_items` chưa có consumer nào — chờ làm unified search
- [x] `alert()` ở `CollectPage.onCreateTask` vi phạm RULES (cấm `window.alert`) — cần component toast — **fix 2026-08-01:** thêm `src/components/Toast.jsx` (`useToast()`, cùng pattern `useConfirm()`), thay `alert()` bằng `showToast()`. Đồng thời fix luôn `IncubatorPage.jsx:336` (bug tương tự, phát hiện trong audit duplicate-logic 2026-08-01) bằng inline error state riêng (không dùng Toast — đó là lỗi chặn hành động, không phải thông báo thành công)

---

## v4.27.0 — ✅ DONE (2026-07-29) — Task thành module riêng (`/tasks`)

> **Bối cảnh chiến lược (2026-07-29):** thu hẹp trọng tâm về **Inbox + Knowledge + Tasks**, sau đó Finance.
> Habit / Lộ Trình / Quiz / BXH / XP / Life Journey đang cân nhắc bỏ. `TaskListSection` vốn nằm
> **bên trong** TrackerPage nên không thể cắt habit mà không mất Task → đây là việc phải làm đầu tiên.
> Bộ lọc cho mọi feature tiếp theo: **"Notion làm được cái này không?"** Nếu có → cân nhắc bỏ.
> Nếu không (rule enforcement, automation xuyên module) → đó là việc đáng làm.

### Đã làm ✅ (chi tiết: CHANGELOG.md v4.27.0)
- Route `/tasks` độc lập (`TasksPage.jsx` lazy + `tasks.css` tách 105 dòng khỏi `tracker.css`),
  Navbar (📌 Nhiệm Vụ lên PRIMARY, Life Log xuống SECONDARY), xoá `<TaskListSection/>` khỏi
  TrackerPage, main chunk 906→876 kB (−30 kB).

### Chưa làm — cần migration SQL user tự chạy trên Supabase
- [ ] **Subtask** — thêm `user_tasks.parent_id UUID REFERENCES user_tasks(id) ON DELETE CASCADE`, render lồng **1 cấp** (không đệ quy vô hạn). Đây là khoảng trống thật duy nhất so với task manager cá nhân
- [ ] **`task_tags` junction** — `(task_id, tag_id)` composite PK, tái dùng bảng `tags` đã có (dùng chung với KB). **Chọn 1 trong 2** cách phân loại này với subtask, đừng làm cả hai — hiện có 2 taxonomy (`tags` — nay đã gộp cả "nhóm" từ v4.30.0, và `collections.type`), thêm nữa là tê liệt
- [ ] **Inline quick-add theo từng nhóm** — nút `+ Thêm` ngay trong khối Quá hạn / Hôm nay / Sắp tới (không cần DB, nhưng để chung phase 2 cho gọn)

### Cố ý KHÔNG làm (chống bloat — model là Things 3 / Linear, KHÔNG phải ClickUp)
- [ ] ~~Assignee, comment, mention~~ — 1 user, giá trị 0
- [ ] ~~Custom status pipeline, custom field~~ — bẫy schema động: mất khả năng enforce rule, đúng lý do Notion không ép được gì
- [ ] ~~Space > Folder > List hierarchy~~ — taxonomy thứ 4/5/6
- [ ] ~~Gantt / Workload / Mind Map / Sprint~~ — 1 user, giá trị 0
- [ ] ~~Time tracking~~ — đã có Focus Timer

---

## v4.26.2 — ✅ DONE (2026-07-29) — Dọn dead code + doc sai của Activity Log

### Đã làm ✅ (chi tiết: CHANGELOG.md v4.26.2)
- Xoá `useActivityLog.getTimelineByDate()` (31 dòng, 0 caller); viết lại JSDoc 11 action verify
  từ call site (bỏ 6 action bịa, thêm 5 action thiếu); `docs/FEATURES.md` §24 xoá claim
  "Daily drill-down" không tồn tại, thêm dòng MonthCalendar.

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

### Đã làm ✅ (chi tiết: CHANGELOG.md v4.26.1)
- Bỏ `getSb()` lazy-import ở 3 hook (`useUserTasks`/`useIntentions`/`useTags`), dùng
  `import { supabase }` tĩnh như 17 hook khác (xoá 29 cặp guard); gộp `snoozedFilter()` trong
  `useCollections`; gộp `isAudioUrl`/`isVideoUrl` → `isMediaUrl()`; gộp 4 bản copy `toDateStr()`;
  thêm `npm test` + 2 self-check mới (`dateUtils.test.js`, `mediaUtils.test.js`).

### Chờ quyết định (2 mục còn lại của P2)
- [ ] `TODO: decision needed` — Xoá 2 thang fallback migration (`useCollections` 3 tầng, `useUserTasks` 1 tầng, ~71 dòng)? Cần biết migration `task_collections`/`collection_tags` đã chạy trên prod chưa
- [ ] `TODO: decision needed` — Bỏ retry của `spawnRecurringTask` (~35 dòng)? RULES §7 đang liệt kê nó là pattern bắt buộc

### Phát hiện thêm — bug, không phải over-engineering
- [ ] `TODO: decision needed` — **5 chỗ dùng `toISOString().split('T')[0]` (UTC) làm "hôm nay"**: `useUserTasks`, `useSubscriptions`, `DashboardPage`, `CashflowBar`, `MonthCalendar`. Ở GMT+7 từ 00:00–06:59 hiểu thành *ngày hôm qua*. Sửa = đổi cách chốt ngày của task/subscription/calendar → cần approve riêng, không gộp vào refactor

---

## v4.26.0 — ✅ DONE (2026-07-28) — Xoá feature Fitness Log (🏋️ Sức Khỏe)

### Đã làm ✅ (chi tiết: CHANGELOG.md v4.26.0)
- Xoá toàn bộ code frontend Fitness Log (`useFitnessLog.js`, tab `fitness` trong TrackerPage
  209 dòng, section Dashboard, XP `fitness_done`) — **−455 dòng**. Cập nhật
  `FEATURES.md`/`DATABASE.md`/`ARCHITECTURE.md`/`RULES.md`/`PROJECT.md`/`PLAN.md`.

### Cố ý KHÔNG làm
- [ ] `TODO: decision needed` — **DROP bảng `fitness_logs`?** Master schema `data/schema_v4.24.0.sql` chỉ sửa khi có chỉ thị rõ ràng (RULES §3). Bảng còn trên prod, không hook nào dùng
- [x] ~~Xoá `tpl-fitness` trong `programs.json`~~ — **KHÔNG xoá**: đó là journey template "Kỷ Luật Thể Chất" thuộc feature Journey, không phải Fitness Log
- [x] ~~Xoá row `activity_logs` có `action='fitness_done'`~~ — **KHÔNG xoá**: bảng append-only audit trail

---

## v4.25.1 — ✅ DONE (2026-07-28) — Refactor P1 (phần 3/5): dọn `api/`

### Đã làm ✅ (chi tiết: CHANGELOG.md v4.25.1)
- `api/_lib/driveToken.js` (gộp 2 bản `getDriveToken`, cache token theo scope rw/readonly);
  `verifyAuth.js` bỏ `createClient`/`withTimeout` tự viết → 1 `fetch` + `AbortSignal.timeout`;
  6 chain `.replace()` → `.toString('base64url')`; `generateFileName()` 15→4 dòng (format tên
  file không đổi); thêm `api/_lib/smoke.test.js`.

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

### Đã làm ✅ (chi tiết: CHANGELOG.md v4.25.0)
- Xoá `src/_archived/` (11 file, 2.524 dòng, 0 import); gỡ `@uiw/react-md-editor` +
  `@uiw/react-markdown-preview` (0 import, −43 package); xoá dead code (`logger.debug()`, 3 hàm
  `useCollections` không caller, 8/10 export `dateUtils.js`); dedup (`CollectPage.formatDate`/
  `slugify`/`h1`-`h4`, `@keyframes fadeIn` 5→2 định nghĩa); docs sync (`RULES.md`,
  `ARCHITECTURE.md`, `PROJECT.md`, `DATABASE.md`, `FEATURES.md`).

### Chờ approve
- [ ] P1 — `api/`: 3/5 mục xong ở v4.25.1, còn 2 mục rủi ro cao (xem trên)
- [ ] P2 — hooks: bỏ `getSb()` lazy, bỏ 2 thang fallback migration, gộp query snooze, thống nhất `todayStr`
- [ ] P3 — `TaskListSection`: gộp form Add/Edit, 22 `useState` → 1 draft object
- [ ] P4 — Modal: `GenericModal` viết lại trên `<dialog>`, gộp 6 overlay
- [ ] P5 — 872 inline style → CSS (1 page/PR)
- [x] ~~P6 — bỏ markdown mode~~ **HUỶ** — mất TOC, mất tính portable của plain text, lợi ích thật chỉ ~120 dòng chứ không phải 250

---

## v4.23.0 — ✅ DONE (2026-06-14) — Remove Drive Format Toggle + Audio-First Default
- Bỏ toggle "Dạng Drive" khỏi `MediaPreview`, thêm `api/stream.js` (Vercel serverless proxy stream, bypass CORS) + `getDriveStreamUrl()`. (chi tiết: CHANGELOG.md v4.23.0)

---

## v4.22.0 — ✅ DONE (2026-06-13) — Codebase Audit Cleanup
- Xoá dead code (`useFileUpload.js`, `KnowledgeResurface.jsx`, `App.css`, assets Vite mặc định, `src/constants/` rỗng); tạo `GenericModal.jsx` + `generic-modal.css` + `dateUtils.js` dùng chung; chuyển `LifeJourneyPage.css` vào `src/styles/`. (chi tiết: CHANGELOG.md v4.22.0)

---

## v4.21.0 — ✅ DONE (2026-05-24) — Optional Journey & Onboarding Redirect Polish
- Bỏ redirect ép buộc sang `/journey` cho user mới/không có journey active; dọn logic + biến liên quan trong `AppShell`. (chi tiết: CHANGELOG.md v4.21.0)

---

## v4.20.1 — ✅ DONE (2026-05-24) — Smart Money Input Parsing & Configurable Currency Settings
- `currencyUtils.js` parse nhập tiền tự do (`50k`, `89$`), cấu hình tỷ giá USD + Auto-K trong Settings, áp dụng cho ô nhập tiền ở Finance/Inbox/Incubator. (chi tiết: CHANGELOG.md v4.20.1)

---

## v4.20.0 — ✅ DONE (2026-05-24) — Inbox Quick Done Feature
- Nút "✓ Xong" chuyển inbox item thành task hoàn thành ngay trong ngày, log `task_done`. (chi tiết: CHANGELOG.md v4.20.0)

---

## v4.19.9 — ✅ DONE (2026-05-24) — Fix Light Mode Task Form Inputs & Buttons Visibility
- Sửa CSS Light Mode cho form/nút task (`auth.css`, `tracker.css`, `TaskListSection.jsx`). (chi tiết: CHANGELOG.md v4.19.9)

---

## v4.19.8 — ✅ DONE (2026-05-24) — Fix Editor Title Input & CustomSelect Alignment
- Căn chỉnh pixel-perfect `CustomSelect` + ô nhập tiêu đề bài viết (`inline-flex`, height 38px). (chi tiết: CHANGELOG.md v4.19.8)

---

## v4.19.7 — ✅ DONE (2026-05-24) — Unified Custom Dropdowns & Task Overdue UX Fixes
- Thay `<select>` mặc định bằng `CustomSelect` ở Inbox/Collect/Incubator; badge cảnh báo task quá hạn trong ngày; mặc định giờ task `23:59`; fix `isOverdue`. (chi tiết: CHANGELOG.md v4.19.7)

## v4.19.6 — ✅ DONE (2026-05-24) — Hotfix: Enhance Sidebar, Input, Dropdown, and Tag borders/contrast in Light Mode
- Sửa viền/tương phản Light Mode cho sidebar, input, dropdown, tag, XpBar; đổi sort dropdown Collect thành popover tùy biến + thêm sort Z→A. (chi tiết: CHANGELOG.md v4.19.6)

## v4.19.5 — ✅ DONE (2026-05-24) — Hotfix: Fix Task Filter popover readability and theme sync
- Bỏ màu inline hardcode của popover lọc Task, thay bằng class CSS đồng bộ theme sáng/tối. (chi tiết: CHANGELOG.md v4.19.5)

## v4.19.4 — ✅ DONE (2026-05-24) — Hotfix: Optimize ArticleCard list borders and container backgrounds in Light Theme
- Sửa viền/nền `.kb-card` trong Light Theme; di chuyển bulk actions bar ra ngoài `.kb-list`. (chi tiết: CHANGELOG.md v4.19.4)

## v4.19.3 — ✅ DONE (2026-05-24) — Hotfix: Format Badges in list/reader view
- Thêm nhãn định dạng (`🎨 Visual` / `✍️ MD`) trên `ArticleCard` + `ReaderView`. (chi tiết: CHANGELOG.md v4.19.3)

## v4.19.2 — ✅ DONE (2026-05-24) — Hotfix: Markdown Editor Preview Reload Fix
- Cố định `REMARK_PLUGINS` tĩnh, `React.memo` cho `MediaPreview`/`CustomAudioPlayer` để tránh remount preview mỗi keystroke. (chi tiết: CHANGELOG.md v4.19.2)

## v4.19.0 — ✅ DONE (2026-05-24) — Custom Glassmorphic Audio Player
- `CustomAudioPlayer.jsx` mới thay player mặc định/iframe Drive; toggle định dạng audio/video/Drive ngay trong Markdown preview. (chi tiết: CHANGELOG.md v4.19.0)

## v4.18.0 — ✅ DONE (2026-05-24) — Advanced Media Classification and Hashtag System
- `mediaUtils.js` phân loại YouTube/Drive/audio/video; `MediaPreview` switch-case thống nhất; `MediaNode.jsx` thay `AudioNode.js`; tự migrate JSON `audioBlock`→`mediaBlock`; source link line-clamp 3 dòng. (chi tiết: CHANGELOG.md v4.18.0 + v4.18.1)

## v4.17.0 — ✅ DONE (2026-05-24) — Compact Audio Preview Redesign
- `MediaPreview.jsx` mới tập trung hoá player Drive/audio/video (compact 90px); `isAudioUrl` nhận hậu tố `#audio`/`#podcast`. (chi tiết: CHANGELOG.md v4.17.0)

## v4.16.3 — ✅ DONE (2026-05-24) — Google Drive iframe Preview Fix
- `extractDriveFileId` + iframe `/preview` thay `<video>`/`<audio>` để bypass CORS/cookie chặn. (chi tiết: CHANGELOG.md v4.16.3)

## v4.16.2 — ✅ DONE (2026-05-24) — Documentation: Upload Naming Convention
- Ghi quy tắc đặt tên file upload vào `FEATURES.md`. (chi tiết: CHANGELOG.md v4.16.2)

## v4.16.1 — ✅ DONE (2026-05-24) — Unified Google Drive Upload + URL Fix
- 100% upload qua Google Drive Service Account, đổi URL sang `uc?export=view`, bỏ Imgur/R2 khỏi docs + `.env.local.example`. (chi tiết: CHANGELOG.md v4.16.1)

## v4.16.0 — ✅ DONE (2026-05-23) — Hybrid Storage & Podcast Player
- `mediaUtils.js`, render audio/video native player, `GlobalAudioPlayer.jsx` + `useRandomPodcast.js`, hybrid upload API (Imgur + Drive Service Account — **sau đổi hẳn sang Drive ở v4.16.1**). (chi tiết: CHANGELOG.md v4.16.0)

---

## v4.14.0 — ✅ DONE (2026-05-18) — KB Category Expansion + DB Type Sync

### Đã làm ✅ (chi tiết: CHANGELOG.md v4.14.0)
- Thêm type `entertainment`/`emotion`, mở CHECK constraint 6→11 loại, fix desync `ai`/`knowledge`/`experience` bị DB chặn từ v4.4.1.

### ⚠️ USER ACTION REQUIRED
- [ ] Run `migration_v4.14.0_collection_types.sql` in Supabase SQL Editor

---

## v4.13.0 — ✅ DONE (2026-05-17) — Postcard Gallery + QuoteWidget KB Integration
- KB quote items render dạng postcard gradient (2-cột), `QuoteWidget` nhận `kbQuotes` để trộn vào random rotation. (chi tiết: CHANGELOG.md v4.13.0)

---

## v4.12.0 — ✅ DONE (2026-05-10) — Media Infrastructure

### Đã làm ✅ (chi tiết: CHANGELOG.md v4.12.0)
- Image/YouTube trong bài viết (Tiptap + Markdown); upload API (R2 lúc đó, sau đổi hẳn sang
  Google Drive Service Account ở v4.16.0/v4.16.1); `UrlInputPopover` thay `window.prompt`;
  `QuoteWidget` (daily-seeded, shuffle); `AudioNode`; bảng `inspirational_quotes` + `useQuotes.js`;
  Imgur auto-upload (lúc đó) + Quote Manager UI trong Settings.

### ⚠️ USER ACTION (lịch sử — R2/Imgur đã bị thay bằng Google Drive Service Account từ v4.16.x, có thể đã lỗi thời)
- [ ] Tạo Cloudflare account → R2 bucket → env vars trên Vercel
- [ ] Run SQL migration `migration_v4.12.0_quotes.sql` in Supabase (tạo bảng `inspirational_quotes`)
- [ ] Tạo Imgur App → `IMGUR_CLIENT_ID` env var trên Vercel

---

## v4.11.0 — ✅ DONE (2026-05-10) — Knowledge Groups (M:N) + Sub-Notes
- 3 bảng mới (`knowledge_groups`, `collection_groups`, `collection_notes`); tab 📁 Nhóm + GroupPicker + SubNotes trong Collect. (chi tiết: CHANGELOG.md v4.11.0)
- ⚠️ `knowledge_groups`/`collection_groups` đã gộp vào `tags` ở v4.30.0 (xem trên) — tab Nhóm vẫn còn, chỉ đổi nguồn dữ liệu.

---

## v4.10.1 — ✅ DONE (2026-05-10) — Task Start Time + Always-Visible Time Input
- DatePicker luôn hiện giờ (mặc định = giờ hiện tại), label "📅 Bắt đầu lúc", fix `spawnRecurringTask` dùng cột đã DROP, mobile bottom-sheet + overflow menu, xoá hẳn Mood Tracker. (chi tiết: CHANGELOG.md v4.10.1)

---

## v4.10.0 — ✅ DONE (2026-05-09) — ClickUp-style DatePicker
- `DatePickerPopover.jsx` mới (shortcut + calendar grid) thay input date/time native. (chi tiết: CHANGELOG.md v4.10.0)

---

## v4.9.0 — ✅ DONE (2026-05-09) — Task Priority System
- Thay Energy/Duration bằng Priority 5 mức, migration drop 2 cột cũ + add `priority`. (chi tiết: CHANGELOG.md v4.9.0)

---

## v4.8.0 — ✅ DONE (2026-05-09) — Incubator UI Redesign
- 2-tab (Đang ấp/Đã bỏ qua), action buttons ngay trên card, `restoreIntention()`. (chi tiết: CHANGELOG.md v4.8.0)

---

## v4.7.3 — ✅ DONE (2026-05-09) — Fix Conversion Flow Bugs
- Fix mất `body` khi Inbox→Task, mất metadata khi Incubator→Task, `todayStr` stale ở Incubator→Expense. (chi tiết: CHANGELOG.md v4.7.3)

---

## v4.7.2 — ✅ DONE (2026-05-09) — Phase 1: Incubator UX Enhancement
- Thêm cột `description` cho `intentions`, render Markdown trong Detail View, badge "📝 Có mô tả". (chi tiết: CHANGELOG.md v4.7.2)

---

## v4.7.1 — ✅ DONE (2026-05-09) — Phase 1: UI Cleanup
- Xoá `DailyReview` widget + component khỏi Sidebar. (chi tiết: CHANGELOG.md v4.7.1)

---

## v4.7.0 — ✅ DONE (2026-05-09) — Phase 1: Dead Code Cleanup + QuickCapture Upgrade
- Xoá `DailyTimeline.jsx`, `useLinkMeta.js`, `XP_REWARDS.duo_streak`; `QuickCapture` viết lại dùng `useCollections.addItem()` + `<textarea>`. (chi tiết: CHANGELOG.md v4.7.0)

---

## v4.5.4 — ✅ DONE (2026-05-09) — Audit Cleanup: DB Docs + Habit Sort Persist
- `DATABASE.md` bỏ 560 dòng SQL phantom (6 bảng ma), đánh dấu `friendships` ARCHIVED + `user_tasks.collection_id` DEPRECATED; `useCustomHabits.reorderHabits()` persist `sort_order` xuống Supabase (trước đó chỉ đổi UI, mất khi refresh). (chi tiết: CHANGELOG.md v4.5.4)

---

## v4.5.2 — ✅ DONE (2026-05-07) — Recovery: Corrupted Files + Meta Tag Fix
- Khôi phục 3 file bị corrupt 0 byte (`useUserTasks.js`, `useCollections.js`, `LinkKBModal.jsx`) + re-apply nâng cấp v4.5.0/v4.5.1; sửa meta tag PWA deprecated. (chi tiết: CHANGELOG.md v4.5.2)

---

## v4.5.1 — ✅ DONE (2026-05-03) — Bug Fixes + UX Improvements
- Fallback query khi `task_collections` chưa tồn tại (400 error); `LinkKBModal` search cả `body`, max 10 kết quả; thêm INSERT RLS `profiles_insert_own`; nút 🔗 link KB trong edit form; Settings vào avatar dropdown. (chi tiết: CHANGELOG.md v4.5.1)

---

## v4.5.0 — ✅ DONE (2026-05-03) — Task ↔ KB Many-to-Many + KB Task Filter
- `task_collections` junction table (thay 1:1 `collection_id`), `linkCollection`/`unlinkCollection`, `LinkKBModal` mới, filter `📌 Task:` + badge `📌 N tasks` trong Collect. (chi tiết: CHANGELOG.md v4.5.0)

---

## v4.4.0 — ✅ DONE (2026-05-02) — Bug Fixes + Task↔Knowledge Link + Inbox Bulk Actions
- Fix crash `IncubatorPage` Execute Modal + `getMonthlyCost()` sai cho chu kỳ 3/6 tháng; Task ↔ Knowledge link 1:1 (`collection_id`, tiền thân của v4.5.0); Inbox bulk classify/delete + activity log. (chi tiết: CHANGELOG.md v4.4.0)

---

## v4.3.0 — ✅ DONE (2026-05-01) — Inbox Filters + Incubator Archive + Tags Cleanup
- Filter chips Inbox (Tất cả/Có URL/Gần đây); toggle "Đã bỏ qua" ở Incubator; drop cột chết `collections.tags TEXT[]`. (chi tiết: CHANGELOG.md v4.3.0)

---

## v4.2.1 — ✅ DONE (2026-05-01) — Edit Expense + Sub Auto-Advance + Incubator Review Banner
- `updateExpense()` + modal sửa nhanh; `useSubscriptions.fetchSubs` tự advance `next_due` quá hạn (bounded MAX=24); banner 🥚 review-due trên TrackerPage. (chi tiết: CHANGELOG.md v4.2.1)

- v4.2.0 — Incubator Execute Modal đổi Radio → Checkbox đa lựa chọn (đồng thời tạo Expense + Habit + Task), auto-suggest theo cost/time, dropdown "⏱ Cam kết thời gian". (chi tiết: CHANGELOG.md v4.2.0)
- Fix sidebar avatar dropdown dùng React Portal (thoát clip `overflow-y`), bỏ 3 cột AI optional khỏi insert payload `useCollections.addItem` (tránh fail khi chưa migrate), thêm `.btn-primary:disabled` style. (chi tiết: CHANGELOG.md, mục headerless ngay trước v4.1.0)

---

## v4.1.0 — ✅ DONE (2026-04-30) — Tag Unification + Settings Page
- `collections.tags` (TEXT[]) → `tags` + `collection_tags` junction table trung tâm; `SettingsPage.jsx` mới (Tag Manager: CRUD, rename, recolor, usage count); route `/settings`. (chi tiết: CHANGELOG.md v4.1.0)

---

## v4.0.3 — ✅ DONE (2026-04-30) — Fitness Edit + Dashboard Fitness Card
- `useFitnessLog.updateLog()`, inline edit tab fitness, compact Dashboard card "Tuần Này". (chi tiết: CHANGELOG.md v4.0.3)

---

## v4.0.2 — ✅ DONE (2026-04-30) — Tech Debt: Recurring Task Retry
- Bounded retry (max 2-3, backoff) khi `spawnRecurringTask` insert fail + structured `console.error`. (chi tiết: CHANGELOG.md v4.0.2)

---

## v4.0.1 — ✅ DONE (2026-04-30) — Tech Debt: InboxPage Overflow Menu
- Refactor 7 nút action → 2 primary (📌 Task + 🗑) + overflow menu (···). (chi tiết: CHANGELOG.md v4.0.1)

---

## v4.0.0 — ✅ DONE (2026-04-30) — Health Tab + Reader View
- Tab 🏋️ Sức Khỏe (thứ 5 của TrackerPage, sau xoá ở v4.26.0) + `useFitnessLog.js`; Reader View metadata preview qua `api/meta.js` + `useLinkMeta.js` (sau xoá ở v4.7.0). (chi tiết: CHANGELOG.md v4.0.0)

---

## v3.9.0 — ✅ DONE (2026-04-30) — 🥚 Incubator Module
- `IncubatorPage.jsx` + `useIntentions.js` mới: CRUD, defer (friction), execute (→Task/Expense), abandon; bảng `intentions` + `intention_logs`. (chi tiết: CHANGELOG.md v3.9.0)

---

## v3.8.0 — ✅ DONE (2026-04-30) — Inbox Snooze
- Snooze inbox item (1/2 tuần, 1/3 tháng), badge "🕔 X snoozed". (chi tiết: CHANGELOG.md v3.8.0)

---

## v3.7.0 — ✅ DONE (2026-04-30) — Cashflow Calendar + PARA Tag
- `CashflowBar.jsx` (timeline 30 ngày due dates); PARA tags (`tags`, `expense_tags`, `subscription_tags` + `TagPicker.jsx`). (chi tiết: CHANGELOG.md v3.7.0)

---

## v3.6.0 — ✅ DONE (2026-04-30) — Energy Tag + Recurring Tasks
- Energy level + duration estimate picker cho task (sau xoá, thay bằng Priority ở v4.9.0); recurring task spawn-one strategy (`spawnRecurringTask`). (chi tiết: CHANGELOG.md v3.6.0)

---

## v3.5.0 — ✅ DONE (2026-04-30) — Quick Expense từ Inbox + Overdue Task Triage
- QuickExpenseModal (regex bóc số tiền từ text); task list chia 3 khối Quá hạn/Hôm nay/Sắp tới + rollover. (chi tiết: CHANGELOG.md v3.5.0)

---

## v3.4.0 — ✅ DONE (2026-04-27) — Google Docs UI Upgrade cho Tiptap Editor
- `lucide-react` icons, dropdown Heading, color picker, căn lề, gạch chân, redesign toolbar. (chi tiết: CHANGELOG.md v3.4.0)

---

## v3.3.1 — ✅ DONE (2026-04-27) — Tiptap Bug Fixes & Polish
- ~200 dòng Light mode CSS cho Tiptap; word count realtime qua `CharacterCount.words()`; thêm section shortcuts Markdown + phím tắt mới. (chi tiết: CHANGELOG.md v3.3.1)

---

## v3.3.0 — ✅ DONE (2026-04-27) — Tiptap Slash Command + Shortcuts + Browser Key Override
- `SlashCommand.jsx` (dropdown `/` 12 block types), `ShortcutsModal` (`Ctrl+.`), browser key override (`Ctrl+S`/`Ctrl+P`). (chi tiết: CHANGELOG.md v3.3.0)

---

## v3.2.1 — ✅ DONE (2026-04-27) — Polish + Debt Cleanup
- Dashboard: `MoodTrendChart` (7/30 ngày), `FocusBreakdown` (per-habit bar), `WeeklyReview` digest. (chi tiết: CHANGELOG.md v3.2.1)

---

## v3.2.0 — ✅ DONE (2026-04-26) — Knowledge Base Dual-Mode Editor + UX Polish
- `TiptapEditor.jsx` WYSIWYG + mode-lock Markdown/Visual; `ConfirmModal`/`useConfirm()` thay toàn bộ `window.confirm()`; 3 cột AI-ready (`content_format`/`body_text`/`word_count`). (chi tiết: CHANGELOG.md v3.2.0)

---

## v3.1.2 — ✅ DONE (2026-04-26) — UX Polish + Mood Chart + Performance
- `CustomSelect` dropdown cho Finance; 4 chu kỳ subscription; `MoodChart7Day`; `schema_v3.1.1.sql` gộp 8 file migration cũ thành 1. (chi tiết: CHANGELOG.md v3.1.2)

---

## v3.1.1 — ✅ DONE (2026-04-26) — Modal UX Fix
- DashboardPage rewrite: 4-KPI hôm nay, Finance Pie chart, ActivityHeatmap thay ContributionGraph. (chi tiết: CHANGELOG.md v3.1.0 — entry ghi dưới version này)

---

## v3.0.0 — ✅ DONE (2026-04-25) — Personal Life Hub Foundation

### Đã làm ✅ (chi tiết: CHANGELOG.md v3.0.0)
- Archive Team/Friends → `src/_archived/`; sidebar + bottom-tabs + QuickCapture FAB; Activity Log
  system; Inbox/Collect module; Finance module; Life Log module (`ActivityHeatmap` + `DailyTimeline`).

### Pending (user responsibility)
- [ ] User runs `migration_v3.0.0.sql` in Supabase SQL Editor

---

## v3.0.1 — ✅ DONE (2026-04-25) — Plan Gap Fix
- `KnowledgeResurface.jsx` (spaced-repetition widget, sau xoá ở v4.22.0); Finance Pie + bar chart; Inbox "→ Task"/"→ Sub" actions. (chi tiết: CHANGELOG.md v3.0.1)

---

## v2.3.0 — ✅ DONE (2026-04-25) — Mood/Skip History on Calendar
- `MonthCalendar` hiện mood emoji + skip reason trên cell/detail panel. (chi tiết: CHANGELOG.md v2.3.0)

---

## v2.2.3 — ✅ DONE (2026-04-25) — XP Dedup Fixes
- `isReady` flag + server-side dedup trong `addXp()`; sync `done` state với XP log. (chi tiết: CHANGELOG.md v2.2.3)

---

## v2.2.2 — ✅ DONE (2026-04-25) — Database Security Fix
- 5 fix RLS (`migration_v2.2.2_security.sql`): progress, team_check_logs, streaks, xp_logs CHECK, `handle_new_user` trigger. (chi tiết: CHANGELOG.md v2.2.2)

---

## v2.2.1 — ✅ DONE (2026-04-25) — Refactor: Remove HabitsPage
- Xoá `HabitsPage.jsx` (redirect deprecated từ v1.9.0), route `/habits` dùng inline `<Navigate>`. (chi tiết: CHANGELOG.md v2.2.1)

---

## v2.2.0 — ✅ DONE (2026-04-22) — Life Journey Visualization + Theme Toggle
- `LifeJourneyPage.jsx` (SVG emotion timeline Catmull-Rom); `useLifeJourney.js`; `ThemeContext.jsx` (dark/light toggle). (chi tiết: CHANGELOG.md v2.2.0)

---

## v2.1.0 — ✅ DONE (2026-04-21) — Personal Tasks (Nhiệm Vụ Cá Nhân)

### Đã làm ✅ (chi tiết: CHANGELOG.md v2.1.0)
- `useUserTasks.js` CRUD (Supabase-first, guest in-memory); `TaskListSection.jsx`; Service Worker
  background notification (`public/sw.js`); calendar integration.

### Pending (user responsibility)
- [ ] Run `data/migration_v2.1.0.sql` in Supabase SQL Editor

---

## v2.0.0 — ✅ DONE (2026-04-20) — Journey Owns Habits
- Mỗi journey tạo habit rows riêng (replace/append mode); `completeJourney`/`renewJourney` snapshot + close habits đúng; tab "Của Tôi"; completion celebration UI. (chi tiết: CHANGELOG.md v2.0.0)

---

## v1.9.4 — ✅ DONE (2026-04-19) — Bulletproof Redirect Fix
- Fix race condition `useEffect` batching: `isLoadingJourney` chuyển thành synchronous derived state để chặn redirect sớm 1 tick. (chi tiết: CHANGELOG.md v1.9.4)

---

## v1.9.1 — ✅ DONE (2026-04-19) — Hotfixes
- Fix firstTime redirect loop (`useRef` + location check); fix signup→can't login (metadata username + trigger `ON CONFLICT DO UPDATE`); seed template habits cho 5 program; month summary cards ở JourneyDetailPage. (chi tiết: CHANGELOG.md v1.9.1 + v1.9.3)

---

## v1.8.0 — ✅ DONE (2026-04-19) — Journey-as-Core-Context

### Đã làm ✅ (chi tiết: CHANGELOG.md v1.8.0)
- `JourneyContext.jsx` (single source of truth `activeJourney`); `JourneyDetailPage.jsx` full
  stats; wire `journey_id` xuyên `useHabitLogs`/`useFocusTimer`/`useCustomHabits`.

### ⚠️ Pending (manual action required)
- [ ] Chạy phần SQL mới trong `data/migration_v1.6.2.sql` (phần 4 — ADD COLUMN to focus_sessions) trong Supabase SQL Editor

---

## v1.6.0 — ✅ DONE (2026-04-19)
- `JourneyPage.jsx` 3 tab (Đang chạy/Khám Phá/Lịch Sử); `ProgramBrowser`/`JourneyHistory`/`ActiveJourneyPanel`/`CustomJourneyModal`; 5 system templates (`programs.json`); route `/journey`. (chi tiết: CHANGELOG.md v1.6.0)

---

## v1.4.0 — ✅ DONE (2026-04-18)

### Phase 3 — Polish & Tech Debt
> Ghi chú: nội dung dưới đây **không có trong CHANGELOG.md** (không tìm thấy entry tương ứng
> khi đối chiếu) — giữ nguyên làm nguồn sự thật duy nhất.

- [x] `src/hooks/useFocusTimer.js` — Focus XP +15 mỗi session (deduped by sessionId, write trực tiếp vào vl_xp_store để tránh circular import)
- [x] `src/hooks/useXpStore.js` — Thêm `focus_session: 15` vào XP_REWARDS cho nhất quán
- [x] `src/hooks/useMoodSkip.js` — Thêm `getAllSkips()` API
- [x] `src/pages/DashboardPage.jsx` — Widget "Phân Tích Bỏ Qua" 14 ngày gần đây, top reasons bar chart + smart tip theo lý do
- [x] `src/hooks/useHabitStore.js` — Fix `week_num` hardcode: tính từ ngày đầu tiên tick, capped tại 3

---

## v1.3.0 — ✅ DONE (2026-04-18)

> Ghi chú: nội dung dưới đây **không có trong CHANGELOG.md** — giữ nguyên làm nguồn sự thật duy nhất.

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

> Ghi chú: nội dung dưới đây **không có trong CHANGELOG.md** — giữ nguyên làm nguồn sự thật duy nhất.

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

> Ghi chú: nội dung dưới đây **không có trong CHANGELOG.md** — giữ nguyên làm nguồn sự thật duy nhất.

- [x] Fix checkbox per-habit: mỗi habit có state riêng `vl_habit_progress`
- [x] Fix mood handler: `handleMood(m)` thay vì `saveMood(m)` sai
- [x] Fix WeekDots: tính từ ngày bắt đầu thật, không phải ngược về từ hôm nay
- [x] Fix FocusTimer custom dropdown: thay native `<select>` bằng glassmorphism panel
- [x] Fix CSS import: `HabitManager.jsx` dùng `calendar.css` không phải `habits.css`

---

## v3.0.0 — ❌ CANCELLED (Team Mode v3 — archived to `src/_archived/`)

> Team features archived in v3.0.0. App repositioned as Personal Life Hub. Components and hooks
> moved to `src/_archived/`. DB tables remain but unused. (chi tiết: CHANGELOG.md v3.0.0, mục
> "BREAKING — Personal Life Hub Pivot")

---

## v2.0.0-auth — ✅ DONE (Cloud + Auth, trước Journey v2.0.0)
- Auth system (email, Google OAuth), `AuthContext`/`AuthModal`, `useHabitStore` dual-mode migration, `TeamPage`/`FriendsPage` (sau archived ở v3.0.0), schema Supabase gốc. (chi tiết: CHANGELOG.md v2.0.0-auth)

---

## v1.1.0 — ✅ DONE (2026-04-14)
- `useXpStore` + `XpBar` (6 levels); `DailyChallenge`; `QuizPage`; `LeaderboardPage`; `useNotifications`; TrackerSection +10 XP/check (deduped). (chi tiết: CHANGELOG.md v1.1.0)

---

## v1.0.0 — ✅ DONE
- Navbar, Landing, TrackerPage, DashboardPage, TeamPage (mock); `useHabitStore` (streak/badge/localStorage); design system (dark mode, glassmorphism); BrowserRouter + routes. (chi tiết: CHANGELOG.md v1.0.0)
