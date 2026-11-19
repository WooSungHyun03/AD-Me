import { NextResponse } from "next/server";
import { configured, supabase } from "./supabase";
export async function context() {
  if (!configured()) return null;
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data: profile } = await db
    .from("profiles")
    .select("role,name")
    .eq("id", user.id)
    .single();
  return {
    db,
    user,
    role: profile?.role as string,
    name: profile?.name as string,
  };
}
export const fail = (message: string, status = 400) =>
  NextResponse.json({ error: { message } }, { status });
export function safeOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return req.headers.get("sec-fetch-site") !== "cross-site";
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
