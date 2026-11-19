-- PostgREST callers must obey the same public DTO shape as application routes.
create function public.valid_creator_dto(p jsonb) returns boolean language sql immutable set search_path=public as $$ select coalesce(
 jsonb_typeof(p)='object' and jsonb_typeof(p->'name')='string' and length(p->>'name') between 2 and 80
 and jsonb_typeof(p->'bio')='string' and length(p->>'bio')<=1000
 and jsonb_typeof(p->'handle')='string' and length(p->>'handle')<=100
 and jsonb_typeof(p->'categories')='array' and jsonb_array_length(p->'categories')<=5 and not jsonb_path_exists(p,'$.categories[*] ? (@.type() != "string")')
 and jsonb_typeof(p->'vibes')='array' and jsonb_array_length(p->'vibes')<=8 and not jsonb_path_exists(p,'$.vibes[*] ? (@.type() != "string")')
 and jsonb_typeof(p->'formats')='array' and jsonb_array_length(p->'formats')<=8 and not jsonb_path_exists(p,'$.formats[*] ? (@.type() != "string")')
 and jsonb_typeof(p->'platforms')='array' and jsonb_array_length(p->'platforms')<=5 and not jsonb_path_exists(p,'$.platforms[*] ? (@.type() != "string")')
 and jsonb_typeof(p->'price_min_krw')='number' and (p->>'price_min_krw')::numeric between 0 and 100000000
 and jsonb_typeof(p->'price_max_krw')='number' and (p->>'price_max_krw')::numeric between (p->>'price_min_krw')::numeric and 100000000
 and jsonb_typeof(p->'followers')='number' and (p->>'followers')::numeric between 0 and 10000000000
 and jsonb_typeof(p->'is_available')='boolean' and jsonb_typeof(p->'is_demo')='boolean'
 and (not(p?'social_url') or (jsonb_typeof(p->'social_url')='string' and ((p->>'social_url')='' or (p->>'social_url') like 'https://%')))
 and (not(p?'portfolio_url') or (jsonb_typeof(p->'portfolio_url')='string' and ((p->>'portfolio_url')='' or (p->>'portfolio_url') like 'https://%')))
,false); $$;
create function public.valid_campaign_dto(p jsonb) returns boolean language sql immutable set search_path=public as $$ select coalesce(
 jsonb_typeof(p)='object' and jsonb_typeof(p->'title')='string' and length(p->>'title') between 2 and 120
 and jsonb_typeof(p->'product')='string' and length(p->>'product') between 1 and 120
 and jsonb_typeof(p->'category')='string' and jsonb_typeof(p->'format')='string'
 and jsonb_typeof(p->'goal')='string' and length(p->>'goal') between 2 and 500
 and jsonb_typeof(p->'target_audience')='string' and length(p->>'target_audience') between 2 and 500
 and jsonb_typeof(p->'vibes')='array' and jsonb_array_length(p->'vibes') between 1 and 8 and not jsonb_path_exists(p,'$.vibes[*] ? (@.type() != "string")')
 and jsonb_typeof(p->'budget_krw')='number' and (p->>'budget_krw')::numeric between 10000 and 100000000
 and (not(p?'platforms') or (jsonb_typeof(p->'platforms')='array' and not jsonb_path_exists(p,'$.platforms[*] ? (@.type() != "string")')))
,false); $$;
alter table creators add constraint creator_dto_valid check(valid_creator_dto(profile));
alter table campaigns add constraint campaign_dto_valid check(valid_campaign_dto(brief));
