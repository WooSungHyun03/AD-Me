import { describe, expect, it } from "vitest";
import { normalizeSocialLink, publicProfilePath } from "@/lib/social-links";

describe("public SNS link contract", () => {
  it.each([
    "https://youtu.be/7cjVj1ZyzyE?si=tracking",
    "https://m.youtube.com/shorts/7cjVj1ZyzyE",
    "https://youtube.com/watch?feature=shared&v=7cjVj1ZyzyE",
  ])("normalizes approved YouTube video links %s", (input) => {
    expect(normalizeSocialLink(input)).toEqual({
      provider: "youtube",
      href: "https://www.youtube.com/watch?v=7cjVj1ZyzyE",
      videoId: "7cjVj1ZyzyE",
    });
  });

  it.each([
    [
      "https://www.youtube.com/@한글?tracking=1",
      "https://www.youtube.com/@%ED%95%9C%EA%B8%80",
    ],
    [
      "https://instagram.com/sample_user/?igsh=tracking",
      "https://www.instagram.com/sample_user/",
    ],
    [
      "https://tiktok.com/@sample/video/123456?share=1",
      "https://www.tiktok.com/@sample/video/123456",
    ],
  ])(
    "keeps approved profile/content paths and drops tracking %s",
    (input, href) => {
      expect(normalizeSocialLink(input)?.href).toBe(href);
    },
  );

  it.each([
    "javascript:alert(1)",
    "data:text/html,fixture",
    "//www.youtube.com/@example",
    "http://www.youtube.com/@example",
    "https://www.youtube.com.example.invalid/@example",
    "https://login:pass@www.youtube.com/@example",
    "https://www.youtube.com:8443/@example",
    "https://www.youtube.com/redirect?q=https://example.invalid",
    "https://www.youtube.com/watch?v=7cjVj1ZyzyE&v=7cjVj1ZyzyE",
    "https://www.youtube.com/@name%2Fredirect",
    "https://www.instagram.com/accounts",
  ])("denies unsafe or unsupported input %s", (input) => {
    expect(normalizeSocialLink(input)).toBeNull();
  });

  it("only constructs a share path for published identities", () => {
    expect(publicProfilePath("user-private", false)).toBeNull();
    expect(publicProfilePath("user-public", true)).toBe(
      "/creators/user-public",
    );
  });
});
