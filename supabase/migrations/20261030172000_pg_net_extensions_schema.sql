-- Tidy-up from the security advisor: pg_net belonged in the extensions schema, not public.
-- pg_net can't be moved, so it's dropped and recreated (its functions stay in the net schema).
drop extension if exists pg_net;
create extension pg_net with schema extensions;
