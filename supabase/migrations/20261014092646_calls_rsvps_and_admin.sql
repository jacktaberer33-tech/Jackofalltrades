-- Applied to the jackofalltrades Supabase project on 14 Oct 2026.
-- 1:1 call bookings (Ace), Friday Table RSVPs, and Jack's admin tools.

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  slot_date date not null check (extract(isodow from slot_date) between 1 and 5),
  slot_time text not null check (slot_time in ('07:00','07:45','12:30','18:00','18:45','19:30')),
  topic text not null default '' check (char_length(topic) <= 1000),
  created_at timestamptz not null default now(),
  constraint bookings_slot_taken unique (slot_date, slot_time)
);
create unique index bookings_one_per_month on public.bookings (member_id, (date_trunc('month', slot_date::timestamp)));

alter table public.bookings enable row level security;
create policy "Members see their own calls; Jack sees all" on public.bookings for select to authenticated
  using (member_id = (select auth.uid()) or (select private.is_admin()));
create policy "Ace members book future weekday slots" on public.bookings for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and (select private.current_tier()) = 'ace'
    and slot_date > (select private.today_london())
    and slot_date <= (select private.today_london()) + 62
  );
create policy "Ace members move their upcoming call" on public.bookings for update to authenticated
  using (member_id = (select auth.uid()) and slot_date > (select private.today_london()))
  with check (
    member_id = (select auth.uid())
    and (select private.current_tier()) = 'ace'
    and slot_date > (select private.today_london())
    and slot_date <= (select private.today_london()) + 62
  );
create policy "Members cancel upcoming calls; Jack cancels any" on public.bookings for delete to authenticated
  using ((member_id = (select auth.uid()) and slot_date > (select private.today_london())) or (select private.is_admin()));

-- Which slots are taken (no names or topics), so members can't double-book.
create function public.taken_slots(from_date date, to_date date)
returns table (slot_date date, slot_time text)
language sql stable security definer set search_path = ''
as $$
  select b.slot_date, b.slot_time from public.bookings b
  where b.slot_date between from_date and to_date and (select auth.uid()) is not null
$$;

create table public.event_rsvps (
  event_date date not null,
  member_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_date, member_id)
);
create index event_rsvps_member_idx on public.event_rsvps (member_id);
alter table public.event_rsvps enable row level security;
create policy "Members see their own RSVPs; Jack sees all" on public.event_rsvps for select to authenticated
  using (member_id = (select auth.uid()) or (select private.is_admin()));
create policy "Full Deck and Ace members RSVP" on public.event_rsvps for insert to authenticated
  with check (member_id = (select auth.uid()) and (select private.can_post()));
create policy "Members cancel their own RSVP" on public.event_rsvps for delete to authenticated
  using (member_id = (select auth.uid()));

create function public.rsvp_count(p_event_date date) returns integer
language sql stable security definer set search_path = ''
as $$ select case when (select auth.uid()) is null then 0 else (select count(*)::int from public.event_rsvps r where r.event_date = p_event_date) end $$;

create function public.admin_members()
returns table (id uuid, name text, email text, tier text, requested_tier text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only Jack can see the member list' using errcode = '42501';
  end if;
  return query
    select p.id, p.name, u.email::text, p.tier, p.requested_tier, p.created_at
    from public.profiles p join auth.users u on u.id = p.id
    order by p.created_at desc;
end $$;

create function public.set_member_tier(p_member uuid, p_tier text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only Jack can change plans' using errcode = '42501';
  end if;
  if p_tier not in ('open','deck','ace') then
    raise exception 'Unknown plan: %', p_tier;
  end if;
  update public.profiles set tier = p_tier where id = p_member;
end $$;
