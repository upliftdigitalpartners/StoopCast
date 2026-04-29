-- Comments, reports, blocks, multi-photo, claim hold, stats RPCs, activity feed.
-- Re-runnable: drops/recreates functions, idempotent table creation.

------------------------------------------------------------------------------
-- multi-photo: photos[] in addition to photo_url (which stays as the primary)
------------------------------------------------------------------------------
alter table public.posts
  add column if not exists photos text[] not null default '{}';

------------------------------------------------------------------------------
-- claim hold: a 5-minute soft reservation after someone claims
------------------------------------------------------------------------------
alter table public.claims
  add column if not exists reserved_until timestamptz;

-- existing trigger sets status=claimed; extend it to also stamp reserved_until
create or replace function public.on_claim_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poster uuid;
begin
  new.reserved_until := now() + interval '5 minutes';

  update public.posts
     set status = 'claimed',
         claimed_by = new.claimer_id,
         claimed_at = now()
   where id = new.post_id and status = 'live'
   returning poster_id into v_poster;

  if v_poster is not null then
    update public.profiles set karma = karma + 1 where id = v_poster;
  end if;
  return new;
end;
$$;

------------------------------------------------------------------------------
-- comments
------------------------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists comments_post_idx on public.comments (post_id, created_at);

alter table public.comments enable row level security;

drop policy if exists "comments public read" on public.comments;
drop policy if exists "comments authed insert" on public.comments;
drop policy if exists "comments author delete" on public.comments;

create policy "comments public read"  on public.comments for select using (true);
create policy "comments authed insert" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments author delete" on public.comments for delete using (auth.uid() = user_id);

------------------------------------------------------------------------------
-- reports
------------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (length(reason) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

alter table public.reports enable row level security;

drop policy if exists "reports own select" on public.reports;
drop policy if exists "reports authed insert" on public.reports;

create policy "reports own select"   on public.reports for select using (auth.uid() = reporter_id);
create policy "reports authed insert" on public.reports for insert with check (auth.uid() = reporter_id);

------------------------------------------------------------------------------
-- blocks (user-to-user)
------------------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

alter table public.blocks enable row level security;

drop policy if exists "blocks own all" on public.blocks;
create policy "blocks own all" on public.blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

------------------------------------------------------------------------------
-- create_post: now accepts an additional photos[] array
------------------------------------------------------------------------------
drop function if exists public.create_post(text, text, text, double precision, double precision, text);
drop function if exists public.create_post(text, text, text, double precision, double precision, text, text[]);

create or replace function public.create_post(
  p_title text,
  p_description text,
  p_photo_url text,
  p_lat double precision,
  p_lng double precision,
  p_category text default 'other',
  p_photos text[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;

  insert into public.posts
    (poster_id, title, description, photo_url, photos, location, category)
  values (
    auth.uid(), p_title, p_description, p_photo_url,
    coalesce(p_photos, '{}'::text[]),
    st_makepoint(p_lng, p_lat)::geography,
    coalesce(p_category, 'other')
  )
  returning id into v_id;
  return v_id;
end;
$$;

------------------------------------------------------------------------------
-- nearby_posts: now also returns photos[] and filters out blocked posters
------------------------------------------------------------------------------
drop function if exists public.nearby_posts(double precision, double precision, double precision);

create or replace function public.nearby_posts(
  lat double precision,
  lng double precision,
  radius_m double precision default 2000
)
returns table (
  id uuid,
  poster_id uuid,
  title text,
  description text,
  photo_url text,
  photos text[],
  category text,
  lat double precision,
  lng double precision,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  distance_m double precision,
  poster_handle text,
  poster_karma int
)
language sql
stable
as $$
  select
    p.id, p.poster_id, p.title, p.description, p.photo_url, p.photos, p.category,
    st_y(p.location::geometry) as lat,
    st_x(p.location::geometry) as lng,
    p.status, p.created_at, p.expires_at,
    st_distance(p.location, st_makepoint(lng, lat)::geography) as distance_m,
    pr.handle as poster_handle,
    pr.karma  as poster_karma
  from public.posts p
  join public.profiles pr on pr.id = p.poster_id
  where p.status = 'live'
    and p.expires_at > now()
    and st_dwithin(p.location, st_makepoint(lng, lat)::geography, radius_m)
    and not exists (
      select 1 from public.blocks b
       where b.blocker_id = auth.uid() and b.blocked_id = p.poster_id
    )
  order by distance_m asc;
$$;

------------------------------------------------------------------------------
-- post_comments(p_id) — list comments with handle + karma
------------------------------------------------------------------------------
drop function if exists public.post_comments(uuid);
create or replace function public.post_comments(p_id uuid)
returns table (
  id uuid,
  user_id uuid,
  body text,
  created_at timestamptz,
  handle text,
  karma int
)
language sql
stable
as $$
  select c.id, c.user_id, c.body, c.created_at, pr.handle, pr.karma
    from public.comments c
    join public.profiles pr on pr.id = c.user_id
   where c.post_id = p_id
   order by c.created_at asc;
$$;

------------------------------------------------------------------------------
-- add_comment / report_post / block_user / unblock_user
------------------------------------------------------------------------------
drop function if exists public.add_comment(uuid, text);
create or replace function public.add_comment(p_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;
  insert into public.comments (post_id, user_id, body)
  values (p_id, auth.uid(), p_body)
  returning id into v_id;
  return v_id;
end;
$$;

drop function if exists public.report_post(uuid, text);
create or replace function public.report_post(p_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;
  insert into public.reports (post_id, reporter_id, reason)
  values (p_id, auth.uid(), p_reason)
  on conflict (post_id, reporter_id) do nothing;
end;
$$;

drop function if exists public.block_user(uuid);
create or replace function public.block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'must be authenticated'; end if;
  insert into public.blocks (blocker_id, blocked_id)
  values (auth.uid(), p_user)
  on conflict do nothing;
end;
$$;

drop function if exists public.unblock_user(uuid);
create or replace function public.unblock_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.blocks
   where blocker_id = auth.uid() and blocked_id = p_user;
end;
$$;

------------------------------------------------------------------------------
-- my_stats() — drives achievements + streaks on profile
------------------------------------------------------------------------------
drop function if exists public.my_stats();
create or replace function public.my_stats()
returns table (
  posts int,
  claims int,
  karma int,
  home_set bool,
  weekly_karma int,
  streak_days int
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as id),
  posts_count as (
    select count(*)::int as n from public.posts where poster_id = (select id from me)
  ),
  claims_count as (
    select count(*)::int as n from public.claims where claimer_id = (select id from me)
  ),
  weekly as (
    select count(*)::int as n
      from public.claims c
      join public.posts p on p.id = c.post_id
     where p.poster_id = (select id from me)
       and c.created_at > now() - interval '7 days'
  ),
  -- streak = number of consecutive days ending today (or yesterday) with at least one post
  daily as (
    select distinct date_trunc('day', created_at at time zone 'utc')::date as d
      from public.posts
     where poster_id = (select id from me)
       and created_at > now() - interval '60 days'
  ),
  ranked as (
    select d, row_number() over (order by d desc) - 1 as rn
      from daily
     where d <= current_date
  ),
  streak as (
    select count(*)::int as n
      from ranked
     where d = current_date - rn
       and (current_date - d) <= 1 -- start streak today or yesterday
  )
  select
    (select n from posts_count),
    (select n from claims_count),
    coalesce((select karma from public.profiles where id = (select id from me)), 0),
    coalesce((select home_set from public.profiles where id = (select id from me)), false),
    coalesce((select n from weekly), 0),
    coalesce((select n from streak), 0);
$$;

------------------------------------------------------------------------------
-- recent_neighborhood_activity — feed for the new Activity tab
-- All posts (any status) within radius in the last `since_hours`, blocked-filtered.
------------------------------------------------------------------------------
drop function if exists public.recent_neighborhood_activity(double precision, double precision, double precision, int);
create or replace function public.recent_neighborhood_activity(
  lat double precision,
  lng double precision,
  radius_m double precision default 3000,
  since_hours int default 48
)
returns table (
  id uuid,
  poster_id uuid,
  title text,
  photo_url text,
  category text,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  distance_m double precision,
  poster_handle text
)
language sql
stable
as $$
  select
    p.id, p.poster_id, p.title, p.photo_url, p.category, p.status,
    p.created_at, p.expires_at,
    st_distance(p.location, st_makepoint(lng, lat)::geography) as distance_m,
    pr.handle as poster_handle
  from public.posts p
  join public.profiles pr on pr.id = p.poster_id
  where p.created_at > now() - (since_hours || ' hours')::interval
    and st_dwithin(p.location, st_makepoint(lng, lat)::geography, radius_m)
    and not exists (
      select 1 from public.blocks b
       where b.blocker_id = auth.uid() and b.blocked_id = p.poster_id
    )
  order by p.created_at desc;
$$;
