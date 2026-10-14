# Jack of All Trades — mentorship platform

The members' platform for the Jack of All Trades brand: a public join page plus the member app
(Home, The Deck, Lessons with the Mirror, The Table, Your 1:1, and You).

This is a working front end. Everything a member does (joining, finishing lessons, Mirror answers,
posts, "me too"s, 1:1 bookings) is saved in the browser, so it behaves like the real thing for one
person. Accounts, payments and a shared community need a backend; see **Next steps**.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/, ready for Netlify or Vercel
npm run typecheck
```

`npm run build:artifact` makes a single self-contained HTML page (React from cdnjs, everything
else inlined) in `artifact/`, used for the shareable preview link.

## Where things live

| What | File |
|---|---|
| Lessons, series, suits, tier names and prices, call times | `src/content.ts` |
| Saved state and every action (join, save Mirror, post, book…) | `src/store.tsx` |
| Routes (`#/app`, `#/deck`, `#/lesson/:id`, `#/table`, `#/ace`, `#/you`) | `src/router.tsx` |
| Screens | `src/pages/` |
| Logo, playing cards, nav shell, suit filter | `src/components/` |
| Colours, type, layout (light and dark themes) | `src/styles.css` |
| Date helpers (Friday Table = last Friday of the month, 7pm) | `src/dates.ts` |

The lessons in `content.ts` are examples written in Jack's voice. Swap in the real titles,
summaries and Mirror questions as videos get recorded. Prices (£12 Full Deck, £49 Ace) and the
"first 50 founding members" offer are proposals; change them in `content.ts` and on the join page
copy in `src/pages/Landing.tsx`.

Placeholders still to fill: `[Photo of Jack]` and `[@yourhandle]` on the join page.

## The model

- **Four suits**: Hearts (relationships), Spades (work and grit), Clubs (body and training),
  Diamonds (money and worth). Every lesson belongs to one series in one suit.
- **The Mirror**: every lesson ends with one honest question. Answers are private unless the
  member shares them to the Table.
- **Tiers**: Open Hand (free: first lesson of each suit, read-only Table), Full Deck (everything),
  Ace (adds a monthly 1:1 call).

## Next steps (the backend)

`src/store.tsx` is the only file the screens talk to, so the backend slots in behind the same
actions:

1. **Accounts and data**: a hosted Postgres with auth (Supabase is the quickest fit for React).
   Tables: `members`, `progress`, `mirror_answers`, `posts`, `me_too`, `bookings`.
2. **Payments**: Stripe Checkout + the customer portal for the Full Deck and Ace subscriptions;
   a webhook sets the member's tier.
3. **Video**: a private video host with signed playback URLs (Mux, Cloudflare Stream or Vimeo)
   so lessons can't be shared outside the membership.
4. **1:1 calls**: real availability and calendar invites (Cal.com or Calendly embed), replacing
   `CALL_TIMES`.
5. **Moderation** on the Table before opening it to strangers.
