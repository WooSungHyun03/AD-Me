import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getConfig } from "./config";
export function serverAdmin() {
  const config = getConfig().supabase,
    secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!config || !secret) return null;
  let valid = /^sb_secret_[\w-]+$/.test(secret);
  try {
    valid ||=
      JSON.parse(Buffer.from(secret.split(".")[1], "base64url").toString())
        .role === "service_role";
  } catch {
    /* Modern secret keys need no JWT payload. */
  }
  return valid
    ? createClient(config.url, secret, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;
}
