import { createHmac } from "node:crypto";
import { isIP } from "node:net";
// Vercel overwrites x-vercel-forwarded-for. Generic XFF is never trusted.
export function requestBudgetSubjects(
  headers: Pick<Headers, "get">,
  vercel: boolean,
  secret: string | undefined,
  account?: string,
) {
  if (!secret) return { ip: null, account: null };
  const value = vercel
    ? headers.get("x-vercel-forwarded-for")?.trim()
    : undefined;
  const hash = (kind: string, v: string) =>
    createHmac("sha256", secret)
      .update(kind + ":" + v)
      .digest("hex");
  return {
    ip: value && isIP(value) ? hash("ip", value) : null,
    account: account
      ? hash("account", account.trim().normalize("NFKC").toLowerCase())
      : null,
  };
}
