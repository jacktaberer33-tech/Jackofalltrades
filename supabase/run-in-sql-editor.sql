-- Paste this into Supabase → SQL Editor → New query, then click Run.
-- (Claude couldn't apply these two parts itself: they need your approval in the dashboard.)

-- 1. Tighten who can call the database functions. Each one already refuses people it
--    shouldn't serve; this also stops signed-out visitors calling them at all.
revoke execute on function public.taken_slots(date, date) from public, anon;
revoke execute on function public.rsvp_count(date) from public, anon;
revoke execute on function public.admin_members() from public, anon;
revoke execute on function public.set_member_tier(uuid, text) from public, anon;
grant execute on function public.taken_slots(date, date) to authenticated;
grant execute on function public.rsvp_count(date) to authenticated;
grant execute on function public.admin_members() to authenticated;
grant execute on function public.set_member_tier(uuid, text) to authenticated;

-- 2. Let members close their own account from the You page.
--    Everything they own (progress, answers, posts, bookings) is removed with it.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = (select auth.uid());
end $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
