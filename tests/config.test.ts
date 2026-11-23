import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/lib/config-schema";

describe("server configuration", () => {
  it("reports missing settings by name and permits service startup", () => {
    const { diagnostics, supabase, appOrigin } = parseConfig({});
    expect(diagnostics.settings).toHaveLength(4);
    expect(
      diagnostics.settings.every((setting) => setting.reason === "missing"),
    ).toBe(true);
    expect(diagnostics.availability.account).toBe(false);
    expect(supabase).toBeNull();
    expect(appOrigin).toBeNull();
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
