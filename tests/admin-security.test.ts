import { describe, expect, it } from "vitest";
import { hasRecentAdminMfa } from "@/lib/admin-security";

const now = 1_800_000_000;
describe("verified administrator claims", () => {
  it.each(["totp", "mfa/totp"])(
    "accepts recent %s in any AMR position",
    (method) => {
      expect(
        hasRecentAdminMfa(
          {
            aal: "aal2",
            amr: [
              { method: "password", timestamp: now },
              { method, timestamp: now - 30 },
            ],
          },
          now,
        ),
      ).toBe(true);
    },
  );
  it.each([
    null,
    {},
    { aal: "aal2", amr: ["totp"] },
    { aal: "aal1", amr: [{ method: "totp", timestamp: now }] },
    { aal: "aal2", iat: now, amr: [{ method: "totp", timestamp: now - 901 }] },
    { aal: "aal2", amr: [{ method: "totp", timestamp: now + 1 }] },
    { aal: "aal2", amr: [{ method: "password", timestamp: now }] },
    { aal: "aal2", amr: [{ method: "mfa/recovery_code", timestamp: now }] },
    { aal: "aal2", amr: [{ method: "totp", timestamp: `${now}` }] },
    { aal: "aal2", amr: [{ method: "totp", timestamp: Infinity }] },
  ])("fails closed for invalid, stale or non-TOTP evidence %j", (claims) => {
    expect(hasRecentAdminMfa(claims, now)).toBe(false);
  });
  it("accepts the 15-minute boundary without treating token refresh as reauth", () => {
    expect(
      hasRecentAdminMfa(
        { aal: "aal2", amr: [{ method: "totp", timestamp: now - 900 }] },
        now,
      ),
    ).toBe(true);
  });
});
