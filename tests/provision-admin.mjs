// Local isolated Supabase only: add a disposable QA admin to .accounts.local.json. The admin role is granted by the
// database owner (psql), never through the API.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(env.NEXT_PUBLIC_SUPABASE_URL))
  throw new Error("local only");
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
  options: { data: { role: "brand", name: "QA 관리자" } },
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
  `update profiles set role = 'admin' where id = '${data.user.id}'`,
]);
const acc = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
acc.admin = { email, password, id: data.user.id };
writeFileSync(".accounts.local.json", JSON.stringify(acc), { mode: 0o600 });
console.log(
  "QA admin provisioned (credentials stay in the ignored local file).",
);
