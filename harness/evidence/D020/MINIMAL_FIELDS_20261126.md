# D020 · 2026-11-26 field-minimizing extraction at the approved-web boundary (isolated contract; no crawl)

Base: origin/main after `55a6e2f`. No network: DNS/download/quota are injected fixture ports. No live site, no
endpoint/job activation, no source approval invented (U011 stays BLOCKED).

## Reproduction (before)
`fetchApprovedWeb` returned the full page body (`html`, up to 256 KiB) — contact details, scripts and off-policy
links would cross the boundary. Acceptance requires "최소 업무 정보" only; the 2026-11-22 evidence listed
field-minimizing extraction as open.

## Change (`src/lib/ingestion/web.ts`)
- `extractPublicFields(html, policy)` → `{ title ≤200, description ≤500 (meta description / og:description), canonical }`.
  Tags stripped, basic entities decoded, whitespace collapsed, contact details masked with the existing D048
  `redact` (email/phone/link). Canonical is kept only if it passes the same `approvedUrl` policy check (https,
  approved host and path, no query/credentials); otherwise null.
- `fetchApprovedWeb` returns `fields` instead of `html`. No caller outside tests (grep), so no consumer breaks.

## Results
| Check | Result |
|---|---|
| `tests/approved-web.test.ts` + `web-security.test.ts` | 9/9 PASS (new: minimal fields only, no raw HTML/script/contact; off-host/off-path/http/query/javascript canonicals dropped; length caps; empty page → nulls) |
| Mutation: remove `redact` | FAIL → restored PASS |
| lint / typecheck / unit | PASS / PASS / 586/586 |
| DB / desktop·mobile | N/A — server-only library, no schema, endpoint or screen change |

## Remaining (unchanged gates)
- U011 real permitted source + rights review; D017 (DEV-B) approved-source policy/consent; durable quota wiring
  (`adme_ops.take_quota`) when a job/endpoint is introduced; real permitted sample. IN_PROGRESS.
