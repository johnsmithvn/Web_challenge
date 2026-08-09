# Local database only

These migrations recreate the development database from the SQL snapshots in `data/`:

1. base v5.0
2. Vault v5.2
3. Finance v6

Use the local-only scripts from the repository root:

```bash
npm run db:local:start
npm run db:local:reset
npm run db:local:status
```

After `db:local:start`, copy its local Project URL and Publishable key into the ignored
`.env.development.local` file:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local Publishable key>
```

Do not run `supabase db push`, `supabase db reset --linked`, or a command with a hosted `--db-url`.
Production was historically updated through the SQL Editor, so it does not know these baseline migration timestamps. Reconcile its migration history separately before any future remote push.

The migration snapshots are immutable. Make future database changes in a new timestamped migration.
