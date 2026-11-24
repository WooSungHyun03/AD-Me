begin;
-- Plain legacy marketing text must never select an internal operation.
alter table adme_ops.jobs add column operation text
 check(operation is null or operation='product_conditions_v1');
update adme_ops.jobs j set operation='product_conditions_v1'
 where exists(select 1 from adme_product_conditions.requests r where r.id=j.id);
create function adme_product_conditions.bind_operation()returns trigger
language plpgsql security definer set search_path=''as $$
begin
 update adme_ops.jobs set operation='product_conditions_v1'where id=new.id;
 return new;
end;$$;
create trigger bind_product_operation after insert on adme_product_conditions.requests
for each row execute function adme_product_conditions.bind_operation();
revoke all on function adme_product_conditions.bind_operation()from public,anon,authenticated,service_role;
do $patch$
declare r record;body text;
begin
 for r in select * from(values
 ('adme_product_conditions.sweep()', 'j.kind=''marketing_draft''and j.input like ''product-condition-v1:%''', 'j.operation=''product_conditions_v1'''),
 ('adme_ops.ops_worker_claim(text)', 'result->>''kind''=''marketing_draft''and result->>''input''like ''product-condition-v1:%''', 'exists(select 1 from adme_ops.jobs where id=(result->>''id'')::uuid and operation=''product_conditions_v1'')'),
 ('adme_ops.worker_heartbeat(text,uuid,uuid)', 'kind=''marketing_draft''and input like ''product-condition-v1:%''', 'operation=''product_conditions_v1'''),
 ('adme_ops.ops_worker_finish(text,uuid,uuid,jsonb,text,integer)', 'j.kind=''marketing_draft''and j.input like ''product-condition-v1:%''', 'j.operation=''product_conditions_v1''')
 )v(signature,needle,replacement)loop
  body:=pg_get_functiondef(r.signature::regprocedure);
  if strpos(body,r.needle)=0 then raise exception 'STOP: unsupported product wrapper: %',r.signature;end if;
  execute replace(body,r.needle,r.replacement);
 end loop;
end;$patch$;
notify pgrst,'reload schema';
commit;
