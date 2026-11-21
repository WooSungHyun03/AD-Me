import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getConfig } from "./config";
// Isolated in-memory session; no cookie replacement and no client-provided UID/timestamp.
export async function verifyDeletionPassword(
  actorId: string,
  email: string,
  password: string,
  code?: string,
) {
  const config = getConfig().supabase;
  if (!config) throw Error("REAUTH_UNAVAILABLE");
  const client = createClient(config.url, config.key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error || signed.data.user?.id !== actorId || !signed.data.session)
    throw Error("REAUTH_REQUIRED");
  try {
    const factors = (signed.data.user.factors ?? []).filter(
      (f) => f.status === "verified",
    );
    if (factors.length) {
      const totp = factors.find((f) => f.factor_type === "totp");
      if (!totp || !code) throw Error("MFA_REQUIRED");
      const verified = await client.auth.mfa.challengeAndVerify({
        factorId: totp.id,
        code,
      });
      if (verified.error) throw Error("MFA_REQUIRED");
    }
    const session = await client.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw Error("REAUTH_REQUIRED");
    const checked = await client.auth.getUser(token);
    const claims = await client.auth.getClaims(token);
    if (
      checked.error ||
      checked.data.user?.id !== actorId ||
      claims.error ||
      claims.data?.claims.sub !== actorId
    )
      throw Error("REAUTH_REQUIRED");
    if (factors.length && claims.data.claims.aal !== "aal2")
      throw Error("MFA_REQUIRED");
    return { at: new Date().toISOString(), token };
  } catch (error) {
    await client.auth.signOut({ scope: "local" });
    throw error;
  }
}
