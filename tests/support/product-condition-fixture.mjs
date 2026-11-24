// Synthetic provider payloads only; never an actual model/source approval.
import { createHash } from "node:crypto";
export const fictionalProductSource = {
  name: "가상 음식 상품",
  description: "음식 분야의 제품 리뷰를 자연스러움 분위기로 소개합니다.",
  audience: "가상 성인 고객",
};
export function syntheticProductOutput(
  source = fictionalProductSource,
  sourceVersion = "a".repeat(64),
) {
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        audience: source.audience,
        description: source.description,
        name: source.name,
      }),
    )
    .digest("hex");
  return {
    sourceVersion,
    modelSourceVersion: fingerprint,
    sourceContract: "owned-product-v1",
    promptVersion: "product-conditions-v2",
    runtimeVersion: "ollama-qwen3-local-v2",
    model: "qwen3:1.7b-q4_K_M",
    usage: { inputTokens: 120, outputTokens: 100, durationNs: 100 },
    requiresConfirmation: true,
    applied: false,
    omitted: 0,
    suggestions: [
      { kind: "category", value: "음식", field: "description", quote: "음식" },
      {
        kind: "format",
        value: "제품 리뷰",
        field: "description",
        quote: "제품 리뷰",
      },
      {
        kind: "vibe",
        value: "자연스러움",
        field: "description",
        quote: "자연스러움",
      },
    ],
  };
}
