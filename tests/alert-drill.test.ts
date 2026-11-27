import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

// D086: the operator alert drill sends one labelled message through alert() and never reveals the webhook URL.
const run = (env: Record<string, string | undefined>) =>
  new Promise<{ code: number; out: string }>((resolve) => {
    execFile(
      process.execPath,
      ["scripts/alert-drill.mjs", "--env", "does-not-exist.env"],
      {
        env: {
          NODE_ENV: "test",
          PATH: process.env.PATH,
          SystemRoot: process.env.SystemRoot,
          ...env,
        },
        encoding: "utf8",
      },
      (error, stdout, stderr) =>
        resolve({
          code: error ? Number(error.code) : 0,
          out: stdout + stderr,
        }),
    );
  });

describe("D086 alert drill", () => {
  it("delivers one [DRILL] message and keeps the webhook path out of its output", async () => {
    const bodies: string[] = [];
    const server = createServer((req, res) => {
      let b = "";
      req.on("data", (c) => (b += c));
      req.on("end", () => {
        bodies.push(b);
        res.writeHead(200).end("ok");
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;
    const secretPath = "/hook/T000-SECRETPATHVALUE-0001";
    try {
      const r = await run({
        ALERT_WEBHOOK_URL: `http://127.0.0.1:${port}${secretPath}`,
        SERVICE_MODE: "test_demo",
      });
      expect(r.code).toBe(0);
      expect(bodies).toHaveLength(1);
      const text = JSON.parse(bodies[0]).text as string;
      expect(text).toMatch(/^\[AD Me test_demo\] \[DRILL\] /);
      expect(text).toContain("실제 장애가 아닙니다");
      expect(r.out).toContain('"result": "sent"');
      expect(r.out).toContain('"channel": "local"');
      expect(r.out).not.toContain("SECRETPATHVALUE");
      expect(r.out).not.toContain(String(port));
    } finally {
      server.close();
    }
  });

  it("reports not_configured (exit 2) without a usable URL and failed (exit 3) on a refused delivery", async () => {
    expect((await run({})).code).toBe(2);
    expect(
      (await run({ ALERT_WEBHOOK_URL: "http://example.com/hook" })).code,
    ).toBe(2);
    const server = createServer((_q, res) => res.writeHead(500).end());
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as AddressInfo;
    try {
      const r = await run({ ALERT_WEBHOOK_URL: `http://127.0.0.1:${port}/x` });
      expect(r.code).toBe(3);
      expect(r.out).toContain('"result": "failed"');
    } finally {
      server.close();
    }
  });
});
