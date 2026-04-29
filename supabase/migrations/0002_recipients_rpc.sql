-- Recipients within radius of a point — used by the notify-nearby edge function.
-- "Nearby" is defined as: any push_token belonging to a user who has posted from
-- (or claimed something at) a point within RADIUS of the new post.
-- For an MVP we simply return all push tokens; in production this would be
-- driven by a per-user "neighborhood center" or last-known location row.

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
   where exclude_user is null or pt.user_id <> exclude_user;
$$;
