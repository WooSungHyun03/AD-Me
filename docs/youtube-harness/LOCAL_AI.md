# Local AI / LLM: actual hosted worker, not ChatGPT API orchestration

## Distinguish coding agent and product AI
- **ChatGPT Desktop Work** performs code writing, installation, browser checks, git actions. It is a user-operated desktop automation experience, *not* our product's API.
- **AD Me inference** runs on our own persistent server with Ollama/vLLM/llama.cpp according to hardware. No ChatGPT/OpenAI API is needed for production AI tasks.
- If desktop session has no direct access to remote GPU, deploy an authenticated pull worker through available SSH/cloud computer tools; do not expose Ollama unauthenticated.

## Verify hardware
Read `nvidia-smi`, CPU RAM, disk, driver, CUDA, Docker, concurrent load. RTX 4080 16GB / RTX A6000 48GB are possible targets from prior project context, but must **not** be presumed available. Model fit, RAM/VRAM must be measured and documented. Don't kill existing processes or fill disk inadvertently.

## Components
- Local model runtime (start with Ollama in Docker/systemd or selected compatible runner); one lightweight Korean-capable instruct model that passes structured JSON tests, plus a locally hosted multilingual embedding model.
- `ai_jobs` queue in Supabase, persistent worker pulls and leases tasks, retries, bounded concurrency and timeout, hardware resource watchdog and health endpoint.
- Models and prompt templates versioned, never personal secret or API keys in logs.

## Agent/AI jobs (prioritized)
| Task | Input | Output | Permission gate | Mechanism |
|---|---|---|---|---|
| campaign parser | brand's own free-form campaign brief | structured category, preferred vibes, format and constraints | owned campaign | small local LLM JSON+Zod |
| natural language search | advertiser query | typed filters, exclude keywords | authenticated brand + credit when executing | small local LLM JSON+hard filters |
| channel tag proposals | policy-approved/owner-supplied title/description | own AD Me thematic hashtags, cited snippets, `confidence` | policy flag + admin review | local LLM classification |
| embeddings | authorized channel texts, campaign texts | vectors + similarity | policy flag for YouTube metadata | local embedding model+pgvector optional |
| explanation | approved recommendation features | source-grounded concise reasons | subscribed/paid session | structured template/optional LLM |
| proposal drafting | brand + creator's opted-in data | outreach message draft | authorized brand; send requires click | local LLM |
| content brief drafting | brand product, campaign terms | suggested video ideas | owned campaign | local LLM |
| ad collaboration hints | videos with disclosure text | `candidate/verified` evidence queue | policy and human review | parser + LLM |
| admin triage | sync logs, queued jobs, moderation refs | troubleshooting summary | admin role | rule engine + local LLM |
| privacy/safety checks | submitted UGC | risk reason or spam candidate | human review on sensitive cases | deterministic + local model |

**Avoid** using an LLM for payment entitlement arithmetic, access control, YouTube quota accounting, financial calculations or final allegations.

## Detailed matching pipeline
1. Validate brand campaign role and payment entitlement.
2. Parse natural language to typed filter; user must see final filters before credit charge.
3. Query eligible `verified/claimed` creators and optionally permitted directory channels (label status). Enforce YouTube policy flag for derived stats.
4. Apply hard constraints. Score independent AD Me first-party tags, creator-entered category/format/budget and allowed source-derived data. Missing features excluded and weights renormalized; show coverage.
5. Sponsored placements selected by separate slot allocator, clearly labelled, not in organic score.
6. Generate `why selected` from feature evidence only; persist result snapshot and idempotent charge.
7. Recommendation fail? No charge, retriable job; user sees `analysis queued`/`failed` not fake result.

## Model runtime guards
- Client cannot send raw prompts to admin model or target another user's data.
- Input sanitization and prompt injection mitigation for YouTube titles/descriptions. Treat all user/external text as **data**, never runtime instructions; no tool/external action initiated by model.
- JSON schema validation with Zod, deterministic fallback parsing, timeouts and retry once; slow inference reported via job status.
- Rate limits, max input length, output token budget, cache keyed by content+model+prompt version, telemetry p50/p95 GPU memory, dead-letter jobs.
- Health check does not claim inference readiness unless actual generation/embedding test passes.
- AI-generated tags are labelled `AD Me AI 추정 태그` until creator/manager review. No inference of sensitive demographic identity or defamatory content.

## Provider-independent testing
- Mock worker test: input→schema→persistence; actual local model test: text→JSON labels; policy-off test: no API-derived tag analysis; worker-off test: queue remains durable; recovery test: lease expiry/retry and no double credits.
