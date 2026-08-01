# DATABASE DESIGN — Life Hub (Personal Life OS)
**Target:** Supabase (PostgreSQL)
**Version:** v4.26.1
**Updated:** 2026-07-28
**Strategy:** Production-ready from day 1
**Source of Truth:** **`data/schema_v4.24.0.sql`** — single consolidated schema (all migrations v4.4.0 → v4.24.0 folded in). Idempotent — run once on a fresh project.

**Table count (verified against the `.sql` file):** **31 `CREATE TABLE`** = **27 active** + **4 archived** (`friendships`, `fitness_logs`, `knowledge_groups`, `collection_groups` — 2 nhóm sau mới archived v4.30.0, xem P2-7).
`mood_logs` is NOT in this schema (dropped in v4.10.1, folded into the consolidated file).
Every other doc that says 26 / 28 / 29 tables is stale — this line is the count.
Lưu ý: `data/schema_v4.24.0.sql` (file snapshot) CHƯA phản ánh v4.30.0 — xem `data/migration_v4.30.0_merge_knowledge_groups_into_tags.sql` cho thay đổi thật.

---

## Entity Overview

```
auth.users (Supabase built-in)
    │
    ▼
profiles ──────────────────────────────────────┐
    │                                           │
    ├──► progress          (daily check)        │
    ├──► streaks           (cached trigger)     │
    ├──► xp_logs           (immutable events)   │
    ├──► habits            (custom + journey)   │
    ├──► habit_logs        (per-habit daily)    │
    ├──► focus_sessions    (pomodoro)           │
    ├──► skip_reasons      (daily skip)         │
    ├──► notification_settings  (1:1)           │
    │                                           │
    ├──► user_journeys     (journey runs)       │
    ├──► journey_habits    (snapshot per run)   │
    │                                           │
    ├──► user_tasks ◄──► task_collections ──► collections
    │                                    (M:N junction v4.5.0)
    ├──► collections       (inbox + knowledge)  │
    ├──► expenses          (daily spending)     │
    ├──► subscriptions     (recurring services) │
    ├──► activity_logs     (append-only audit)  │
    ├──► intentions / intention_logs (incubator)│
    │                                           │
    ├──► tags ◄──► collection_tags              │
    │    (+ emoji, description v4.30.0 —        │
    │     tag có emoji = "nhóm/folder")          │
    │         ◄──► task_tags        (v4.28.0)    │
    │         ◄──► expense_tags                  │
    │         ◄──► subscription_tags             │
    │              └─ all 4 ──► VIEW tagged_items │
    │                                           │
    ├──► collection_notes  (threaded sub-notes) │
    ├──► inspirational_quotes (user quotes)     │
    │                                           │
    ├──► friendships       [ARCHIVED v3.0.0]    │
    └────────────────────────────────────────────┘

Programs ──► program_habits   (template library, system + user)
```

---

## Full SQL Schema

> ⚠️ Do NOT duplicate SQL here. Read [`data/schema_v4.24.0.sql`](../data/schema_v4.24.0.sql) directly for
> column definitions, RLS policies, triggers, and indexes. `schema_v4.4.0.sql` and the per-version
> `migration_*.sql` files no longer exist — they were folded into the consolidated file (history in git).

### Table Inventory (27 active)

| # | Table | Purpose | Key constraints |
|---|-------|---------|-----------------|
| 1 | `profiles` | Extends `auth.users` (1:1) | PK = `auth.users.id`, auto-created by trigger |
| 2 | `progress` | Daily habit check-in | UNIQUE(user_id, date) |
| 3 | `streaks` | Streak stats row | 1:1 with profiles, inserted by signup trigger. ⚠️ No `refresh_streak()` trigger exists — see [Streak note](#streak-source-of-truth) |
| 4 | `xp_logs` | Immutable XP event log | CHECK(amount BETWEEN -200 AND 200) |
| 5 | `habits` | Custom + journey habits | FK → user_journeys(journey_id), `active` flag |
| 6 | `habit_logs` | Per-habit daily completion | UNIQUE(user_id, habit_id, date), status: completed/skipped |
| 7 | `focus_sessions` | Pomodoro sessions | FK → habits, FK → user_journeys |
| 8 | `skip_reasons` | Why user missed a day | UNIQUE(user_id, date) |
| 9 | `notification_settings` | Reminder config (1:1) | Auto-created by signup trigger |
| 10 | `programs` | Journey templates | `is_system` flag for built-in templates |
| 11 | `program_habits` | Template habit definitions | FK → programs |
| 12 | `user_journeys` | Journey runs | status: active/completed/extended/archived |
| 13 | `journey_habits` | Snapshot of habits per run | FK → user_journeys, FK → habits |
| 14 | `user_tasks` | Personal to-do items | priority SMALLINT, recurrence_rule JSONB |
| 15 | `task_collections` | Junction: Task ↔ KB (M:N) | Composite PK(task_id, collection_id), CASCADE |
| 16 | `collections` | Inbox + Knowledge Base | type CHECK (8, **sửa v4.28.0**): `inbox`, `note`, `quote`, `learn`, `idea`, `ai`, `entertainment`, `podcast`. ⚠️ Trước v4.28.0 CHECK có `emotion` (không tồn tại trong `src/`) và **thiếu `podcast`** (có trong `knowledge.json`) → classify sang Podcast fail constraint |
| 17 | `expenses` | Daily spending log | amount VNĐ, category, note |
| 18 | `subscriptions` | Recurring services | cycle, next_due, auto-advance |
| 19 | `activity_logs` | Append-only audit trail | action + label + amount + meta JSONB |
| 20 | `intentions` | Incubator (someday-maybe) | status: incubating/deferred/executed/abandoned |
| 21 | `intention_logs` | Incubator audit trail | FK → intentions |
| 22 | `tags` | Central tag system | UNIQUE(user_id, name). **v4.30.0:** + cột `emoji`, `description` — tag có `emoji` đóng vai trò "nhóm/folder" hiển thị trong Knowledge Base (gộp từ `knowledge_groups`, xem P2-7) |
| 23 | `collection_tags` | Junction: KB ↔ Tags | Composite PK |
| 24 | `expense_tags` | Junction: Expense ↔ Tags | Composite PK |
| 25 | `subscription_tags` | Junction: Sub ↔ Tags | Composite PK |
| 25b | `task_tags` | Junction: Task ↔ Tags | **v4.28.0.** Composite PK(task_id, tag_id), CASCADE. RLS kiểm ownership **cả 2 phía**. Chỉ index `tag_id` (task_id đã là cột dẫn đầu của PK) |
| 28 | `collection_notes` | Threaded sub-notes per article | FK → collections, FK → profiles, plain text |
| 29 | `inspirational_quotes` | User + system quotes | FK → profiles, `is_active` toggle, `audio_url` optional |
| — | `knowledge_groups` | **[ARCHIVED v4.30.0]** KB folder/group metadata | Quyết định P2-7 (2026-08-01): trùng việc với `tags` (cả 2 đều M:N trên `collections`). Đã gộp dữ liệu sang `tags` (cột `emoji`/`description` mới) + `collection_tags` qua `migration_v4.30.0_merge_knowledge_groups_into_tags.sql` Phase 1. Frontend không còn dùng (`useKnowledgeGroups.js` đã xoá). Table còn tồn tại trong DB tới khi chạy Phase 2 (`DROP TABLE`, breaking, chưa chạy). |
| — | `collection_groups` | **[ARCHIVED v4.30.0]** Junction: KB ↔ Groups (M:N) | Cùng lý do với `knowledge_groups` ở trên — đã gộp vào `collection_tags`. |
| — | `fitness_logs` | **[ARCHIVED v4.26.0]** Workout sessions | `session_name`, `duration_min`, `energy`. Frontend code deleted v4.26.0 (recoverable from git history). Table still exists in production DB, no active hook or page uses it. Safe to DROP when ready. |
| — | `friendships` | **[ARCHIVED v3.0.0]** Friend requests | Frontend code deleted v4.25.0 (was `src/_archived/`, recoverable from git history). Table exists in production DB but is not used by any active hook or page. Safe to DROP when ready. |

### Views

| View | Mục đích | Ghi chú |
|------|----------|---------|
| `tagged_items` | **v4.28.0.** 1 mặt đọc hợp nhất cho filter/search theo tag: `UNION ALL` 4 junction → `(tag_id, kind, item_id)` với `kind ∈ {collection, task, expense, subscription}` | ⚠️ Tạo với `WITH (security_invoker = true)` — **bắt buộc**. Mặc định view chạy bằng quyền OWNER (postgres) và **bỏ qua RLS** của bảng dưới → leak data mọi user. Cần PostgreSQL ≥ 15. |

### Kiến trúc Tag — tại sao N junction, không phải 1 bảng polymorphic

`tags` là **1 bảng trung tâm duy nhất** (`UNIQUE(user_id, name)`), không có cột `tags TEXT[]` lặp ở đâu. Mỗi loại entity nối vào qua 1 junction riêng: `collection_tags`, `task_tags`, `expense_tags`, `subscription_tags`.

Nhìn có vẻ dư (N loại → N bảng), nhưng **đó là giá của referential integrity**: mỗi junction có `REFERENCES ... ON DELETE CASCADE` cả 2 phía, nên xoá entity thì link tự biến mất.

**Cố ý KHÔNG dùng** `taggables(tag_id, entity_type, entity_id)` polymorphic: `entity_id` không thể có FK → xoá entity không xoá link → **rác vĩnh viễn**. Đây đúng là bệnh của `activity_logs` (row `fitness_done` treo mãi sau khi feature bị xoá ở v4.26.0).

Nguyên tắc: **N junction để GHI (giữ FK), 1 view để ĐỌC (unified filter).**

### Deprecated Columns

| Table | Column | Status | Replacement |
|-------|--------|--------|-------------|
| `user_tasks` | `collection_id` | **DEPRECATED v4.5.0 → code ngừng ghi v4.28.0, DROP ở `migration_v5.0.0`** | `task_collections` junction (M:N). v4.28.0 đã bỏ tham số `collectionId` khỏi `addTask` và chuyển `CollectPage.onCreateTask` sang `linkCollection()`. **Trước v4.28.0 link tạo từ Knowledge coi như mất** vì cột 1:1 không được đọc ở đâu. |
| `collections` | `resolved`, `course_name`, `duration_min`, `reviewed_at`, `priority` | **CỘT CHẾT — DROP ở `migration_v5.0.0`** | Không cột nào được đọc/render (grep 0 hit trong `useCollections`/`CollectPage`/`InboxPage`/`ArticleCard`). `priority` chỉ được passthrough lúc INSERT — v4.28.0 đã bỏ. Lưu ý `collections.priority` là `TEXT`, khác hẳn `user_tasks.priority` (`SMALLINT`) dù trùng tên. |
| `user_tasks` | `energy_level`, `duration_est` | **DROPPED v4.9.0** | Replaced by `priority SMALLINT` (0=None … 5=Urgent). The schema file explicitly `DROP COLUMN IF EXISTS` both. |
| `collections` | `tags` (TEXT[]) | **GONE v4.1.0** | Use `collection_tags` junction. Not created by `schema_v4.24.0.sql` at all — a fresh install has no such column. Docs claiming it is "kept for backward compat" are stale. |

### Tables That Do NOT Exist

Named in older docs / older `ARCHITECTURE.md` revisions, but **never** in the current schema file:

| Table | Reality |
|-------|---------|
| `teams`, `reactions`, `partner_queue` | Team feature cancelled v3.0.0 — frontend code deleted v4.25.0 |
| `quiz_attempts` | Quiz XP goes to `xp_logs` (deduped by reason+meta) |
| `daily_challenge_completions` | Challenge XP goes to `xp_logs` |
| `mood_logs` | Existed until v4.10.1, dropped — not in `schema_v4.24.0.sql` |

<a id="streak-source-of-truth"></a>
### Streak — Source of Truth

- `streaks` rows are created **once** by the `handle_new_user()` signup trigger and are **never updated**:
  no `refresh_streak()` function or trigger exists in `schema_v4.24.0.sql`, and no frontend hook writes to `streaks`.
- The streak the user sees is computed **client-side** in `useHabitStore.js` (`calcStreak()` / `getLongestStreak()`
  over the `progress` map).
- Consequence: `get_leaderboard()` reads `streaks`, so its streak/longest columns stay at 0.
  `TODO: decision needed` — either write `streaks` on each `progress` upsert, or make the leaderboard
  derive streaks from `progress` server-side.


---

## XP System

Source: `XP_REWARDS` in `src/hooks/useXpStore.js` (+ `FOCUS_XP` in `useFocusTimer.js`).
`xp_logs.amount` has `CHECK (amount BETWEEN -200 AND 200)`.

| Event | XP | Frequency |
|-------|-----|----------|
| Daily check ✓ | +10 | Per habit/day (deduped; un-tick → `removeXp`) |
| Streak 3 | +50 | One-time |
| Streak 10 | +100 | One-time |
| Streak 21 | +200 | One-time |
| Daily Challenge | +20 | Max 1/day |
| Quiz | score × 5 (0–50) | Per attempt |
| Focus Session | +15 | Per session (deduped by `meta.sessionId`) |

## Level Thresholds

| Level | Name | XP |
|-------|------|----|
| 0 | 🌱 Người Mới | 0 |
| 1 | ⚡ Luyện Sĩ | 100 |
| 2 | 🔥 Đệ Tử | 300 |
| 3 | ⚔️ Chiến Binh | 700 |
| 4 | 👑 Huyền Thoại | 1500 |
| 5 | 🏆 Vô Địch | 3000 |

## Leaderboard

Since v4.24.0 `profiles` is read-own-row-only (email leak fix), so the leaderboard is **not** a client-side
join anymore. There is **no `user_xp` view** — XP is aggregated inside the function.

```js
const { data } = await supabase.rpc('get_leaderboard');   // src/pages/LeaderboardPage.jsx
```

`public.get_leaderboard()` — `SECURITY DEFINER`, granted to `anon` + `authenticated`, returns
`id, display_name, avatar_url, current_streak, longest_streak, total_xp, total_done`
(no email), `ORDER BY total_xp DESC, current_streak DESC LIMIT 50`. XP = `SUM(xp_logs.amount)`,
done = `COUNT(progress WHERE completed)`, streaks = `streaks` table (see the streak note above).

Other `SECURITY DEFINER` RPCs added in v4.24.0: `login_email(username)`, `username_exists(username)`,
`email_exists(email)`.

## Migration Strategy (localStorage → Supabase)

**v1.6.2+ architecture:** Supabase is primary for ALL user data. localStorage only stores UI flags.

On first login (one-time per data type):
1. Read `vl_habit_data` from localStorage → upsert into `progress` → wipe local
2. Read `vl_custom_habits` → upsert into `habits` → wipe local
3. Read `vl_xp_store` → insert into `xp_logs` → wipe local
4. Read `vl_habit_progress` → insert into `habit_logs` → wipe local
5. Read `vl_focus_sessions` → insert into `focus_sessions` → wipe local
6. Set `vl_migrated_v2 = userId` flag in localStorage
7. Subsequent reads → Supabase only

## Migration Files

> **v4.24.0:** ALL migrations are now consolidated into a single file —
> **`data/schema_v4.24.0.sql`**. The old `schema_v4.4.0.sql` + the v4.7.2 → v4.14.0
> migrations + the v4.24.0 RLS patch have been merged and removed (history in git).
> The consolidated file is idempotent — run it once; re-running is safe.

| File | Purpose |
|------|---------|
| **`data/schema_v4.24.0.sql`** | **Single source of truth** — all 31 tables + RLS + indexes + triggers + RPC functions (login_email/username_exists/email_exists/get_leaderboard) + seed 5 programs. Idempotent. |
| `data/reset_user_data.sql` | **Reset script** — DELETE all user data, keep auth accounts |

## Supabase Setup Checklist

- [ ] Create project (region: Southeast Asia – Singapore)
- [ ] Run **`data/schema_v4.24.0.sql`** in SQL Editor (the ONLY file needed — creates everything)
- [ ] Enable Realtime for: profiles, progress, habits, focus_sessions, xp_logs
- [ ] Enable Google OAuth (Auth → Providers → Google)
- [ ] Get URL + anon key from Project Settings → API
- [ ] Create `.env.local` with the two keys
- [ ] Verify `on_auth_user_created` trigger fires on test signup
