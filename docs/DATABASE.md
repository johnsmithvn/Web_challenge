# DATABASE DESIGN — Life Hub (Personal Life OS)
**Target:** Supabase (PostgreSQL)
**Version:** v4.24.0
**Updated:** 2026-06-28
**Strategy:** Production-ready from day 1
**Source of Truth:** **`data/schema_v4.24.0.sql`** — single consolidated schema (all migrations v4.4.0 → v4.24.0 folded in). **26 tables** (final state: `mood_logs` removed; `friendships` kept but archived/unused). Idempotent — run once on a fresh project.

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

> **Source of Truth:** [`data/schema_v4.4.0.sql`](../data/schema_v4.4.0.sql) — **28 `CREATE TABLE`** (incl. 2 legacy: `mood_logs`, `friendships`), idempotent, safe to re-run. Migrations then DROP `mood_logs` and ADD 4 tables (`knowledge_groups`, `collection_groups`, `collection_notes`, `inspirational_quotes`).
>
> ⚠️ Do NOT duplicate SQL here. Read the `.sql` file directly for column definitions, RLS policies, triggers, and indexes.

### Table Inventory (30 active tables = 28 master − `mood_logs` dropped − `friendships` archived + 4 from migrations)

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
- `partner_queue` — Auto-match feature never implemented

> ⚠️ **`mood_logs` & `friendships` ARE in `schema_v4.4.0.sql`** (unlike the list above). A fresh install creates them via master, then `migration_v4.10.1_drop_mood.sql` DROPs `mood_logs`; `friendships` remains but is unused/archived (safe to DROP). They are NOT "docs-only".


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

> **v4.24.0:** ALL migrations are now consolidated into a single file —
> **`data/schema_v4.24.0.sql`**. The old `schema_v4.4.0.sql` + the v4.7.2 → v4.14.0
> migrations + the v4.24.0 RLS patch have been merged and removed (history in git).
> The consolidated file is idempotent — run it once; re-running is safe.

| File | Purpose |
|------|---------|
| **`data/schema_v4.24.0.sql`** | **Single source of truth** — all 26 tables + RLS + indexes + triggers + RPC functions (login_email/username_exists/email_exists/get_leaderboard) + seed. Idempotent. |
| `data/reset_user_data.sql` | **Reset script** — DELETE all user data, keep auth accounts |

## Supabase Setup Checklist

- [ ] Create project (region: Southeast Asia – Singapore)
- [ ] Run **`data/schema_v4.24.0.sql`** in SQL Editor (the ONLY file needed — creates everything)
- [ ] Enable Realtime for: profiles, progress, habits, focus_sessions, xp_logs
- [ ] Enable Google OAuth (Auth → Providers → Google)
- [ ] Get URL + anon key from Project Settings → API
- [ ] Create `.env.local` with the two keys
- [ ] Verify `on_auth_user_created` trigger fires on test signup
