-- Jack's account keeps the name Freddy, but on the Table his posts and replies show as "Jack".
create or replace function private.stamp_author()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := coalesce((select auth.uid()), new.author_id);
  v_name text;
  v_admin boolean;
begin
  select p.name, p.is_admin into v_name, v_admin from public.profiles p where p.id = v_uid;
  new.author_id := v_uid;
  new.from_jack := coalesce(v_admin, false);
  new.author_name := case when new.from_jack then 'Jack' else coalesce(v_name, 'Member') end;
  new.created_at := now();
  return new;
end $function$;

update public.posts set author_name = 'Jack' where from_jack;
update public.post_replies set author_name = 'Jack' where from_jack;
