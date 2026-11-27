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
it("D058: report rows carry ticket, kind, deadline and interim hide only; other detail keys are refused", async () => {
  const row = {
    id: "8f9b2a9e-6f4e-4c11-9a43-0e6c1c1f0a01",
    label: "ADR-261127-00001 · 사칭 신고",
    status: "in_review",
    createdAt: "2026-11-27T01:00:00.000+00:00",
    details: {
      ticketNo: "ADR-261127-00001",
      requestKind: "impersonation",
      dueAt: "2026-12-04T01:00:00.123456+00:00",
      interimHidden: true,
    },
  };
  const page = (details: object) => ({
    data: {
      version: 1,
      kind: "reports",
      items: [{ ...row, details }],
      nextCursor: null,
    },
    error: null,
  });
  state.rpc.mockResolvedValueOnce(page(row.details));
  const ok = await POST(req({ kind: "reports", reason: "D058 접수번호 확인" }));
  expect(ok.status).toBe(200);
  expect((await ok.json()).items[0].details).toEqual(row.details);
  for (const leak of [
    { ...row.details, reporterId: "8f9b2a9e-6f4e-4c11-9a43-0e6c1c1f0a02" },
    { ...row.details, requestKind: "unknown" },
  ]) {
    state.rpc.mockResolvedValueOnce(page(leak));
    const bad = await POST(
      req({ kind: "reports", reason: "D058 접수번호 확인" }),
    );
    expect(bad.status).toBe(503);
    expect(await bad.text()).not.toContain(
      "8f9b2a9e-6f4e-4c11-9a43-0e6c1c1f0a02",
    );
  }
});
