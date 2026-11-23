import { readFileSync } from "node:fs";
import { localRuntime, sql } from "./local-qa.mjs";
const doc = JSON.parse(
  readFileSync(
    "src/lib/policy-document.json",
    "utf8",
  ),
);
export const qaSignupConsent = {
  policy_version: doc.version,
  policy_hash: doc.documentHash,
  terms_accepted: true,
  privacy_accepted: true,
  adult_beta_confirmed: true,
};
export function enableLocalConsent() {
  localRuntime();
  sql(
    `select adme_consent.approve('${doc.version}','${doc.documentHash}','FICTIONAL LOCAL QA ONLY; no legal approval');`,
  );
}
