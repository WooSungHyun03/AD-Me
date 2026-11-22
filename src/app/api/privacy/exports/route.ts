import { NextResponse } from "next/server";
import { context, fail, safeOrigin } from "@/lib/api";
import { REAUTH_MESSAGE, recentSignIn } from "@/lib/auth-links";
// Creates a one-time export ticket (15 min). Re-authentication is checked here and again in the DB.
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  if (!recentSignIn(c.user)) return fail(REAUTH_MESSAGE, 401);
  const { data, error } = await c.db.rpc("create_privacy_export");
  if (error)
    return error.message.includes("reauth_required")
      ? fail(REAUTH_MESSAGE, 401)
      : error.message.includes("rate_limited")
        ? fail("내보내기는 24시간에 5번까지 요청할 수 있습니다.", 429)
        : fail("내보내기를 준비하지 못했습니다.", 500);
  const t = data[0];
  return NextResponse.json(
    { id: t.id, token: t.token, expiresAt: t.expires_at },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
