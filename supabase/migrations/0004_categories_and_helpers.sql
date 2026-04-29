-- Categories on posts + helpers
-- After this migration:
--   * posts.category is one of a known set
--   * create_post takes category
--   * nearby_posts returns category
--   * delete_my_post(uuid) lets a poster soft-delete their own post (status = 'gone')

------------------------------------------------------------------------------
-- category column
------------------------------------------------------------------------------
alter table public.posts
  add column if not exists category text not null default 'other'
  check (category in (
    'furniture','electronics','books','clothes',
    'kitchen','kids','art','other'
  ));

create index if not exists posts_category_idx on public.posts (category);

------------------------------------------------------------------------------
-- create_post: now accepts category
------------------------------------------------------------------------------
create or replace function public.create_post(
  p_title text,
  p_description text,
  p_photo_url text,
  p_lat double precision,
  p_lng double precision,
  p_category text default 'other'
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

  insert into public.posts
    (poster_id, title, description, photo_url, location, category)
  values (
    auth.uid(),
    p_title,
    p_description,
    p_photo_url,
    st_makepoint(p_lng, p_lat)::geography,
    coalesce(p_category, 'other')
  )
  returning id into v_id;

  return v_id;
end;
$$;

------------------------------------------------------------------------------
-- nearby_posts: now returns category
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
    p.id, p.poster_id, p.title, p.description, p.photo_url, p.category,
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
-- delete_my_post: poster soft-deletes by setting status='gone'
------------------------------------------------------------------------------
create or replace function public.delete_my_post(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'must be authenticated';
  end if;

  update public.posts
     set status = 'gone'
   where id = p_id
     and poster_id = auth.uid();
end;
$$;
