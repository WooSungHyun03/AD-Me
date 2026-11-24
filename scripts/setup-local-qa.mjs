// Developer-only isolated infrastructure. Never connects to a linked/hosted project.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  copyFileSync,
  readdirSync,
} from "node:fs";
import { resolve } from "node:path";
const workdir = "output/dev-a-db";
mkdirSync(workdir, { recursive: true });
const log = `${workdir}/setup.local.log`;
function cli(args) {
  if (!/^[a-z0-9 /.,@:_=-]+$/i.test(args))
    throw new Error("Unexpected local CLI arguments");
  const command = `npm exec --yes --package=supabase@3.2.0 -- supabase ${args}`;
  const result =
    process.platform === "win32"
      ? spawnSync(
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", command],
          { encoding: "utf8" },
        )
      : spawnSync(
          "npm",
          [
            "exec",
            "--yes",
            "--package=supabase@3.2.0",
            "--",
            "supabase",
            ...args.split(" "),
          ],
          { encoding: "utf8" },
        );
  appendFileSync(
    log,
    `\n${command}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  );
  if (result.status !== 0)
    throw new Error(
      `Local Supabase step failed. Inspect ignored ${log}; do not publish its credential material.`,
    );
  return result.stdout;
}
const configPath = `${workdir}/supabase/config.toml`;
const markerPath = `${workdir}/.adme-generated-qa`;
if (!existsSync(configPath)) {
  cli(`init --workdir ${workdir} --yes`);
  writeFileSync(markerPath, "DEV-A fictional isolated QA only\n");
} else if (!existsSync(markerPath)) {
  throw new Error(
    "Existing unmarked local project preserved. Refusing to reset it.",
  );
}
let config = readFileSync(configPath, "utf8").replace(/^\uFEFF/, "");
if (!/^project_id = "dev-a-db"$/m.test(config))
  throw new Error("Unexpected local project ID");
cli(`stop --workdir ${workdir}`);
config = config
  .replace(/^site_url = .*$/m, 'site_url = "https://127.0.0.1:3143"')
  .replace(
    /^additional_redirect_urls = .*$/m,
    'additional_redirect_urls = ["https://127.0.0.1:3143/auth/confirm"]',
  )
  .replace(/^email_sent = \d+$/m, "email_sent = 1000")
  .replace(
    /(\[auth\.email\][\s\S]*?)enable_confirmations = false/,
    "$1enable_confirmations = true",
  )
  .replace(
    /(\[auth\.mfa\.totp\][\s\S]*?)enroll_enabled = false/,
    "$1enroll_enabled = true",
  )
  .replace(
    /(\[auth\.mfa\.totp\][\s\S]*?)verify_enabled = false/,
    "$1verify_enabled = true",
  );
// Local Mailpit is an inbox sink; this does not alter hosted SMTP or abuse limits.
if (!/^\[auth.email.template.confirmation\]$/m.test(config))
  config += `\n[auth.email.template.confirmation]\nsubject = "AD Me local confirmation"\ncontent_path = "./supabase/templates/confirmation.html"\n\n[auth.email.template.recovery]\nsubject = "AD Me local recovery"\ncontent_path = "./supabase/templates/recovery.html"\n`;
if (!/^\[auth.email.template.email_change\]$/m.test(config))
  config += `\n[auth.email.template.email_change]\nsubject = "AD Me local email change"\ncontent_path = "./supabase/templates/email_change.html"\n`;
writeFileSync(configPath, config);
for (const directory of ["migrations", "templates"]) {
  mkdirSync(`${workdir}/supabase/${directory}`, { recursive: true });
  for (const name of readdirSync(`supabase/${directory}`))
    copyFileSync(
      `supabase/${directory}/${name}`,
      `${workdir}/supabase/${directory}/${name}`,
    );
}
copyFileSync("supabase/seed.sql", `${workdir}/supabase/seed.sql`);
cli(
  `start --workdir ${workdir} -x realtime,imgproxy,postgres-meta,studio,edge-runtime,logflare,vector,supavisor`,
);
cli(`db reset --local --workdir ${workdir} --yes`);
const status = cli(`status --workdir ${workdir} --output json`);
writeFileSync(`${workdir}/runtime.local.json`, status);
const openssl =
  process.platform === "win32" &&
  existsSync("C:/Program Files/Git/usr/bin/openssl.exe")
    ? "C:/Program Files/Git/usr/bin/openssl.exe"
    : "openssl";
const tls = spawnSync(
  openssl,
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    `${workdir}/tls.local.key`,
    "-out",
    `${workdir}/tls.local.crt`,
    "-subj",
    "/CN=localhost",
    "-addext",
    "subjectAltName=DNS:localhost,IP:127.0.0.1",
    "-days",
    "2",
  ],
  { encoding: "utf8" },
);
appendFileSync(log, tls.stderr ?? "");
if (tls.status !== 0)
  throw new Error(
    "Local TLS certificate generation failed; developer must resolve OpenSSL locally.",
  );
const fixtures = spawnSync(process.execPath, ["scripts/prepare-local-qa.mjs"], {
  encoding: "utf8",
});
appendFileSync(log, fixtures.stdout ?? "");
if (fixtures.status !== 0)
  throw new Error(
    "Local QA fixture preparation failed. No hosted account was accessed.",
  );
console.log(
  `Prepared isolated local Supabase, ${readdirSync("supabase/migrations").filter((name) => name.endsWith(".sql")).length} local migrations, Mailpit and TLS. Private runtime files remain under ${resolve(workdir)}.`,
);
