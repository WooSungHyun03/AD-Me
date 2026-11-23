import {
  readFileSync,
  readdirSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  realpathSync,
} from "node:fs";
import { resolve, dirname, relative, sep } from "node:path";
import { createHash } from "node:crypto";
import { platform } from "node:os";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";
const args = process.argv.slice(2),
  value = (name) => args[args.indexOf(name) + 1],
  output = value("--output");
assert.ok(
  args.includes("--output") && output && !existsSync(output),
  "Choose a new evidence file",
);
const root = process.cwd(),
  manifest = JSON.parse(
    readFileSync("docs/licenses/20261121-shipping/manifest.json", "utf8"),
  ),
  sha = (b) => createHash("sha256").update(b).digest("hex"),
  notice = readFileSync(manifest.shipped_path);
assert.equal(sha(notice), manifest.sha256);
assert.equal(
  sha(
    Buffer.from(
      readFileSync("package-lock.json", "utf8").replaceAll("\r\n", "\n"),
    ),
  ),
  manifest.lockfile_sha256_lf,
);
for (const s of manifest.sources)
  assert.equal(
    sha(Buffer.from(readFileSync(s.path, "utf8").replaceAll("\r\n", "\n"))),
    s.sha256_lf,
  );
const supplementManifest = JSON.parse(
  readFileSync("docs/licenses/20261122-supplement/manifest.json", "utf8"),
);
const supplement = readFileSync(supplementManifest.shipped_path);
assert.equal(sha(supplement), supplementManifest.sha256);
assert.equal(
  supplementManifest.lockfile_sha256_lf,
  manifest.lockfile_sha256_lf,
);
const supplementInventoryText = readFileSync(
  "docs/licenses/20261122-supplement/inventory.json",
  "utf8",
).replaceAll("\r\n", "\n");
assert.equal(
  sha(Buffer.from(supplementInventoryText)),
  supplementManifest.inventory_sha256_lf,
);
const supplementalIndex = new Map(
  JSON.parse(supplementInventoryText).map((r) => [r.path, r]),
);
function csv(text) {
  const rows = [];
  let row = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
const [headers, ...data] = csv(
    readFileSync("docs/licenses/20261121/dependencies.csv", "utf8"),
  ),
  index = Object.fromEntries(
    data.map((r) => [
      r[headers.indexOf("lock_path")],
      Object.fromEntries(headers.map((h, i) => [h, r[i]])),
    ]),
  );
const lock = JSON.parse(readFileSync("package-lock.json", "utf8")),
  packages = new Map(),
  traces = [];
let outside = 0;
function walk(folder) {
  for (const f of readdirSync(folder, { withFileTypes: true })) {
    if (f.name === "cache") continue;
    const p = resolve(folder, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith(".nft.json")) traces.push(p);
  }
}
walk(".next");
assert.ok(traces.length > 0, "Production build trace required");
for (const trace of traces)
  for (const file of JSON.parse(readFileSync(trace, "utf8")).files ?? []) {
    const path = relative(root, realpathSync(resolve(dirname(trace), file)))
      .split(sep)
      .join("/");
    if (path.startsWith("../")) {
      outside++;
      continue;
    }
    assert.ok(
      !/(^|\/)(\.env(?:\.|$)|\.accounts\.)/.test(path),
      "Sensitive traced file",
    );
    const match = path.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)(?:\/|$)/);
    if (!match) continue;
    const key = match[1],
      entry = lock.packages[key];
    assert.ok(entry, "Unpinned traced package: " + key);
    if (packages.has(key)) continue;
    const actual = JSON.parse(
      readFileSync(resolve(key, "package.json"), "utf8"),
    );
    assert.equal(actual.version, entry.version, key);
    const r = index[key];
    assert.ok(r, key);
    packages.set(key, {
      path: key,
      version: entry.version,
      review: r.review,
      license: r.license,
      supplemental_material: supplementalIndex.has(key)
        ? (() => {
            const item = supplementalIndex.get(key);
            assert.equal(item.version, entry.version);
            assert.equal(item.package_metadata_verified, true);
            assert.equal(
              item.archive_integrity,
              lock.packages[item.carrier]?.integrity,
            );
            assert.equal(item.source, lock.packages[item.carrier]?.resolved);
            assert.equal(item.notice_complete, false);
            return {
              review: item.review,
              declared_license: item.declared_license,
              carrier: item.carrier,
              exact_archive_verified: true,
              materials: item.files.map((f) => f.kind),
              notice_complete: false,
            };
          })()
        : null,
    });
  }
let http = false;
if (args.includes("--probe")) {
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3217",
    ],
    { stdio: "ignore" },
  );
  try {
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        const r = await fetch(
          "http://127.0.0.1:3217/legal/third-party-notices.txt",
        );
        if (r.ok) {
          assert.equal(
            sha(Buffer.from(await r.arrayBuffer())),
            manifest.sha256,
          );
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(ready, "Local notice HTTP probe failed");
    const extra = await fetch(
      "http://127.0.0.1:3217/legal/third-party-supplement-20261122.txt",
    );
    assert.ok(extra.ok);
    assert.equal(
      sha(Buffer.from(await extra.arrayBuffer())),
      supplementManifest.sha256,
    );
    const page = await fetch("http://127.0.0.1:3217/licenses");
    assert.ok(page.ok && (await page.text()).includes("오픈소스 고지"));
    http = true;
  } finally {
    child.kill();
  }
}
const rows = [...packages.values()].sort((a, b) =>
    a.path.localeCompare(b.path),
  ),
  gaps = rows.filter(
    (r) =>
      !["EXACT_INSTALLED_NOTICES", "EXACT_ARCHIVE_NOTICES"].includes(r.review),
  );
const result = {
  at: new Date().toISOString(),
  result: gaps.length
    ? "INVENTORY_VERIFIED_WITH_NOTICE_GAPS"
    : "INVENTORY_VERIFIED",
  target: args.includes("--target") ? value("--target") : platform(),
  node: process.version,
  trace_files: traces.length,
  traced_packages: rows.length,
  unresolved_runtime_packages: gaps,
  package_versions_match_lock: true,
  known_notice_file_sha256: manifest.sha256,
  supplemental_material_sha256: supplementManifest.sha256,
  supplemental_material_bytes: supplement.length,
  runtime_with_exact_archive_disclosure: rows.filter((r) =>
    r.supplemental_material?.materials.includes("README_LICENSING_DISCLOSURE"),
  ).length,
  supplemental_material_does_not_close_notice_or_source_obligations: true,
  notice_bytes: notice.length,
  source_documents_unchanged: true,
  http_notice_and_korean_page_verified: http,
  outside_workspace_trace_paths: outside,
  rights_approval: false,
  packages: rows,
  scope:
    "Actual target production trace and shipped known notices; unresolved notices and supplied logo/content rights remain release blockers. Not a blanket licensing approval.",
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(result, null, 2) + "\n");
console.log(
  JSON.stringify({
    result: result.result,
    target: result.target,
    traced_packages: rows.length,
    notice_gaps: gaps.length,
    http,
  }),
);
