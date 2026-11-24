import { expect, it } from "vitest";
import { hasRecentSessionSignIn } from "@/lib/session-reauth";
const now = 1800000000;
const claims = (amr: unknown, patch = {}) => ({
  sub: "actor",
  session_id: "session",
  amr,
  ...patch,
});
it.each(["password", "otp", "totp", "mfa/totp"])(
  "accepts verified fresh %s evidence",
  (method) => {
    expect(
      hasRecentSessionSignIn(
        claims([{ method, timestamp: now - 599 }]),
        "actor",
        now,
      ),
    ).toBe(true);
  },
);
it.each([
  claims([{ method: "password", timestamp: now - 600 }]),
  claims([{ method: "password", timestamp: now + 1 }]),
  claims([{ method: "password", timestamp: String(now) }]),
  claims([{ method: ["password"], timestamp: now }]),
  claims([{ method: "token_refresh", timestamp: now }]),
  claims(["password"]),
  claims([]),
  claims(null),
  claims([{ method: "password", timestamp: now }], { sub: "other" }),
  claims([{ method: "password", timestamp: now }], { session_id: "" }),
  claims([{ method: "password", timestamp: now - 1200 }], { iat: now }),
])(
  "fails closed for stale, future, malformed or mismatched session claims %j",
  (proof) => {
    expect(hasRecentSessionSignIn(proof, "actor", now)).toBe(false);
  },
);
