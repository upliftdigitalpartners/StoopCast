-- StoopCast initial schema
-- Profiles, posts (with PostGIS geo), claims, karma, push tokens.

create extension if not exists "postgis";
create extension if not exists "pgcrypto";

------------------------------------------------------------------------------
-- profiles: 1:1 with auth.users
------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  karma int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are public read"
  on public.profiles for select
  using (true);

create policy "users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- auto-create a profile row on signup with a default handle
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, handle)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'handle',
      'stooper_' || substr(replace(new.id::text, '-', ''), 1, 8)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

------------------------------------------------------------------------------
-- posts: a stoop find
-- expires_at = created_at + 15 minutes (the alert window)
------------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  poster_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(title) between 1 and 80),
  description text check (length(description) <= 500),
  photo_url text not null,
  location geography(point, 4326) not null,
  status text not null default 'live' check (status in ('live', 'claimed', 'gone', 'expired')),
  claimed_by uuid references public.profiles(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

create index posts_location_gix on public.posts using gist (location);
create index posts_status_idx on public.posts (status);
create index posts_expires_at_idx on public.posts (expires_at);

alter table public.posts enable row level security;

create policy "posts are public read"
  on public.posts for select
  using (true);

create policy "authenticated users can post"
  on public.posts for insert
  with check (auth.uid() = poster_id);

create policy "poster can update own post"
  on public.posts for update
  using (auth.uid() = poster_id);

------------------------------------------------------------------------------
-- claims: one row per "I'm grabbing this" — first wins, others see it's claimed
------------------------------------------------------------------------------
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  claimer_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id)
);

alter table public.claims enable row level security;

create policy "claims public read"
  on public.claims for select
  using (true);

create policy "authenticated can claim"
  on public.claims for insert
  with check (auth.uid() = claimer_id);

-- when a claim is inserted, mark the post claimed and bump poster karma +1
create or replace function public.on_claim_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poster uuid;
begin
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

create trigger claims_on_insert
  after insert on public.claims
  for each row execute procedure public.on_claim_insert();

------------------------------------------------------------------------------
-- push_tokens: device tokens for Expo push
------------------------------------------------------------------------------
create table public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table public.push_tokens enable row level security;

create policy "users manage own push tokens select"
  on public.push_tokens for select using (auth.uid() = user_id);
create policy "users manage own push tokens insert"
  on public.push_tokens for insert with check (auth.uid() = user_id);
create policy "users manage own push tokens update"
  on public.push_tokens for update using (auth.uid() = user_id);
create policy "users manage own push tokens delete"
  on public.push_tokens for delete using (auth.uid() = user_id);

------------------------------------------------------------------------------
-- nearby_posts(lat, lng, radius_m) — RPC for the map / list
------------------------------------------------------------------------------
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
    p.id, p.poster_id, p.title, p.description, p.photo_url,
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
  order by distance_m asc;
$$;

------------------------------------------------------------------------------
-- create_post(...) — wraps geo construction so the client doesn't speak PostGIS
------------------------------------------------------------------------------
create or replace function public.create_post(
  p_title text,
  p_description text,
  p_photo_url text,
  p_lat double precision,
  p_lng double precision
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  insert into public.posts (poster_id, title, description, photo_url, location)
  values (
    auth.uid(),
    p_title,
    p_description,
    p_photo_url,
    st_makepoint(p_lng, p_lat)::geography
  )
  returning id into v_id;

  return v_id;
end;
$$;

------------------------------------------------------------------------------
-- expire_old_posts() — call from a scheduled task / cron
------------------------------------------------------------------------------
create or replace function public.expire_old_posts()
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  update public.posts
     set status = 'expired'
   where status = 'live'
     and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

------------------------------------------------------------------------------
-- storage bucket for photos (run once; safe to re-run)
------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('stoop-photos', 'stoop-photos', true)
on conflict (id) do nothing;

create policy "stoop-photos public read"
  on storage.objects for select
  using (bucket_id = 'stoop-photos');

create policy "stoop-photos auth upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'stoop-photos');
