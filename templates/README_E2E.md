# E2E contracts to implement in tests/e2e

Implement Playwright flows with data-testid names in docs/QA.md. Test users are created through isolated DB fixture/setup, not hardcoded to the public repository.

- test('brand creates campaign -> matches ranked -> sends proposal')
- test('creator accepts proposal -> brand sees accepted')
- test('creator applies to open campaign -> brand reviews')
- test('cross-tenant access denied')
- test('missing recommendation data shown as missing')
- test('promotion cannot change match rank')
- test('payment amount tampering and replay denied')
- test('Toss test checkout -> server confirm -> entitlement') // only when test keys configured; otherwise report BLOCKED, not pass
- test('responsive layout for 390 and 1440')
