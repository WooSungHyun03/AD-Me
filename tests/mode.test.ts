import { describe, it, expect, afterEach, vi } from "vitest";
import { serviceMode } from "../src/lib/mode";
import { publicCreators } from "../src/lib/data";
import { POST as order } from "../src/app/api/billing/orders/route";
import { POST as confirm } from "../src/app/api/billing/confirm/route";

const post = () =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { origin: "http://localhost", host: "localhost" },
    body: JSON.stringify({ sku: "brand_pro" }),
  });

describe("D001/D005 service mode", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("fails closed to free_beta for anything but explicit test_demo", () => {
    expect(serviceMode(undefined)).toBe("free_beta");
    expect(serviceMode("")).toBe("free_beta");
    expect(serviceMode("TEST_DEMO")).toBe("free_beta");
    expect(serviceMode("test_demo")).toBe("test_demo");
  });
  it("free_beta without DB reports a connection error, not 48 fictional creators", async () => {
    vi.stubEnv("SERVICE_MODE", "free_beta");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    await expect(publicCreators()).rejects.toThrow();
  });
  it("test_demo without DB serves only labeled demo fixtures", async () => {
    vi.stubEnv("SERVICE_MODE", "test_demo");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const list = await publicCreators();
    expect(list.length).toBe(48);
    expect(list.every((c) => c.is_demo)).toBe(true);
  });
  it("free_beta refuses purchase and confirmation before auth or DB", async () => {
    vi.stubEnv("SERVICE_MODE", "free_beta");
    for (const route of [order, confirm]) {
      const res = await route(post());
      expect(res.status).toBe(403);
    }
  });
});
