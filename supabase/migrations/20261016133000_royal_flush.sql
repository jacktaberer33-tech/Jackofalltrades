-- NOT YET APPLIED: waiting for Jack's go-ahead before running on the jackofalltrades Supabase project.
-- Royal Flush: a fourth plan (£199/month) with a weekly 1:1 call, limited to 5 places.
-- Backward compatible: Ace keeps one call a month; nothing existing changes meaning.

-- The new plan name.
alter table public.profiles drop constraint profiles_tier_check;
alter table public.profiles add constraint profiles_tier_check check (tier in ('open','deck','ace','royal'));
alter table public.profiles drop constraint profiles_requested_tier_check;
alter table public.profiles add constraint profiles_requested_tier_check check (requested_tier in ('open','deck','ace','royal'));

create or replace function private.can_post() returns boolean
language sql stable security definer set search_path = ''
as $$ select coalesce((select p.is_admin or p.tier in ('deck','ace','royal') from public.profiles p where p.id = (select auth.uid())), false) $$;

create or replace function private.handle_new_member() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := left(btrim(coalesce(new.raw_user_meta_data->>'name', '')), 40);
  v_req text := new.raw_user_meta_data->>'requested_tier';
begin
  if v_name = '' then v_name := 'Member'; end if;
  if v_req is not null and v_req not in ('open','deck','ace','royal') then v_req := null; end if;
  insert into public.profiles (id, name, requested_tier) values (new.id, v_name, v_req);
  return new;
end $$;

create or replace function public.set_member_tier(p_member uuid, p_tier text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only Jack can change plans' using errcode = '42501';
  end if;
  if p_tier not in ('open','deck','ace','royal') then
    raise exception 'Unknown plan: %', p_tier;
  end if;
  update public.profiles set tier = p_tier where id = p_member;
end $$;

-- How many of the 5 Royal Flush places are free. Public, so the join page can show it.
create function public.royal_places_left() returns integer
language sql stable security definer set search_path = ''
as $$ select greatest(0, 5 - (select count(*)::int from public.profiles where tier = 'royal' and not is_admin)) $$;
revoke execute on function public.royal_places_left() from public;
grant execute on function public.royal_places_left() to anon, authenticated, service_role;

-- 1:1 calls: Ace books one call per calendar month, Royal Flush one per week (Mon–Sun).
-- Each booking is stamped with its period; one booking per member per period.
alter table public.bookings add column period text;
update public.bookings set period = 'm' || to_char(slot_date, 'YYYY-MM');
alter table public.bookings alter column period set not null;
drop index public.bookings_one_per_month;
create unique index bookings_one_per_period on public.bookings (member_id, period);

create function private.set_booking_period() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select p.tier from public.profiles p where p.id = new.member_id) = 'royal' then
    new.period := 'w' || to_char(new.slot_date, 'IYYY-IW');
  else
    new.period := 'm' || to_char(new.slot_date, 'YYYY-MM');
  end if;
  return new;
end $$;
create trigger bookings_set_period before insert or update of slot_date on public.bookings
  for each row execute function private.set_booking_period();

-- Who can book, and how far ahead. Royal Flush gets first pick: four weeks ahead, Ace two.
drop policy "Ace members book future weekday slots" on public.bookings;
drop policy "Ace members move their upcoming call" on public.bookings;
create policy "1:1 members book future weekday slots" on public.bookings for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and (select private.current_tier()) in ('ace','royal')
    and slot_date > (select private.today_london())
    and slot_date <= (select private.today_london()) + case when (select private.current_tier()) = 'royal' then 32 else 16 end
  );
create policy "1:1 members move their upcoming calls" on public.bookings for update to authenticated
  using (member_id = (select auth.uid()) and slot_date > (select private.today_london()))
  with check (
    member_id = (select auth.uid())
    and (select private.current_tier()) in ('ace','royal')
    and slot_date > (select private.today_london())
    and slot_date <= (select private.today_london()) + case when (select private.current_tier()) = 'royal' then 32 else 16 end
  );
