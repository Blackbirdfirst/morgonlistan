-- Morgonlistan database schema.
-- Run this once in your Supabase project's SQL Editor (Supabase dashboard ->
-- SQL Editor -> New query -> paste this whole file -> Run).

-- One row per family. The whole app state (kids, tasks, completions,
-- currency, etc.) lives in a single jsonb column, mirroring the exact shape
-- that used to live in localStorage — this keeps the app's read/write logic
-- almost unchanged, just pointed at Supabase instead of localStorage.
create table public.families (
  id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.families enable row level security;

-- Each signed-in user can only ever read/write their own family's row.
create policy "Families can read their own row"
  on public.families for select
  using (auth.uid() = id);

create policy "Families can update their own row"
  on public.families for update
  using (auth.uid() = id);

create policy "Families can insert their own row"
  on public.families for insert
  with check (auth.uid() = id);

-- The moment someone signs up (first magic-link click), automatically create
-- their family row — matches the app's "zero required setup" philosophy.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.families (id, state)
  values (new.id, '{}'::jsonb);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Admin-only convenience view for the Supabase dashboard/SQL Editor: every
-- family with its signup email, kid count, and state in one readable row.
-- Explicitly NOT exposed to the app's own API (see the revoke below) — a
-- view like this joins in auth.users, and without that revoke, PostgREST
-- could otherwise let a signed-in family query every other family's email.
create or replace view public.families_overview as
select
  u.email,
  to_char(u.created_at, 'YYYY-MM-DD HH24:MI') as signed_up_at,
  to_char(f.updated_at, 'YYYY-MM-DD HH24:MI') as updated_at,
  coalesce(jsonb_array_length(f.state->'kids'), 0) as kid_count,
  f.id,
  f.state
from auth.users u
join public.families f on f.id = u.id
order by u.created_at desc;

revoke all on public.families_overview from anon, authenticated;
