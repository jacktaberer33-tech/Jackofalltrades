-- Ace referrals: give £50, get £50.
--
-- Every Ace or Royal Flush member gets one personal Stripe promotion code, made by the referral function
-- the first time they open the You page. A friend who joins Ace with it gets £50 off their first payment
-- (the coupon only applies to Ace, and only for a customer who has never paid). When that checkout
-- completes, stripe-webhook records the referral here and gives the member who shared the code £50 of
-- Stripe credit, which comes off their next payment. Jack places the friend in their group if there's room.
--
-- Only the server (service role) writes these tables. Members can read their own rows; Jack reads all.

create table public.referral_codes (
  member_id uuid primary key references public.profiles (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9-]{4,24}$'),
  promo_id text not null unique,
  -- Paused (in Stripe too) while the member isn't on Ace or Royal Flush.
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;
revoke insert, update, delete on public.referral_codes from anon, authenticated;
create policy "Members read their own code; Jack reads all" on public.referral_codes
  for select to authenticated
  using (member_id = (select auth.uid()) or (select private.is_admin()));

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references public.profiles (id) on delete set null,
  -- One referral per friend.
  friend_id uuid unique references public.profiles (id) on delete set null,
  code text not null,
  checkout_session text not null unique,
  credit_txn text,
  credited_at timestamptz,
  -- Why no credit was given, or what happened to it, for Jack.
  credit_note text,
  reversed_at timestamptz,
  created_at timestamptz not null default now()
);

create index referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;
revoke insert, update, delete on public.referrals from anon, authenticated;
create policy "Members read referrals they made; Jack reads all" on public.referrals
  for select to authenticated
  using (referrer_id = (select auth.uid()) or (select private.is_admin()));
