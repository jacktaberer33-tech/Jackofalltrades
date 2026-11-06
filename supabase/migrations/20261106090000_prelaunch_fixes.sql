-- Pre-launch fixes from the beta test (4 Nov 2026), batch 1: money and access.

-- 1. 1:1 bookings (06-1, 07-1). The one-call-per-period rule rests on `period`, which the trigger fills in.
--    It used to run only when slot_date changed, so a member could edit `period` directly and book again.
--    Now it runs on every insert and update, and members can only change a call's date, time and topic.
drop trigger if exists bookings_set_period on public.bookings;
create trigger bookings_set_period before insert or update on public.bookings
  for each row execute function private.set_booking_period();
revoke update on public.bookings from anon, authenticated;
grant update (slot_date, slot_time, topic) on public.bookings to authenticated;

-- 2. Royal Flush places (03-4). Starting a Royal Flush checkout holds a place until the checkout expires,
--    so two people can't both pay for the last place. Holds lapse on their own; paying turns the hold
--    into a Royal Flush membership and the webhook removes it. Only the edge functions use this table.
create table public.royal_holds (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.royal_holds enable row level security;
revoke all on public.royal_holds from anon, authenticated;

create or replace function public.royal_places_left() returns integer
language sql stable security definer set search_path = ''
as $$
  select greatest(0, 5
    - (select count(*)::int from public.profiles where tier = 'royal' and not is_admin)
    - (select count(*)::int
         from public.royal_holds h join public.profiles p on p.id = h.member_id
        where h.expires_at > now() and p.tier <> 'royal' and not p.is_admin))
$$;

-- Takes (or renews) a hold for one member, if a place is free. One caller at a time, so two
-- checkouts starting together can't both take the last place.
create function public.take_royal_hold(p_member uuid, p_minutes integer default 32) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  taken integer;
begin
  perform pg_advisory_xact_lock(hashtext('public.royal_holds'));
  delete from public.royal_holds where expires_at <= now();
  select (select count(*)::int from public.profiles where tier = 'royal' and not is_admin)
       + (select count(*)::int
            from public.royal_holds h join public.profiles p on p.id = h.member_id
           where p.tier <> 'royal' and not p.is_admin and h.member_id <> p_member)
    into taken;
  if taken >= 5 then
    return false;
  end if;
  insert into public.royal_holds (member_id, expires_at)
  values (p_member, now() + make_interval(mins => p_minutes))
  on conflict (member_id) do update set expires_at = excluded.expires_at;
  return true;
end $$;
revoke execute on function public.take_royal_hold(uuid, integer) from public, anon, authenticated;
grant execute on function public.take_royal_hold(uuid, integer) to service_role;

-- 3. Alerts for Jack. The payment webhook and checkout note anything Jack needs to act on (a refund owed,
--    Royal Flush over five, a payment with no account behind it, someone joining the waitlist); the hourly
--    member-mail job emails any new ones to him and marks them sent. `dedupe` stops a retried event
--    raising the same alert twice. Only the edge functions use this table.
create table public.jack_alerts (
  id bigint generated always as identity primary key,
  kind text not null,
  message text not null,
  member_id uuid references public.profiles (id) on delete set null,
  dedupe text unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.jack_alerts enable row level security;
revoke all on public.jack_alerts from anon, authenticated;
create index jack_alerts_unsent on public.jack_alerts (created_at) where sent_at is null;

-- 4. Closing an account (03-9, 07-6). The You page sends members through the close-account function,
--    which checks Stripe and pauses their referral code first. This check stops the account going while
--    a plan is still renewing, even if the function is called directly.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;
  if exists (
    select 1 from public.profiles
     where id = (select auth.uid())
       and subscription_status in ('active', 'trialing', 'past_due')
       and not cancel_at_period_end
  ) then
    raise exception 'Cancel your plan first' using errcode = 'P0001';
  end if;
  delete from auth.users where id = (select auth.uid());
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
