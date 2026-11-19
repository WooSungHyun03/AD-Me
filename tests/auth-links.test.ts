import { describe, expect, it } from "vitest";
import { emailProofSchema, resetPasswordSchema } from "../src/lib/auth-links";

describe("auth link boundaries", () => {
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
