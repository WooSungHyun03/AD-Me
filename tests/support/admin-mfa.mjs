// Local QA only: raise a signed-in admin client to aal2 with the provisioned TOTP factor.
// Admin RPCs (is_admin()) require a fresh MFA session since D060; password-only sessions are denied.
import { totp } from "./local-qa.mjs";

export async function elevateAdmin(client, account) {
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw error;
  const factor = data.totp.find((f) => f.status === "verified");
  if (!factor) throw new Error("admin QA account has no verified TOTP factor");
  const verified = await client.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: totp(account.totpSecret),
  });
  if (verified.error) throw verified.error;
  return client;
}
