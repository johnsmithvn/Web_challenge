# DATABASE DESIGN — Life Hub (Personal Life OS)
**Target:** Supabase (PostgreSQL)
**Version:** v4.22.0
**Updated:** 2026-06-13
**Strategy:** Production-ready from day 1
**Source of Truth:** `data/schema_v4.4.0.sql` (25 tables) + incremental migrations (see Migration Files below)

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
    ├──► habits            (custom + journey)    │
    ├──► habit_logs        (per-habit daily)     │
    ├──► focus_sessions    (pomodoro)            │
    ├──► skip_reasons               │
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
    ├──► fitness_logs      (workout sessions)   │
    │                                           │
    ├──► tags ◄──► collection_tags              │
    │         ◄──► expense_tags                 │
    │         ◄──► subscription_tags            │
    │                                           │
    ├──► knowledge_groups ◄──► collection_groups ──► collections
    │                        (M:N junction v4.11.0)
    ├──► collection_notes    (threaded sub-notes)│
    │                                           │
    ├──► friendships       [ARCHIVED v3.0.0]    │
    └────────────────────────────────────────────┘

Programs ──► program_habits   (template library, system + user)
```

---

## Full SQL Schema

> **Source of Truth:** [`data/schema_v4.4.0.sql`](../data/schema_v4.4.0.sql) — 25 tables, idempotent, safe to re-run.
>
> ⚠️ Do NOT duplicate SQL here. Read the `.sql` file directly for column definitions, RLS policies, triggers, and indexes.

### Table Inventory (30 active tables)

| # | Table | Purpose | Key constraints |
|---|-------|---------|-----------------|
| 1 | `profiles` | Extends `auth.users` (1:1) | PK = `auth.users.id`, auto-created by trigger |
| 2 | `progress` | Daily habit check-in | UNIQUE(user_id, date) |
| 3 | `streaks` | Cached streak stats | 1:1 with profiles, updated by `refresh_streak()` trigger |
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
| 16 | `collections` | Inbox + Knowledge Base | type CHECK: inbox/note/link/quote/learn/idea |
| 17 | `expenses` | Daily spending log | amount VNĐ, category, note |
| 18 | `subscriptions` | Recurring services | cycle, next_due, auto-advance |
| 19 | `activity_logs` | Append-only audit trail | action + label + amount + meta JSONB |
| 20 | `intentions` | Incubator (someday-maybe) | status: incubating/deferred/executed/abandoned |
| 21 | `intention_logs` | Incubator audit trail | FK → intentions |
| 22 | `fitness_logs` | Workout sessions | session_name, duration_min, energy |
| 23 | `tags` | Central tag system | UNIQUE(user_id, name) |
| 24 | `collection_tags` | Junction: KB ↔ Tags | Composite PK |
| 25 | `expense_tags` | Junction: Expense ↔ Tags | Composite PK |
| 26 | `subscription_tags` | Junction: Sub ↔ Tags | Composite PK |
| 27 | `knowledge_groups` | KB folder/group metadata | title, emoji, description. FK → profiles |
| 28 | `collection_groups` | Junction: KB ↔ Groups (M:N) | Composite PK(collection_id, group_id), CASCADE |
| 29 | `collection_notes` | Threaded sub-notes per article | FK → collections, FK → profiles, plain text |
| 30 | `inspirational_quotes` | User + system quotes | FK → profiles, `is_active` toggle, `audio_url` optional |
| — | `friendships` | **[ARCHIVED v3.0.0]** Friend requests | Code in `src/_archived/FriendsPage.jsx`. Table exists in production DB but is not used by any active hook or page. Safe to DROP when ready. |

### Deprecated Columns

| Table | Column | Status | Replacement |
|-------|--------|--------|-------------|
| `user_tasks` | `collection_id` | **DEPRECATED v4.5.0** | Use `task_collections` junction table (M:N). Column kept for rollback, will be DROPped in v5.0. |

### Removed Tables (docs-only, never in schema_v4.4.0.sql)

The following tables appeared in earlier versions of this document but were **never part of the production schema file**:

- `teams` — Team feature cancelled v3.0.0, code archived
- `reactions` — Team emoji reactions, cancelled v3.0.0
- `quiz_attempts` — Quiz uses `xp_logs` instead (deduped by reason+meta)
- `daily_challenge_completions` — Challenges use `xp_logs` instead
- `mood_logs` — Removed in v4.10.1
- `partner_queue` — Auto-match feature never implemented


---

## XP System

| Event | XP | Frequency |
|-------|-----|----------|
| Daily check ✓ | +10 | Per habit/day (deduped) |
| Streak 3 | +50 | One-time |
| Streak 10 | +100 | One-time |
| Streak 21 | +200 | One-time |
| Daily Challenge | +20 | Max 1/day |
| Quiz | +10–50 | Per attempt (score-based) |
| Focus Session | +15 | Per session (deduped) |
| Duo streak | +30 | Per day (v3 planned) |

## Level Thresholds

| Level | Name | XP |
|-------|------|----|
| 0 | 🌱 Người Mới | 0 |
| 1 | ⚡ Luyện Sĩ | 100 |
| 2 | 🔥 Đệ Tử | 300 |
| 3 | ⚔️ Chiến Binh | 700 |
| 4 | 👑 Huyền Thoại | 1500 |
| 5 | 🏆 Vô Địch | 3000 |

## Leaderboard Query

```sql
SELECT
  p.id, p.display_name, p.avatar_url,
  s.current_streak, s.longest_streak, s.total_done,
  COALESCE(x.total_xp, 0) AS total_xp
FROM profiles p
JOIN streaks s ON s.user_id = p.id
LEFT JOIN user_xp x ON x.user_id = p.id
ORDER BY s.current_streak DESC, total_xp DESC
LIMIT 20;
```

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

> **v4.4.0+:** All legacy migration files have been consolidated into `data/schema_v4.4.0.sql`.
> This single file contains all 25 tables, RLS policies, indexes, triggers, and seed data.
> It is **idempotent** — safe to re-run on any Supabase project.

| File | Purpose |
|------|---------|
| `data/schema_v4.4.0.sql` | **Master schema** — 25 tables + all RLS + triggers + seeds (idempotent) |
| `data/reset_user_data.sql` | **Reset script** — DELETE all user data, keep auth accounts |
| `data/migration_v4.7.2_add_description_to_intentions.sql` | ADD `description` column to `intentions` |
| `data/migration_v4.9.0_task_priority.sql` | DROP energy/duration, ADD `priority` to `user_tasks` |
| `data/migration_v4.10.1_drop_mood.sql` | DROP `mood_logs` table |
| `data/migration_v4.11.0_knowledge_groups.sql` | 3 tables: `knowledge_groups` + `collection_groups` + `collection_notes` |
| `data/migration_v4.12.0_quotes.sql` | `inspirational_quotes` table + RLS |
| `data/migration_v4.14.0_collection_types.sql` | Expand collection type CHECK constraint |

## Supabase Setup Checklist

- [ ] Create project (region: Southeast Asia – Singapore)
- [ ] Run `data/schema_v4.4.0.sql` in SQL Editor (creates everything)
- [ ] Enable Realtime for: profiles, progress, habits, focus_sessions, xp_logs
- [ ] Enable Google OAuth (Auth → Providers → Google)
- [ ] Get URL + anon key from Project Settings → API
- [ ] Create `.env.local` with the two keys
- [ ] Verify `on_auth_user_created` trigger fires on test signup
