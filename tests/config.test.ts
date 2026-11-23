import { afterEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { parseConfig, resolveServiceMode } from "../src/lib/config-schema";
import { getConfig } from "../src/lib/config";
import { serviceMode } from "../src/lib/mode";
afterEach(() => vi.unstubAllEnvs());

describe("server configuration", () => {
  it("reports missing settings by name and permits service startup", () => {
    const { diagnostics, supabase, appOrigin } = parseConfig({});
    expect(diagnostics.settings).toHaveLength(3);
    expect(
      diagnostics.settings.every((setting) => setting.reason === "missing"),
    ).toBe(true);
    expect(diagnostics.availability.account).toBe(false);
    expect(supabase).toBeNull();
    expect(appOrigin).toBeNull();
  });

  it.each([
    [{}, "free_beta"],
    [{ SERVICE_MODE: "test_demo" }, "test_demo"],
    [{ ADME_SERVICE_MODE: "test_demo" }, "test_demo"],
    [
      { ADME_SERVICE_MODE: "test_demo", SERVICE_MODE: "test_demo" },
      "test_demo",
    ],
    [
      { ADME_SERVICE_MODE: "test_demo", SERVICE_MODE: "free_beta" },
      "free_beta",
    ],
    [
      { ADME_SERVICE_MODE: "free_beta", SERVICE_MODE: "test_demo" },
      "free_beta",
    ],
    [
      {
        ADME_SERVICE_MODE: "test_demo",
        SERVICE_MODE: "INVALID_PRIVATE_CANARY",
      },
      "free_beta",
    ],
  ])(
    "uses one fail-closed mode in app, legacy helpers and CLI: %j",
    (input, expected) => {
      vi.stubEnv("ADME_SERVICE_MODE", input.ADME_SERVICE_MODE ?? "");
      vi.stubEnv("SERVICE_MODE", input.SERVICE_MODE ?? "");
      vi.stubEnv("ADME_FEATURE_TEST_BILLING", "on");
      const config = getConfig();
      expect(config.serviceMode).toBe(expected);
      expect(serviceMode()).toBe(expected);
      expect(
        parseConfig({ ...input, ADME_FEATURE_TEST_BILLING: "on" }).features
          .testBilling,
      ).toBe(config.features.testBilling);
      const output = execFileSync(
        process.execPath,
        ["scripts/check-config.mjs"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            NEXT_PUBLIC_SUPABASE_URL: "",
            NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
            NEXT_PUBLIC_TOSS_CLIENT_KEY: "",
          },
        },
      );
      expect(JSON.parse(output).availability.testBilling).toBe(
        expected === "free_beta" ? "off" : "missing_prerequisites",
      );
      expect(output).not.toContain("INVALID_PRIVATE_CANARY");
    },
  );

  it("names conflicts/invalid aliases without values and never enables TEST billing", () => {
    expect(
      resolveServiceMode({
        ADME_SERVICE_MODE: "test_demo",
        SERVICE_MODE: "free_beta",
      }).issues,
    ).toEqual([
      { name: "ADME_SERVICE_MODE", reason: "conflict" },
      { name: "SERVICE_MODE", reason: "conflict" },
    ]);
    const result = parseConfig({
      ADME_SERVICE_MODE: "test_demo",
      SERVICE_MODE: "PRIVATE_CANARY",
      ADME_FEATURE_TEST_BILLING: "on",
    });
    expect(result.diagnostics.settings).toContainEqual({
      name: "SERVICE_MODE",
      reason: "invalid",
    });
    expect(result.features.testBilling).toBe("off");
    expect(JSON.stringify(result.diagnostics)).not.toContain("PRIVATE_CANARY");
  });

  it("requires an optional TEST client only when that feature is requested", () => {
    expect(
      parseConfig({}).diagnostics.settings.some(
        (s) => s.name === "NEXT_PUBLIC_TOSS_CLIENT_KEY",
      ),
    ).toBe(false);
    expect(
      parseConfig({
        ADME_SERVICE_MODE: "test_demo",
        ADME_FEATURE_TEST_BILLING: "on",
      }).diagnostics.settings,
    ).toContainEqual({
      name: "NEXT_PUBLIC_TOSS_CLIENT_KEY",
      reason: "missing",
    });
    expect(
      parseConfig({ SUPABASE_SERVICE_ROLE_KEY: "PRIVATE_CANARY" }).diagnostics
        .settings,
    ).toContainEqual({ name: "SUPABASE_SERVICE_ROLE_KEY", reason: "invalid" });
  });

  it.each([
    "https://person:secret@example.org",
    "http://preview.example",
    "https://preview.example/auth",
    "https://preview.example?",
    "https://preview.example/#",
    "https://preview.example\\@other.example",
  ])("rejects unsafe origins %s", (value) => {
    const { appOrigin, diagnostics } = parseConfig({
      NEXT_PUBLIC_APP_URL: value,
    });
    expect(appOrigin).toBeNull();
    expect(diagnostics.settings).toContainEqual({
      name: "NEXT_PUBLIC_APP_URL",
      reason: "invalid",
    });
    expect(JSON.stringify(diagnostics)).not.toContain(value);
  });

  it("accepts only local HTTP outside production and normalizes HTTPS", () => {
    expect(
      parseConfig({ NEXT_PUBLIC_APP_URL: "http://localhost:3000" }).appOrigin,
    ).toBe("http://localhost:3000");
    expect(
      parseConfig({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }).appOrigin,
    ).toBeNull();
    expect(
      parseConfig({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://PREVIEW.example/",
      }).appOrigin,
    ).toBe("https://preview.example");
  });

  it("rejects a live Toss key or secret in a public variable without leaking either", () => {
    const privateValue = ["test", "sk", "synthetic_private_value"].join("_");
    const publicValue = "live_ck_synthetic_live_value";
    const config = parseConfig({
      NEXT_PUBLIC_SUPABASE_URL: "https://database.example",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: privateValue,
      NEXT_PUBLIC_TOSS_CLIENT_KEY: publicValue,
    });
    expect(config.supabase).toBeNull();
    expect(config.testBillingClientKey).toBeNull();
    expect(JSON.stringify(config.diagnostics)).not.toMatch(
      /synthetic|live_ck|test_sk/,
    );
    expect(config.diagnostics.availability.testBilling).toBe("off");
  });

  it("accepts legacy anon JWTs but rejects service role JWTs", () => {
    const exampleJwt = (role: string) => {
      const payload = Buffer.from(JSON.stringify({ role })).toString(
        "base64url",
      );
      return `header.${payload}.signature`;
    };
    const withKey = (key: string) =>
      parseConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://database.example/",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: key,
      });
    expect(withKey(exampleJwt("anon")).supabase?.url).toBe(
      "https://database.example",
    );
    expect(withKey(exampleJwt("service_role")).supabase).toBeNull();
    expect(withKey("sb_publishable_fixture").supabase).not.toBeNull();
  });
});
