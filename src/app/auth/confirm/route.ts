import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  RECOVERY_COOKIE,
  RECOVERY_TTL_SECONDS,
  appUrl,
  safeNext,
} from "@/lib/auth-links";
import { configured, supabase } from "@/lib/supabase";
const types: EmailOtpType[] = ["recovery", "email_change", "signup", "email"];
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const base = appUrl();
  const type = q.get("type") as EmailOtpType | null;
  const tokenHash = q.get("token_hash");
  const code = q.get("code");
  const failed = NextResponse.redirect(new URL("/login?error=link", base));
  if (!configured()) return failed;
  const db = await supabase();
  // One-time tokens: reused or expired links fail here and never reach the target page.
  const { data, error } =
    tokenHash && type && types.includes(type)
      ? await db.auth.verifyOtp({ type, token_hash: tokenHash })
      : code
        ? await db.auth.exchangeCodeForSession(code)
        : { data: { user: null }, error: new Error("missing token") };
  if (error || !data.user) return failed;
  const jar = await cookies();
  const recovery = type === "recovery" || q.get("next") === "/auth/reset";
  if (recovery)
    jar.set(RECOVERY_COOKIE, data.user.id, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: RECOVERY_TTL_SECONDS,
    });
  const next = recovery ? "/auth/reset" : safeNext(q.get("next"));
  return NextResponse.redirect(new URL(next, base));
}
