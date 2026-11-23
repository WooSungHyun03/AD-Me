import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, failDatabase } from "./api";
import { reviewCursorSchema, reviewInboxSchema } from "./reviews";
export function decodeReviewCursor(value?: string) {
  if (!value) return null;
  if (value.length > 400 || !/^[A-Za-z0-9_-]+$/.test(value))
    fail("검토 목록 위치를 확인해주세요.", 422);
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    fail("검토 목록 위치를 확인해주세요.", 422);
  }
  const result = reviewCursorSchema.safeParse(raw);
  if (!result.success) fail("검토 목록 위치를 확인해주세요.", 422);
  return result.data;
}
export async function readReviewInbox(
  db: Pick<SupabaseClient, "rpc">,
  cursor?: string,
) {
  const before = decodeReviewCursor(cursor);
  const { data, error } = await db.rpc("review_inbox", {
    p_before: before?.createdAt ?? null,
    p_before_id: before?.id ?? null,
    p_limit: 20,
  });
  if (error) failDatabase(error, "검토 자료를 불러오지 못했습니다.");
  const result = reviewInboxSchema.safeParse(data);
  if (!result.success) fail("검토 자료 응답을 확인하지 못했습니다.", 503);
  const { nextCursor, ...rest } = result.data;
  return {
    ...rest,
    nextCursor: nextCursor
      ? Buffer.from(JSON.stringify(nextCursor)).toString("base64url")
      : null,
  };
}
export function requireReviewResult(
  value: unknown,
  kind: "id" | "version" | "boolean" = "id",
) {
  const schema =
    kind === "id"
      ? z.uuid()
      : kind === "version"
        ? z.number().int().positive()
        : z.literal(true);
  if (!schema.safeParse(value).success)
    fail("검토 처리 응답을 확인하지 못했습니다.", 503);
}
