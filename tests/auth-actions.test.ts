import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  configured: mocks.configured,
  supabase: async () => ({ auth: mocks }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
import {
  confirmEmail,
  requestRecovery,
  resetPassword,
} from "../src/app/auth/actions";
function form(data: Record<string, string>) {
  const result = new FormData();
  for (const [k, v] of Object.entries(data)) result.set(k, v);
  return result;
}
const proof = "a".repeat(64);
const reset = () =>
  form({
    token_hash: proof,
    type: "recovery",
    password: "unique-password-123",
    confirm_password: "unique-password-123",
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.signOut.mockResolvedValue({ error: null });
});
describe("email confirmation and recovery server actions", () => {
  it("does not send email for invalid input", async () => {
    expect(
      (await requestRecovery({}, form({ email: "bad" }))).error,
    ).toBeTruthy();
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });
  it("does not claim delivery when SMTP fails", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({
      error: { code: "unexpected_failure" },
    });
    const result = await requestRecovery(
      {},
      form({ email: "person@example.com" }),
    );
    expect(result.error).toBeTruthy();
    expect(result.message).toBeUndefined();
  });
  it("uses a generic acknowledgement after an accepted request", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    const one = await requestRecovery({}, form({ email: "first@example.com" }));
    const two = await requestRecovery(
      {},
      form({ email: "second@example.com" }),
    );
    expect(one).toEqual(two);
    expect(one.message).toContain("계정이 있다면");
  });
  it("cannot redeem a recovery proof through the signup confirmation action", async () => {
    expect(
      (await confirmEmail({}, form({ token_hash: proof, type: "recovery" })))
        .error,
    ).toBeTruthy();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
  });
  it("checks email ownership before navigating to the dashboard", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null });
    await expect(
      confirmEmail({}, form({ token_hash: proof, type: "email" })),
    ).rejects.toThrow("REDIRECT:/dashboard");
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: proof,
      type: "email",
    });
  });
  it("does not update a password for mismatched inputs", async () => {
    const data = reset();
    data.set("confirm_password", "different-password");
    expect((await resetPassword({}, data)).error).toBeTruthy();
    expect(mocks.verifyOtp).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("requires provider verification for every reset; stale session alone is insufficient", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: "otp_expired" },
    });
    expect((await resetPassword({}, reset())).error).toBeTruthy();
    expect(mocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: proof,
      type: "recovery",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("updates only after recovery verification and signs out all refresh sessions", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {
        user: { id: "verified-user" },
        session: { access_token: "fixture" },
      },
      error: null,
    });
    mocks.updateUser.mockResolvedValue({ error: null });
    await expect(resetPassword({}, reset())).rejects.toThrow(
      "REDIRECT:/login?password_reset=complete",
    );
    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: "unique-password-123",
    });
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
  it("clears recovery session after update failure without reporting success", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {
        user: { id: "verified-user" },
        session: { access_token: "fixture" },
      },
      error: null,
    });
    mocks.updateUser.mockResolvedValue({ error: { code: "weak_password" } });
    expect((await resetPassword({}, reset())).error).toContain("새 복구 링크");
    expect(mocks.signOut).toHaveBeenCalled();
  });
});
