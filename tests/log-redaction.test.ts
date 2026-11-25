// D078: server log fields never carry credentials. Fake values are assembled at runtime so the repository
// itself stays clean for harness/secret_scan.py.
import { afterEach, describe, expect, it, vi } from "vitest";
import { log, mask } from "../src/lib/observability";
import { logApiFailure } from "../src/shared/server/logging";

const join = (...parts: string[]) => parts.join("");
const fake = {
  github: join("gh", "p_", "A".repeat(36)),
  vercel: join("vercel", "_", "B".repeat(24)),
  bearer: join("Bearer ", "opaque", "C".repeat(30)),
  pem: join("-----BEGIN ", "PRIVATE KEY-----\nMIIE", "D".repeat(40)),
  dbUrl: join(
    "postgres",
    "ql://postgres:",
    "S3cretPassw0rd",
    "@db.example.co:5432/postgres",
  ),
  slack: join(
    "https://hooks.slack.com/services/",
    "T000/B000/",
    "E".repeat(24),
  ),
  discord: join("https://discord.com/api/webhooks/", "123456/", "F".repeat(40)),
  anthropic: join("sk-", "ant-", "G".repeat(32)),
  envValue: join("server-only-", "H".repeat(24)),
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("D078 log redaction", () => {
  it("masks provider tokens, private keys, DB passwords and webhook URLs inside strings", () => {
    const out = JSON.stringify(
      mask({ detail: Object.values(fake).slice(0, -1).join(" | ") }),
    );
    for (const [name, value] of Object.entries(fake).slice(0, -1))
      expect(out, name).not.toContain(
        name === "dbUrl" ? "S3cretPassw0rd" : value.slice(-20),
      );
  });

  it("redacts credential-named fields regardless of casing style", () => {
    const out = JSON.stringify(
      mask({
        serviceRoleKey: "v1",
        service_role_key: "v2",
        SUPABASE_SERVICE_ROLE_KEY: "v3",
        clientKey: "v4",
        credentials: "v5",
        privateKey: "v6",
        connectionString: "v7",
        jwt: "v8",
        key: "alert-dedupe-key",
      }),
    );
    for (const v of ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8"])
      expect(out).not.toContain(`"${v}"`);
    // Generic `key` fields (alert dedupe keys) remain readable.
    expect(out).toContain("alert-dedupe-key");
  });

  it("does not emit unmasked objects nested beyond the depth limit", () => {
    const deep = {
      a: {
        b: { c: { d: { e: { f: { password: "p", note: fake.github } } } } },
      },
    };
    const out = JSON.stringify(mask(deep));
    expect(out).not.toContain(fake.github);
    expect(out).not.toContain('"password":"p"');
    expect(out).toContain("[truncated]");
  });

  it("masks literal values of configured server-only variables", () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", fake.envValue);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000/public-value");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const line = log("error", "x", {
      detail: `failed posting to ${fake.envValue} from http://localhost:3000/public-value`,
    });
    expect(line).not.toContain(fake.envValue);
    expect(line).toContain("[server-env]");
    expect(line).toContain("public-value");
  });

  it("api failure logs keep the established shape and mask the operation label", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logApiFailure(`example.post ${fake.github}`, "INTERNAL_ERROR", "rid", 3.4);
    expect(spy).toHaveBeenCalledOnce();
    const [event, fields] = spy.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(event).toBe("api_error");
    expect(fields).toMatchObject({
      requestId: "rid",
      domain: "example",
      errorCode: "INTERNAL_ERROR",
      duration: 3,
      retryable: false,
    });
    expect(JSON.stringify(spy.mock.calls)).not.toContain(fake.github);
  });
});
