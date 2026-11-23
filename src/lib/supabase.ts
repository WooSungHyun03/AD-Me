import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getConfig } from "./config";

export const configured = () => Boolean(getConfig().supabase);
export async function supabase() {
  const config = getConfig().supabase;
  if (!config) throw new Error("Supabase 연결이 준비되지 않았습니다.");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Middleware handles cookie refresh. */
        }
      },
    },
  });
}
export async function currentUser() {
  if (!configured()) return null;
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const active = await db.rpc("account_access");
  return !active.error && active.data === true ? user : null;
}
