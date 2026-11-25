import {
  apiRoute,
  requireContext,
  parseBody,
  failDatabase,
  fail,
} from "@/lib/api";
import {
  savedSearchInput,
  savedSearchDelete,
  savedSearchList,
  savedSearchAlerts,
} from "@/lib/saved-searches";
export const GET = apiRoute("saved-searches.list", async () => {
  const c = await requireContext(),
    r = await c.db.rpc("saved_search_list");
  if (r.error) failDatabase(r.error, "저장 검색을 불러오지 못했습니다.");
  const result = savedSearchList.safeParse(r.data);
  if (!result.success) fail("저장 검색 응답을 확인하지 못했습니다.", 503);
  return Response.json(result.data, {
    headers: { "Cache-Control": "private, no-store" },
  });
});
export const POST = apiRoute("saved-searches.put", async (req) => {
  const c = await requireContext(),
    p = await parseBody(req, savedSearchInput, "검색 조건을 확인해주세요.");
  const r = await c.db.rpc("saved_search_put", {
    p_id: p.id,
    p_expected: p.expected,
    p_name: p.name,
    p_filters: p.filters,
  });
  if (r.error)
    failDatabase(r.error, "저장하지 못했습니다. 목록을 새로 확인해주세요.");
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const DELETE = apiRoute("saved-searches.delete", async (req) => {
  const c = await requireContext(),
    p = await parseBody(req, savedSearchDelete, "저장 검색을 확인해주세요.");
  const r = await c.db.rpc("saved_search_delete", {
    p_id: p.id,
    p_expected: p.expected,
  });
  if (r.error)
    failDatabase(r.error, "삭제하지 못했습니다. 목록을 새로 확인해주세요.");
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const PATCH = apiRoute("saved-searches.alerts", async (req) => {
  const c = await requireContext(),
    p = await parseBody(req, savedSearchAlerts, "알림 설정을 확인해주세요.");
  const r = await c.db.rpc("saved_search_alerts", {
    p_id: p.id,
    p_expected: p.expected,
    p_notify: p.notify,
  });
  if (r.error)
    failDatabase(
      r.error,
      "알림 설정을 바꾸지 못했습니다. 목록을 새로 확인해주세요.",
    );
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
