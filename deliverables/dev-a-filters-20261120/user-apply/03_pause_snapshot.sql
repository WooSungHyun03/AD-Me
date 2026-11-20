-- Optional USER containment: stop the new owner-only snapshot without deleting data.
revoke execute on function public.my_creator_identity_snapshot() from authenticated;
revoke execute on function adme_creator.my_snapshot() from authenticated;
-- Existing catalog uses the original DTO. Retain tables, triggers and history for forward fix.
