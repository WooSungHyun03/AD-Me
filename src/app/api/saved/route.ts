import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, failDatabase, parseBody, requireContext } from "@/lib/api";
export const POST = apiRoute("saved.post", async (req) => {
  const c = await requireContext();
  const b = await parseBody(
    req,
    z.object({ creatorId: z.string().min(1).max(100) }),
    "잘못된 요청입니다.",
  );
  const { data, error } = await c.db.rpc("toggle_saved_creator", {
    p_ref: b.creatorId,
  });
  if (error) failDatabase(error, "저장 상태를 불러오지 못했습니다.");
  return NextResponse.json({ saved: data === true });
});
