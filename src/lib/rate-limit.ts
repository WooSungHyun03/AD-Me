import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, failDatabase } from "./api";

export async function enforceRateLimit(
  db: SupabaseClient,
  action: "draft_poll",
) {
  const { data, error } = await db.rpc("ops_request_quota", {
    p_action: action,
  });
  if (error) failDatabase(error, "요청 한도를 확인하지 못했습니다.");
  if (
    !data ||
    typeof data.allowed !== "boolean" ||
    !Number.isInteger(data.retryAfter) ||
    data.retryAfter < 0 ||
    data.retryAfter > 86400
  )
    fail("요청 한도를 확인하지 못했습니다.", 503);
  if (!data.allowed)
    fail(
      "요청이 많습니다. 잠시 후 다시 시도해주세요.",
      429,
      Math.max(1, data.retryAfter),
    );
}
