import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import type { Page } from "@playwright/test";
import { localClient, localRuntime, sql } from "./local-qa.mjs";
import { qaSignupConsent } from "./consent-fixture.mjs";

export async function localAccount(role: "brand" | "creator", prefix: string) {
  const admin = localClient(localRuntime().SERVICE_ROLE_KEY);
  const credentials = {
    email: `${prefix}-${randomUUID()}@example.test`,
    password: randomUUID() + "Aa1!",
  };
  const result = await admin.auth.admin.createUser({
    ...credentials,
    email_confirm: true,
    user_metadata: { ...qaSignupConsent, role, name: "Local session QA" },
  });
  if (result.error) throw Error("Local account creation failed");
  return { ...credentials, id: result.data.user!.id, admin };
}
export async function localSession(account: {
  email: string;
  password: string;
}) {
  const cookies: { name: string; value: string }[] = [];
  const runtime = localRuntime();
  const db = createServerClient(runtime.API_URL, runtime.ANON_KEY, {
    cookies: {
      getAll: () => cookies,
      setAll: (values) => {
        for (const value of values) {
          const index = cookies.findIndex((c) => c.name === value.name);
          if (index >= 0) cookies[index] = value;
          else cookies.push(value);
        }
      },
    },
  });
  if ((await db.auth.signInWithPassword(account)).error)
    throw Error("Local login failed");
  return { db, cookies };
}
export async function ageLocalSession(
  session: Awaited<ReturnType<typeof localSession>>,
) {
  const id = (await session.db.auth.getClaims()).data!.claims.session_id;
  if (!/^[a-f0-9-]{36}$/.test(String(id)))
    throw Error("Invalid local session fixture");
  sql(
    `update auth.mfa_amr_claims set created_at=now()-interval'20 minutes',updated_at=now()-interval'20 minutes' where session_id='${id}';`,
  );
  if ((await session.db.auth.refreshSession()).error)
    throw Error("Local refresh failed");
}
export async function installSession(
  page: Page,
  baseURL: string,
  session: Awaited<ReturnType<typeof localSession>>,
) {
  await page.context().clearCookies();
  await page
    .context()
    .addCookies(
      session.cookies.map((c) => ({
        ...c,
        url: baseURL,
        sameSite: "Lax" as const,
      })),
    );
}
export async function loginLocal(
  page: Page,
  account: { email: string; password: string },
) {
  await page.goto("/login?next=/settings&reauth=1");
  await page.getByLabel("이메일", { exact: true }).fill(account.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
}
