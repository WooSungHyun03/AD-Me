import { apiRoute, parseBody, fail } from "@/lib/api";
import {
  deletionReceiptSchema,
  readDeletionStatus,
  advanceDeletionQuarantine,
} from "@/lib/deletion-runtime";
import { deletionAdmin } from "@/lib/deletion-http";
export const runtime = "nodejs";
export const POST = apiRoute("deletion.quarantine", async (req) => {
  const input = await parseBody(
      req,
      deletionReceiptSchema,
      "접수 확인 정보를 확인해주세요.",
    ),
    admin = await deletionAdmin(input.id);
  if (!(await readDeletionStatus(admin, input)))
    fail("접수 정보를 찾을 수 없습니다.", 404);
  const state = await advanceDeletionQuarantine(admin, input);
  return Response.json(state, {
    headers: { "Cache-Control": "private, no-store" },
  });
});
