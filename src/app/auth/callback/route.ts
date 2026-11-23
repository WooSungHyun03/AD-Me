import { NextResponse } from "next/server";
import { configured, supabase } from "@/lib/supabase";
import { authNextPath, authSiteOrigin } from "@/lib/auth-links";
export async function GET(request: Request) {
  const input = new URL(request.url);
  const code = input.searchParams.get("code");
  const origin = authSiteOrigin();
  let target = "/auth/error";
  if (code && code.length <= 2048 && configured()) {
    const db = await supabase();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) target = authNextPath(input.searchParams.get("next"));
  }
  const response = NextResponse.redirect(new URL(target, origin), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
