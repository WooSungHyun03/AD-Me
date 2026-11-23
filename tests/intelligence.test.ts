import { describe, expect, it } from "vitest";
import { draftResult, opsCommand, parseChannel } from "@/lib/intelligence";

const channel = "UC_x5XG1OV2P6uZZ5FSM9Ttw";
describe("intelligence boundaries", () => {
  it("preserves complete local-worker provenance and rejects partial/forged usage", () => {
    const output = {
      concept: "가상 초안",
      outline: ["확인 필요"],
      proposal: "가상 제안",
      model: "qwen3:1.7b-q4_K_M",
      promptVersion: "marketing-draft-v2",
      runtimeVersion: "ollama-qwen3-local-v2",
      requiresReview: true,
      usage: { inputTokens: 150, outputTokens: 100, durationNs: 1000000000 },
    };
    expect(draftResult.parse(output)).toEqual(output);
    for (const extra of [
      { model: "another" },
      { usage: undefined },
      { requiresReview: false },
      { usage: { ...output.usage, outputTokens: 651 } },
    ])
      expect(draftResult.safeParse({ ...output, ...extra }).success).toBe(
        false,
      );
    expect(
      draftResult.safeParse({
        concept: "이전 초안",
        outline: ["확인"],
        proposal: "이전 제안",
        model: "old",
      }).success,
    ).toBe(true);
  });
  it("accepts canonical channel IDs and HTTPS YouTube channel URLs", () => {
    expect(parseChannel(channel)).toBe(channel);
    expect(parseChannel(`https://www.youtube.com/channel/${channel}/`)).toBe(
      channel,
    );
  });
  it("rejects deceptive hosts, credentialed URLs, and non-channel paths", () => {
    for (const url of [
      `https://www.youtube.com.evil.test/channel/${channel}`,
      `https://member@youtube.com/channel/${channel}`,
      `http://youtube.com/channel/${channel}`,
      `https://youtube.com/watch?v=${channel}`,
    ])
      expect(parseChannel(url)).toBeNull();
  });
  it("requires a closed set of actions and a nonempty structured draft", () => {
    expect(
      opsCommand.safeParse({
        action: "review",
        value: channel,
        extra: "publish",
      }).success,
    ).toBe(false);
    expect(
      draftResult.safeParse({
        model: "local",
        concept: "초안",
        outline: [],
        proposal: "협업 제안",
      }).success,
    ).toBe(false);
  });
});
