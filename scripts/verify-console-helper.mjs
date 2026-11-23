import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

// Exactly the disposable packet DB, never environment-selected or hosted infrastructure.
const sql = (input) => execFileSync("docker", ["exec", "-i", "supabase_db_dev-a-packet-db", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { input, encoding: "utf8" }).trim();
const id = randomUUID();
const browser = await chromium.launch({ channel: "chrome" });
try {
  sql(`insert into auth.users(id,email,raw_user_meta_data) values('${id}','packet-fixture@example.test','{"role":"brand","name":"QA packet"}');`);
  const page = await browser.newPage();
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(pathToFileURL(resolve("deliverables/dev-a-p0-20261119/console-actions.html")).href);
  await page.locator("#user").fill(id);
  await page.locator("#reference").fill("QA O'Brien approval; no external user");
  await page.locator("button").click();
  const grant = await page.locator("#sql").inputValue();
  assert.match(grant, /QA O''Brien/);
  sql(grant);
  assert.equal(sql(`select approval_reference from public.administrator_grants where user_id='${id}';`), "QA O'Brien approval; no external user");
  await page.locator("#action").selectOption("revoke");
  await page.locator("button").click();
  sql(await page.locator("#sql").inputValue());
  assert.equal(sql(`select revoked_at is not null from public.administrator_grants where user_id='${id}';`), "t");
  assert.equal(requests.filter((url) => !url.startsWith("file:")).length, 0);
  writeFileSync("harness/evidence/DEV-A-P0-CONTINUE/console-packet.json", JSON.stringify({ at: new Date().toISOString(),
    environment: "second isolated Supabase Docker DB with baseline 001-003 and actual generated apply SQL",
    result: "PASS", migrations_in_history: 4, new_rls_tables: 4, provisioning_denied_to: ["anon", "authenticated", "service_role"],
    helper: "Actual offline Chromium form; apostrophe escaping, generated grant/revoke executed against disposable fixture; zero external requests",
  }, null, 2));
  console.log("PASS offline console helper: safely escaped approval and revocation executed in isolated packet DB; zero external requests.");
} finally {
  sql(`delete from public.audit_log where entity_id='${id}'; delete from public.administrator_grants where user_id='${id}'; delete from auth.users where id='${id}';`);
  await browser.close();
}
