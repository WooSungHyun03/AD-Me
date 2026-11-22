# D050 independent agreement revision core

Server-only immutable revision projection: validated terms, two distinct participants, scope checks, expected version, bounded immutable history, idempotency fingerprint and collision rejection, proposer confirmation plus opposite-party acceptance. A new one-sided offer never replaces previous confirmed terms. Unknown/locked D049 collaboration states cannot activate this core.

Focused unit tests are state/adapter contracts, not actual collaboration DB/RLS verification. D049 state authority, atomic repository CAS, agreement_versions persistence/RLS/API/UI, cancellation and cross-review remain gates. No existing proposal endpoint or state transition is changed. IN_PROGRESS, not legal-signature/settlement or full ticket completion.
