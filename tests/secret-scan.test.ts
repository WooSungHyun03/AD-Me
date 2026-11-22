// D078: the scanner catches secrets in untracked files, Playwright traces (zip), evidence and logs, flags
// authenticated traces in evidence, and never prints the secret itself. Fake values are built at runtime.
import { afterAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
const run = (...args: string[]) => {
  try {
    return {
      code: 0,
      out: execFileSync("python3", [
        "harness/secret_scan.py",
        ...args,
      ]).toString(),
    };
  } catch (e) {
    const err = e as { status: number; stdout: Buffer };
    return { code: err.status, out: err.stdout.toString() };
  }
};
const fakeToss = ["test", "sk", "Q".repeat(24)].join("_");
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fakeServiceJwt = `${b64({ alg: "HS256" })}.${b64({ role: ["service", "role"].join("_") })}.sig`;
// Minimal stored-entry zip (what a Playwright trace is) holding a network log line.
function zip(name: string, content: string) {
  const data = Buffer.from(content);
  const n = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  const crc = crc32(data);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(n.length, 28);
  const localPart = Buffer.concat([local, n, data]);
  const centralPart = Buffer.concat([central, n]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralPart.length, 12);
  end.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, end]);
}
function crc32(b: Buffer) {
  let c = ~0;
  for (const x of b) {
    c ^= x;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
const created = [
  "test-results/d078-fake",
  "harness/evidence/D078-fake",
  "d078-untracked.txt",
  "test-results/d078.log",
];
afterAll(() =>
  created.forEach((p) => rmSync(p, { recursive: true, force: true })),
);

describe("D078 secret scanner", () => {
  it("passes on the clean repository", () => {
    expect(run().code).toBe(0);
  });
  it("catches an untracked (about to be committed) file without printing the value", () => {
    writeFileSync("d078-untracked.txt", `TOSS=${fakeToss}\n`);
    const r = run();
    expect(r.code).toBe(1);
    expect(r.out).toContain("d078-untracked.txt: toss secret key");
    expect(r.out).not.toContain(fakeToss);
    rmSync("d078-untracked.txt");
  });
  it("catches service-role tokens and server env values inside trace zips; flags traces in evidence", () => {
    mkdirSync("test-results/d078-fake", { recursive: true });
    const env = existsSync(".env.local")
      ? readFileSync(".env.local", "utf8")
      : ""; // CI has no .env.local
    const serverValue = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1];
    writeFileSync(
      "test-results/d078-fake/trace.zip",
      zip(
        "trace.network",
        `authorization: Bearer ${fakeServiceJwt}\n${serverValue ?? ""}`,
      ),
    );
    mkdirSync("harness/evidence/D078-fake", { recursive: true });
    writeFileSync(
      "harness/evidence/D078-fake/trace.zip",
      zip("x", "nothing secret"),
    );
    const r = run("--artifacts");
    expect(r.code).toBe(1);
    expect(r.out).toContain("trace.zip!trace.network: service-role JWT");
    if (serverValue)
      expect(r.out).toContain("value of server-only SUPABASE_SERVICE_ROLE_KEY");
    expect(r.out).toContain(
      "harness/evidence/D078-fake/trace.zip: trace/storage state in evidence",
    );
    expect(r.out).not.toContain(fakeServiceJwt);
    if (serverValue) expect(r.out).not.toContain(serverValue);
  });
  it("scans logs", () => {
    writeFileSync(
      "test-results/d078.log",
      `error while calling with key ${fakeToss}`,
    );
    const r = run("--logs", "test-results/d078.log");
    expect(r.code).toBe(1);
    expect(r.out).toContain("toss secret key");
  });
  it("key status shows names and fingerprints only", () => {
    const out = run("--keys").out;
    expect(out).toMatch(
      /SUPABASE_SERVICE_ROLE_KEY: (absent|present len=\d+ sha256=[0-9a-f]{8})/,
    );
    const env = existsSync(".env.local")
      ? readFileSync(".env.local", "utf8")
      : ""; // CI has no .env.local
    const v = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1];
    if (v) expect(out).not.toContain(v);
  });
  it("private files are ignored by git", () => {
    for (const f of [
      ".env.local",
      ".accounts.local.json",
      ".vercel/project.json",
      "test-results/x.zip",
    ])
      expect(
        execFileSync("git", ["check-ignore", "-q", f, "--no-index"]).toString(),
      ).toBe("");
    expect(existsSync(".gitignore")).toBe(true);
  });
});
