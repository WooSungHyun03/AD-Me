import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import document from "./policy-document.json";
export const policyDocument = document;
export const consentFieldsSchema = z.object({
  policyVersion: z.literal(document.version),
  policyHash: z.literal(document.documentHash),
  termsAccepted: z.literal("on"),
  privacyAccepted: z.literal("on"),
  adultConfirmed: z.literal("on"),
});
export const policyStatusSchema = z.strictObject({
  version: z.literal(document.version),
  documentHash: z.literal(document.documentHash),
  approved: z.boolean(),
});
export type PolicyStatus = z.infer<typeof policyStatusSchema>;
export const signupConsentMetadata = {
  policy_version: document.version,
  policy_hash: document.documentHash,
  terms_accepted: true,
  privacy_accepted: true,
  adult_beta_confirmed: true,
};
export const publicationProofSchema = z.strictObject({
  version: z.literal(document.version),
  documentHash: z.literal(document.documentHash),
  requestKey: z.uuid(),
});
// Keep the same key after a lost response; a changed user intent needs a new key.
export function publicationIntent(
  previous: { payload: string; requestKey: string } | null,
  data: unknown,
) {
  const payload = JSON.stringify(data);
  return previous?.payload === payload
    ? previous
    : { payload, requestKey: crypto.randomUUID() };
}
export async function readCurrentPolicy(
  db: SupabaseClient,
): Promise<PolicyStatus> {
  const { data, error } = await db.rpc("current_consent_policy");
  if (error) throw new Error("정책 연결을 준비 중입니다.");
  return policyStatusSchema.parse(data);
}

// D015: notice texts and versions (DB mirror: marketing_notice_version() in migration 20261123100018).
export const MARKETING_VERSION = "marketing-2026-11";
export const PURPOSES = {
  service_email:
    "서비스 알림 메일: 내 제안·지원·메시지에 변화가 있을 때 보내는 메일입니다. 꺼도 사이트 안 알림은 계속 표시됩니다.",
  marketing_email:
    "(선택) 마케팅 메일: 새 기능·이벤트 소식. 동의하지 않아도 모든 기능을 이용할 수 있고 언제든 철회할 수 있습니다. 철회하면 발송 대기 중인 메일도 취소됩니다.",
  interests: "관심 카테고리(최대 5개): 추천과 소식 맞춤에만 쓰입니다.",
} as const;
