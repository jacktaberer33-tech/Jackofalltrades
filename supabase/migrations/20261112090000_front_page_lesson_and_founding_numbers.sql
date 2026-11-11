-- 1. Front-page lesson. One free lesson can be flagged to play on the public join page, so visitors can
--    watch before they sign up. The lesson-video function hands anyone a short-lived link for that one
--    lesson only; every other lesson still needs a signed-in member on the right plan.
alter table public.lesson_videos add column front_page boolean not null default false;
create unique index lesson_videos_one_front_page on public.lesson_videos (front_page) where front_page;
alter table public.lesson_videos add constraint front_page_is_free check (not front_page or min_tier = 'open');

-- 2. Founding member numbers. The first 50 people to join a paid plan (through Stripe) get a number,
--    1 to 50, in the order they joined. It's given once and never reused, and shows on their founding
--    member card on the You page. Plans Jack sets by hand don't count, and nor does Jack.
alter table public.profiles add column founding_number smallint unique check (founding_number between 1 and 50);

create function private.assign_founding_number() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  next_number integer;
begin
  if new.founding_number is null
     and not new.is_admin
     and new.tier <> 'open'
     and new.stripe_subscription_id is not null
     and new.subscription_status in ('active', 'trialing') then
    perform pg_advisory_xact_lock(hashtext('public.profiles.founding_number'));
    select coalesce(max(founding_number), 0) + 1 into next_number from public.profiles;
    if next_number <= 50 then
      new.founding_number := next_number;
    end if;
  end if;
  return new;
end $$;
create trigger profiles_founding_number before update of tier, subscription_status, stripe_subscription_id on public.profiles
  for each row execute function private.assign_founding_number();

-- Members can't give themselves a number.
create or replace function private.guard_profile_changes() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.tier is distinct from old.tier
          or new.is_admin is distinct from old.is_admin
          or new.id is distinct from old.id
          or new.created_at is distinct from old.created_at
          or new.stripe_customer_id is distinct from old.stripe_customer_id
          or new.stripe_subscription_id is distinct from old.stripe_subscription_id
          or new.subscription_status is distinct from old.subscription_status
          or new.current_period_end is distinct from old.current_period_end
          or new.cancel_at_period_end is distinct from old.cancel_at_period_end
          or new.founding_number is distinct from old.founding_number) then
    raise exception 'Plans can only be changed by Jack or by payment' using errcode = '42501';
  end if;
  return new;
end $$;
