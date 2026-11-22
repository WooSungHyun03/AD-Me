import { NextResponse } from "next/server";
import { reportError } from "@/lib/observability";
import { context, fail, safeOrigin } from "@/lib/api";
import { storageAdmin, sweepUploads } from "@/lib/uploads";
// Admin-triggered cleanup of deleted and orphaned files.
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  if (c.role !== "admin") return fail("관리자 권한이 필요합니다.", 403);
  const admin = storageAdmin();
  if (!admin) return fail("파일 저장소가 설정되지 않았습니다.", 503);
  try {
    return NextResponse.json({ ok: true, ...(await sweepUploads(admin)) });
  } catch (e) {
    await reportError(e, { route: "/api/admin/uploads" });
    return fail("정리 작업에 실패했습니다.", 500);
  }
}
