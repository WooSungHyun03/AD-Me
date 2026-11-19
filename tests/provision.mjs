import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
const accounts = {};
for (const role of ["brand", "creator", "other"]) {
  const password = randomUUID() + "Aa!";
  const email = `adme-qa-${role}-${randomUUID().slice(0, 8)}@example.com`;
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: role === "creator" ? "creator" : "brand",
        name: `검증 ${role}`,
      },
    },
  });
  if (error) throw new Error(error.message);
  accounts[role] = { email, password, id: data.user.id };
}
writeFileSync(".accounts.local.json", JSON.stringify(accounts), {
  mode: 0o600,
});
console.log(
  JSON.stringify({
    ids: Object.values(accounts).map((a) => a.id),
    message:
      "Disposable QA users provisioned. Credentials remain in ignored local file.",
  }),
);
