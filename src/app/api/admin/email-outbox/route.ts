import { compatibleApiRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { context, fail, safeOrigin } from "@/lib/api";
import { configuredSender, runOutbox } from "@/lib/notifications/email";
import { storageAdmin } from "@/lib/uploads";
// D053: admin-triggered outbox run. Without a sender it reports BLOCKED and claims nothing.
 async function handlePOST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  if (c.role !== "admin") return fail("관리자 권한이 필요합니다.", 403);
  const svc = storageAdmin();
  if (!svc) return fail("서버 키가 설정되지 않았습니다.", 503);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  return NextResponse.json(await runOutbox(svc, configuredSender(), appUrl));
}

export const POST=compatibleApiRoute("src/app/api/admin/email-outbox/route.ts.POST",handlePOST);
