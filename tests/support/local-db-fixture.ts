// Local-only owner fixtures for the disposable Supabase stack (session_user postgres).
// Versioned publication consent and the proposal RPCs are covered by their own suites;
// E2E specs that only need "a published creator" use these helpers instead of direct
// inserts that the current publication guard (42501) correctly refuses.
import { execFileSync } from "node:child_process";

export function ownerSql(query: string) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_AD-Me",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
    ],
    { input: query, encoding: "utf8" },
  ).trim();
}

const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;

export function publishCreatorFixture(
  id: string,
  ownerId: string | null,
  profile: Record<string, unknown>,
) {
  ownerSql(
    `insert into public.creators(id,owner_id,published,profile) values(${literal(id)},${
      ownerId ? literal(ownerId) : "null"
    },true,${literal(JSON.stringify(profile))}::jsonb)`,
  );
}
