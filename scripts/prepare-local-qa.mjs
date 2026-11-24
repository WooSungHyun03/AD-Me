import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { enableLocalConsent, qaSignupConsent } from "../tests/support/consent-fixture.mjs";
import { enableLocalIngestionPolicy } from "../tests/support/ingestion-fixture.mjs";
import {
  localRuntime,
  localClient,
  sql,
  totp,
} from "../tests/support/local-qa.mjs";

const runtime = localRuntime();
enableLocalConsent();
enableLocalIngestionPolicy();
const admin = localClient(runtime.SERVICE_ROLE_KEY);
const accounts = {};
// Explicit opt-in of isolated fixtures only; hosted controls remain default-off.
sql("select adme_release.set_demo_catalog(true,'local-fictional-qa-only');");
sql(
  "update adme_ops.resource_controls set ingestion_enabled=true,llm_enabled=true where singleton=true;",
);
for (const role of ["brand", "creator", "other", "admin", "staff"]) {
  const email = `qa-${role}-${randomBytes(6).toString("hex")}@example.test`;
  const password = randomBytes(24).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...qaSignupConsent,
      role: role === "creator" ? "creator" : "brand",
      name: `QA local ${role}`,
    },
  });
  assert.equal(error, null, "local QA account creation");
  accounts[role] = { email, password, id: data.user.id };
}
sql(
  `select public.provision_administrator('${accounts.admin.id}', 'LOCAL QA fixture, no external approval', now()+interval '1 day');`,
);
sql(
  `select adme_ops.provision_staff('${accounts.staff.id}', 'content', 'LOCAL QA delegated fixture', now()+interval '1 day');`,
);
const client = localClient();
assert.equal(
  (await client.auth.signInWithPassword(accounts.admin)).error,
  null,
);
const { data: factor, error } = await client.auth.mfa.enroll({
  factorType: "totp",
  issuer: "AD Me local QA",
});
assert.equal(error, null, "local TOTP enrollment");
accounts.admin.totpSecret = factor.totp.secret;
accounts.admin.factorId = factor.id;
assert.equal(
  (
    await client.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: totp(factor.totp.secret),
    })
  ).error,
  null,
  "actual local Auth TOTP verification",
);
writeFileSync(
  "output/dev-a-db/accounts.local.json",
  JSON.stringify(accounts, null, 2),
);
console.log(
  "Prepared five isolated local accounts and a real local Auth TOTP factor; no credentials printed.",
);
