-- Applied to the jackofalltrades Supabase project on 14 Oct 2026.
-- Lesson progress, saved lessons, Mirror answers, and the Table (posts, replies, me-too).

create table public.progress (
  member_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 80),
  completed_at timestamptz not null default now(),
  primary key (member_id, lesson_id)
);
alter table public.progress enable row level security;
create policy "Members manage their own progress" on public.progress
  for all to authenticated using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()));

create table public.saved_lessons (
  member_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 80),
  created_at timestamptz not null default now(),
  primary key (member_id, lesson_id)
);
alter table public.saved_lessons enable row level security;
create policy "Members manage their own saved lessons" on public.saved_lessons
  for all to authenticated using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()));

create table public.mirror_answers (
  member_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) <= 80),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  shared boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (member_id, lesson_id)
);
alter table public.mirror_answers enable row level security;
create policy "Members manage their own Mirror answers" on public.mirror_answers
  for all to authenticated using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()));

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  author_name text not null default '',
  from_jack boolean not null default false,
  suit text check (suit in ('hearts','spades','clubs','diamonds')),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  mirror_lesson_id text check (char_length(mirror_lesson_id) <= 80),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index posts_created_at_idx on public.posts (created_at desc);
create index posts_author_id_idx on public.posts (author_id);

create table public.post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  author_name text not null default '',
  from_jack boolean not null default false,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index post_replies_post_idx on public.post_replies (post_id, created_at);
create index post_replies_author_idx on public.post_replies (author_id);

create table public.post_me_too (
  post_id uuid not null references public.posts(id) on delete cascade,
  member_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, member_id)
);
create index post_me_too_member_idx on public.post_me_too (member_id);

-- Author name and Jack badge always come from the author's profile, never the client.
create function private.stamp_author() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := coalesce((select auth.uid()), new.author_id);
  v_name text;
  v_admin boolean;
begin
  select p.name, p.is_admin into v_name, v_admin from public.profiles p where p.id = v_uid;
  new.author_id := v_uid;
  new.author_name := coalesce(v_name, 'Member');
  new.from_jack := coalesce(v_admin, false);
  new.created_at := now();
  return new;
end $$;

create function private.only_jack_pins() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not new.from_jack then new.pinned := false; end if;
  return new;
end $$;

create trigger posts_a_stamp_author before insert on public.posts
  for each row execute function private.stamp_author();
create trigger posts_b_only_jack_pins before insert on public.posts
  for each row execute function private.only_jack_pins();
create trigger post_replies_stamp_author before insert on public.post_replies
  for each row execute function private.stamp_author();

alter table public.posts enable row level security;
create policy "Members read the Table" on public.posts for select to authenticated using (true);
create policy "Full Deck and Ace members post" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.can_post()));
create policy "Jack pins and edits posts" on public.posts for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Authors and Jack remove posts" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()));

alter table public.post_replies enable row level security;
create policy "Members read replies" on public.post_replies for select to authenticated using (true);
create policy "Full Deck and Ace members reply" on public.post_replies for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.can_post()));
create policy "Authors and Jack remove replies" on public.post_replies for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()));

alter table public.post_me_too enable row level security;
create policy "Members see me-toos" on public.post_me_too for select to authenticated using (true);
create policy "Full Deck and Ace members add me-too" on public.post_me_too for insert to authenticated
  with check (member_id = (select auth.uid()) and (select private.can_post()));
create policy "Members remove their own me-too" on public.post_me_too for delete to authenticated
  using (member_id = (select auth.uid()));
