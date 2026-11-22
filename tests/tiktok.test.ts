import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { policies, SourceNotAllowedError } from "@/lib/ingestion/policy";
import {
  authorizeUrl,
  parseToken,
  verifyWebhook,
  parseDeauthorization,
  TikTokScopeError,
} from "@/lib/ingestion/tiktok";
const approved = {
  ...policies,
  tiktok_display_api: {
    ...policies.tiktok_display_api,
    status: "approved" as const,
    reviewer: "QA",
    terms_version: "test",
  },
};
const o = {
  clientKey: "ck",
  redirectUri: "https://adme.example.test/api/integrations/tiktok/callback",
  state: "s".repeat(40),
};
const token = (scope: string) => ({
  access_token: "a",
  refresh_token: "r",
  open_id: "oid",
  scope,
  expires_in: 86400,
  refresh_expires_in: 31536000,
  token_type: "Bearer",
});
describe("D023 TikTok adapter", () => {
  it("is blocked while the source policy is pending", () => {
    expect(policies.tiktok_display_api.status).toBe("pending");
    expect(() => authorizeUrl(o)).toThrow(SourceNotAllowedError);
  });
  it("builds a minimal-scope authorize URL once approved; refuses unsafe redirect/state", () => {
    const u = new URL(authorizeUrl(o, approved));
    expect(u.origin + u.pathname).toBe(
      "https://www.tiktok.com/v2/auth/authorize/",
    );
    expect(u.searchParams.get("scope")).toBe(
      "user.info.basic,user.info.stats,video.list",
    );
    expect(u.searchParams.get("scope")).not.toMatch(/research/i);
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(() =>
      authorizeUrl({ ...o, redirectUri: "http://x.test/cb" }, approved),
    ).toThrow();
    expect(() =>
      authorizeUrl({ ...o, redirectUri: "https://x.test/cb?a=1" }, approved),
    ).toThrow();
    expect(() => authorizeUrl({ ...o, state: "short" }, approved)).toThrow();
  });
  it("token: scope errors, extra scopes refused, lifetimes capped to documented values", () => {
    expect(() => parseToken(token("user.info.basic"))).toThrow(
      TikTokScopeError,
    );
    expect(() =>
      parseToken(
        token("user.info.basic,user.info.stats,video.list,research.data.basic"),
      ),
    ).toThrow(/unexpected_scope/);
    const t = parseToken(
      token("user.info.basic,user.info.stats,video.list"),
      0,
    );
    expect(t.accessExpiresAt.getTime()).toBe(2 * 3600 * 1000);
    expect(t.refreshExpiresAt.getTime()).toBe(180 * 86400 * 1000);
    expect(() =>
      parseToken({ ...token("video.list"), token_type: "mac" }),
    ).toThrow();
  });
  it("webhook signature: valid, tampered, stale, malformed", () => {
    const body = JSON.stringify({ event: "authorization.removed" }),
      now = 1_800_000_000;
    const s = createHmac("sha256", "sec")
      .update(`${now}.${body}`)
      .digest("hex");
    expect(verifyWebhook(`t=${now},s=${s}`, body, "sec", now)).toBe(true);
    expect(verifyWebhook(`t=${now},s=${s}`, body + " ", "sec", now)).toBe(
      false,
    );
    expect(verifyWebhook(`t=${now},s=${s}`, body, "other", now)).toBe(false);
    expect(verifyWebhook(`t=${now},s=${s}`, body, "sec", now + 301)).toBe(
      false,
    );
    expect(verifyWebhook("garbage", body, "sec", now)).toBe(false);
    expect(verifyWebhook(null, body, "sec", now)).toBe(false);
  });
  it("deauthorization event parses open_id and reason", () => {
    const d = parseDeauthorization({
      client_key: "ck",
      event: "authorization.removed",
      create_time: 1,
      user_openid: "oid",
      content: '{"reason":2}',
    });
    expect(d).toMatchObject({ openId: "oid", reason: 2 });
    expect(() =>
      parseDeauthorization({
        event: "video.publish.completed",
        user_openid: "x",
        create_time: 1,
        content: "",
      }),
    ).toThrow();
  });
});
