-- Service-only invoker gateway needs schema USAGE, not table grants or RLS bypass.
begin;
grant usage on schema adme_ops to service_role;
notify pgrst,'reload schema';
commit;
