import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
// The deploy script is also run directly by Vercel with Node.js.
import {
  checkProductionSchema,
  migrationFingerprint,
} from "../scripts/production-schema.mjs";

const fingerprint = migrationFingerprint();
const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const production = { VERCEL: "1", VERCEL_ENV: "production" };

test("main deploys through the database gate before the app build", () => {
  expect(config.git.deploymentEnabled).toEqual({
    main: true,
    "codex/dev-a-p0-continue": false,
  });
  expect(config.buildCommand).toBe(
    "node scripts/production-schema.mjs && npm run build",
  );
});

test("production fails closed without the approved fingerprint for the SQL files", () => {
  expect(() => checkProductionSchema(production)).toThrow(/not been verified/);
  expect(() =>
    checkProductionSchema({
      ...production,
      ADME_PRODUCTION_SCHEMA_SHA256: "0".repeat(64),
    }),
  ).toThrow(/not been verified/);
  expect(() =>
    checkProductionSchema({
      ...production,
      ADME_PRODUCTION_SCHEMA_SHA256: fingerprint,
    }),
  ).not.toThrow();
});

test("preview and local builds can run independently, and an unknown Vercel target fails closed", () => {
  expect(() => checkProductionSchema({})).not.toThrow();
  expect(() =>
    checkProductionSchema({ VERCEL: "1", VERCEL_ENV: "preview" }),
  ).not.toThrow();
  expect(() => checkProductionSchema({ VERCEL: "1" })).toThrow(
    /could not be identified/,
  );
});

test("an approved database fingerprint is invalidated by a migration edit or addition", () => {
  const directory = mkdtempSync(join(tmpdir(), "adme-release-test-"));
  try {
    const first = join(directory, "202611240001_first.sql");
    writeFileSync(first, "select 1;");
    const approved = migrationFingerprint(directory);
    const env = { ...production, ADME_PRODUCTION_SCHEMA_SHA256: approved };
    expect(() => checkProductionSchema(env, directory)).not.toThrow();
    writeFileSync(first, "select 2;");
    expect(() => checkProductionSchema(env, directory)).toThrow(
      /not been verified/,
    );
    writeFileSync(first, "select 1;");
    writeFileSync(join(directory, "202611240002_second.sql"), "select 3;");
    expect(() => checkProductionSchema(env, directory)).toThrow(
      /not been verified/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
