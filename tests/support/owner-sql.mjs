// Local QA only: run SQL as the database owner inside the local Supabase container.
// Used for fixtures that no API path may create (e.g. ownerless collected profiles, operator
// restrictions). The D073 publication guard lets only owner sessions bypass consent transactions.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? ""))
  throw new Error("owner SQL fixtures run only against local Supabase");
const container = process.env.ADME_DB_CONTAINER ?? "supabase_db_AD-Me";
if (!/^supabase_db_[A-Za-z0-9_-]+$/.test(container)) throw new Error("invalid local DB container");

export function ownerSql(statement) {
  return execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-Atq"],
    { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}
export const lit = (value) => `'${String(value).replace(/'/g, "''")}'`;
export const jsonLit = (value) => `${lit(JSON.stringify(value))}::jsonb`;
