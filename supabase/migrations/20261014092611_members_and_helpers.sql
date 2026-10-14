-- Applied to the jackofalltrades Supabase project on 14 Oct 2026.
-- Members (profiles), helper checks, and the sign-up trigger.

create schema if not exists private;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  tier text not null default 'open' check (tier in ('open','deck','ace')),
  requested_tier text check (requested_tier in ('open','deck','ace')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create function private.current_tier() returns text
language sql stable security definer set search_path = ''
as $$ select tier from public.profiles where id = (select auth.uid()) $$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false) $$;

create function private.can_post() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select p.is_admin or p.tier in ('deck','ace') from public.profiles p where p.id = (select auth.uid())), false) $$;

create function private.today_london() returns date
language sql stable set search_path = ''
as $$ select (now() at time zone 'Europe/London')::date $$;

grant execute on function private.current_tier(), private.is_admin(), private.can_post(), private.today_london() to authenticated;

alter table public.profiles enable row level security;
create policy "Members read their own profile; Jack reads all" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select private.is_admin()));
create policy "Members edit their own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Members can rename themselves or request a plan, but only Jack's tools change plans or admin rights.
create function private.guard_profile_changes() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.tier is distinct from old.tier
          or new.is_admin is distinct from old.is_admin
          or new.id is distinct from old.id
          or new.created_at is distinct from old.created_at) then
    raise exception 'Plans can only be changed by Jack' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profile_changes();

-- New sign-ups get a profile on the free plan; the plan they picked is kept as a request.
create function private.handle_new_member() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(new.raw_user_meta_data->>'name', '')), 40);
  v_req text := new.raw_user_meta_data->>'requested_tier';
begin
  if v_name = '' then v_name := 'Member'; end if;
  if v_req is not null and v_req not in ('open','deck','ace') then v_req := null; end if;
  insert into public.profiles (id, name, requested_tier) values (new.id, v_name, v_req);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_member();
