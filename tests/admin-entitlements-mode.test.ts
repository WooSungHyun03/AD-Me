import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/entitlements/route";

const { rpc, context } = vi.hoisted(() => ({
  rpc: vi.fn(),
  context: vi.fn(),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  context,
}));

const owner = "10000000-0000-4000-8000-000000000001";
const grant = {
  action: "grant",
  owner,
  sku: "brand_pro",
  days: 30,
  credits: 0,
  note: "fictional local QA",
};
const post = (body: object) =>
  POST(
    new Request("http://localhost/api/admin/entitlements", {
      method: "POST",
      headers: { origin: "http://localhost", host: "localhost" },
      body: JSON.stringify(body),
    }),
  );
function setup(mode: string, flag = "on") {
  vi.stubEnv("ADME_SERVICE_MODE", mode);
  vi.stubEnv("SERVICE_MODE", mode);
  vi.stubEnv("ADME_FEATURE_TEST_BILLING", flag);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "sb_publishable_local_fixture_only",
  );
  vi.stubEnv("NEXT_PUBLIC_TOSS_CLIENT_KEY", "test_ck_local_fixture_only");
  rpc.mockResolvedValue({ error: null });
  context.mockResolvedValue({ user: { id: owner }, db: { rpc } });
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("D001 manual TEST entitlement issuance", () => {
  it.each([
    ["free_beta", "on"],
    ["test_demo", "off"],
  ])(
    "denies repeated grants without DB writes for mode=%s flag=%s",
    async (mode, flag) => {
      setup(mode, flag);
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await post(grant);
        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe("NOT_FOUND");
      }
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("retains the enabled TEST grant RPC contract", async () => {
    setup("test_demo");
    expect((await post(grant)).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("admin_grant_entitlement", {
      p_owner: owner,
      p_sku: "brand_pro",
      p_days: 30,
      p_credits: 0,
      p_note: grant.note,
    });
  });
  it("keeps recovery/revocation available when billing is off", async () => {
    setup("free_beta", "off");
    expect(
      (await post({ action: "revoke", id: owner, note: grant.note })).status,
    ).toBe(200);
    expect(rpc).toHaveBeenCalledWith("revoke_entitlement", {
      p_id: owner,
      p_reason: grant.note,
    });
  });
  it("preserves login and DB administrator refusal in TEST mode", async () => {
    setup("test_demo");
    context.mockResolvedValueOnce(null);
    expect((await post(grant)).status).toBe(401);
    rpc.mockResolvedValueOnce({
      error: { code: "42501", message: "forbidden" },
    });
    expect((await post(grant)).status).toBe(403);
  });
  it("maps the disabled DB boundary to the same hidden resource response", async () => {
    setup("test_demo");
    rpc.mockResolvedValueOnce({
      error: { code: "PT404", message: "TEST billing disabled" },
    });
    expect((await post(grant)).status).toBe(404);
  });
});
