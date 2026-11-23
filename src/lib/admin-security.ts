export const adminMfaMaxAgeSeconds = 15 * 60;

// Call only with claims verified by Supabase. Refreshing a token is not reauthentication.
export function hasRecentAdminMfa(claims: unknown, now = Date.now() / 1000) {
  if (!claims || typeof claims !== "object") return false;
  const { aal, amr } = claims as { aal?: unknown; amr?: unknown };
  return (
    aal === "aal2" &&
    Array.isArray(amr) &&
    amr.some((entry: unknown) => {
      if (!entry || typeof entry !== "object") return false;
      const { method, timestamp } = entry as {
        method?: unknown;
        timestamp?: unknown;
      };
      return (
        (method === "totp" || method === "mfa/totp") &&
        typeof timestamp === "number" &&
        Number.isSafeInteger(timestamp) &&
        timestamp <= now &&
        timestamp >= now - adminMfaMaxAgeSeconds
      );
    })
  );
}
