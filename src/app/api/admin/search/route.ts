import { apiRoute, fail, failDatabase, parseBody } from "@/lib/api";
import { requireSupportContext } from "@/lib/ops-context";
import {
  supportInputSchema,
  supportPageSchema,
  supportScopes,
} from "@/lib/admin-support";
export const POST = apiRoute("admin.search", async (req, requestId) => {
  const c = await requireSupportContext(),
    p = await parseBody(
      req,
      supportInputSchema,
      "검색 대상과 조회 사유를 확인해주세요.",
    );
  if (!supportScopes[c.staffRole].includes(p.kind))
    fail("해당 업무 범위의 권한이 필요합니다.", 403);
  const { data, error } = await c.db.rpc("admin_support_search", {
    p_kind: p.kind,
    p_query: p.query,
    p_after: p.cursor,
    p_limit: 20,
    p_reason: p.reason,
    p_request: requestId,
  });
  if (error) failDatabase(error, "운영 검색을 수행하지 못했습니다.");
  const parsed = supportPageSchema.safeParse(data);
  if (!parsed.success || parsed.data.kind !== p.kind)
    fail("검색 결과를 확인하지 못했습니다.", 503);
  return Response.json(parsed.data, {
    headers: { "Cache-Control": "private, no-store" },
  });
});
