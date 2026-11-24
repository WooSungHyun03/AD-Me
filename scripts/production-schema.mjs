import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const migrations = new URL("../supabase/migrations/", import.meta.url);
const unverifiedSchema = "ADME_UNVERIFIED_SCHEMA";

/** @param {URL | string} [directory] */
export function migrationFingerprint(directory = migrations) {
  const entries = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.name.endsWith(".sql"))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (!entries.length || entries.some((entry) => !entry.isFile())) {
    throw new Error("Expected regular SQL migration files");
  }
  const manifest = createHash("sha256");
  for (const entry of entries) {
    const file =
      directory instanceof URL
        ? new URL(entry.name, directory)
        : join(directory, entry.name);
    // Git's Windows checkout converts LF to CRLF. Match the committed SQL on
    // every host, retaining BOM/other bytes and rejecting invalid UTF-8.
    const sql = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
      .decode(readFileSync(file))
      .replace(/\r\n/g, "\n");
    const fingerprint = createHash("sha256").update(sql, "utf8").digest("hex");
    manifest.update(`${entry.name}\0${fingerprint}\n`);
  }
  return manifest.digest("hex");
}

/**
 * @param {Readonly<Record<string, string | undefined>>} [env]
 * @param {URL | string} [directory]
 */
export function checkProductionSchema(
  env = process.env,
  directory = migrations,
) {
  if (env.VERCEL !== "1" && !env.VERCEL_ENV && !env.VERCEL_TARGET_ENV) return;
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") {
    if (env.VERCEL_TARGET_ENV !== "production") return;
  } else if (
    env.VERCEL_ENV !== "production" &&
    env.VERCEL_TARGET_ENV !== "production"
  ) {
    throw new Error("Vercel build environment could not be identified");
  }

  const approved = env.ADME_PRODUCTION_SCHEMA_SHA256;
  if (
    !/^[a-f0-9]{64}$/.test(approved ?? "") ||
    approved !== migrationFingerprint(directory)
  ) {
    throw Object.assign(
      new Error(
        "Production release blocked: the migration fingerprint has not been verified against production. See docs/production-readiness/RELEASE_CHECKLIST.md.",
      ),
      { code: unverifiedSchema },
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const ignoredBuildStep = process.argv[2] === "--ignore-unapproved";
  try {
    if (process.argv[2] === "--fingerprint")
      console.log(migrationFingerprint());
    else checkProductionSchema();
    // Vercel's Ignored Build Step continues on 1 and stops on 0.
    if (ignoredBuildStep) process.exitCode = 1;
  } catch (error) {
    if (ignoredBuildStep && error.code === unverifiedSchema) {
      console.log(`Production build skipped: ${error.message}`);
    } else {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
