# AI_AGENT_RULES.md — Life Hub (Personal Life OS)

**Project:** Life Hub — Personal Life OS
**Version:** v4.22.0
**Updated:** 2026-06-13
**Repository:** React 19 + Vite 8 + Supabase (PostgreSQL) SPA

Rules for AI coding agents working on this repository.
These rules control **agent behavior**, not project architecture or business logic.

---

# 1. Knowledge Honesty

The agent MUST never invent or assume information about the repository.

Rules:

* Never fabricate facts about:

  * repository files or their contents
  * Supabase table schemas, RLS policies, or triggers
  * hook return signatures or state shapes
  * CSS class names or design tokens
  * environment variables or deployment configuration
  * localStorage key formats or usage

* If required information is missing, write:

```
TODO: missing input
```

* If unsure about execution impact, write:

```
TODO: decision needed
```

Always distinguish clearly between:

* **Observed facts** – verified from repository files
* **Assumptions** – clearly labeled guesses
* **Proposed changes** – modifications suggested by the agent

Do not present assumptions as facts.

---

# 2. Anti-Hallucination Safeguards

Before writing or modifying code:

1. Verify that the target file exists in `src/`, `api/`, `data/`, `public/`, or `docs/`.
2. If it does not exist, explicitly create it.
3. Inspect related files before making changes (e.g., read the hook before modifying the page that uses it).

Before claiming task completion:

* Confirm modified files match expectations
* Verify expected content (imports, exports, function signatures)
* Run `npm run build` (or `npx vite build`) to verify zero errors
* Check no TypeScript/ESLint errors introduced

Never claim external side effects (Supabase data changes, Vercel deployment) unless verified in code or logs.

If validation cannot be completed, record:

```
TODO: pending validation
```

---

# 3. Scope Control

The agent MUST work **only within the current task scope**.

Do NOT touch:

* `src/_archived/` — dead code, preserved for reference only
* `node_modules/`, `dist/`, `.git/` — auto-generated
* `.env.local` — contains secrets, NEVER read or modify
* `data/schema_v4.4.0.sql` — master schema, only modify with explicit instruction

---

# Workflow

## Before Writing Code

1. Read `docs/RULES.md` (this file).

2. If context is missing or the project behavior is unclear, read:

   - `docs/ARCHITECTURE.md` — folder structure, data flow, tech stack, routes
   - `docs/FEATURES.md` — feature specifications, sub-feature details, data sources

3. Read `docs/PLAN.md` to understand the current phase of development and version history.

4. Read `docs/TASKS.md` to find the current task.

5. Update `docs/TASKS.md` to mark the current task as:

```
IN PROGRESS
```

6. Implement **only the current task**.

---

## After Implementation

1. Update `docs/TASKS.md`

   - Mark the task as completed `[x]`.
   - Add follow-up tasks if necessary.

2. Update `docs/PLAN.md` if the phase or milestone progress has changed.

3. Update `docs/ARCHITECTURE.md` if:

   - A new page, hook, component, or utility was added
   - Module behavior changed
   - Data flow changed
   - Route table changed
   - localStorage key was added/removed
   - Supabase table was added/modified

4. Update `docs/FEATURES.md` if any user-facing behavior changed.

5. Update `docs/DATABASE.md` if any Supabase table, column, or RLS policy changed.

6. Update `CHANGELOG.md` with version entry.

7. Bump version in `package.json`.

---

# Restrictions

The agent MUST NOT:

- Refactor unrelated modules
- Change architecture without explicit instruction
- Rename files across the repository
- Modify configuration defaults unnecessarily (`vite.config.js`, `vercel.json`, `eslint.config.js`)
- Introduce large refactors
- Touch `src/_archived/` files
- Modify `data/schema_v4.4.0.sql` without explicit instruction
- Remove or modify existing CSS variables in `src/styles/global.css` without understanding downstream impact

If a larger change appears necessary, record:

```
TODO: architectural change required
```

Do NOT implement architectural changes automatically.

---

# Mandatory Practices

The agent MUST:

- Mark unknown decisions as `TODO` in documentation
- Do NOT hide important TODO decisions only inside code comments
- Keep documentation concise
- Avoid duplicate long explanations
- Modify **only files relevant to the current task scope**
- Do NOT delete or rewrite unrelated files
- Keep changes **minimal and reversible**
- Preserve naming consistency with architecture documentation
- Follow existing code patterns (e.g., hook structure, CSS class naming, component composition)

---

# Documentation Synchronization

Any behavior change MUST be reflected in the documentation.

Required updates:

| File | When to update |
|------|----------------|
| `docs/ARCHITECTURE.md` | Module structure, data flow, route, hook, component, or utility changes |
| `docs/FEATURES.md` | Any user-facing feature change (add, modify, remove) |
| `docs/DATABASE.md` | Supabase table, column, RLS policy, or trigger changes |
| `docs/PLAN.md` | Phase or milestone progress changes |
| `docs/TASKS.md` | Task completion, new tasks |
| `CHANGELOG.md` | Every repository modification (version, Added/Changed/Fixed/Removed) |

---

# Missing Context Handling

If required information is missing:

```
TODO: missing input
```

The agent MUST NOT guess implementation details.

Stop implementation until the missing input is clarified.

---

# File Verification Rule

Before modifying a file:

1. Verify the file exists in the repository.
2. If the file does not exist, explicitly create it.
3. Inspect related files before making modifications.

---

# Task Completion Verification

Before marking a task as completed, the agent MUST verify:

- All relevant files were modified correctly
- No unrelated files were changed
- Documentation was updated where necessary
- `docs/TASKS.md` status was updated
- `docs/PLAN.md` was updated if phase progress changed
- `CHANGELOG.md` was updated
- `package.json` version was bumped
- `npm run build` passes with 0 errors

---

# 4. File Modification Rules

When modifying the repository:

* Change **only files relevant to the task**
* Keep modifications **minimal**
* Avoid deleting files unless explicitly required
* Preserve naming conventions
* Avoid rewriting entire files unless necessary

Prefer **small, reversible patches**.

### File Organization Conventions

```
src/pages/       → Page components (1 per route)
src/components/  → Reusable UI components
src/hooks/       → Custom React hooks (Supabase-first, guest fallback)
src/contexts/    → React Context providers
src/lib/         → Third-party client setup (supabase.js)
src/utils/       → Pure utility functions
src/data/        → Static JSON content (Rule 14)
src/extensions/  → Custom Tiptap editor extensions
src/styles/      → All CSS files (1 per domain/component)
api/             → Vercel Edge Functions (serverless)
data/            → SQL migration files + master schema
public/          → Static assets (favicon, manifest, service worker)
docs/            → Project documentation
```

### CSS Conventions

- **No Tailwind** — vanilla CSS with CSS variables
- Design tokens in `src/styles/global.css` (`--bg-primary`, `--purple`, `--radius-md`, etc.)
- One CSS file per domain/component in `src/styles/`
- Support both Dark and Light themes via CSS variables
- Use glassmorphism patterns consistently

### Component Conventions

- Lazy-load non-critical pages via `React.lazy` + `Suspense`
- `LandingPage` and `TrackerPage` are eager-loaded (always needed)
- Use `ErrorBoundary` wrapper for route-level error handling
- Modals use `GenericModal` component (not inline markup)
- Dropdowns use `CustomSelect` component (not native `<select>`)
- Date picking uses `DatePickerPopover` (not native `<input type="date">`)
- Confirm dialogs use `ConfirmModal` + `useConfirm()` (not `window.confirm`)

---

# 5. Code Safety Principles

Generated code should follow these principles:

* Prefer small single-responsibility modules
* Validate all external inputs
* Fail fast on invalid configuration
* Avoid hidden side effects
* Keep logs structured and actionable

### Dual-Mode Architecture

Every data hook MUST follow the dual-mode pattern:

```
User Action
    │
    ▼
Hook (e.g. useHabitStore)
    │
    ├── isAuthenticated?
    │       ├── YES → Supabase upsert/insert (PRIMARY)
    │       │         ├── Optimistic update → React state
    │       │         └── Error → rollback
    │       │
    │       └── NO → In-memory state (reset on refresh)
    │
    └── Update local React state → re-render
```

### localStorage Rules

- Prefix ALL keys with `vl_` (e.g., `vl_theme`, `vl_onboarded`)
- Store ONLY UI state flags and settings — NEVER user data
- User data goes to Supabase (authenticated) or in-memory (guest)

### Hook Naming

- `use<Entity>.js` — CRUD hooks (e.g., `useExpenses.js`, `useTags.js`)
- Exported functions: `fetch<Plural>`, `add<Entity>`, `update<Entity>`, `delete<Entity>`
- Return `{ items, loading, error, ...actions }`

Avoid:

* Silent failures
* Magic constants without explanation
* Hidden global state
* `window.confirm()`, `window.alert()`, `window.prompt()` — use `ConfirmModal` and custom UI

---

# Environment

Node.js dependencies are managed via `npm`. Use `npm install` to set up.

```bash
# Development
npm run dev          # Start Vite dev server

# Build (verification)
npm run build        # Production build — MUST pass with 0 errors

# Lint
npm run lint         # ESLint check
```

### Required Environment Variables

```
VITE_SUPABASE_URL              # Frontend: Supabase project URL
VITE_SUPABASE_ANON_KEY         # Frontend: Supabase anonymous key (public)
GOOGLE_SERVICE_ACCOUNT_JSON    # Server-only: Google Drive upload (Vercel Function)
DRIVE_FOLDER_ID                # Server-only: Google Drive target folder
```

> ⚠️ Variables with `VITE_` prefix are exposed to the browser.
> Variables WITHOUT `VITE_` prefix are server-side only (Vercel Functions).

---

# 6. Configuration and Secret Safety

The agent MUST NOT place secrets inside the repository.

Never hardcode:

* API keys
* Supabase service_role keys
* Google Service Account JSON
* OAuth client secrets
* Any tokens or passwords

Credentials must come from:

* Environment variables (`.env.local` for local, Vercel Environment for production)
* NEVER committed to git — `.env.local` is in `.gitignore`

Reference: `.env.local.example` for variable names and documentation.

---

# 7. Retry and Loop Safety

Automated retry logic must always be bounded.

Never generate:

* Infinite loops
* Uncontrolled retries
* Recursion without limits

All retry systems must include:

* Maximum retry count (e.g., MAX_RETRIES = 2)
* Backoff delay (e.g., 1000ms)
* Failure logging via `console.error`

Existing patterns:

* `spawnRecurringTask` — bounded retry (max 2, 1s backoff)
* `lazyRetry()` — stale chunk retry (1 attempt, page reload)
* `useSubscriptions.fetchSubs` — auto-advance bounded (MAX_ADVANCE = 24 cycles)

---

# 8. Versioning and Change Log Rule

After completing **any task that modifies the repository**, the agent MUST update the change log.

Steps:

1. Update `CHANGELOG.md`
2. Record the change under the correct version
3. Include a short description

Each entry must contain:

* Version number and date
* Sections: Added / Changed / Fixed / Removed (as applicable)
* Changed files or modules
* Short description of the change

Example:

```markdown
## v4.23.0 — 2026-06-15
### Added
- **Feature Name:** Brief description.
  - Sub-detail 1
  - Sub-detail 2

### Changed
- **FileName.jsx** — What changed and why.

### Files Added
- `src/hooks/useNewHook.js`

### Files Modified
- `src/pages/SomePage.jsx`
```

---

# 9. Version Numbering

Use **Semantic Versioning**:

```
MAJOR.MINOR.PATCH
```

Rules:

**PATCH** changes include:
- Bug fixes
- Small improvements
- Internal logic fixes
- Hotfixes (v4.19.1 → v4.19.2)

**MINOR** changes include:
- New features
- New modules (pages, hooks, components)
- Non-breaking behavior changes
- UI redesigns

**MAJOR** changes include:
- Architecture changes
- Breaking interface changes
- Database schema breaking changes

If unsure which version level to use:

```
TODO: version decision needed
```

Current version: **v4.22.0**

---

# 10. Documentation Integrity

If code behavior changes, documentation must be updated.

This includes:

* Module behavior
* Component interfaces and props
* Hook return shapes
* Configuration structure
* Data flow (Supabase ↔ React state ↔ UI)
* Route table
* localStorage key usage

Documentation must reflect the **current repository state**.

Never silently change behavior without documenting it.

---

# 11. Completion Checklist

Before declaring a task finished, verify:

- [ ] Relevant files modified correctly
- [ ] No unrelated files changed
- [ ] TODO markers added for uncertainties
- [ ] `CHANGELOG.md` updated
- [ ] `package.json` version bumped
- [ ] `docs/TASKS.md` status updated
- [ ] `docs/PLAN.md` updated (if milestone changed)
- [ ] `docs/ARCHITECTURE.md` updated (if structure changed)
- [ ] `docs/FEATURES.md` updated (if feature changed)
- [ ] `docs/DATABASE.md` updated (if DB changed)
- [ ] `npm run build` — 0 errors

Only then mark the task as complete.

---

# Goal of These Rules

These rules exist to ensure the AI agent:

* Does not hallucinate
* Does not silently break the project
* Keeps changes traceable
* Maintains repository safety
* Behaves predictably during automated coding tasks
* Follows established project conventions
* Keeps documentation synchronized with code

---

# README Requirement

The repository MUST contain a `README.md` at root explaining:

* How to run the project from a clean machine
* Environment variable setup
* Database setup (Supabase SQL)
* Build and deployment instructions

---

# 12. Frontend Code Quality Guidelines

## Structure

```
src/
  pages/         → Page components (1 per route, lazy-loaded)
  components/    → Reusable UI (props-driven, no direct DB access)
  hooks/         → Data hooks (Supabase-first, guest fallback)
  contexts/      → React Context (Auth, Theme, Journey)
  utils/         → Pure functions (no React, no side effects)
  data/          → Static JSON (Rule 14)
  extensions/    → Custom Tiptap extensions
  styles/        → CSS files (1 per domain)
  lib/           → Third-party client setup
```

## Conventions

* Pages import hooks for data, components for UI
* Hooks contain all Supabase interaction logic
* Components receive data via props (no direct `supabase` calls except DashboardPage FocusBreakdown)
* Use `React.lazy` for non-critical pages
* Use `React.memo` for expensive renders (e.g., `MediaPreview`, `CustomAudioPlayer`)
* Use `useCallback`/`useMemo` where appropriate
* Assert behavior, **not** implementation details

## Import Patterns

```js
// Static JSON
import QUESTIONS from '../data/quiz.json';
import HABITS_DATA from '../data/habits.json';
const { skipReasons, categories } = HABITS_DATA;

// Shared components (avoid re-implementing)
import GenericModal from '../components/GenericModal';
import ConfirmModal from '../components/ConfirmModal';
import CustomSelect from '../components/CustomSelect';
import DatePickerPopover from '../components/DatePickerPopover';
import TagPicker from '../components/TagPicker';
import QuoteWidget from '../components/QuoteWidget';
```

---

# 13. ⚠️ Mandatory Documentation Sync on Feature Changes

**Áp dụng cho cả human developer và AI agent.**

Mỗi khi **thêm tính năng mới** hoặc **sửa đổi tính năng hiện có**, BẮT BUỘC phải cập nhật đồng thời các file sau:

## Bắt buộc cập nhật:

| File | Khi nào |
|------|---------|
| `docs/FEATURES.md` | Mọi thay đổi tính năng (thêm mới, sửa behavior, xóa) |
| `docs/TASKS.md` | Đánh dấu task hoàn thành, thêm task mới nếu phát sinh |
| `docs/ARCHITECTURE.md` | Khi thêm page, hook, component mới hoặc thay đổi data flow |
| `docs/DATABASE.md` | Khi thêm/sửa Supabase table, column, trigger, hoặc RLS policy |
| `docs/PLAN.md` | Khi milestone thay đổi hoặc phase mới bắt đầu |
| `CHANGELOG.md` | Mọi thay đổi (version bump, Added/Changed/Fixed/Removed) |

## Không được phép:

- Merge code mới mà không cập nhật `docs/FEATURES.md`
- Thêm table DB mới mà không cập nhật `docs/DATABASE.md`
- Thêm hook/component mà không cập nhật `docs/ARCHITECTURE.md`
- Đổi behavior tính năng mà không cập nhật `docs/FEATURES.md`

## Format cập nhật FEATURES.md:

Mỗi tính năng trong `FEATURES.md` phải có:
1. **Số thứ tự + tên** (`## 5. 📈 Dashboard Cá Nhân`)
2. **File references** (page + hook + css)
3. **Mô tả ngắn** (1 câu)
4. **Chi tiết từng sub-feature** (bullet list)
5. **Data source** (localStorage key hoặc Supabase table)

## Ví dụ commit khi có tính năng mới:

```
feat(sleep-tracker): add sleep duration logging

- src/hooks/useSleepLog.js
- src/components/SleepWidget.jsx
- docs/FEATURES.md updated (thêm section #17)
- docs/ARCHITECTURE.md updated (thêm hook + table)
- docs/DATABASE.md updated (thêm sleep_logs table)
- CHANGELOG.md v1.3.0 Added
```

> ⚠️ Pull request sẽ bị reject nếu thiếu docs update.

---

# 14. 📂 Static Content Data — 1 JSON File Per Feature

**Áp dụng cho: challenges, quiz, testimonials, knowledge cards, skip reasons, default habits, v.v.**

## Quy tắc cốt lõi:

- **KHÔNG** hardcode mảng content tĩnh trong component/hook
- **PHẢI** lưu vào `src/data/<feature>.json` — **1 file per feature**, không split theo type
- Nếu feature có nhiều sub-group → dùng key trong cùng 1 object JSON

## Cấu trúc hiện tại `src/data/`:

```
src/data/
├── challenges.json         # 21 Daily Challenges
├── quiz.json               # Quiz questions (21 pool, pick 10)
├── habits.json             # defaultHabits, categories, icons, colors, skipReasons
├── testimonials.json       # Landing page reviews
├── quotes.json             # 30 daily motivational quotes
├── programs.json           # 5 system journey templates (offline fallback)
├── expense-categories.json # 8 expense categories (food, transport, etc.)
└── knowledge.json          # Unified KB types (Inbox/Collect tabs)
```

## Tiêu chí để tách ra JSON:

| Nên tách | Không cần tách |
|----------|----------------|
| Nhiều items có cùng schema (>3) | UI config nhỏ (TABS, NAV_LINKS) |
| Content thay đổi độc lập với logic | Hằng số tính toán (RANK_COLORS) |
| Content cần thêm/xóa bởi non-dev | DAY_LABELS, WEEKDAYS |
| Text/label dài, có thể dịch | PLANT_STAGES, FLOWERS (UI-tightly coupled) |

## Import pattern:

```js
// Single file per feature
import QUESTIONS from '../data/quiz.json';
import HABITS_DATA from '../data/habits.json';
const { skipReasons, categories } = HABITS_DATA;
import KNOWLEDGE_TYPES from '../data/knowledge.json';
import EXPENSE_CATEGORIES from '../data/expense-categories.json';
```

## Lý do:

- Thêm challenge mới → chỉ edit JSON, không touch component
- Non-dev có thể tự sửa content mà không cần hiểu React
- Tránh merge conflict trên component khi chỉ đổi data

---

# 15. Supabase-Specific Rules

## Table Naming

- Lowercase, snake_case
- Plural nouns (e.g., `habits`, `expenses`, `user_tasks`)
- Junction tables: `<entity1>_<entity2>` (e.g., `task_collections`, `collection_tags`)

## RLS (Row Level Security)

- ALL tables MUST have RLS enabled
- Users can only read/write their own data (`auth.uid() = user_id`)
- Exception: `programs` and `program_habits` allow public SELECT for system templates

## Migrations

- Master schema: `data/schema_v4.4.0.sql` (idempotent, safe to re-run)
- New migrations: `data/migration_v{version}_{description}.sql`
- Never modify the master schema without explicit instruction
- Document new tables in `docs/DATABASE.md`

## Realtime

Enabled for: `profiles`, `progress`, `habits`, `focus_sessions`, `xp_logs`

---

# 16. XP System Rules

XP events are logged to `xp_logs` table (immutable append-only).

| Event | XP | Dedup Rule |
|-------|-----|-----------|
| Habit tick | +10 | 1 per habit per day (reason + meta match) |
| Streak 3/10/21 | +50/+100/+200 | One-time milestone |
| Daily Challenge | +20 | 1 per day |
| Quiz | +10→+50 | Per attempt (score-based) |
| Focus Session | +15 | 1 per session |
| Fitness Log | +10 | 1 per session |

**Rules:**
- Always dedup via `hasMilestone(reason, meta)` before `addXp`
- Un-tick habit → `removeXp` (v2.0.0)
- Compute `totalXp = SUM(amount)` from `xp_logs` at runtime
- Never update/delete XP entries (except `removeXp` for un-tick)