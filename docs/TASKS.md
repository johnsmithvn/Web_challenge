# TASKS — Personal Life Hub (formerly Thử Thách Vượt Lười)
**Updated:** 2026-05-10

---

## v4.12.0 — IN PROGRESS — Media Infrastructure

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
