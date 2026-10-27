-- Lesson videos live in Bunny Stream. This table maps each lesson to its Bunny video and records the
-- cheapest plan that may watch it. Members never read it: the lesson-video edge function (service role)
-- checks the member's plan and hands back a short-lived signed player link. Only Jack can see and edit it.
--
-- min_tier mirrors unlockedBy() in src/content.ts ('open' for the free lesson in each suit). The app writes
-- it whenever Jack attaches a video; if who a card is for changes in content.ts, update it here too.
create table public.lesson_videos (
  lesson_id text primary key check (lesson_id ~ '^[a-z0-9-]{1,80}$'),
  video_id uuid not null,
  min_tier text not null check (min_tier in ('open', 'deck', 'ace', 'royal')),
  updated_at timestamptz not null default now()
);

alter table public.lesson_videos enable row level security;

create policy "Jack reads lesson videos" on public.lesson_videos
  for select to authenticated using ((select private.is_admin()));
create policy "Jack adds lesson videos" on public.lesson_videos
  for insert to authenticated with check ((select private.is_admin()));
create policy "Jack changes lesson videos" on public.lesson_videos
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Jack removes lesson videos" on public.lesson_videos
  for delete to authenticated using ((select private.is_admin()));

revoke all on public.lesson_videos from anon;

create or replace function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger lesson_videos_touch before update on public.lesson_videos
  for each row execute function private.touch_updated_at();
