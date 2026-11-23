import "server-only";
import { z } from "zod";
import { fail } from "./api";
import { cursorPointSchema, messageRowSchema } from "./conversation";
const cursorSchema = cursorPointSchema.extend({
  version: z.literal(1),
  proposalId: z.uuid(),
});
export function decodeConversationCursor(
  value: string | undefined,
  proposalId: string,
) {
  if (!value) return null;
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value))
    fail("메시지 위치를 확인해주세요.", 422);
  let input: unknown;
  try {
    input = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    fail("메시지 위치를 확인해주세요.", 422);
  }
  const result = cursorSchema.safeParse(input);
  if (!result.success || result.data.proposalId !== proposalId)
    fail("메시지 위치를 확인해주세요.", 422);
  return result.data;
}
const dbPageSchema = z.strictObject({
  version: z.literal(1),
  items: z.array(messageRowSchema).max(50),
  nextCursor: cursorPointSchema.nullable(),
  blocked: z.boolean(),
  blockedByMe: z.boolean(),
});
export function projectConversationPage(input: unknown, proposalId: string) {
  const parsed = dbPageSchema.safeParse(input);
  if (!parsed.success) fail("메시지 응답을 확인하지 못했습니다.", 503);
  const { nextCursor, ...rest } = parsed.data;
  return {
    ...rest,
    nextCursor: nextCursor
      ? Buffer.from(
          JSON.stringify({ version: 1, proposalId, ...nextCursor }),
        ).toString("base64url")
      : null,
  };
}
