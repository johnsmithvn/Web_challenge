# CHANGELOG

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
