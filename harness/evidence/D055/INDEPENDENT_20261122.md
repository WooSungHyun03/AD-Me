# D055 independent implementation

Owner-only private calendar download for structured campaign windows: UTC timestamps, stable event UIDs, CRLF text escaping,75-octet UTF8 folding and no attendee/contact export. No feed token/public URL; current Auth/RLS and owner query apply on every request. Missing dates are an explicit409; foreign/demo campaigns are404. UI explains downloaded copies do not auto-update.

RFC5545 source: https://www.rfc-editor.org/rfc/rfc5545.html (content lines and DATE-TIME). Tests cover KST-midnight/UTC previous day, Korean byte folding, calendar property injection, stable IDs and missing data. D049 collaboration milestones and D052 reminder delivery/cancel/dedup remain unimplemented gates. IN_PROGRESS, not a reminder completion claim. Final API/browser results belong in batch evidence.
