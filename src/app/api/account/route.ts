import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, failDatabase, parseBody, requireContext } from "@/lib/api";
export const PATCH = apiRoute("account.patch", async (req) => {
  const c = await requireContext();
  const p = await parseBody(
    req,
    z.object({ name: z.string().trim().min(2).max(80) }),
    "이름은 2~80자여야 합니다.",
  );
  const { error } = await c.db
    .from("profiles")
    .update({ name: p.name })
    .eq("id", c.user.id);
  if (error) failDatabase(error, "이름을 저장하지 못했습니다.");
  return NextResponse.json({ ok: true });
});
