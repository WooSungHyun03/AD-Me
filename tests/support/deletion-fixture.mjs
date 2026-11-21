import { localRuntime, sql } from "./local-qa.mjs";
export function enableLocalDeletionIntake() {
  localRuntime();
  sql(
    "update adme_privacy.intake set enabled=true,review_ref='FICTIONAL LOCAL QUARANTINE QA; no permanent erasure approval' where singleton;",
  );
}
