import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, failDatabase } from "./api";
import { z } from "zod";

const draftState = z.object({
  status: z.enum(["queued", "running", "done", "failed"]),
  output: z.unknown(),
});

export async function readRateLimitedDraft(db: SupabaseClient, id: string) {
  // ops_draft_get atomically enforces its own quota, including direct REST calls.
  const { data, error } = await db.rpc("ops_draft_get", { p_id: id });
  if (error) failDatabase(error, "작업 상태를 확인할 수 없습니다.");
  if (data === null) fail("작업을 찾을 수 없습니다.", 404);
  const parsed = draftState.safeParse(data);
  if (!parsed.success) fail("작업 상태를 확인할 수 없습니다.", 503);
  return parsed.data;
}
