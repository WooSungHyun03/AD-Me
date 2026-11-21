import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, fail, failDatabase, parseBody } from "@/lib/api";
import { requireAdminContext } from "@/lib/admin";
export const POST = apiRoute("admin.moderate.post", async (req, requestId) => {
  const c = await requireAdminContext();
  const p = await parseBody(
    req,
    z.discriminatedUnion("kind", [
      z.object({
        id: z.string().min(1).max(100),
        kind: z.literal("creator"),
        published: z.boolean(),
        reason: z.string().trim().min(5).max(500),
      }),
      z.object({
        id: z.uuid(),
        kind: z.literal("campaign"),
        published: z.boolean(),
        reason: z.string().trim().min(5).max(500),
      }),
    ]),
    "잘못된 요청입니다.",
  );
  const { error } = await c.db.rpc("admin_moderate_entity", {
    p_kind: p.kind,
    p_id: p.id,
    p_published: p.published,
    p_reason: p.reason,
    p_request: requestId,
  });
  if (error?.code === "P0001" && error.message === "forbidden")
    fail("관리자 권한이 필요합니다.", 403);
  if (error) failDatabase(error, "운영 상태를 변경하지 못했습니다.");
  return NextResponse.json({ ok: true });
});
