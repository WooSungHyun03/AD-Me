import { beforeEach, it, expect, vi } from "vitest";
import { POST } from "@/app/api/admin/search/route";
const state = vi.hoisted(() => ({ rpc: vi.fn(), role: "support" }));
vi.mock("@/lib/ops-context", () => ({
  requireSupportContext: async () => ({
    staffRole: state.role,
    db: { rpc: state.rpc },
  }),
}));
const req = (value: unknown) =>
  new Request("http://localhost/api/admin/search", {
    method: "POST",
    body: JSON.stringify(value),
  });
beforeEach(() => {
  state.rpc.mockReset();
  state.role = "support";
});
it("denies unsupported staff scope, export, owner injection and reasonless queries", async () => {
  for (const value of [
    { kind: "orders", reason: "valid reason" },
    { kind: "export", reason: "valid reason" },
    { kind: "members", reason: "x" },
    { kind: "members", reason: "valid reason", actor: "forged" },
  ])
    expect((await POST(req(value))).status).toBeGreaterThanOrEqual(400);
  expect(state.rpc).not.toHaveBeenCalled();
});
it("uses one generated request ID for audit and HTTP receipt; strict DTO prevents secret leakage", async () => {
  state.rpc.mockResolvedValue({
    data: { version: 1, kind: "members", items: [], nextCursor: null },
    error: null,
  });
  const r = await POST(req({ kind: "members", reason: "가상 회원 문의 확인" }));
  expect(r.status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith(
    "admin_support_search",
    expect.objectContaining({
      p_request: r.headers.get("X-Request-Id"),
      p_limit: 20,
      p_reason: "가상 회원 문의 확인",
    }),
  );
  state.rpc.mockResolvedValue({
    data: {
      version: 1,
      kind: "members",
      items: [],
      nextCursor: null,
      password: "PRIVATE",
    },
    error: null,
  });
  const bad = await POST(
    req({ kind: "members", reason: "가상 회원 문의 확인" }),
  );
  expect(bad.status).toBe(503);
  expect(await bad.text()).not.toContain("PRIVATE");
});
