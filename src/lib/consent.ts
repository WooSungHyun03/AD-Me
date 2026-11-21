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
