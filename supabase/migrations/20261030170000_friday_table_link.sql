-- The Friday Table call link (one recurring Google Meet link). Paying members (Full Deck and above)
-- and Jack can read it; only Jack can set it. The app shows a Join button on the day of the call.
create table public.friday_table (
  id boolean primary key default true check (id),
  meet_url text check (meet_url is null or meet_url ~ '^https://[^\s]+$'),
  updated_at timestamptz not null default now()
);

insert into public.friday_table (id) values (true);

alter table public.friday_table enable row level security;

create policy "Paying members and Jack read the call link" on public.friday_table
  for select to authenticated using ((select private.can_post()));
create policy "Jack sets the call link" on public.friday_table
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

revoke all on public.friday_table from anon;
revoke insert, delete on public.friday_table from authenticated;

create trigger friday_table_touch before update on public.friday_table
  for each row execute function private.touch_updated_at();
