# D037 — independently available saved conditions

Current source already implements versioned private saved conditions and re-open/update/delete. Tested7 groups using actual local Auth/PostgREST/SQL against109 migrations: owner-only minimal DTO, foreign isolation, private-schema denial, strict filter validation, concurrent expected-version conflict, stale-delete rejection, deletion and20-record cap. Test now uses YouTube; existing historic multi-platform records/contracts are preserved. All accounts/filter values are fictional. Cleanup ran.

This verifies stored/reopened conditions, not new-candidate notifications. D052 notification cursor/outbox integration and user opt-in, deduplication/unsubscribe/delete behavior remain the exact gate for this ticket; email additionally depends on D053. No real notification, provider or hosted delivery claimed. IN_PROGRESS remains appropriate, not full TESTED/VERIFIED/DONE. Browser save/reopen flow is in the final affected batch.
