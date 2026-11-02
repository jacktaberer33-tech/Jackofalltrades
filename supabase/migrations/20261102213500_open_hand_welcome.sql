-- welcome_sent can now record the Open Hand welcome too.
alter table public.welcome_sent drop constraint welcome_sent_tier_check;
alter table public.welcome_sent add constraint welcome_sent_tier_check check (tier in ('open', 'deck', 'ace', 'royal'));
