# D024 follow-up — numeric view count (2026-11-27)

## What changed
- In `20261126130000`, `hasViews` was `metadata ? 'views'`.
- A stored `"views": null` or `"views": "12"` therefore counted as having a view count, so the sample could pass the pilot gate.
- The new migration `20261127100000_d024_pilot_views_numeric.sql` does `create or replace` of `public.pilot_quality_samples()`.
- `hasViews` is now `coalesce(jsonb_typeof(metadata->'views') = 'number', false)`.
- The rest of the function body is byte-identical to the previous migration.
- Grants are re-asserted: service_role execute only; public, anon and authenticated are revoked.

## Verification
All runs were local, on the isolated disposable Supabase.
- **Migration applied:**
  - The migration was applied with owner psql and recorded in `schema_migrations`.
  - Execute privilege: anon `f`, service_role `t`.
- **`tests/pilot-quality.mjs`: 4/4 PASS.**
  - Two fixtures were added: one with `views: null`, one with `views: "12"`.
  - Only the 2 numeric fixtures report `hasViews`.
  - The duplicate-title assertion now counts duplicates directly. Before, it compared against the first sample in resource-hash order, which broke once there were more fixtures.
  - Fixture rows are removed afterwards (0 `qa-d024-*` policies remain).
- **`harness/migration_check.py`: PASS.** 140 migrations; manifest rows #36 and the detail row were added.
- **Unit tests:** `tests/pilot-quality.test.ts` plus the production-schema tests, 14/14 PASS. eslint and prettier pass on the test file.

## Remaining gates (unchanged)
- U014: real participants and their consent.
- U001: YouTube source approval.
- U004: apply `20261126130000` and `20261127100000` to the production DB.
- The production fingerprint must be re-registered for the new migration set. That is operator work.
