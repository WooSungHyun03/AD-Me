import { REAUTH_SECONDS } from "./auth-links";

// Only call with provider-verified claims, never decoded request/cookie values.
// User.last_sign_in_at is account-wide; iat changes on token refresh.
export function hasRecentSessionSignIn(
  claims: unknown,
  actorId: string,
  now = Date.now() / 1000,
) {
  if (!claims || typeof claims !== "object" || !Number.isFinite(now))
    return false;
  const { sub, session_id, amr } = claims as {
    sub?: unknown;
    session_id?: unknown;
    amr?: unknown;
  };
  return (
    sub === actorId &&
    typeof session_id === "string" &&
    session_id.length > 0 &&
    Array.isArray(amr) &&
    amr.some((entry: unknown) => {
      if (!entry || typeof entry !== "object") return false;
      const { method, timestamp } = entry as {
        method?: unknown;
        timestamp?: unknown;
      };
      return (
        typeof method === "string" &&
        ["password", "otp", "totp", "mfa/totp"].includes(method) &&
        typeof timestamp === "number" &&
        Number.isSafeInteger(timestamp) &&
        timestamp <= now &&
        timestamp > now - REAUTH_SECONDS
      );
    })
  );
}
