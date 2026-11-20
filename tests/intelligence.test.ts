import { describe, expect, it } from "vitest";
import { draftResult, opsCommand, parseChannel } from "@/lib/intelligence";

const channel = "UC_x5XG1OV2P6uZZ5FSM9Ttw";
describe("intelligence boundaries", () => {
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
