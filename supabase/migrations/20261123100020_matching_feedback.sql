-- D046: recommendation feedback for offline evaluation. Reason codes only (no free text), one row per
-- rater × campaign × creator, the scorer version and the position/score the server showed.
create table public.matching_feedback(
  id bigint generated always as identity primary key,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  creator_id text not null references creators(id) on delete cascade,
  rater_id uuid not null references profiles(id) on delete cascade,
  model_version text not null check (model_version ~ '^adme-[0-9.]+$'),
  rank_position int not null check (rank_position between 1 and 50),
  score int check (score between 0 and 100),
  verdict text not null check (verdict in ('fit','unfit')),
  reason text not null check (
    (verdict = 'fit' and reason in ('category_match','vibe_match','budget_fit','format_fit','other_fit')) or
    (verdict = 'unfit' and reason in ('category_mismatch','vibe_mismatch','budget_mismatch','unavailable','brand_safety','other_unfit'))),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, creator_id, rater_id)
);
alter table matching_feedback enable row level security;
create policy matching_feedback_own_read on matching_feedback for select using (rater_id = auth.uid());
-- Writes only through /api/matching-feedback (service role), which checks campaign ownership and recomputes
-- the shown rank/score/version, so a client can never store a forged position.
revoke insert, update, delete on matching_feedback from anon, authenticated;

-- Evaluation dataset (admin/service). No rater id; campaign appears only as a hash group key.
-- split: by campaign, so one campaign's labels never sit in both train and test (no leakage across a brief).
-- accepted: the later proposal outcome, a label only — never a feature for the score that was shown.
create function public.matching_feedback_dataset() returns table(
  campaign_key text, creator_id text, model_version text, rank_position int, score int,
  verdict text, reason text, accepted boolean, size_bucket text, split text)
language plpgsql stable security definer set search_path=public, extensions as $$
begin
  if not (is_admin() or auth.role() = 'service_role') then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
  select left(md5(f.campaign_id::text), 12), f.creator_id, f.model_version, f.rank_position, f.score, f.verdict, f.reason,
    exists(select 1 from proposals p where p.campaign_id = f.campaign_id and p.creator_id = f.creator_id
           and p.status in ('accepted','submitted','revision_requested','completed')),
    case when (cr.profile->>'is_demo')::boolean is not true then 'unknown'
         when (cr.profile->>'followers')::numeric < 10000 then 'small'
         when (cr.profile->>'followers')::numeric < 100000 then 'mid' else 'large' end,
    case when get_byte(decode(md5(f.campaign_id::text), 'hex'), 0) % 5 = 0 then 'test' else 'train' end
  from matching_feedback f join creators cr on cr.id = f.creator_id
  order by f.id;
end $$;
revoke all on function public.matching_feedback_dataset() from public, anon;
grant execute on function public.matching_feedback_dataset() to authenticated, service_role;
