import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseInput,
  requireContext,
} from "@/lib/api";
export const GET = apiRoute("images.room", async (req) => {
  const c = await requireContext(),
    room = parseInput(
      z.uuid(),
      new URL(req.url).searchParams.get("proposalId"),
      "대화방을 확인해주세요.",
    );
  const { data, error } = await c.db.rpc("image_room_files", { p_room: room });
  if (error) failDatabase(error, "첨부 이력을 불러오지 못했습니다.");
  const d = z
    .array(
      z.strictObject({
        id: z.uuid(),
        name: z.string().max(120),
        bytes: z.number().int().positive().max(5242880),
        messageId: z.uuid(),
      }),
    )
    .max(20)
    .safeParse(data);
  if (!d.success) fail("첨부 이력을 확인하지 못했습니다.", 503);
  return Response.json(d.data, { headers: { "Cache-Control": "no-store" } });
});
