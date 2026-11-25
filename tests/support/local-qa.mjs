import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export function localRuntime() {
  const runtime = JSON.parse(
    readFileSync("output/dev-a-db/runtime.local.json", "utf8").replace(
      /^\uFEFF/,
      "",
    ),
  );
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
