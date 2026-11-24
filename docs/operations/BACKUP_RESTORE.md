# Backup, restore and capacity (D087)

## What the Free plan provides (checked 2026-11-22, Supabase docs)
- **No automatic backups on Free**, and backups can't be downloaded. PITR is a paid add-on (Pro and up). → Our policy: **the user takes a manual dump themselves**.
- **Storage files are never in a DB backup** (on any plan). They must be exported separately.
- Auth: `auth.users` / `auth.identities` are included in the dump. Sessions and refresh tokens aren't restored, so users simply sign in again.
- Not included: Edge Function secrets (`TOSS_SECRET_KEY`), Auth settings (redirect URLs, SMTP), Vercel env. Record these separately in the release manifest's environment table.
- Sources: [Database Backups](https://supabase.com/docs/guides/platform/backups), [Free plan backups FAQ](https://supabase.com/kb/faqs/platform/free-plan-backups), [Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod), [Pricing](https://supabase.com/pricing)

## Cost
- This procedure uses only the CLI dump and file downloads, so **it creates no paid add-on** (PITR, extra backups). Nothing is turned on that auto-bills.
- The user confirms in Supabase Billing that "Point in Time Recovery" is **off** (U003).

## Backup (user, daily or before deploying — RPO ≤ 24h)
Where to keep it: **a folder only you can access**, outside the repo (e.g. an encrypted personal cloud drive). Never put it in the repo (`backups/` is gitignored). It contains personal data, so delete it after 30 days.
1. DB: `supabase db dump --linked -f schema.sql` + `supabase db dump --linked --data-only -f data.sql` (the CLI prompts for the DB password; never put it in the repo).
2. Storage: download the `private-uploads` and `privacy-ledger` buckets as files (the Storage page in the Supabase dashboard, or the CLI's `supabase storage cp -r --experimental ss:///<bucket> ./files/<bucket>`; check the CLI version supports it).
3. Note the date, the `ops_stats().migration` version and file sizes alongside the backup.

## Restore (when needed, onto a new project or an emptied DB)
1. Create a new Supabase project (or empty the existing one) → `supabase db push` (migrations 0001–latest).
2. Restore data: run `set session_replication_role = replica;` then `data.sql` as a superuser connection (reports has circular FKs).
3. Restore bucket definitions and policies, then upload file bytes through the Storage API with their original MIME type. Leave object rows out of the SQL restore so the Storage API can create matching metadata and bytes together.
4. Re-apply the deletions requested since the backup: admin page "복구 후 삭제 재적용" (D079).
5. Check `/api/health` 200 → sign in with an existing account → open a private file.

## Isolated-environment drill (agent, `node harness/restore_drill.mjs`)
- Back up public and private app data, Auth users and identities, bucket definitions and Storage bytes. After the recovery-point write, delete the files, reset the isolated database, and restore.
- Then verifies: every table's row count matches, the pre-backup marker exists, the post-backup write is lost (= RPO), an existing account signs in, the owner opens the private file with matching bytes, deletion re-apply is consistent.
- Runs on a matching Docker-backed local database and Storage API. Use one Supabase CLI version to start and reset the isolated stack. The optional `ADME_RESTORE_WORKDIR` selects the dedicated local project and must match the configured loopback API port. The rehearsal covers private file access by application path policy. Provider ownership and version history for other bucket types require separate verification.

## Performance and capacity baselines
`BASE_URL=http://localhost:3100 node tests/load/load.mjs` (production build + local Supabase). Budgets: p95 page ≤ 1000ms, search RPC ≤ 300ms, 0 errors.
The local stack has no network latency, so in production add Vercel(icn1)↔Supabase(Seoul) round trips and cold starts (D088 re-measures against the public URL with light load).
