import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  requireContext,
} from "@/lib/api";
export const POST = apiRoute("admin.moderate.post", async (req) => {
  const c = await requireContext();
  if (c.role !== "admin") return fail("관리자 권한이 필요합니다.", 403);
  const p = await parseBody(
    req,
    z.discriminatedUnion("kind", [
      z.object({
        id: z.string().min(1).max(100),
        kind: z.literal("creator"),
        published: z.boolean(),
      }),
      z.object({
        id: z.uuid(),
        kind: z.literal("campaign"),
        published: z.literal(false),
      }),
    ]),
    "잘못된 요청입니다.",
  );
  const { error } = await c.db.rpc("moderate_entity", {
    p_kind: p.kind,
    p_id: p.id,
    p_published: p.published,
  });
  if (error?.code === "P0001" && error.message === "forbidden")
    fail("관리자 권한이 필요합니다.", 403);
  if (error) failDatabase(error, "운영 상태를 변경하지 못했습니다.");
  return NextResponse.json({ ok: true });
});
