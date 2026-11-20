import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as command } from "@/app/api/admin/intelligence/route";
import { POST as create, GET as get } from "@/app/api/intelligence/route";

const state = vi.hoisted(() => ({
  role: "brand",
  signedIn: true,
  rpc: vi.fn(),
}));
vi.mock("@/lib/api", async (original) => {
  const api = await original<typeof import("@/lib/api")>();
  return {
    ...api,
    requireContext: async () => {
      if (!state.signedIn) api.fail("로그인이 필요합니다.", 401);
      return {
        user: { id: "fixture" },
        role: state.role,
        db: { rpc: state.rpc },
      };
    },
  };
});
const request = (data: unknown, method = "POST", query = "") =>
  new Request(`https://app.example/api/intelligence${query}`, {
    method,
    headers: { host: "app.example", origin: "https://app.example" },
    ...(method === "POST" ? { body: JSON.stringify(data) } : {}),
  });
beforeEach(() => {
  vi.resetAllMocks();
  state.role = "brand";
  state.signedIn = true;
  state.rpc.mockResolvedValue({ data: null, error: null });
  vi.stubEnv("ADME_FEATURE_LLM", "on");
  vi.stubEnv("ADME_FEATURE_INGESTION", "on");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://database.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_fixture");
});
afterEach(() => vi.unstubAllEnvs());
describe("main intelligence routes share the D004 API contract", () => {
  it.each([command, create, get])(
    "returns a safe correlatable auth error",
    async (handler) => {
      state.signedIn = false;
      const response = await handler(
        request(null, handler === get ? "GET" : "POST"),
      );
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        error: {
          code: "UNAUTHENTICATED",
          requestId: response.headers.get("X-Request-Id"),
        },
      });
      expect(state.rpc).not.toHaveBeenCalled();
    },
  );
  it("rejects bad JSON, fields and cross-site commands before database work", async () => {
    expect(
      (await command(request({ action: "channel", value: "bad" }))).status,
    ).toBe(422);
    const malformed = new Request("https://app.example/api/intelligence", {
      method: "POST",
      body: "{",
    });
    expect((await create(malformed)).status).toBe(400);
    const cross = new Request("https://app.example/api/intelligence", {
      method: "POST",
      headers: { origin: "https://other.example", host: "app.example" },
      body: "{}",
    });
    expect((await command(cross)).status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it.each([
    ["42501", 403],
    ["54000", 429],
    ["P0002", 404],
    ["08006", 503],
  ])("sanitizes database failure %s", async (code, status) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.rpc.mockResolvedValue({
      data: null,
      error: { code, message: "PRIVATE_PROVIDER_FIXTURE" },
    });
    const response = await command(
      request({ action: "channel", value: "UC_x5XG1OV2P6uZZ5FSM9Ttw" }),
    );
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("PRIVATE_PROVIDER_FIXTURE");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("returns only validated draft output to the requesting owner", async () => {
    state.rpc.mockImplementation(async (name) => ({
      data:
        name === "ops_request_quota"
          ? { allowed: true, retryAfter: 0 }
          : { status: "done", output: { private: "unexpected" } },
      error: null,
    }));
    const response = await get(
      request(null, "GET", "?id=00000000-0000-4000-8000-000000000001"),
    );
    expect(await response.json()).toEqual({ status: "done", output: null });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
