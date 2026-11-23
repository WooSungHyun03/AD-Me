-- USER only, after source 5748a86829de32204a56b0d590d7854c2d97ddfd is deployed/coordinated and real URL/steward review.
-- This closes legacy no-ack signup; it does not approve a policy or enable collection.
begin;
do $$begin if(select count(*) from supabase_migrations.schema_migrations)<>54 then raise exception 'STOP: expected54';end if;end$$;
select adme_consent.activate_boundary('5748a86829de32204a56b0d590d7854c2d97ddfd');
commit;
