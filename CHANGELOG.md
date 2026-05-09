# CHANGELOG

## v4.10.1 — 2026-05-10
### Changed
- **DatePicker — Always-visible time input:** Time input now always shown (removed "Thêm giờ" toggle). Defaults to current local time (`HH:MM`) when opening picker. "Bây giờ" quick-set button added.
- **DatePicker — Start-time semantics:** Header label changed from "📅 Khi nào" → "📅 Bắt đầu lúc" to clarify the date/time represents when user should START the task, not a deadline.
- **Task default time:** If user doesn't explicitly set a time, defaults to `00:00` (midnight = "start of day / unspecified"). Previously stored as `null`.
- **Task card time badge:** `⏰` badge only shows for tasks with explicitly set time (not `00:00`).
- **Notification logic:** Service Worker skips `00:00` tasks for notifications — only tasks with user-set times trigger reminders.

### Added
- `dp-time__now-btn` CSS class for the "Bây giờ" quick-set button in DatePicker.
- `hideTime` prop on `DatePickerPopover` for contexts where time input should be hidden.
- `nowHHMM()` helper function in DatePicker and TaskListSection.

### Files Modified
- `src/components/DatePickerPopover.jsx` — always-visible time, smart defaults, label change
- `src/components/TaskListSection.jsx` — default dueTime to now, hide 00:00 badges
- `src/hooks/useUserTasks.js` — default due_time to '00:00', filter SW sync
- `src/styles/datepicker.css` — .dp-time__now-btn styles
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
