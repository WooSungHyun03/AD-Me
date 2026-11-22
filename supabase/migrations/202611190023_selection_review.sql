-- D061: brand-private selection review. A brand defines its own checklist; per campaign × creator it records
-- which items were checked, a private memo and a manual approval. When the brand has a checklist, accepting
-- an application (= selecting the creator) requires an approval covering every current item.
-- Nothing here is readable by the creator, other brands, admins via REST, or the public profile.
create table public.review_checklist_items(
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  label text not null check (length(trim(label)) between 1 and 100),
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on review_checklist_items(brand_id, position);
alter table review_checklist_items enable row level security;
create policy review_items_own on review_checklist_items for all
  using (brand_id = auth.uid())
  with check (brand_id = auth.uid() and exists(select 1 from profiles where id = auth.uid() and role = 'brand'));
create function public.review_items_cap() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if (select count(*) from review_checklist_items where brand_id = new.brand_id) >= 10 then
    raise exception 'checklist_full' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.review_items_cap() from public, anon, authenticated;
create trigger review_items_cap before insert on review_checklist_items for each row execute function review_items_cap();

create table public.creator_reviews(
  campaign_id uuid not null references campaigns(id) on delete cascade,
  creator_id text not null references creators(id) on delete cascade,
  brand_id uuid not null references profiles(id) on delete cascade,
  checked uuid[] not null default '{}',
  memo text not null default '' check (length(memo) <= 1000),
  approved boolean not null default false,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, creator_id)
);
alter table creator_reviews enable row level security;
create policy creator_reviews_own_read on creator_reviews for select using (brand_id = auth.uid());
revoke insert, update, delete on creator_reviews from anon, authenticated;

-- An approval counts only if it covers the brand's CURRENT items (adding an item re-opens the review).
create function public.review_approved(p_brand uuid, p_campaign uuid, p_creator text) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from creator_reviews r where r.campaign_id = p_campaign and r.creator_id = p_creator and r.approved
    and coalesce((select array_agg(id) from review_checklist_items where brand_id = p_brand), '{}') <@ r.checked)
$$;
revoke all on function public.review_approved(uuid, uuid, text) from public, anon, authenticated;

create function public.set_creator_review(p_campaign uuid, p_creator text, p_checked uuid[], p_memo text, p_approve boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare items uuid[]; ok uuid[];
begin
  if not exists(select 1 from campaigns where id = p_campaign and owner_id = auth.uid() and not is_demo) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists(select 1 from creators where id = p_creator) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if length(coalesce(p_memo, '')) > 1000 then raise exception 'memo_too_long' using errcode = '22001'; end if;
  items := coalesce((select array_agg(id) from review_checklist_items where brand_id = auth.uid()), '{}');
  ok := coalesce((select array_agg(x) from unnest(coalesce(p_checked, '{}')) x where x = any(items)), '{}');
  if p_approve and not items <@ ok then raise exception 'review_incomplete' using errcode = '23514'; end if;
  insert into creator_reviews(campaign_id, creator_id, brand_id, checked, memo, approved, reviewed_by, reviewed_at, updated_at)
  values (p_campaign, p_creator, auth.uid(), ok, coalesce(p_memo, ''), p_approve,
          case when p_approve then auth.uid() end, case when p_approve then now() end, now())
  on conflict (campaign_id, creator_id) do update set checked = excluded.checked, memo = excluded.memo,
    approved = excluded.approved, reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at, updated_at = now();
  return jsonb_build_object('approved', p_approve, 'checked', cardinality(ok), 'items', cardinality(items));
end $$;
revoke all on function public.set_creator_review(uuid, text, uuid[], text, boolean) from public, anon;
grant execute on function public.set_creator_review(uuid, text, uuid[], text, boolean) to authenticated;

-- Gate on every path that selects an applicant (RPC or otherwise).
create function public.selection_gate() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if old.status = 'pending' and new.status = 'accepted' and new.kind = 'application'
     and exists(select 1 from review_checklist_items where brand_id = new.brand_id)
     and not review_approved(new.brand_id, new.campaign_id, new.creator_id) then
    raise exception 'review_required' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.selection_gate() from public, anon, authenticated;
create trigger selection_gate before update of status on proposals for each row execute function selection_gate();
