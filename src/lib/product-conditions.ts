import { z } from "zod";
import { redact } from "./ai";
import values from "./product-condition-values.json";

export const productConditionSource = z.strictObject({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().min(5).max(1200),
  audience: z.string().trim().max(160).default(""),
});
const evidence = {
  field: z.enum(["name", "description", "audience"]),
  quote: z.string().min(2).max(120),
};
export const productConditionProposal = z.strictObject({
  sourceVersion: z.string().regex(/^[a-f0-9]{64}$/),
  sourceContract: z.literal("unbound-product-text-v1"),
  promptVersion: z.literal("product-conditions-v1"),
  runtimeVersion: z.literal("ollama-qwen3-local-v2"),
  model: z.literal("qwen3:1.7b-q4_K_M"),
  usage: z.strictObject({
    inputTokens: z.number().int().min(0).max(4096),
    outputTokens: z.number().int().min(0).max(650),
    durationNs: z.number().int().min(0).max(180000000000),
  }),
  requiresConfirmation: z.literal(true),
  applied: z.literal(false),
  omitted: z.number().int().min(0).max(8),
  suggestions: z
    .array(
      z.discriminatedUnion("kind", [
        z.strictObject({
          kind: z.literal("category"),
          value: z.enum(values.category as [string, ...string[]]),
          ...evidence,
        }),
        z.strictObject({
          kind: z.literal("vibe"),
          value: z.enum(values.vibe as [string, ...string[]]),
          ...evidence,
        }),
        z.strictObject({
          kind: z.literal("format"),
          value: z.enum(values.format as [string, ...string[]]),
          ...evidence,
        }),
      ]),
    )
    .max(8),
});

// The future server producer supplies its own RLS-checked product source and stored
// fingerprint. Neither this text contract nor a caller/model proves ownership.
export function validateProductConditionProposal(
  raw: unknown,
  source: unknown,
  expectedSourceVersion: string,
) {
  const input = productConditionSource.parse(source),
    proposal = productConditionProposal.parse(raw);
  if (proposal.sourceVersion !== expectedSourceVersion)
    throw Error("PRODUCT_SOURCE_CHANGED");
  const seen = new Set<string>();
  for (const row of proposal.suggestions) {
    const key = `${row.kind}:${row.value}`;
    if (
      seen.has(key) ||
      !redact(input[row.field]).includes(row.quote) ||
      !row.quote.includes(row.value)
    )
      throw Error("PRODUCT_EVIDENCE_INVALID");
    seen.add(key);
  }
  return proposal;
}
