import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  requireAdminContext: vi.fn(),
  probe: vi.fn(),
  details: vi.fn(),
  alert: vi.fn(),
}));
vi.mock("@/lib/admin", () => ({
  requireAdminContext: dependencies.requireAdminContext,
}));
vi.mock("@/lib/health", () => ({
  details: dependencies.details,
  probe: dependencies.probe,
}));
vi.mock("@/lib/observability", () => ({ alert: dependencies.alert }));
vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/health/route";

describe("health diagnostics access", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns public uptime only when an admin's MFA has expired", async () => {
    dependencies.requireAdminContext.mockRejectedValue(
      new Error("MFA expired"),
    );
    dependencies.probe.mockResolvedValue({ ok: true, ms: 2 });

    const result = await GET(new Request("http://localhost/api/health"));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ status: "ok" });
    expect(dependencies.details).not.toHaveBeenCalled();
  });

  it("returns diagnostics for a session that passes the existing admin gate", async () => {
    const db = {};
    dependencies.requireAdminContext.mockResolvedValue({ db });
    dependencies.details.mockResolvedValue({ status: "ok", usage: [] });

    const result = await GET(new Request("http://localhost/api/health"));
    expect(await result.json()).toEqual({ status: "ok", usage: [] });
    expect(dependencies.details).toHaveBeenCalledExactlyOnceWith(db);
  });
});
