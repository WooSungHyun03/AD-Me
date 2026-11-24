import { expect, it, beforeEach, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  rpc: vi.fn(),
  getClaims: vi.fn(),
}));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  context: mocks.context,
}));
import { POST } from "@/app/api/privacy/exports/route";
const req = () =>
  new Request("http://localhost/api/privacy/exports", {
    method: "POST",
    headers: { origin: "http://localhost", host: "localhost" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({
    user: { id: "actor", last_sign_in_at: new Date().toISOString() },
    db: { auth: { getClaims: mocks.getClaims }, rpc: mocks.rpc },
  });
  mocks.rpc.mockResolvedValue({
    data: [
      {
        id: "fixture",
        token: "a".repeat(64),
        expires_at: new Date().toISOString(),
      },
    ],
    error: null,
  });
});
it("refuses old current-session proof even after a different login refreshed the account timestamp", async () => {
  mocks.getClaims.mockResolvedValue({
    data: {
      claims: {
        sub: "actor",
        session_id: "session",
        amr: [{ method: "password", timestamp: 1 }],
      },
    },
    error: null,
  });
  expect((await POST(req())).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("allows verified current-session proof", async () => {
  mocks.getClaims.mockResolvedValue({
    data: {
      claims: {
        sub: "actor",
        session_id: "session",
        amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }],
      },
    },
    error: null,
  });
  expect((await POST(req())).status).toBe(201);
});
it("refuses missing verification without preparing data", async () => {
  mocks.getClaims.mockResolvedValue({
    data: null,
    error: { message: "unavailable" },
  });
  expect((await POST(req())).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
