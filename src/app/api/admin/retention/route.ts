import { NextResponse } from "next/server";
import { reportError } from "@/lib/observability";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
import { storageAdmin } from "@/lib/uploads";
import { reapplyFromLedger, snapshotLedger } from "@/lib/privacy-retention";
// Admin: run the retention job, copy the tombstone ledger, or re-apply deletions after a backup restore.
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  if (c.role !== "admin") return fail("관리자 권한이 필요합니다.", 403);
  const p = z
    .object({
      action: z.enum(["run", "snapshot", "reapply"]),
      ledger: z.array(z.unknown()).max(100000).optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("잘못된 요청입니다.");
  const admin = storageAdmin();
  if (!admin) return fail("서버 키가 설정되지 않았습니다.", 503);
  try {
    if (p.data.action === "run") {
      const { data, error } = await admin.rpc("run_retention");
      if (error || data?.error) {
        await reportError(error ?? new Error("retention_failed"), {
          route: "/api/admin/retention",
        });
        return fail("보존 작업에 실패했습니다. 다시 실행해주세요.", 500);
      }
      return NextResponse.json({ ok: true, counts: data });
    }
    if (p.data.action === "snapshot")
      return NextResponse.json({
        ok: true,
        tombstones: await snapshotLedger(admin),
      });
    return NextResponse.json({
      ok: true,
      applied: await reapplyFromLedger(admin, p.data.ledger),
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ledger_invalid")
      return fail("삭제 기록 형식이 올바르지 않습니다.");
    await reportError(e, { route: "/api/admin/retention" });
    return fail(
      "작업에 실패했습니다. 같은 요청으로 다시 시도할 수 있습니다.",
      500,
    );
  }
}
