-- Welcome emails for paid plans (sent by the member-mail edge function, job "welcome").
-- welcome_sent records which plan welcomes have gone out, so each is sent once. Only the service role
-- (the edge function) reads or writes it.
create table public.welcome_sent (
  member_id uuid not null references public.profiles (id) on delete cascade,
  tier text not null check (tier in ('deck', 'ace', 'royal')),
  sent_at timestamptz not null default now(),
  primary key (member_id, tier)
);
alter table public.welcome_sent enable row level security;
revoke all on public.welcome_sent from anon, authenticated;

-- Calls member-mail with any JSON body (call_member_mail(p_job) stays for the scheduled jobs).
create or replace function private.call_member_mail_body(p_body jsonb)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := 'https://zbgktqrnnhntmozuzagk.supabase.co/functions/v1/member-mail',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := p_body,
    timeout_milliseconds := 60000
  )
$$;
revoke execute on function private.call_member_mail_body(jsonb) from public, anon, authenticated;

-- When a member's plan goes up (paid, upgraded, or given a place by Jack), send that plan's welcome
-- straight away. The request is queued and only sent once the change is committed.
create or replace function private.welcome_on_upgrade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rank_of constant jsonb := '{"open":0,"deck":1,"ace":2,"royal":3}';
begin
  if not new.is_admin and (rank_of ->> new.tier)::int > (rank_of ->> old.tier)::int then
    perform private.call_member_mail_body(jsonb_build_object('job', 'welcome', 'member_id', new.id));
  end if;
  return new;
end $$;

create trigger profiles_welcome_on_upgrade
  after update of tier on public.profiles
  for each row execute function private.welcome_on_upgrade();
