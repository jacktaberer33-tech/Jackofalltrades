-- Applied to the jackofalltrades Supabase project on 14 Oct 2026.
-- Stripe subscription details on each member. Only the payments webhook (service role)
-- and Jack's tools change these; members can read their own.
alter table public.profiles
  add column stripe_customer_id text unique,
  add column stripe_subscription_id text,
  add column subscription_status text,
  add column current_period_end timestamptz,
  add column cancel_at_period_end boolean not null default false;

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
          or new.cancel_at_period_end is distinct from old.cancel_at_period_end) then
    raise exception 'Plans can only be changed by Jack or by payment' using errcode = '42501';
  end if;
  return new;
end $$;
