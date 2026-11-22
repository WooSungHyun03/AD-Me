# D067 independent TEST confirmation/recovery boundary

Shared strict callback/result schemas for server and client; malformed ID/amount/key never sent, HTTP200 alone no longer yields a paid UI state, interrupted/rate-limited/unknown results instruct manual retry of exactly the same order. Known duplicate or valid entitlement evidence is required for confirmation. No automatic provider polling/new order creation and all existing app/DB TEST gates stay in place.

Focused tests inject local fetch responses for forged callbacks, interrupted request/retry identity, malformed200 and error/duplicate outcomes. This is not Toss SDK/backend actual-provider approval. D066 reviewed order contract, U015 approved TEST target, interrupted actual TEST approval/DB reconciliation and cross-review remain gates. No provider request/key or payment occurred. IN_PROGRESS, not full completion.
