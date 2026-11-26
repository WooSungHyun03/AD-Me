import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// CI has no replica runtime file: use the disposable stack's .env.local and project container.
function ciRuntime() {
  const env = Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .trim()
      .split("\n")
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
  const api = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(
    "localhost",
    "127.0.0.1",
  );
  const project = /^project_id\s*=\s*"([^"]+)"/m.exec(
    readFileSync("supabase/config.toml", "utf8"),
  )?.[1];
  return {
    API_URL: api,
    ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    // Supabase CLI puts the DB on the API port + 1.
    DB_URL: `postgresql://postgres:postgres@127.0.0.1:${Number(/:(\d+)$/.exec(api)?.[1]) + 1}/postgres`,
    DB_CONTAINER: `supabase_db_${project}`,
  };
}
export function localRuntime() {
  const file = "output/dev-a-db/runtime.local.json";
  const runtime =
    process.env.ADME_LOCAL_QA !== "1" && !existsSync(file)
      ? ciRuntime()
      : JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  // Any loopback port, so an isolated replica can run beside another local stack.
  if (
    !/^http:\/\/127\.0\.0\.1:\d+$/.test(runtime.API_URL ?? "") ||
    !/@127\.0\.0\.1:\d+\//.test(runtime.DB_URL ?? "") ||
    !/^supabase_db_[A-Za-z0-9_-]+$/.test(
      runtime.DB_CONTAINER ?? "supabase_db_dev-a-db",
    )
  )
    throw new Error("Local QA refuses non-loopback infrastructure");
  return runtime;
}
export function localClient(key, token) {
  const runtime = localRuntime();
  return createClient(runtime.API_URL, key ?? runtime.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });
}
export function sql(statement) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      localRuntime().DB_CONTAINER ?? "supabase_db_dev-a-db",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    {
      input: statement,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  ).trim();
}
export function totp(secret, seconds = Math.floor(Date.now() / 1000)) {
  let bits = "";
  for (const character of secret.toUpperCase().replace(/=+$/, "")) {
    const value = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(character);
    if (value < 0) throw new Error("Invalid local TOTP fixture");
    bits += value.toString(2).padStart(5, "0");
  }
  const key = Buffer.from(
    (bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(seconds / 30)));
  const digest = createHmac("sha1", key).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000)
    .toString()
    .padStart(6, "0");
}
// Synthetic signed JWTs are only for isolated local PostgREST authorization tests.
export function localJwt(userId, overrides = {}) {
  const runtime = localRuntime();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    exp: now + 3600,
    iat: now,
    aal: "aal2",
    amr: [{ method: "totp", timestamp: now - 1 }],
    ...overrides,
  };
  const part = (data) =>
    Buffer.from(JSON.stringify(data)).toString("base64url");
  const body = `${part({ alg: "HS256", typ: "JWT" })}.${part(payload)}`;
  return `${body}.${createHmac("sha256", runtime.JWT_SECRET).update(body).digest("base64url")}`;
}

// Specs that act as the shared creator need its own published fictional profile, regardless of run order.
// Returns the prior row (or null) so dropCreatorProfile restores e.g. a tombstone left by another spec.
export function ensureCreatorProfile(ownerId) {
  if (!/^[0-9a-f-]{36}$/.test(ownerId))
    throw new Error("ensureCreatorProfile needs a local account UUID");
  const id = `user-${ownerId}`;
  const prior = sql(
    `select jsonb_build_object('published',published,'moderation_status',moderation_status,'profile',profile) from public.creators where id='${id}';`,
  );
  sql(
    `insert into public.creators(id,owner_id,published,profile) select '${id}','${ownerId}',true,profile||'{"is_demo":false,"name":"가상 QA 크리에이터"}'::jsonb from public.creators where profile->>'is_demo'='true' order by id limit 1 on conflict(id) do update set published=true,moderation_status='allowed',profile=excluded.profile;`,
  );
  // Proposals the spec creates against this profile are removed on drop, whichever path restores it.
  return { id, prior: prior || null, since: sql("select now();") };
}
export function dropCreatorProfile(own) {
  if (!own) return;
  sql(
    `delete from public.proposals where creator_id='${own.id}' and created_at>='${own.since}';`,
  );
  if (own.prior)
    sql(
      `update public.creators c set published=(p->>'published')::boolean,moderation_status=p->>'moderation_status',profile=p->'profile' from (select '${own.prior.replaceAll("'", "''")}'::jsonb p) x where c.id='${own.id}';`,
    );
  else sql(`delete from public.creators where id='${own.id}';`);
}
