-- USER may pause new external work without deleting data or grants.
update adme_ops.resource_controls set ingestion_enabled=false,llm_enabled=false where singleton=true;
-- Also set ADME_FEATURE_INGESTION=off and ADME_FEATURE_LLM=off in the app environment.
-- Existing in-flight provider calls can still finish; new enqueue/leases are stopped.
