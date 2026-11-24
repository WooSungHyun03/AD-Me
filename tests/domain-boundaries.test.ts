import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "vitest";

function inspect(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "adme-domain-boundaries-"));
  try {
    for (const [name, content] of Object.entries(files)) {
      const file = join(root, "src", name);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
    const result = spawnSync(
      process.execPath,
      [resolve("scripts/check-domain-boundaries.mjs"), root],
      { encoding: "utf8" },
    );
    if (result.error) throw result.error;
    return { status: result.status, report: JSON.parse(result.stdout) };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("the CLI detects indirect client secrets, private domain imports and route DB access on native paths", () => {
  const { status, report } = inspect({
    "components/client.ts": '"use client";import {db} from "@/lib/barrel";',
    "lib/barrel.ts": 'export {db} from "./supabase";',
    "lib/supabase.ts": 'import "server-only";export const db=1;',
    "app/api/example/route.ts": 'import {db} from "@/lib/supabase";',
    "shared/invalid.ts": 'import {a} from "@/domains/one/internal";',
    "domains/one/internal.ts":
      'import {b} from "../two/internal";export const a=1;',
    "domains/two/internal.ts":
      'import {a} from "../one/internal";export const b=1;',
  });
  expect(status).toBe(1);
  expect(report.directDatabaseRoutes).toEqual(["app/api/example/route.ts"]);
  expect(report.violations).toContain(
    "Client components/client.ts reaches server-only lib/supabase.ts",
  );
  expect(report.violations).toContain(
    "shared/invalid.ts imports domain domains/one/internal.ts",
  );
  expect(report.violations).toContain(
    "domains/one/internal.ts imports domain internals domains/two/internal.ts",
  );
  expect(
    report.violations.some((v: string) => v.startsWith("Runtime cycle ")),
  ).toBe(true);
});

test("the CLI preserves valid server-action and type-only client boundaries", () => {
  const { status, report } = inspect({
    "components/client.ts":
      '"use client";import {save} from "@/app/actions";import type {Row} from "@/lib/db.server";',
    "app/actions.ts":
      '"use server";import {db} from "@/lib/db.server";export async function save(){}',
    "lib/db.server.ts":
      'import "server-only";export const db=1;export type Row={id:string};',
  });
  expect(status).toBe(0);
  expect(report.violations).toEqual([]);
  expect(report.cycles).toEqual([]);
});
