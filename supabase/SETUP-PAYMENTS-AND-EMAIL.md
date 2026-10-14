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

Start in **test mode**; repeat steps 1–4 in live mode when ready to take real money.

1. Products: **Full Deck** £12/month with price lookup key `deck_monthly`, and **Ace** £49/month
   with lookup key `ace_monthly`. (The code finds prices by lookup key, so prices can change
   later without code changes.)
2. Billing portal (Settings → Billing → Customer portal): allow cancelling, updating payment
   method, and switching between the two plans.
3. Webhook endpoint: `https://zbgktqrnnhntmozuzagk.supabase.co/functions/v1/stripe-webhook`
   listening for `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
4. Supabase → Edge Functions → Secrets: `STRIPE_SECRET_KEY` (sk_test_… then sk_live_…),
   `STRIPE_WEBHOOK_SECRET` (whsec_… from step 3), and `SITE_URL` (https://jackofalltrades.life).
5. In `src/config.ts` set `PAYMENTS_LIVE = true` and push.
6. Test with card `4242 4242 4242 4242`, any future date, any CVC.

Founding-member discounts: create a Stripe coupon + promotion code; checkout already accepts
promotion codes. Jack can still upgrade anyone by hand from the You page (Members).
