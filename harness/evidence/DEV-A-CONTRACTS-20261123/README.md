# DEV-A D003/D004 — main continuation

Started from current main d79235d on the existing working branch. D003 unifies canonical/legacy mode interpretation across the app, CLI, legacy consumers and admin health; diagnostics expose setting names/reasons only and optional TEST keys are not falsely required. D004 bounds actual request bytes (including streams and media/length spoofing), preserves multipart/CSV bulk contracts and copies immutable response headers safely.

Ticket commits: a90c1d1 D003 implementation; 03e465c D004 implementation; ed8679c D003 test typing/alias register; final browser-only commit recorded in verification.json. No SQL changed. One config-only USER handoff is deliverables/dev-a-contracts-20261123/README.md. Existing artifacts and all migration sources remain unchanged.

Full unit442/78 files, lint, next typegen/tsc, production build, Python16 and canonical ledger/secret/deployment-hold checks pass. Browser10 scenarios passed as6 initially plus4 affected after correcting a POST-method test and ambiguous Next route-announcer locator. First setup failures and raw commands/results are retained in ignored output/contracts-*.local.log. Desktop and mobile login screenshots were inspected; no horizontal overflow. Test settings explicitly disable alert webhooks and provider credentials. This is actual loopback HTTP with synthetic inputs, not actual DB/provider/checkout success.

Status remains TESTED. Full authenticated two-role/whole-schema E2E, hosted configuration and rollout are unverified; no ticket or release is marked VERIFIED/DONE. The old41-vs105 environment compatibility gate remains with D085/D087. Keyless /creators missing-data failure is disclosed and never replaced with fictional influencer records.
