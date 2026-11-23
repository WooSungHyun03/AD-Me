import { localRuntime, sql } from "./local-qa.mjs";
export function enableLocalIngestionPolicy() {
  localRuntime();
  sql(
    "insert into adme_ops.source_runtime_policies(version,provider,enabled,cache_seconds,job_seconds,tombstone_seconds,daily_units,max_attempts,review_ref) values('local-source-policy-1','youtube',true,2592000,86400,86400,1000,3,'FICTIONAL LOCAL QA policy, no provider approval') on conflict(version) do update set enabled=true;",
  );
}
