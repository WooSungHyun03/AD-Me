# D048 — Concept/proposal/summary AI adapter (DEV-B · P1)

Status: **adapter, template fallback, cost cap and tests DONE (local). Real LLM provider BLOCKED.**
- Installing `@anthropic-ai/sdk` was refused by the session permission policy, since a new dependency needs user approval.
- A server-only `ANTHROPIC_API_KEY` is also not provided.
- So every draft today is the template. No LLM output has been produced or verified.

## What was built
- `src/lib/ai/index.ts`
  - Kinds `concept` / `proposal` / `brief` / `summary`, each with a Zod schema (length limits; summary text ≤ 3000 chars, treated as untrusted).
  - `PROMPT_VERSION` per kind (`*-v1`), `TEMPLATE_VERSION` (`template-v2`).
  - Provider interface `{name, model, call({system,user,maxOutputTokens,signal})}` returning `usage`.
  - `LIMITS`: 20 calls per user per day, 300 overall, 8 s timeout, 1200 output tokens.
  - `generate()` falls back to the template, with a reason shown to the user, in these cases: no provider / not logged in / cap reached / timeout / call error / output validation failure.
  - Prompt-injection defence:
    - Inputs are wrapped in `<input field>` blocks with `<>` neutralised, so a payload cannot close or open a block.
    - The system text says the blocks are data, not instructions, and forbids invented numbers.
    - Output containing the system canary or input tags is rejected.
  - Personal data minimization: emails, phone numbers and links are redacted before the provider call and again in the output.
  - `unverified`: numbers with units in the draft that were not in the input are flagged for a human check.
  - Summary template is extractive (first sentences unchanged), so nothing is invented.
- `POST /api/ai/draft`
  - Checks origin and validates `kind`; returns the draft only, nothing is saved or sent.
  - Cost cap is reserved in the DB before any provider call: service-only RPCs, so a client cannot grant itself quota.
- Migration `202611190021_ai_usage.sql`
  - `ai_usage` stores daily counts and tokens only (no prompt/output).
  - Readable only by the account itself; no client writes.
  - `reserve_ai_call()` is serialized with an advisory lock (per-user + global cap); `record_ai_tokens()`.
- `ai-studio.tsx`
  - Four kinds; badge shows how the draft was made (template/LLM, provider, model, version) and the fallback reason.
  - Sources line: "입력한 … 만 사용".
  - Draft is in an editable textarea. Copy is disabled until "검토했고 고쳤습니다" is checked, and editing again resets that check.
  - "초안은 자동으로 전송되지 않습니다". No auto-send exists anywhere.
- Privacy export now includes `ai_usage` and D046 `matching_feedback` (own rows).

## Tests (2026-11-22, local)
- `tests/ai.test.ts` (8), using an injected fake provider:
  - No key gives the template plus a reason for all 4 kinds; schema rejection.
  - Anonymous and over-cap users never reach the provider; usage is recorded.
  - Timeout falls back to the template.
  - Injection cannot open a second block, and leaked system text is rejected.
  - Email/phone/link are redacted both in what the provider receives and in the output.
  - Invented "30만 / 12%" are flagged.
- `tests/ai-usage.mjs` (direct REST, in ci-db):
  - anon/brand reserve, record and insert are denied.
  - 10 concurrent reserves with cap 3 → exactly 3; global cap 5 → 2 more.
  - Tokens recorded; client update has no effect; own row only; counts-only columns.
- `tests/e2e/ai-studio.spec.ts` (desktop+mobile):
  - Template label and reason, sources line.
  - Copy disabled until review, re-disabled after edit.
  - Pasted `<img onerror>` stays inert text.
  - API returns 400 for bad kind/input; brief JSON is labeled template.
- `service.spec.ts`: the draft assertion now reads the textarea value.
- Full regression: `bash tests/ci-db.sh` exit 0, covering 21 migrations, E2E 60/60, 19 DB tests and the restore drill. Also vitest 120, lint 0, typecheck/build OK, secret scan PASS.
- Screenshots: `studio-{desktop,mobile}.png`, no horizontal scroll.

## To unblock (user)
1. Approve adding `@anthropic-ai/sdk` (exact version pinned).
2. Put `ANTHROPIC_API_KEY` in Vercel as a server-only variable, never `NEXT_PUBLIC_`.
3. The agent then implements `configuredProvider()` with the SDK (model per the skill default, low effort, `max_tokens` = `LIMITS.maxOutputTokens`, per-request timeout, `maxRetries: 0`) and verifies one real call within the cap.
4. The privacy page line "외부 LLM으로 정보를 전송하지 않습니다" must be updated at the same time. It is true today, because no provider is connected.

## Known limits
- `ai_usage` has no retention cleanup yet; it is deleted with the account.
- The number check only catches numbers with a unit (%, 만, 원, 명, 회, 배).
