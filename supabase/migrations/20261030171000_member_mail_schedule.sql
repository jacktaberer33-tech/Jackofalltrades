-- Schedules the member-mail edge function:
--   hourly at :17      { "job": "sync" }    keep the Resend "Members" segment in step with the site
--   daily at 20:00 UTC { "job": "digest" }  Jack's round-up of the day's Table posts and replies
--                                           (8pm in winter, 9pm in summer, UK time)
--
-- The function only runs for callers who send the cron secret. It's generated here, inside the database,
-- and kept in the vault; nobody (Jack, Claude, the website) ever sees it. Only the service role (the edge
-- function) can check a value against it.
create extension if not exists pg_net;
create extension if not exists pg_cron;

select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'cron_secret', 'member-mail: shared secret for scheduled calls')
where not exists (select 1 from vault.secrets where name = 'cron_secret');

create or replace function public.cron_secret_matches(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name = 'cron_secret' and decrypted_secret = p_secret
  )
$$;
revoke execute on function public.cron_secret_matches(text) from public, anon, authenticated;
grant execute on function public.cron_secret_matches(text) to service_role;

-- Calls member-mail with a job name. Runs as the cron job's owner; not callable from the website.
create or replace function private.call_member_mail(p_job text)
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
    body := jsonb_build_object('job', p_job),
    timeout_milliseconds := 120000
  )
$$;
revoke execute on function private.call_member_mail(text) from public, anon, authenticated;

select cron.schedule('member-mail-sync', '17 * * * *', $$ select private.call_member_mail('sync') $$);
select cron.schedule('member-mail-digest', '0 20 * * *', $$ select private.call_member_mail('digest') $$);
