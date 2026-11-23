import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseInput,
  requireContext,
} from "@/lib/api";
export const GET = apiRoute("brands.contact.get", async (request) => {
  const c = await requireContext();
  const parts = new URL(request.url).pathname.split("/");
  const id = parseInput(
    z.uuid(),
    parts[parts.length - 2],
    "브랜드 ID를 확인해주세요.",
  );
  const { data, error } = await c.db.rpc("brand_contact_for", {
    p_brand_id: id,
  });
  if (error) failDatabase(error, "담당자 정보를 불러오지 못했습니다.");
  if (!data?.length) fail("조회 가능한 담당자 정보가 없습니다.", 404);
  return Response.json(
    { contactName: data[0].contact_name, contactEmail: data[0].contact_email },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
