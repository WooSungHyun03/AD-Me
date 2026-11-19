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
  const { data, error } = await c.db
    .from("saved_creators")
    .select("creator_id")
    .eq("owner_id", c.user.id)
    .eq("creator_id", b.creatorId)
    .maybeSingle();
  if (error) failDatabase(error, "저장 상태를 불러오지 못했습니다.");
  const result = data
    ? await c.db
        .from("saved_creators")
        .delete()
        .eq("owner_id", c.user.id)
        .eq("creator_id", b.creatorId)
    : await c.db
        .from("saved_creators")
        .insert({ owner_id: c.user.id, creator_id: b.creatorId });
  if (result.error) failDatabase(result.error, "저장하지 못했습니다.");
  return NextResponse.json({ saved: !data });
});
