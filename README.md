# Jack of All Trades — mentorship platform

The members' platform for the Jack of All Trades brand: a public join page plus the member app
(Home, The Deck, Lessons with the Mirror, The Table, Your 1:1, and You).

Live at https://jackofalltrades33.netlify.app. Every push to `main` deploys through Netlify.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173 (talks to the live Supabase project)
npm run build        # production build in dist/
npm run typecheck
```

## How it fits together

- **Front end:** Vite + React + TypeScript, hosted on Netlify.
- **Back end:** Supabase project `jackofalltrades` (London). Accounts use Supabase Auth
  (email + password). All data sits behind row-level security; the rules are in
  `supabase/migrations/`.
- **Plans:** members pick a plan at sign-up, which is stored as a *request*. Everyone starts on
  Open Hand. Until Stripe is connected, Jack upgrades people from the You page (Members list).

| What | File |
|---|---|
| Lessons, series, suits, tier names and prices, call times | `src/content.ts` |
| Every action (sign in, save Mirror, post, book…) and all Supabase calls | `src/store.tsx` |
| Supabase client and error messages | `src/supabase.ts` |
| Sign up / sign in / password reset sheet | `src/components/AuthSheet.tsx` |
| Screens | `src/pages/` |
| Database tables and security rules | `supabase/migrations/` |
| One-off SQL to paste into the Supabase SQL Editor | `supabase/run-in-sql-editor.sql` |

## Who can do what

| | Open Hand | Full Deck | Ace | Jack |
|---|---|---|---|---|
| First lesson of each suit, Mirror answers | ✓ | ✓ | ✓ | ✓ |
| Every lesson | | ✓ | ✓ | ✓ |
| Read the Table | ✓ | ✓ | ✓ | ✓ |
| Post, reply, "me too", Friday Table RSVP | | ✓ | ✓ | ✓ |
| Book a monthly 1:1 call | | | ✓ | sees all calls |
| Pin posts, remove any post, change plans, member list | | | | ✓ |

Mirror answers, progress and bookings are private to each member (Jack sees bookings).

## Making someone admin

In Supabase → SQL Editor:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'you@example.com');
```

## Before inviting real members

1. **Email:** Supabase's built-in email only sends to the project team. Set up custom SMTP
   (Authentication → Emails → SMTP, e.g. Resend) and then turn **Confirm email** back on.
2. **Payments:** connect Stripe Checkout + the customer portal; a webhook (Supabase Edge
   Function) sets `profiles.tier`.
3. **Video:** a private host with signed playback (Mux, Cloudflare Stream or Vimeo).
4. **Content:** replace the example lessons in `src/content.ts`, the `[Photo of Jack]` and
   `[@yourhandle]` placeholders on the join page.
