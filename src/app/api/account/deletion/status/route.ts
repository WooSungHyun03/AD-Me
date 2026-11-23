import { apiRoute, parseBody, fail } from "@/lib/api";
import {
  deletionReceiptSchema,
  readDeletionStatus,
} from "@/lib/deletion-runtime";
import { deletionAdmin } from "@/lib/deletion-http";
export const POST = apiRoute("deletion.status", async (req) => {
  const input = await parseBody(
      req,
      deletionReceiptSchema,
      "접수 확인 정보를 확인해주세요.",
    ),
    admin = await deletionAdmin(input.id),
    state = await readDeletionStatus(admin, input);
  if (!state) fail("접수 정보를 찾을 수 없습니다.", 404);
  return Response.json(state, {
    headers: { "Cache-Control": "private, no-store" },
  });
});
