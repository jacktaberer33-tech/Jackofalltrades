-- Which lessons are live: those Jack has attached a video to. The app shows the rest as "Filming soon".
-- Returns lesson ids only (never the video ids), to anyone, since the Deck shows what's ready before joining.
create function public.filmed_lessons() returns setof text
language sql stable security definer set search_path = ''
as $$ select lesson_id from public.lesson_videos order by lesson_id $$;
revoke execute on function public.filmed_lessons() from public;
grant execute on function public.filmed_lessons() to anon, authenticated;
