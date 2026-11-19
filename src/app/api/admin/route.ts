import { NextResponse } from "next/server";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  requireContext,
} from "@/lib/api";
import { z } from "zod";
export const POST = apiRoute("admin.post", async (req) => {
  const c = await requireContext();
  if (c.role !== "admin") return fail("관리자 권한이 필요합니다.", 403);
  const p = await parseBody(
    req,
    z.object({ id: z.uuid(), status: z.enum(["reviewed", "dismissed"]) }),
    "잘못된 요청입니다.",
  );
  const { error } = await c.db.rpc("review_report", {
    p_id: p.id,
    p_status: p.status,
  });
  if (error?.code === "P0001" && error.message === "forbidden")
    fail("관리자 권한이 필요합니다.", 403);
  if (error) failDatabase(error, "검토 처리에 실패했습니다.");
  return NextResponse.json({ ok: true });
});
