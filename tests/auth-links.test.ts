import { describe, expect, it, vi, afterEach } from "vitest";
import {
  authNextPath,
  authSiteOrigin,
  emailProofSchema,
  resetPasswordSchema,
} from "../src/lib/auth-links";

afterEach(() => vi.unstubAllEnvs());
describe("auth link boundaries", () => {
  it.each([
    "https://evil.example/",
    "//evil.example",
    "/\\evil.example",
    "/reset-password",
    "/admin",
    "/dashboard?next=https://evil.example",
  ])("does not accept redirect input %s", (next) => {
    expect(authNextPath(next)).toBe("/dashboard");
  });
  it.each([
    "https://user:pass@be-celeb.org",
    "http://evil.example",
    "https://be-celeb.org/auth",
    "https://be-celeb.org?token=value",
    "https://be-celeb.org/#fragment",
  ])("rejects unsafe canonical configuration %s", (origin) => {
    expect(() => authSiteOrigin(origin)).toThrow();
  });
  it("requires HTTPS in production even for localhost", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => authSiteOrigin("http://localhost:3000")).toThrow();
    expect(authSiteOrigin("https://be-celeb.org")).toBe("https://be-celeb.org");
  });
  it("rejects duplicate/type-confused/missing recovery proof", () => {
    expect(
      emailProofSchema.safeParse({
        token_hash: ["a".repeat(64)],
        type: "email",
      }).success,
    ).toBe(false);
    expect(
      emailProofSchema.safeParse({ token_hash: "a".repeat(64), type: "admin" })
        .success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        type: "recovery",
        password: "long-password-123",
        confirm_password: "long-password-123",
      }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        token_hash: "a".repeat(64),
        type: "email",
        password: "long-password-123",
        confirm_password: "long-password-123",
      }).success,
    ).toBe(false);
  });
  it("rejects mismatched/oversized passwords before spending a token", () => {
    expect(
      resetPasswordSchema.safeParse({
        token_hash: "a".repeat(64),
        type: "recovery",
        password: "long-password-123",
        confirm_password: "different-password",
      }).success,
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        token_hash: "a".repeat(64),
        type: "recovery",
        password: "x".repeat(129),
        confirm_password: "x".repeat(129),
      }).success,
    ).toBe(false);
  });
});
