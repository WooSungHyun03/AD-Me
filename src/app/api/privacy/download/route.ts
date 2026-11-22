import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
import {
  assertClean,
  collectExport,
  counterpartIds,
  sanitizeExport,
} from "@/lib/privacy";
const messages: Record<string, [string, number]> = {
  expired: ["내보내기 링크가 만료되었습니다. 다시 요청해주세요.", 410],
  reused: ["이미 내려받은 내보내기입니다. 다시 요청해주세요.", 410],
  denied: ["내보내기에 접근할 수 없습니다.", 403],
};
// POST (not a GET link) so the one-time token never lands in URLs, history or logs.
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({ id: z.uuid(), token: z.string().regex(/^[0-9a-f]{64}$/) })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(...messages.denied);
  const { data: outcome, error } = await c.db.rpc("consume_privacy_export", {
    p_id: p.data.id,
    p_token: p.data.token,
  });
  if (error) return fail("내보내기를 확인하지 못했습니다.", 500);
  if (outcome !== "ok") return fail(...(messages[outcome] ?? messages.denied));
  const raw = await collectExport(c.db, c.user);
  const data = sanitizeExport(raw, c.user.id);
  assertClean(data, counterpartIds(raw, c.user.id));
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="adme-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
