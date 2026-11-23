import { expect, it } from "vitest";
import { publicTopicOptions } from "@/lib/public-youtube-topics";
import values from "@/lib/product-condition-values.json";
import { validateProductConditionProposal } from "@/lib/product-conditions";
const hash = "a".repeat(64);
const source = {
  name: "가상 음식 제품",
  description: "음식 분야의 제품 리뷰를 기획합니다.",
};
const proposal = {
  sourceVersion: hash,
  sourceContract: "unbound-product-text-v1",
  promptVersion: "product-conditions-v1",
  runtimeVersion: "ollama-qwen3-local-v2",
  model: "qwen3:1.7b-q4_K_M",
  usage: { inputTokens: 100, outputTokens: 50, durationNs: 100 },
  requiresConfirmation: true,
  applied: false,
  omitted: 0,
  suggestions: [
    {
      kind: "category",
      value: "음식",
      field: "description",
      quote: "음식 분야",
    },
  ],
};
it("uses only supported YouTube topics and keeps a validated proposal unapplied", () => {
  expect(values.category).toEqual(Object.keys(publicTopicOptions));
  expect(validateProductConditionProposal(proposal, source, hash)).toEqual(
    proposal,
  );
});
it("refuses changed sources, invented evidence, duplicate conditions and private schema additions", () => {
  expect(() =>
    validateProductConditionProposal(proposal, source, "b".repeat(64)),
  ).toThrow("SOURCE_CHANGED");
  for (const rows of [
    [{ ...proposal.suggestions[0], quote: "지어낸 음식" }],
    [...proposal.suggestions, ...proposal.suggestions],
  ])
    expect(() =>
      validateProductConditionProposal(
        { ...proposal, suggestions: rows },
        source,
        hash,
      ),
    ).toThrow("EVIDENCE_INVALID");
  expect(() =>
    validateProductConditionProposal(
      { ...proposal, ownerId: "forged" },
      source,
      hash,
    ),
  ).toThrow();
});
it("refuses demographic/budget inference, auto-application or bypassed confirmation", () => {
  for (const extra of [
    { applied: true },
    { requiresConfirmation: false },
    {
      suggestions: [
        {
          kind: "audience",
          value: "30대 여성",
          field: "description",
          quote: "음식 분야",
        },
      ],
    },
  ])
    expect(() =>
      validateProductConditionProposal({ ...proposal, ...extra }, source, hash),
    ).toThrow();
});
