-- Per-user home location, used to geo-target push notifications.
-- After this migration:
--   * profiles.home_location is the user's chosen neighborhood center
--   * profiles.home_set is a derived bool the client can read without parsing geography
--   * recipients_near() actually filters by distance instead of broadcasting

alter table public.profiles
  add column if not exists home_location geography(point, 4326);

alter table public.profiles
  add column if not exists home_set boolean
  generated always as (home_location is not null) stored;

create index if not exists profiles_home_location_gix
  on public.profiles using gist (home_location);

------------------------------------------------------------------------------
-- set_home_location(lat, lng) — wraps PostGIS so the client doesn't speak it
------------------------------------------------------------------------------
create or replace function public.set_home_location(
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  update public.profiles
     set home_location = st_makepoint(p_lng, p_lat)::geography
   where id = auth.uid();
end;
$$;

------------------------------------------------------------------------------
-- my_home() — read back the current user's home as plain lat/lng
------------------------------------------------------------------------------
create or replace function public.my_home()
returns table (lat double precision, lng double precision)
language sql
stable
security definer
set search_path = public
as $$
  select st_y(home_location::geometry)::double precision as lat,
         st_x(home_location::geometry)::double precision as lng
    from public.profiles
   where id = auth.uid()
     and home_location is not null;
$$;

------------------------------------------------------------------------------
-- recipients_near — real geo filter now
-- Only notify users whose home_location is within radius_m of the new post.
-- Users without a home_location set get nothing (they have to opt in).
------------------------------------------------------------------------------
create or replace function public.recipients_near(
  lat double precision,
  lng double precision,
  radius_m double precision default 1500,
  exclude_user uuid default null
)
returns table (user_id uuid, token text)
language sql
stable
as $$
  select pt.user_id, pt.token
    from public.push_tokens pt
    join public.profiles pr on pr.id = pt.user_id
   where pr.home_location is not null
     and st_dwithin(
           pr.home_location,
           st_makepoint(lng, lat)::geography,
           radius_m
         )
     and (exclude_user is null or pt.user_id <> exclude_user);
$$;
