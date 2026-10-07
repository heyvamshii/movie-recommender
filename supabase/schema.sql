-- ReelMatch likes table. Run once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.likes (
  user_id    text        not null,
  movie_id   integer     not null,
  created_at timestamptz not null default now(),
  primary key (user_id, movie_id)
);

-- Row level security with no policies: browsers (anon key) can neither read nor write.
-- Only the website's server, using the service-role key, can access likes.
alter table public.likes enable row level security;

-- Starting likes for the demo accounts (user1 and user2 start empty).
insert into public.likes (user_id, movie_id) values
  ('user3', 89745),
  ('user3', 59315),
  ('user3', 112852),
  ('user3', 110102),
  ('user3', 122920),
  ('user3', 122912),
  ('user3', 58559),
  ('user3', 109487),
  ('user3', 79132),
  ('user4', 2671),
  ('user4', 597),
  ('user4', 6942),
  ('user4', 1721),
  ('user4', 8533),
  ('user4', 539),
  ('user4', 1307),
  ('user4', 4246)
on conflict do nothing;
