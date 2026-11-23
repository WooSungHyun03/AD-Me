import { afterEach, describe, expect, it, vi } from "vitest";
import { parseConfig } from "@/lib/config-schema";
import { POST as createOrder } from "@/app/api/billing/orders/route";
import { POST as confirmOrder } from "@/app/api/billing/confirm/route";
import { allowsTestPayment } from "../supabase/functions/payment-confirm/feature";

const config = {
  NEXT_PUBLIC_APP_URL: "https://preview.example",
  NEXT_PUBLIC_SUPABASE_URL: "https://database.example",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_fixture",
  NEXT_PUBLIC_TOSS_CLIENT_KEY: "test_ck_fixture",
};

afterEach(() => vi.unstubAllEnvs());

describe("feature gates", () => {
  it("requires TEST mode and an explicit flag plus valid configuration", () => {
    expect(
      parseConfig({ ...config, ADME_FEATURE_TEST_BILLING: "on" })
        .testBillingClientKey,
    ).toBeNull();
    const test = {
      ...config,
      ADME_SERVICE_MODE: "test_demo",
      ADME_FEATURE_TEST_BILLING: "on",
    };
    expect(parseConfig(test).testBillingClientKey).toBe(
      config.NEXT_PUBLIC_TOSS_CLIENT_KEY,
    );
    expect(
      parseConfig({ ...test, ADME_SERVICE_MODE: "unrecognized" }).features
        .testBilling,
    ).toBe("off");
    expect(
      parseConfig({ ...test, NEXT_PUBLIC_TOSS_CLIENT_KEY: "live_ck_fixture" })
        .features.testBilling,
    ).toBe("missing_prerequisites");
  });

  it("exposes implemented queue adapters only with explicit flags and database config", () => {
    const { features } = parseConfig({
      ...config,
      ADME_FEATURE_INGESTION: "on",
      ADME_FEATURE_LLM: "on",
      ADME_FEATURE_MAIL: "on",
    });
    expect(features).toMatchObject({
      ingestion: "enabled",
      llm: "enabled",
      mail: "enabled",
      testBilling: "off",
    });
    expect(
      parseConfig({ ADME_FEATURE_INGESTION: "on", ADME_FEATURE_LLM: "on" })
        .features,
    ).toMatchObject({
      ingestion: "missing_prerequisites",
      llm: "missing_prerequisites",
    });
  });

  it.each([createOrder, confirmOrder])(
    "rejects direct billing requests while disabled",
    async (handler) => {
      vi.stubEnv("ADME_SERVICE_MODE", "free_beta");
      vi.stubEnv("ADME_FEATURE_TEST_BILLING", "on");
      const res = await handler(
        new Request("https://preview.example/api/billing", {
          method: "POST",
          body: "{}",
        }),
      );
      expect(res.status).toBe(404);
      expect((await res.json()).error.code).toBe("NOT_FOUND");
    },
  );

  it("requires the isolated TEST gate in the direct Edge Function", () => {
    expect(allowsTestPayment("free_beta", "on")).toBe(false);
    expect(allowsTestPayment("test_demo", undefined)).toBe(false);
    expect(allowsTestPayment("test_demo", "ON")).toBe(false);
    expect(allowsTestPayment("test_demo", "on")).toBe(true);
  });
});
