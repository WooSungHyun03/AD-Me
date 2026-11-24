import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  resend: vi.fn(),
  signUp: vi.fn(),
  budget: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/request-budget", () => ({ reserveRequestBudget: mocks.budget }));
vi.mock("@/lib/supabase", () => ({
  configured: mocks.configured,
  supabase: async () => ({ auth: mocks, rpc: mocks.rpc }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
import {
  confirmEmail,
  requestRecovery,
  resendSignupEmail,
  resetPassword,
} from "../src/app/auth/actions";
import { authAction } from "../src/app/actions";
import { policyDocument, signupConsentMetadata } from "../src/lib/consent";
function form(data: Record<string, string>) {
  const result = new FormData();
  for (const [k, v] of Object.entries(data)) result.set(k, v);
  if (data.mode === "signup")
    for (const [k, v] of Object.entries({
      policyVersion: policyDocument.version,
      policyHash: policyDocument.documentHash,
      termsAccepted: "on",
      privacyAccepted: "on",
      adultConfirmed: "on",
    }))
      result.set(k, v);
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
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://preview.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_fixture");
  vi.stubEnv("ADME_FEATURE_MAIL", "on");
  mocks.configured.mockReturnValue(true);
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.budget.mockResolvedValue(null);
  mocks.rpc.mockResolvedValue({
    data: {
      version: policyDocument.version,
      documentHash: policyDocument.documentHash,
      approved: true,
    },
    error: null,
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("email confirmation and recovery server actions", () => {
  it("rejects missing checks, stale policy and unapproved policy before signup provider calls", async () => {
    const d = {
      email: "person@example.com",
      password: "a-fixture-password",
      name: "테스트",
      role: "creator",
      mode: "signup",
    };
    const missing = form(d);
    missing.delete("adultConfirmed");
    expect((await authAction(null, missing)).error).toContain("각각 선택");
    const stale = form(d);
    stale.set("policyHash", "b".repeat(64));
    expect((await authAction(null, stale)).error).toBeTruthy();
    mocks.rpc.mockResolvedValueOnce({
      data: {
        version: policyDocument.version,
        documentHash: policyDocument.documentHash,
        approved: false,
      },
      error: null,
    });
    expect((await authAction(null, form(d))).error).toContain("정책 검토");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("uses the token-hash confirmation route and returns the same acknowledgement for duplicate signup", async () => {
    const signup = form({
      email: "person@example.com",
      password: "a-fixture-password",
      name: "테스트",
      role: "creator",
      mode: "signup",
    });
    mocks.signUp.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });
    const accepted = await authAction(null, signup);
    mocks.signUp.mockResolvedValueOnce({
      error: { code: "user_already_exists" },
    });
    expect(await authAction(null, signup)).toEqual(accepted);
    expect(accepted.message).toContain("인증이 필요하면");
    expect(mocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          data: { role: "creator", name: "테스트", ...signupConsentMetadata },
          emailRedirectTo: "https://preview.example/auth/confirm",
        },
      }),
    );
  });

  it("ends any unexpected signup session when confirmation has not taken place", async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: { access_token: "fixture" } },
      error: null,
    });
    const result = await authAction(
      null,
      form({
        email: "person@example.com",
        password: "a-fixture-password",
        name: "테스트",
        role: "brand",
        mode: "signup",
      }),
    );
    expect(result.error).toContain("가입 인증 설정");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("resends through the signup provider and hides differences for missing accounts", async () => {
    const email = form({ email: "person@example.com" });
    mocks.resend.mockResolvedValueOnce({ error: null });
    const accepted = await resendSignupEmail({}, email);
    mocks.resend.mockResolvedValueOnce({ error: { code: "user_not_found" } });
    expect(await resendSignupEmail({}, email)).toEqual(accepted);
    expect(accepted.message).toContain("인증이 필요하면");
    expect(mocks.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "person@example.com",
      options: { emailRedirectTo: "https://preview.example/auth/confirm" },
    });
    vi.stubEnv("ADME_FEATURE_MAIL", "off");
    expect((await resendSignupEmail({}, email)).error).toBeTruthy();
    expect(mocks.resend).toHaveBeenCalledTimes(2);
  });

  it("keeps expired and used signup proofs out of protected pages", async () => {
    mocks.verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
    const result = await confirmEmail(
      {},
      form({ token_hash: proof, type: "email" }),
    );
    expect(result.error).toContain("만료되었거나 이미 사용");
  });
  it("does not send recovery email when disabled", async () => {
    vi.stubEnv("ADME_FEATURE_MAIL", "off");
    expect(
      (await requestRecovery({}, form({ email: "person@example.com" }))).error,
    ).toBeTruthy();
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });
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
  it("keeps a pending secure email change on the confirmation step until both addresses verify", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
    expect(
      await confirmEmail({}, form({ token_hash: proof, type: "email_change" })),
    ).toEqual({ message: expect.stringContaining("다른 주소") });
  });
  it("returns completed email changes to settings", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {
        user: { id: "verified-user" },
        session: { access_token: "fixture" },
      },
      error: null,
    });
    await expect(
      confirmEmail({}, form({ token_hash: proof, type: "email_change" })),
    ).rejects.toThrow("REDIRECT:/settings");
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
