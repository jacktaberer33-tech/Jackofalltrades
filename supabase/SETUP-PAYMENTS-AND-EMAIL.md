# Switching on email and payments

Everything in code is built. These are the steps that need accounts, keys or a domain.

## Email (Resend)

1. Buy the domain and point it at Netlify (site → Domain management).
2. In Resend, add the domain (e.g. `mail.yourdomain.co.uk`) and add the DNS records it shows
   in Netlify DNS. Wait for Resend to say **Verified**.
3. In Resend, create an API key with **Sending access** only.
4. Supabase → Authentication → Emails → **SMTP Settings** → enable custom SMTP:
   - Sender email: `jack@yourdomain.co.uk` (any address on the verified domain)
   - Sender name: `Jack of All Trades`
   - Host: `smtp.resend.com` · Port: `465` · Username: `resend` · Password: the Resend API key
5. Supabase → Authentication → Emails → **Templates**: paste
   `email-templates/confirm-signup.html` into *Confirm signup* (subject "Take your seat at the
   Table") and `email-templates/reset-password.html` into *Reset password* (subject "Your new
   password link").
6. Supabase → Authentication → Sign In / Providers → Email → turn **Confirm email** back on.
7. Supabase → Authentication → URL Configuration: set Site URL to the new domain and add
   `https://yourdomain.co.uk/**` to Redirect URLs (keep the netlify.app one too).

## Payments (Stripe)

The code is built: `create-checkout` (join, or confirm a plan change), `billing-portal` (change card,
switch plan, invoices, cancel) and `stripe-webhook` (keeps each member's plan in step with Stripe).
Everything below is clicking in the Stripe Dashboard. Do it all in a **sandbox** first (Stripe's test
environment: account switcher, top left → Sandboxes), then repeat in live mode to take real money.

### 1. Plans and prices

One **product per plan**, so receipts and invoices name the plan. All recurring, GBP. Set each
price's **lookup key** (under "More pricing options" / advanced); the code finds prices by it, so
amounts can change later without code changes.

| Product | Price | Bills every | Lookup key |
|---|---|---|---|
| Full Deck | £19 | month | `deck_monthly` |
| Ace | £99 | month | `ace_monthly` |
| Ace | £269 | 3 months | `ace_quarterly` |
| Ace | £495 | 6 months | `ace_halfyear` |
| Royal Flush | £949 | 3 months | `royal_quarterly` |
| Royal Flush | £1,745 | 6 months | `royal_halfyear` |

Founding-member discounts: create a coupon and a promotion code; Checkout already accepts codes.

### 2. Public details and branding

Settings → Business → **Public details**:
- Business name `Jack of All Trades`, support email `jackofalltrades.life@gmail.com`.
- **Terms of service URL** `https://jackofalltrades.life/#/terms`. Required: Checkout asks every
  member to tick that they accept the terms and want the membership to start straight away, and
  Stripe refuses to open Checkout without this URL.
- Privacy policy URL `https://jackofalltrades.life/#/privacy`.
- Statement descriptor `JACK OF ALL TRADES` (what shows on bank statements).
- Business address: the I-Support address once it's approved. It's printed on invoices and receipts.

Settings → **Branding**: logo/icon (`public/favicon` art), brand colour `#c81e37`, accent `#121211`.

### 3. Customer emails and failed payments

Settings → Billing → **Subscriptions and emails**:
- Send **receipts** for successful payments and **finalized invoices** to customers.
- **Send emails about upcoming renewals**, with **Upcoming renewal events** set to **7 days**. The
  Membership Terms promise upfront members a reminder at least 7 days before renewal.
- **Send emails when card payments fail** and **emails about expiring cards**, linking to the
  Stripe-hosted page so members can fix their card themselves.
- Failed payments: turn on **Smart Retries**; after the last retry, **cancel the subscription**.
  The webhook then moves the member back to Open Hand. (While Stripe is retrying, the member keeps
  their plan.)

### 4. Customer portal

Settings → Billing → **Customer portal**:
- Allow updating payment methods, viewing invoices, and **cancelling at the end of the period**
  (ask for a reason: it's useful feedback).
- Allow **switching plans** between **Full Deck** and **Ace** (all their prices). Leave **Royal Flush
  out** of this list: it has 5 places, and the app checks there's a free one before it opens the portal
  on a "confirm this change" screen. In the sandbox, test an Ace member upgrading to Royal Flush from
  the app; if Stripe refuses because Royal Flush isn't listed, add it and keep an eye on the count.
- Upgrades: **prorate** and **invoice immediately**. Downgrades: **at the end of the billing period**,
  so someone who paid for 6 months keeps them before switching.

### 5. Webhook

Workbench → Webhooks → **Add destination**:
- URL `https://zbgktqrnnhntmozuzagk.supabase.co/functions/v1/stripe-webhook`
- API version `2026-09-30.endive` (matches the code).
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `customer.subscription.created`,
  `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`,
  `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`,
  `charge.dispute.created`, `radar.early_fraud_warning.created`.

What the webhook does with them: payments and subscription changes set the member's plan.
**Disputes, early fraud warnings and full refunds cancel the subscription immediately** (a refund
ends the membership under the terms; a disputed card shouldn't be charged again). Partial refunds
change nothing. Stripe also emails you about every dispute, and you answer those in the Dashboard.

### 6. Keys (only you handle these)

Use a **restricted key** (`rk_…`), not the secret key: Developers → API keys → Create restricted key,
named `jackofalltrades-site`, with:

| Resource | Permission |
|---|---|
| Checkout Sessions | Write |
| Customers | Write |
| Customer portal | Write |
| Subscriptions | Write |
| Prices, Products | Read |
| Charges | Read |

Supabase → Edge Functions → **Secrets**: `STRIPE_SECRET_KEY` = the `rk_…` key,
`STRIPE_WEBHOOK_SECRET` = the `whsec_…` from step 5, `SITE_URL` = `https://jackofalltrades.life`.
Keys never go in the code, in chat, or in GitHub. Turn on two-factor sign-in for Stripe with an
authenticator app or passkey, not SMS.

### 7. Test in the sandbox

1. Deploy the three functions (Claude can do this), then open a pull request's Netlify deploy
   preview: `netlify.toml` turns payments on for previews only, so the live site stays as it is.
2. Join with `jacktaberer33+test@gmail.com` using card `4242 4242 4242 4242`, any future date, any
   CVC. The plan should change within seconds. Repeat for an upfront plan.
3. From the You page: switch plan, change card, cancel. Try `4000 0000 0000 0341` (attaches, then
   fails on renewal) and a dispute with `4000 0000 0000 0259`.
4. Check Workbench → Webhooks shows every delivery succeeded.

### 8. Go live

Repeat steps 1–6 in live mode (sandbox products, settings and keys don't carry over), swap the
secrets for live ones, then in Netlify → Site configuration → Environment variables add
`VITE_PAYMENTS_LIVE` = `true` for **Production** and redeploy. Make one real £19 payment and refund it.
From then on deploy previews talk to live Stripe too, so remove the preview setting from
`netlify.toml` (or point previews at a separate sandbox) once you're live.

### Invoicing

Every subscription payment already makes an invoice and a receipt, so there's nothing to build.
For one-off work (a PT block, a talk at a school) use Dashboard → Invoices → **Create invoice**:
add the customer and a line item, and Stripe emails it with a pay-online link. Set the footer and
your business address under Settings → Billing → **Invoice template** first.

### Tax

Nothing in the code turns tax on. That's deliberate: Stripe only collects tax where you've told it
you're registered, and turning on automatic tax without a registration collects nothing while
looking like it works. Things to settle with your accountant before you need them:
- **UK VAT**: you only register once taxable turnover passes the VAT threshold. If you do, add the
  registration in Stripe → Tax → Locations and the code can switch on `automatic_tax`.
- **Members outside the UK**: recorded lessons can count as digital services, which have their own
  VAT rules for customers in the EU. Ask your accountant whether that applies to you.
- Stripe Tax → Settings: set a head office address (the I-Support one). In live mode, Tax →
  Locations then flags places where your sales may be getting near a registration threshold.
