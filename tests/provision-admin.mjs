// Local isolated Supabase only: add a disposable QA admin to .accounts.local.json. The admin role is granted by the
// database owner (psql), never through the API.
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { totp } from "./support/local-qa.mjs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(env.NEXT_PUBLIC_SUPABASE_URL))
  throw new Error("local only");
const port = new URL(env.NEXT_PUBLIC_SUPABASE_URL).port;
const kongPorts = execFileSync(
  "docker",
  ["port", "supabase_kong_AD-Me", "8000/tcp"],
  { encoding: "utf8" },
);
if (
  !kongPorts
    .trim()
    .split("\n")
    .some((address) => address.endsWith(":" + port))
)
  throw new Error("QA Supabase container does not match the configured port");
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
const email = `adme-qa-admin-${randomUUID().slice(0, 8)}@example.com`,
  password = randomUUID() + "Aa!";
const { data, error } = await db.auth.signUp({
  email,
  password,
  options: { data: { ...qaSignupConsent, role: "brand", name: "QA 관리자" } },
});
if (error) throw error;
execFileSync("docker", [
  "exec",
  "supabase_db_AD-Me",
  "psql",
  "-U",
  "postgres",
  "-v",
  "ON_ERROR_STOP=1",
  "-tAc",
  `select public.provision_administrator('${data.user.id}', 'Isolated CI administrator fixture', now()+interval '1 day');`,
]);
const { error: signinError } = await db.auth.signInWithPassword({
  email,
  password,
});
if (signinError) throw signinError;
const { data: factor, error: enrollmentError } = await db.auth.mfa.enroll({
  factorType: "totp",
  issuer: "AD Me isolated CI",
});
if (enrollmentError) throw enrollmentError;
const { error: verifyError } = await db.auth.mfa.challengeAndVerify({
  factorId: factor.id,
  code: totp(factor.totp.secret),
});
if (verifyError) throw verifyError;
const acc = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
acc.admin = {
  email,
  password,
  id: data.user.id,
  totpSecret: factor.totp.secret,
};
writeFileSync(".accounts.local.json", JSON.stringify(acc), { mode: 0o600 });
console.log(
  "QA admin provisioned (credentials stay in the ignored local file).",
);
