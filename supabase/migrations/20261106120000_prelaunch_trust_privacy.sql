-- Pre-launch fixes from the beta test (4 Nov 2026), batch 2: trust and privacy.

-- 1. Names (05-3, 07-7). Names are tidied (spaces trimmed and squeezed, at most 40 characters) whenever
--    they're saved, so a blank or over-long name can't get in through the API. A blank sign-up name
--    becomes "Member"; renaming to blank is refused.
create function private.tidy_profile_name() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.name := left(btrim(regexp_replace(coalesce(new.name, ''), '\s+', ' ', 'g')), 40);
  if new.name = '' then
    if tg_op = 'INSERT' then
      new.name := 'Member';
    else
      raise exception 'Your name can''t be blank' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_tidy_name before insert or update of name on public.profiles
  for each row execute function private.tidy_profile_name();

-- Only Jack's own posts show as "Jack". A member whose name is Jack (or looks like the host's) shows
-- as "Jack (member)", so nobody can pass themselves off as him at the Table.
create or replace function private.stamp_author() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := coalesce((select auth.uid()), new.author_id);
  v_name text;
  v_admin boolean;
begin
  select p.name, p.is_admin into v_name, v_admin from public.profiles p where p.id = v_uid;
  new.author_id := v_uid;
  new.from_jack := coalesce(v_admin, false);
  v_name := coalesce(nullif(btrim(v_name), ''), 'Member');
  if not new.from_jack
     and lower(regexp_replace(v_name, '[^a-zA-Z ]', '', 'g')) in
         ('jack', 'jack t', 'jack taberer', 'jack of all trades', 'the croupier', 'croupier', 'admin', 'host', 'coach') then
    v_name := v_name || ' (member)';
  end if;
  new.author_name := case when new.from_jack then 'Jack' else v_name end;
  new.created_at := now();
  return new;
end $$;

-- 2. Referrals (07-2). Only Jack reads the referrals table. Members see how many friends joined with
--    their code through the referral function, which counts them without saying who.
drop policy if exists "Members read referrals they made; Jack reads all" on public.referrals;
create policy "Jack reads referrals" on public.referrals for select to authenticated
  using ((select private.is_admin()));
