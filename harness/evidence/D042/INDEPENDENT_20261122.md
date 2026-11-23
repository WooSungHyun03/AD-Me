# D042 independent implementation

Plan/source: start3a3f09f, existing DEV-A branch. Add an owner-only campaign-copy page and explicit brief whitelist; use the existing campaign creation endpoint and its brand/RLS checks. No SQL/interface changes. Preserve source campaign, participants, messages, notes and all upload references. Copies begin as draft and require explicit save; dates/rights must be reviewed by the user.

Focused unit coverage checks foreign/demo/missing actors, corrupted source, unknown/private fields, title bounds and independent arrays. Final batch evidence will record actual local desktop/mobile owner/non-owner flows and shared checks. D027 attachment immutable versions/restore remains a predecessor; this ticket is IN_PROGRESS, not complete.
