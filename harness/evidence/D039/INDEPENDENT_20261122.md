# D039 independent implementation

Plan: add a deliberately limited deterministic parser and an explicit confirm/cancel proposal UI on the current URL-backed catalog. No automatic filter application, provider calls, new credentials or fabricated supported facets. Explicit units are required; contradictory/oversized bounds are excluded and shown as warnings. Unparsed text is visible.

Focused tests cover sensitive unsupported facets, ambiguous/wrong units, injection-like instructions, duplicate/conflicting bounds and control/size limits. D048 optional LLM adapter and cross-review remain outstanding; current implementation is IN_PROGRESS and keyless deterministic behavior, not actual LLM verification. Final browser/shared results are recorded in the batch evidence.
