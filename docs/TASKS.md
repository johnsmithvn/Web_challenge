# TASKS — Personal Life Hub (formerly Thử Thách Vượt Lười)
**Updated:** 2026-08-05

---

## v5.2.0 — ✅ CODE DONE / ⏳ SQL CHỜ USER CHẠY (2026-08-05) — Vault làm lại theo thiết kế Keyplate

**Đã làm** (chi tiết đầy đủ ở CHANGELOG.md v5.2.0, FEATURES.md §29, DATABASE.md, DESIGN.md
§ "Account vault"): 6 bảng `accounts`/`account_fields`/`account_auth`/`account_codes`/`account_logs`/
`account_tags`, `useAccounts.js` viết lại, `/accounts` layout Keyplate (header + filter bar + 2 pane,
breakpoint 900px), 10 template, 10 loại field, link nhiều-tới-một, phương thức đăng nhập, sheet mã
dự phòng + paste import, sửa inline + diff log, history append-only, `vaultLogic.js` + self-check.
Lint 0 error, `npm test` pass (6/6), `npm run build` pass.

**Thay hẳn** bản Account Vault Phase A1 của v5.1.0 (chưa từng deploy — schema chưa chạy trên
Supabase). Đã xoá `migration_v5.1.0_accounts.sql`, `AccountForm.jsx`, `AccountAvatar.jsx`,
`accountLinks.js` + test.

### ⏳ User phải tự chạy / tự kiểm
- [ ] **Chạy `data/migration_v5.2.0_vault.sql`** trên Supabase SQL Editor. Idempotent, có sẵn câu
      VERIFY ở cuối file. **Chưa chạy thì `/accounts` sẽ trắng** (mọi query fail, hook nuốt lỗi vào
      `logger.warn`). 6 bảng này chưa từng tồn tại trên DB nên chạy lúc nào cũng an toàn.
- [ ] `npm run build` (tao đã chạy pass, nhưng chạy lại trên máy mày cho chắc).
- [ ] Smoke test:
      (a) `/accounts` → **New item** → chọn **Platform account** → item mới có sẵn field + 4 phương
          thức đăng nhập (password primary) + sheet 10 mã;
      (b) **Edit** → đổi title, thêm/xoá field, đổi loại field (text→multi phải gieo giá trị cũ) →
          **Save changes** → mở lại phải thấy **History** ghi từng thay đổi, secret hiện `•` không lộ
          giá trị thật;
      (c) field `password` có **strength bar**; nút **Generate** phải **disable**;
      (d) tạo item thứ hai, ở item đầu Edit → field loại **link** → chọn item thứ hai + 1 giá trị →
          Save → chip link bấm nhảy sang item kia; xoá item kia → chip thành **"Missing item"**;
      (e) **Sign-in methods:** Make primary / Turn off ngoài chế độ sửa → History ghi ngay; đặt
          primary cái khác → cái cũ tự về ENABLED (đúng ≤1 primary);
      (f) **codes:** Reveal codes, bấm 1 mã → gạch ngang + mờ + History ghi "marked used"; Edit →
          **Paste import** dán `1234 5678` (2 dòng) → đếm "2 codes detected" → Replace/Append;
      (g) item loại **Credit card** → có **card preview**, số thẻ mask tới khi Reveal field Card number;
      (h) search: gõ giá trị 1 field secret → **không** ra kết quả (secret loại khỏi search); gõ tiêu
          đề/tag/nhãn field → ra đúng;
      (i) filter chip Types + #Tags; nút Clear chỉ hiện khi có filter;
      (j) **< 900px:** chọn item → list ẩn, có nút `← All items`; light theme không vỡ layout.
- [ ] Kiểm tag: `/settings` → xoá 1 tag đang gắn item → hộp xác nhận phải ghi "N tài khoản".

### Quyết định đã chốt trong đợt này (2026-08-05)
| Câu hỏi | Chốt |
|---|---|
| Bám bản thiết kế tới đâu | **Y hệt Keyplate** — token riêng (#7c5cff, Plus Jakarta Sans, radius 18px) scope trong `.acc-vault`; chữ UI tiếng Anh |
| Feature chỉ Life Hub có (status, nhắc hạn đăng nhập, gom theo dịch vụ, favicon, nhân bản, 20 mẫu VN) | **Bỏ hết** — mã 3 chữ của template là thứ cấu trúc của design |
| Bảng vs cột jsonb | **Có lifecycle/ràng buộc riêng → bảng** (auth/codes/logs); **là giá trị của field → cột** (multi_values/links) |
| CHECK constraint | Chỉ đặt trên giá trị code render phân nhánh theo (`type`, `state`); KHÔNG đặt trên giá trị chỉ tra bảng lấy nhãn (`tpl`, `kind`) — thêm template/kind mới không cần migration |
| Link mồ côi khi xoá item đích | **jsonb không FK** → con trỏ mồ côi → UI "Missing item". Đúng hành vi đặc tả, FK không mua được gì |
| `account_logs` | **Append-only ép bằng RLS** (chỉ SELECT + INSERT). `diffLog` mask secret trước khi ghi |
| Password generator | **Render nhưng disable** tới khi có mã hoá — sinh mật khẩu thật để lưu plaintext là sai. Strength bar (chỉ đọc) thì bật |
| Guest mode | **Không có** — vault mất khi refresh thì vô nghĩa; chưa login thì hiện lời nhắc |

### Còn nợ
- [ ] **Chưa gộp `migration_v5.2.0_vault.sql` vào master `schema_v4.24.0.sql`** — RULES §3 cần chỉ
      thị tường minh. Hệ quả: cài mới từ master sẽ **thiếu 6 bảng vault**.
- [ ] **`data/reset_user_data.sql` chưa xoá dữ liệu vault** — 6 bảng `account_*` sinh sau khi script
      đó được viết (đã ghim chip spawn_task cho việc này).
- [ ] **Mã hoá client-side chưa làm** — vẫn plaintext. `password`/`secret` chỉ mask UI, là **rủi ro
      đã biết và user chấp nhận tường minh** để dùng ngay. Banner cảnh báo cố ý; đừng "dọn" đi.
      Thiết kế envelope encryption ở `docs/DESIGN_ACCOUNT_VAULT.md`.

---

## v5.0.0 — ✅ DONE (code 2026-08-02, SQL + smoke test 2026-08-03) — Activity Log v2 + Task Detail View + gỡ Life Log

**Đã làm** (chi tiết đầy đủ ở CHANGELOG.md v5.0.0, FEATURES.md §16/§24, DESIGN.md § Task Detail Modal):
`activity_logs` dựng lại (task_id FK CASCADE, field/old_value/new_value/note), `user_tasks.updated_at`
+ trigger, log 5 cửa ghi với diff generic, `TaskDetailModal` 2 tab (Hoạt động / Ghi chú),
`src/utils/taskFields.js` + test, **gỡ hẳn Life Log + heatmap + KPI "Hoạt động hôm nay"**.
Lint 0 error, `npm test` pass.

### ✅ User đã chạy / đã kiểm xong (2026-08-03)
- [x] **Chạy SQL vòng 1** (activity_logs v2 + user_tasks.updated_at) — user xác nhận đã chạy
      `data/schema_v4.24.0.sql` 2026-08-02.
- [x] **Chạy LẠI `data/schema_v4.24.0.sql`** sau đợt 3-5 (DROP 12 bảng, DROP `get_leaderboard()`,
      bỏ 2 cột `focus_sessions.habit_id`/`journey_id`, bỏ seed programs, bỏ 2 bảng khỏi realtime
      publication, `handle_new_user()` không INSERT streaks/notif nữa) — xong 2026-08-03.
- [x] **Deploy code** — xong 2026-08-03.
- [x] `npm run build` — xong 2026-08-03.
- [x] Smoke test — xong 2026-08-03 (XP tick/untick task, `/focus` timer, sửa task không đổi gì →
      không sinh log, `/tasks` tab Lịch, `/incubator` Execute, onboarding, `/tracker` → `/tasks`,
      Navbar, light theme landing). User xác nhận không còn lỗi.

**→ v5.0.0 CLOSED.** Không còn việc treo nào của đợt dọn module.

### Quyết định đã chốt trong đợt này (2026-08-02)
| Câu hỏi | Chốt |
|---|---|
| Rebuild kiểu gì | **DROP + CREATE** — chấp nhận mất trắng log cũ |
| Heatmap đếm gì | **Moot** — Life Log gỡ hẳn, không còn heatmap |
| Xoá task thì log ra sao | **FK CASCADE** — log chết theo task, DB tự dọn, không có dòng mồ côi |
| Ghi chú sửa được không | **Có** — RLS UPDATE giới hạn `action='note'` + GRANT cấp cột `note` |
| Subtask / dependency | **Hoãn** — dùng task phẳng một thời gian dài rồi mới quyết (xem Backlog dưới) |
| Life Log + KPI "Hoạt động" | **Gỡ hẳn** — heatmap chỉ COUNT dòng, là người đọc duy nhất của các dòng sự kiện rời rạc; gỡ nó thì 11 điểm ghi `logActivity` cũng thành vô dụng nên xoá luôn |

### Còn nợ
- [x] **Hợp nhất v5.0.0 vào `data/schema_v4.24.0.sql`** — ✅ xong 2026-08-02, **user cho phép tường
      minh** (RULES §3). Master dùng `CREATE TABLE IF NOT EXISTS` + `ALTER ADD/DROP COLUMN` để giữ
      tính idempotent, khác file migration dùng `DROP TABLE`.
- [ ] Bảng `activity_logs` giờ **chỉ phục vụ Task**. Nếu sau này muốn log lại chuyện gì khác
      (chi tiêu, inbox…) thì phải có NGƯỜI ĐỌC trước — đừng lặp lại vòng cũ: ghi rồi không ai đọc.
- [ ] Cột `task_id` để NULLABLE dù mọi dòng đều gắn task. Ép `NOT NULL` được, nhưng chưa cần.

> Các version-block đã ✅ DONE hoàn toàn và có đầy đủ trong `CHANGELOG.md` được rút gọn thành
> 1 dòng pointer. Checkbox chưa tick, TODO/decision needed, backlog, và runbook "user tự chạy"
> được giữ nguyên — đó là nội dung KHÔNG có trong CHANGELOG.

---

## 🧊 Backlog — Vault: mã hoá + tính năng thật (vault UI đã xong v5.2.0)

Thiết kế envelope encryption ở `docs/DESIGN_ACCOUNT_VAULT.md`. Vault UI Keyplate xong 2026-08-05
(xem block v5.2.0 đầu file) — còn lại (theo "Not in the prototype" của handoff):

- [ ] **Mã hoá client-side** — envelope encryption (KEK/DEK, `crypto.subtle`, 0 dependency),
      unlock modal + trạng thái locked, export ciphertext + đổi passphrase. Làm liền một đợt,
      không bật từng phần (mất passphrase mà chưa có export = mất trắng).
- [ ] Auto-lock timer (header đang ghi "no auto-lock yet"), TOTP thật cho phương thức authenticator,
      clipboard auto-clear, dọn link mồ côi khi xoá item.

---

## 🧊 Backlog — Định hình lại field & taxonomy của Task (nghiên cứu thêm, chưa triển khai)

**Ưu tiên thấp nhất trong các việc Task — làm sau cùng.** Gộp 3 luồng thảo luận rời rạc (subtask
từ v4.27.0, ClickUp/Jira 2026-08-02, base-date của recurring 2026-08-02) vào 1 chỗ vì tất cả cùng
chạm 1 câu hỏi: **Task nên có thêm field/quan hệ gì, và chúng ăn khớp với nhau ra sao** — làm rời
từng cái dễ dẫm chân nhau (vd subtask từng bị cảnh báo "chọn 1 trong 2 với `task_tags`, đừng làm cả
hai" — giờ thêm cả `start_date` nữa thì càng cần nghĩ chung 1 lần thay vì vá từng field riêng lẻ).

Trước khi làm bất kỳ mục nào: đọc lại "Cố ý KHÔNG làm" ở v4.29.0/v4.27.0 bên dưới — model là
**Things 3 / Linear, KHÔNG phải ClickUp/Jira** (lý do: 1 user, phần lớn field kiểu team-tool giá
trị ~0).

- [ ] **Subtask** (`user_tasks.parent_id` — KHÁC `recurrence_parent_id` đã có ở v4.31.0, 2 quan hệ
  hoàn toàn khác nhau) — khoảng trống thật duy nhất so với 1 task manager cá nhân tử tế. Đã audit
  sẵn 6 chỗ vỡ cần sửa cùng lúc với migration (chưa code, chưa có code dở dang nào trong repo tính
  tới 2026-08-02):
  1. `pendingTasks` không lọc `parent_id` → subtask render **2 lần** (lồng dưới parent + card riêng)
  2. `due_date DATE NOT NULL` → subtask buộc có ngày riêng → nesting **đứt ngang section** (subtask
     ở "Sắp tới", parent ở "Hôm nay"). Fix: subtask kế thừa `due_date` của parent
  3. `LinkKBModal` tìm task trong `[...todayTasks,...overdueTasks,...futureTasks]` → bấm 🔗 trên
     subtask trả **null**, modal trống. Fix: tìm trong `tasks` gốc
  4. `spawnRecurringTask` chỉ INSERT field của parent → lần lặp sau **mất hết subtask**
  5. `deleteTask` optimistic chỉ filter parent → subtask **treo trên UI** tới lần refetch; rollback
     cũng chỉ khôi phục parent
  6. `getCompletedTasks` + SW `SYNC_TASKS` không lọc parent → mỗi subtask 1 dòng calendar + 1
     notification
  - **`TODO: decision needed` (2026-08-02, chưa chốt):** subtask kiểu ClickUp/Jira thực ra có 2
    dạng khác nhau — (a) **task con đầy đủ** (`parent_id`, có priority/due riêng, đúng 6 chỗ vỡ ở
    trên) hay (b) **checklist** (danh sách bước nhỏ trong 1 task, chỉ text+checkbox, 1 cột JSONB
    `checklist_items` trên chính task, KHÔNG đụng 6 chỗ vỡ vì không tạo row task mới). Cần biết
    nhu cầu thật nghiêng về "task con có deadline riêng" hay "vài bước nhỏ trong 1 việc" trước khi
    chọn migration — 2 câu trả lời ra 2 giải pháp chi phí khác hẳn nhau.
- [x] **`start_date`** — **chốt 2026-08-02: KHÔNG làm.** `due_date` + `completed_at` (tương đương
  "Resolved" của Jira) đã đủ cho nhu cầu thực tế. Không thêm cột.
- [x] **`updated_at` (last modified time)** — ✅ XONG v5.0.0. Hạ tầng đã có sẵn:
  hàm trigger `update_updated_at()` trong `schema_v4.24.0.sql` (dòng 28-31) đang dùng cho
  `habits`/`friendships`; `collections` có bản riêng tương tự (`update_collections_updated_at()`).
  Chỉ cần thêm cột + 1 `CREATE TRIGGER` tái dùng hàm có sẵn cho `user_tasks`, không cần code app
  tính toán gì. **Khác `activity log` bên dưới:** đây chỉ là 1 giá trị "lần cuối sửa lúc nào",
  KHÔNG lưu đổi cái gì — 2 thứ bổ sung nhau, không thay thế nhau (Jira cũng có cả field `Updated`
  lẫn tab History riêng).
- [ ] **Phân loại task thêm (type/category)** — đã có 2 trục (`priority` + `tags`, `task_tags` UI
  xong ở v4.31.0). Khuyến nghị: KHÔNG thêm trục thứ 3.
- [x] **Thời gian bắt đầu–kết thúc dự kiến trong NGÀY (giờ, kiểu time-grid)** — **chốt lại
  2026-08-02: vẫn KHÔNG làm**, kể cả bản nhẹ (không có `start_time` riêng). Đã loại ở v4.29.0
  (`due_time` mặc định `23:59` → mọi task dồn 1 hàng đáy).
- [x] **Auto-fill giờ bắt đầu/kết thúc thực tế khi tick xong** — **chốt: KHÔNG làm field riêng**,
  trùng "time tracking" (Jira/ClickUp: bấm start/stop, cộng dồn phút làm — dùng để tính công/tính
  giờ cho khách hoặc quản lý capacity team, 1 user không cần). Đã có Focus Timer làm đúng việc
  "start/stop cộng phút". Khuyến nghị: **link Focus session vào task** (giống Focus đã link habit)
  thay vì thêm field trùng chức năng.
- [ ] **Dependency (task A phải xong trước task B, `depends_on_id`)** — **mới phát hiện 2026-08-02**
  khi so ClickUp/Jira, TASKS.md trước đây chưa từng nhắc field này. Khác các field team-tool khác
  (assignee, comment...) — dependency có giá trị thật cho 1 user (task sau chỉ nên hiện *Sắp tới*
  khi task trước đã done). Nhưng đây sẽ là quan hệ tự-tham-chiếu **thứ 3** trên `user_tasks` (đã có
  recurrence chain + đang định làm subtask chain) — rủi ro schema phình nếu không nghĩ chung với
  subtask. **Chưa quyết**, cần biết use-case thật có tồn tại (tạo task theo kiểu trình tự phụ
  thuộc) hay `due_date` sắp xếp theo ngày đã đủ.
- [x] **Activity log v2** — ✅ XONG v5.0.0 (đập bỏ `activity_logs` cũ, xây
  lại hoàn toàn, không phải patch):
  - **Phạm vi:** log **mọi field đổi của Task** (không chỉ lịch trình) — mỗi dòng = 1 field đổi +
    giá trị cũ/mới, hiển thị trong tab **Activity** của Task Detail View (kiểu Jira History).
    Knowledge (`collections`) **không cần gì thêm** — `created_at`/`updated_at` đã có sẵn từ
    trước (trigger `trg_collections_updated_at`), đủ cho nhu cầu ("chỉ cần biết sửa lúc nào").
  - **Mọi field đều lưu đầy đủ `old_value`/`new_value`, kể cả `description`** — đã tính thử:
    TEXT vài KB/lần sửa, cả đời 1 task cũng chỉ vài chục KB, không đáng lo ở quy mô 1 user
    (khác hẳn lưu ảnh/video lặp lại). **Chỉ khác ở tầng hiển thị:** field ngắn hiện full trong
    dòng Activity, `description` rút gọn preview (~80 ký tự + "...") kèm nút "Xem thêm" để bung
    full — dữ liệu lưu đủ, chỉ UI gọn. Không có field nào của Task bị bỏ qua khi update.
  - **Note cá nhân (tab riêng, KHÔNG phải comment kiểu team đã loại trước đó):** user tự thêm ghi
    chú theo thời gian trên 1 task (vd "đã xong nhưng chưa đúng tiến độ", rồi sau thêm "đã xong
    hết") — dùng chung bảng, cột `note TEXT` riêng, field/old_value/new_value NULL khi là note.
  - **Schema:** `entity_type, entity_id, action, field, old_value, new_value, note, created_at`
    (thay `action/label/amount/meta` cũ). Heatmap Life Log **không đổi cách đọc** — vẫn
    `COUNT(*) GROUP BY ngày`, không quan tâm field mới.
  - **Purge ngay lúc rebuild** (không đợi lúc Habit tracker bị gỡ thật): xóa hẳn dòng cũ có
    `action IN ('habit_done','habit_undo','fitness_done')`. Hệ quả đã xác nhận với user: heatmap
    những ngày cũ chỉ có hoạt động Habit sẽ giảm mật độ/thành ô trống — user đồng ý đánh đổi.
  - **Diff generic, không hardcode field list:** `updateTask()` so từng key có trong payload
    `updates` với giá trị cũ trong state hiện tại, khác thì log — field mới thêm sau này (vd
    `parent_id` subtask, `depends_on_id` dependency) tự động được log miễn đi qua `updateTask()`
    như convention sẵn có, không cần sửa lại code log.
  - **Cho xóa log:** thêm RLS policy `activity_logs_delete_own` (chưa có, bảng cũ chỉ có
    SELECT+INSERT) + nút 🗑 xóa từng dòng trong tab Activity (dùng `ConfirmModal` có sẵn). Hệ quả:
    xóa dòng Task cũng giảm mật độ heatmap Life Log ngày đó — cùng loại đánh đổi như purge
    habit_done ở trên, user đã biết trước.
  - `intention_logs` (Incubator) **KHÔNG** phải mẫu tái dùng được — log chuyển trạng thái
    (`action CHECK IN created/deferred/executed/abandoned/reviewed`), khác bản chất field-diff.
  - Đụng >5 file khi code thật: `useActivityLog.js`, mọi call site `logActivity` hiện tại,
    `useUserTasks.js` (ghi diff mới), Task Detail View mới (đọc + hiển thị) → chờ duyệt cuối cùng
    trước khi viết migration.
- [x] **Task detail view** — ✅ XONG ở v5.0.0 (`TaskDetailModal.jsx`), host cho tab Hoạt động + Ghi chú.

---

## 🧊 Backlog — KẾ HOẠCH DỌN MODULE (quét toàn repo 2026-08-02, CHƯA code)

**Quét bằng grep toàn `src/`, không đoán.** Kết quả: `src/` hiện **37.465 dòng**. Frontend **sạch ở
mức file** — không component/hook/CSS/JSON/context/util/route/api nào mồ côi. Rác nằm ở **mức
module**, không phải file lẻ.

Chiến lược đã chốt (v4.27.0): giữ **Inbox + Knowledge + Tasks + Finance**. Mọi thứ khác là ứng viên.

### 5 đợt, theo thứ tự — rẻ/an toàn trước, đắt/rối sau

| Đợt | Nội dung | Dòng | Rủi ro |
|---|---|---|---|
| ~~1~~ | ~~Hành Trình cảm xúc~~ ✅ **XONG 2026-08-02** | −873 | — |
| ~~2~~ | ~~Landing Page~~ ✅ **VIẾT LẠI 2026-08-02** (không xoá) | −1.545 | — |
| ~~3~~ | ~~Quiz + BXH~~ ✅ **XONG 2026-08-02** | −843 | — |
| ~~4~~ | ~~Habit + Lộ Trình + Dashboard~~ ✅ **XONG 2026-08-02** | −7.729 | — |
| ~~5~~ | ~~Dọn bảng DB chết~~ ✅ **XONG 2026-08-02** | 30→18 bảng | — |

---

#### ✅ Đợt 1 — Hành Trình cảm xúc — XONG (2026-08-02)
Đã xoá `LifeJourneyPage.jsx` + `useLifeJourney.js` + `life-journey.css`, gỡ route + ROUTE_META +
mục Navbar, dọn `RULES.md`/`FEATURES.md` §17/`ARCHITECTURE.md`/`PROJECT.md`. Lint 0 error, test pass.
⚠️ Dữ liệu cột mốc vẫn nằm trong localStorage (`vl_life_journey_events`, `vl_journey_title`) — xoá
code không xoá nó; muốn lấy lại thì `git revert` hoặc đọc key đó trong DevTools.

#### ✅ Đợt 2 — Landing Page — VIẾT LẠI, KHÔNG XOÁ (2026-08-02)
User chọn viết lại thay vì xoá, để trang chủ mô tả đúng tính năng hiện có.
- Xoá 11 file landing cũ (7 section component + `hero.css` + `sections.css` + `testimonials.css`
  + `testimonials.json`) — 923 dòng JSX + 822 dòng CSS quảng cáo sản phẩm không còn tồn tại.
- Viết mới `LandingPage.jsx` (~200) + `styles/landing.css` (~250): hero + nút đăng nhập + nút đổi
  theme riêng (Navbar ẩn ở `/` khi chưa login) + luồng 3 bước + lưới 6 card module.
- **Net −1.545 dòng.** `DESIGN.md` thêm mục `.lp-*`.
- Cố ý KHÔNG liệt kê Habit / Lộ Trình / Quiz / BXH → sau đợt 3-4 không phải sửa lại landing.
- Câu hỏi "route `/` trỏ đâu" **không còn cần trả lời** — `/` vẫn là landing.

#### ✅ Đợt 3 — Quiz + Bảng Xếp Hạng — XONG (2026-08-02)
Xoá `QuizPage.jsx`, `LeaderboardPage.jsx`, `quiz.css`, `leaderboard.css`, `data/quiz.json`; gỡ
2 route + 2 ROUTE_META + 2 mục Navbar + `XP_REWARDS.quiz_complete`. **−843 dòng.**
SQL trong master schema: `DROP FUNCTION get_leaderboard()`, `DROP TABLE streaks`, gỡ INSERT
`streaks` khỏi `handle_new_user()`. Số bảng 30 → 29.
Tiện tay sửa `LoginNudgeModal` — 2/3 lời hứa của nó là tính năng đã xoá (Team Mode v3.0.0,
Leaderboard v5.0.0).

#### ✅ Đợt 4 — Habit + Lộ Trình + Dashboard — XONG (2026-08-02)
Xoá 25 file (~7.729 dòng). Chi tiết đầy đủ ở CHANGELOG.md v5.0.0.
Kèm 5 chỗ **viết lại chứ không chỉ xoá**: `OnboardingModal` (3 bước mới),
`IncubatorPage` (bỏ nhánh tạo Habit), `useFocusTimer` + `FocusTimer` + `FocusPage`
(bỏ link habit/journey), `MonthCalendar` (bỏ habit mode), `useXpStore` +
`useUserTasks` (XP đổi nguồn sang Task).
SQL: DROP 8 bảng + bỏ seed programs + bỏ 2 bảng khỏi realtime publication.

#### ✅ Đợt 5 — Dọn bảng DB chết — XONG (2026-08-02)
DROP `notification_settings` (chưa hook nào từng đọc/ghi — `useNotifications` lưu
localStorage), `friendships` (archived v3.0.0), `fitness_logs` (feature gỡ v4.26.0).
Trigger `handle_new_user()` bỏ INSERT vào `notification_settings`.
**Schema 30 → 18 bảng. Không còn bảng nào trong schema mà không có hook dùng.**

### ⛔ CHỐNG XOÁ NHẦM — dùng chung, KHÔNG thuộc module bị xoá
`GenericModal` · `ConfirmModal` · `Toast`/`ToastContext` · `CustomSelect` · `DatePickerPopover` ·
`TagPicker` · `MonthCalendar` (task mode dùng ở `/tasks`) · `QuoteWidget` (dùng ở Collect + Inbox) ·
`useTags` · `useCollections` · `useUserTasks` · `useActivityLog` · `dateUtils` · `taskFields` ·
`global.css` · `calendar.css` · `AuthContext` · `ThemeContext` · `ErrorBoundary` · `PageSkeleton` ·
`GlobalAudioPlayer` + `useRandomPodcast` · `QuickCapture` (mount ở App)

### ✅ Đã chốt 2026-08-02
| Câu hỏi | Chốt | Hệ quả |
|---|---|---|
| DashboardPage | **XOÁ HẲN** | Gỡ route `/dashboard` + `dashboard.css`. Finance/Focus đã có trang riêng. Kéo theo: `useMoodSkip` mất consumer cuối (TrackerPage cũng xoá) → bảng `skip_reasons` chết → DROP ở đợt 5 |
| Focus Timer | **GIỮ** — gỡ link habit | Pomodoro thuần. Bỏ `linkHabit`, `journey_id`, `habit_id` khỏi `useFocusTimer`; UI chọn habit ở `FocusPage`/`FocusTimer` gỡ. Bảng `focus_sessions` giữ (2 FK đã `ON DELETE SET NULL`) |
| Incubator | **GIỮ** — vẫn có tác dụng với Task | Chỉ gỡ nhánh "Execute → tạo Habit" (`IncubatorPage:154` import + `:310` `addHabit`). Inbox core KHÔNG bị đụng |
| XP | **GIỮ** — chuyển nguồn sang Task | Đây là việc THÊM, không phải bớt. Sau khi bỏ Habit/Quiz/Challenge, XP chỉ còn `focus_session`; phải thêm luồng "hoàn thành task = +XP" (hiện Task **cố ý** không tính XP — xem FEATURES §16, cần đảo quyết định cũ). `XpBar` giữ (Navbar dùng), `useXpStore` giữ, bảng `xp_logs` giữ |

**Không còn câu nào chưa chốt.** (Route `/` giữ nguyên là landing — đã viết lại ở đợt 2.)

### Việc PHÁT SINH từ quyết định XP (không phải xoá — là thêm)
- [x] Thêm `XP_REWARDS.task_done` + `addXp`/`removeXp` trong `completeTask`/`uncompleteTask`,
      dọn `XP_REWARDS` còn 2 mục — ✅ XONG v5.0.0 (đợt 4).
- [x] Cập nhật RULES §16 — ✅ XONG, bảng XP còn 2 event.

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
- `data/RUNBOOK.sql` — gộp v4.28.0 + v4.30.0 + v5.0.0 thành 1 file chạy tuần tự (Phần 1/2 đã
  chạy, Phần 3 breaking còn comment sẵn: DROP TABLE `knowledge_groups`/`collection_groups`
  + DROP COLUMN `tags.emoji`/`description`). **2026-08-02: xoá 3 file migration standalone gốc**
  (`migration_v4.28.0_tags_rls_indexes.sql`, `migration_v4.30.0_merge_knowledge_groups_into_tags.sql`,
  `migration_v5.0.0_cleanup_dead_columns.sql`) — nội dung trùng lặp 100% với RUNBOOK.sql, giữ cả
  2 nơi gây nhầm lẫn khi chạy tay (đã gặp thật: mở nhầm file cũ, dán bị auto-correct `--`→`—` gây
  lỗi syntax). SQL gốc từng version vẫn xem được qua `git log -- data/migration_v4.28.0...sql`.
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
- [x] **2026-08-02:** chạy mục "KIỂM TRƯỚC PHẦN 3" trong RUNBOOK.sql — cả 6 cột chết
      (`collections.resolved/course_name/duration_min/reviewed_at/priority`,
      `user_tasks.collection_id`) xác nhận **KHÔNG TỒN TẠI** trên DB (0 dòng). DROP COLUMN ở
      Phần 3 (mục 3b/3c) giờ chỉ là no-op an toàn, không có gì để mất.
- [x] Deploy code (bản đã bỏ UI Nhóm) lên prod — **user xác nhận đã deploy** trước khi chạy Phần 3
- [x] **2026-08-02:** Chạy RUNBOOK.sql Phần 3 — `DROP TABLE knowledge_groups, collection_groups`
      + `DROP COLUMN tags.emoji, tags.description` + 2 cột chết + `collections.status` chuẩn hoá.
      Bỏ bước 3a khỏi khối chạy (backfill `user_tasks.collection_id` → `task_collections`) vì cột
      `collection_id` đã xác nhận không tồn tại — chạy sẽ lỗi `column does not exist`, không mất
      dữ liệu gì (transaction tự rollback khi 3a lỗi). Verify sau khi chạy: cả 4 câu kiểm tra
      (cột chết `collections`, `user_tasks.collection_id`, bảng `knowledge_groups`/
      `collection_groups`, `tags.emoji`/`description`) đều trả 0 dòng — thành công hoàn toàn.
- [x] Smoke test `/collect` trên app thật — **user xác nhận đã test xong 2026-08-02**

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
- [x] ~~`/tracker` tab 📅 Lịch — habit mode~~ — MOOT: `/tracker` + habit mode đã gỡ ở v5.0.0.

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
  khỏi `useUserTasks.addTask`, `IncubatorPage`, `useCollections`; cập nhật `docs/DATABASE.md`
  (task_tags, Views, kiến trúc Tag). SQL 2 phần (an toàn + breaking) viết ban đầu ở 2 file riêng,
  từ 2026-08-02 đã gộp hết vào `data/RUNBOOK.sql` (2 file gốc đã xoá, xem block v4.30.0 phía trên).

### ⏳ User phải tự chạy (agent không kết nối Supabase) — ĐÚNG THỨ TỰ
> **2026-08-02:** B1/B2 dưới đây đã xong qua `RUNBOOK.sql` Phần 1 (xác nhận chạy — xem block
> v4.30.0). B3 (backup) vẫn cần tự làm trước khi mở Phần 3. B4 xong (6 cột chết xác nhận 0 dòng).
> B5/B6 gộp thành 1: chỉ còn RUNBOOK.sql Phần 3 (DROP TABLE nhóm cũ + cột emoji/description) chưa
> chạy, và hợp nhất vào `schema_v4.24.0.sql` sau khi Phần 3 chạy xong.
- [x] **B0.** Kiểm schema drift — **2026-08-01 xác nhận trên prod:** `chk_collections_type` = `CHECK (type = ANY (ARRAY['inbox','note','quote','learn','idea','ai','entertainment','podcast']))` → **có `podcast`, không có `emotion`**. Kết luận: P0-1 **không phải bug thật** — constraint trên prod đã đúng, chỉ có `data/schema_v4.24.0.sql` (file snapshot trong repo) là bản cũ chưa gộp (việc của B6)
- [x] **B1+B2.** Deploy code + chạy RUNBOOK.sql Phần 1 (RLS 2 phía, index, `task_tags`, view `tagged_items`) — xác nhận đã chạy
- [x] **B3.** Backup DB — **user chủ động chọn bỏ qua** 2026-08-02 (rủi ro tự chấp nhận), không chặn tiến độ
- [x] **B4.** KIỂM TRƯỚC — 6 cột chết xác nhận 0 dòng trên DB thật (2026-08-02)
- [x] **B5.** Chạy RUNBOOK.sql Phần 3 — **2026-08-02: xác nhận xong** (xem chi tiết ở "⏳ User phải tự chạy" trên), kèm smoke test `/collect` cũng đã xác nhận xong
- [x] **B6.** Hợp nhất RUNBOOK.sql vào `data/schema_v4.24.0.sql` — **2026-08-02, làm theo yêu cầu tường minh của user.** `schema_v4.24.0.sql` giờ phản ánh đúng trạng thái cuối (v4.31.0): bỏ `user_tasks.collection_id` + 5 cột chết `collections`, thêm `recurrence_parent_id` + `task_tags` + view `tagged_items`, RLS 4 junction tag 2 phía, `chk_collections_type` có `podcast`, `chk_collections_status` mới, xoá hẳn `knowledge_groups`/`collection_groups`. `RUNBOOK.sql` giữ lại làm hồ sơ lịch sử, không cần chạy lại. Bảng đếm 31→30 (xem DATABASE.md).

### 7 lỗ hổng đã tìm — trạng thái
| # | Lỗ hổng | Xử lý |
|---|---|---|
| P0-1 | `chk_collections_type` có `emotion` chết, **thiếu `podcast`** → classify Podcast fail constraint | ✅ **đã đúng trên prod** (xác nhận 2026-08-01, xem B0) — không phải bug thật, chỉ do file schema trong repo lệch |
| P0-2 | 4 junction RLS chỉ kiểm ownership 1 phía → ghi được rác cross-user (đọc không leak) | migration v4.28.0 |
| P1-3 | `expense_tags`/`subscription_tags` thiếu index `tag_id` → filter theo tag full scan | migration v4.28.0 |
| P1-4 | `type` và `status` trùng nghĩa (cả 2 default `'inbox'`) | code v4.28.0 + CHECK ở v5.0.0 |
| P2-5 | 5 cột chết trên `collections` | ✅ xác nhận **không còn tồn tại** trên DB (2026-08-02, `information_schema.columns` 0 dòng) |
| P2-6 | `user_tasks.collection_id` deprecated nhưng vẫn được ghi | code v4.28.0 đã ngừng ghi + ✅ xác nhận **không còn tồn tại** trên DB (2026-08-02) |
| P2-7 | `knowledge_groups` là taxonomy M:N **thứ 3** trên `collections`, trùng việc với `tags` | ✅ **đã quyết + code xong** (2026-08-01) — gộp vào `tags` (`emoji`/`description`), xem v4.30.0. Chỉ còn SQL chờ user chạy |

### Còn nợ
- [x] `TODO: decision needed` — **P2-7:** đã chốt 2026-08-01 — gộp `knowledge_groups` vào `tags` (thêm cột `emoji`/`description`, KHÔNG dùng `is_group BOOLEAN`). Xem v4.30.0 ở trên
- [x] ~~Subtask (`parent_id`)~~ — đã gom vào Backlog "Định hình lại field & taxonomy của Task" đầu file.
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
- [x] ~~Subtask~~ — đã gom vào Backlog đầu file.
- [x] `task_tags` junction — xong v4.31.0 (xem "Còn nợ" trên)
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

### Nợ Activity Log — ✅ ĐÃ GIẢI QUYẾT HẾT ở v5.0.0 (2026-08-02)

Toàn bộ 9 mục `TODO: decision needed` của khối này đã hết hiệu lực khi bảng `activity_logs` được
dựng lại (xem block v5.0.0 đầu file). Ghi lại kết cục để không ai đọc nhầm danh sách cũ:

| Nợ cũ | Kết cục |
|---|---|
| `amount` nhồi 4 đơn vị | Cột `amount` **đã bỏ** — tiền/XP vốn đã có nguồn thật ở `expenses`/`subscriptions`/`xp_logs` |
| Không có `entity_type`/`entity_id` | Thay bằng FK thật `task_id → user_tasks ON DELETE CASCADE`, **cố ý không dùng polymorphic** |
| `label` là câu tiếng Việt render sẵn | Cột `label` **đã bỏ**; nhãn giờ derive lúc render qua `describeActivity()` trong `utils/taskFields.js` |
| `action` free-form, không CHECK | **Cố ý giữ free-form** — mọi lệnh ghi đều fire-and-forget nuốt lỗi, nên CHECK bị vi phạm sẽ làm log biến mất âm thầm. Chống gõ sai bằng hằng số `ACTIONS` |
| Coverage lệch (`completeTask` không log) | **Đã bịt** — log cắm ở 5 cửa ghi của `useUserTasks` |
| `useFocusTimer.js:154` insert bypass hook | **Đã xoá hẳn** cùng Life Log |
| Row orphan `fitness_done` | **Đã purge** |
| `getHeatmapData` SELECT cả năm | **Đã xoá** cùng Life Log |
| Fire-and-forget không đảm bảo ghi | **Vẫn vậy, cố ý** — log hỏng không được phép chặn thao tác của user |


---

## v4.26.1 — ✅ DONE (2026-07-28) — Refactor P2 (4/6): tầng data

### Đã làm ✅ (chi tiết: CHANGELOG.md v4.26.1)
- Bỏ `getSb()` lazy-import ở 3 hook (`useUserTasks`/`useIntentions`/`useTags`), dùng
  `import { supabase }` tĩnh như 17 hook khác (xoá 29 cặp guard); gộp `snoozedFilter()` trong
  `useCollections`; gộp `isAudioUrl`/`isVideoUrl` → `isMediaUrl()`; gộp 4 bản copy `toDateStr()`;
  thêm `npm test` + 2 self-check mới (`dateUtils.test.js`, `mediaUtils.test.js`).

### Chờ quyết định (2 mục còn lại của P2)
- [ ] `TODO: decision needed` — Xoá 2 thang fallback migration (`useCollections` 3 tầng, `useUserTasks` 1 tầng, ~71 dòng)? **2026-08-02: blocker đã rõ** — `task_collections`/`collection_tags`/`task_tags` xác nhận đã chạy + đang dùng thật trên prod (xem B0-B6, v4.28.0). Quyết định xoá fallback hay không vẫn cần approve riêng (không tự xoá)
- [ ] `TODO: decision needed` — Bỏ retry của `spawnRecurringTask` (~35 dòng)? RULES §7 đang liệt kê nó là pattern bắt buộc

### Phát hiện thêm — bug, không phải over-engineering
- [ ] `TODO: decision needed` — **`toISOString().split('T')[0]` (UTC) dùng làm "hôm nay"**. Ở GMT+7
      từ 00:00–06:59 nó hiểu thành *ngày hôm qua*. **Danh sách đếm lại 2026-08-02 sau khi dọn module**
      (khác bản cũ — `useUserTasks`/`useSubscriptions`/`MonthCalendar` giờ đã dùng `toDateStr`,
      `DashboardPage` đã xoá): `CashflowBar` (2 chỗ), `useFocusTimer` (3 chỗ), `FocusPage`,
      `useExpenses`, `InboxPage`. Sửa = đổi cách chốt ngày của Focus/chi tiêu/snooze → cần approve
      riêng. Bản vá là `toDateStr()` trong `utils/dateUtils.js` (đã có sẵn).

---

## v4.26.0 — ✅ DONE (2026-07-28) — Xoá feature Fitness Log (🏋️ Sức Khỏe)

### Đã làm ✅ (chi tiết: CHANGELOG.md v4.26.0)
- Xoá toàn bộ code frontend Fitness Log (`useFitnessLog.js`, tab `fitness` trong TrackerPage
  209 dòng, section Dashboard, XP `fitness_done`) — **−455 dòng**. Cập nhật
  `FEATURES.md`/`DATABASE.md`/`ARCHITECTURE.md`/`RULES.md`/`PROJECT.md`/`PLAN.md`.

### Cố ý KHÔNG làm
- [x] **DROP bảng `fitness_logs`** — ✅ XONG v5.0.0 (đợt 5), cùng `friendships` + `notification_settings`.
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
- [ ] P2 — hooks: `getSb()` lazy đã bỏ ở v4.26.1; còn 2 thang fallback migration + thống nhất `todayStr` (xem mục UTC ở trên)
- [ ] P3 — `TaskListSection`: gộp form Add/Edit, **37** `useState` → 1 draft object (đếm lại 2026-08-02)
- [ ] P4 — Modal: `GenericModal` viết lại trên `<dialog>`. Còn **3 hệ**: `.modal-overlay` (global.css), `generic-modal.css`, `confirm-modal.css` — DESIGN.md đã ghi nhận là nợ, chưa chốt cái nào canonical
- [ ] P5 — inline style → CSS (1 page/PR). **357 chỗ** còn lại (đếm lại 2026-08-02; giảm từ 872 nhờ dọn module)
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
- Thêm type `entertainment`/`emotion` (sau đổi thành `podcast` ở v4.28.0), mở CHECK constraint 6→11 loại, fix desync `ai`/`knowledge`/`experience` bị DB chặn từ v4.4.1. **2026-08-02: dọn** — `migration_v4.14.0_collection_types.sql` không còn tồn tại trong `data/` (đã gộp vào schema từ trước), constraint đã xác nhận đúng trên prod hôm nay (xem v4.28.0 B0). (chi tiết: CHANGELOG.md v4.14.0)

---

## v4.13.0 — ✅ DONE (2026-05-17) — Postcard Gallery + QuoteWidget KB Integration
- KB quote items render dạng postcard gradient (2-cột), `QuoteWidget` nhận `kbQuotes` để trộn vào random rotation. (chi tiết: CHANGELOG.md v4.13.0)

---

## v4.12.0 — ✅ DONE (2026-05-10) — Media Infrastructure
- Image/YouTube trong bài viết (Tiptap + Markdown); upload API (R2/Imgur lúc đó, **sau đổi hẳn
  sang Google Drive Service Account ở v4.16.0/v4.16.1** — R2/Imgur setup bên dưới đã lỗi thời,
  không cần làm); `UrlInputPopover` thay `window.prompt`; `QuoteWidget` (daily-seeded, shuffle);
  `AudioNode`; bảng `inspirational_quotes` + `useQuotes.js` (feature đang chạy thật, migration đã
  chạy từ lâu — file `migration_v4.12.0_quotes.sql` không còn tồn tại trong `data/`, đã gộp vào
  schema). (chi tiết: CHANGELOG.md v4.12.0)

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
- Archive Team/Friends → `src/_archived/`; sidebar + bottom-tabs + QuickCapture FAB; Activity Log
  system; Inbox/Collect module; Finance module; Life Log module (`ActivityHeatmap` + `DailyTimeline`).
  **2026-08-02: dọn** — `migration_v3.0.0.sql` không còn tồn tại trong `data/` (đã gộp từ lâu, các
  module này đang chạy thật). (chi tiết: CHANGELOG.md v3.0.0)

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
- `useUserTasks.js` CRUD (Supabase-first, guest in-memory); `TaskListSection.jsx`; Service Worker
  background notification (`public/sw.js`); calendar integration. **2026-08-02: dọn** —
  `migration_v2.1.0.sql` không còn tồn tại (đã gộp từ lâu, module Task đang chạy thật + được mở
  rộng nhiều lần từ đó tới v4.31.0). (chi tiết: CHANGELOG.md v2.1.0)

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
- `JourneyContext.jsx` (single source of truth `activeJourney`); `JourneyDetailPage.jsx` full
  stats; wire `journey_id` xuyên `useHabitLogs`/`useFocusTimer`/`useCustomHabits`. **2026-08-02:
  dọn** — `migration_v1.6.2.sql` không còn tồn tại (đã gộp từ lâu, Journey đang chạy thật).
  (chi tiết: CHANGELOG.md v1.8.0)

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
- [x] ~~Push Notification thực sự (Web Push)~~ — MOOT: nhắc nhở habit đã gỡ v5.0.0. Thông báo
      nhắc hạn Nhiệm vụ vẫn chạy qua Service Worker, không cần Web Push.
- [x] ~~Cross-tick Team~~ — MOOT: Team Mode gỡ từ v3.0.0.

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
- [x] Chạy `data/migration_v1.2.0.sql` — **2026-08-02: dọn**, file không còn tồn tại (đã gộp từ lâu)
- [x] Điền real keys vào `.env.local` → test toàn bộ flow với DB thật — app chạy production từ lâu
- [x] Test: habit tick → mood → skip reason → focus session → all synced DB — đã qua production lâu rồi

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
