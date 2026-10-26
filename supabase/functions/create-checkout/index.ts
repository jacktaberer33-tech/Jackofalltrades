// Starts a Stripe Checkout for the Full Deck, Ace or Royal Flush plan, for the signed-in member.
// If they already pay for a plan, it opens the Stripe billing portal instead: straight onto a
// "confirm this change" screen when they picked a different plan or term, otherwise the portal home
// (switch plans, change card, see invoices, cancel).
//
// Secrets (Supabase → Edge Functions → Secrets): STRIPE_SECRET_KEY (a restricted rk_ key), optional SITE_URL.
// Stripe prices are found by lookup key, one per plan and term (how long is paid for at once):
// deck_monthly; ace_monthly, ace_quarterly, ace_halfyear; royal_quarterly, royal_halfyear.
// Royal Flush is capped at 5 places (public.royal_places_left).
// Checkout asks members to accept the Membership Terms (live mode: set a Terms of service URL in
// Stripe → Settings → Public details).
// Upgrades open a second billing-portal configuration whose metadata.purpose is "upgrade-confirm":
// it includes Royal Flush, which the default configuration leaves out because of the 5-place cap.
import Stripe from 'npm:stripe@23.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// The first term listed for each plan is its default.
const LOOKUP: Record<string, Record<string, string>> = {
  deck: { month: 'deck_monthly' },
  ace: { month: 'ace_monthly', quarter: 'ace_quarterly', half: 'ace_halfyear' },
  royal: { quarter: 'royal_quarterly', half: 'royal_halfyear' },
};
const LIVE_STATUSES = ['active', 'trialing', 'past_due'];
// Tags these sessions in the Stripe Dashboard so this flow can be compared with any others later.
const INTEGRATION_ID = 'jack-membership-checkout-qvtrmzke';
const ROYAL_FULL = "Royal Flush is full right now. You're welcome to join the waitlist.";
const UPGRADE_CONFIG = 'upgrade-confirm';

function siteFor(req: Request): string {
  const site = (Deno.env.get('SITE_URL') ?? 'https://jackofalltrades.life').replace(/\/$/, '');
  const origin = req.headers.get('Origin') ?? '';
  const allowed = [
    site,
    'https://jackofalltrades.life',
    'https://www.jackofalltrades.life',
    'https://jackofalltrades33.netlify.app',
    'http://localhost:5173',
  ];
  // Netlify deploy previews, so payments can be tested in a sandbox before going live.
  if (/^https:\/\/deploy-preview-\d+--jackofalltrades33\.netlify\.app$/.test(origin)) return origin;
  return allowed.includes(origin) ? origin : site;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return json({ error: "Payments aren't switched on yet." }, 503);
  const stripe = new Stripe(stripeKey);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    const user = auth?.user;
    if (authError || !user) return json({ error: 'Sign in first.' }, 401);

    const { plan, term } = (await req.json().catch(() => ({}))) as { plan?: string; term?: string };
    const keys = plan ? LOOKUP[plan] : undefined;
    if (!keys) return json({ error: 'Pick the Full Deck, Ace or Royal Flush.' }, 400);
    const lookupKey = (term && keys[term]) || Object.values(keys)[0];

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('name, tier, stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) return json({ error: 'Member not found.' }, 404);

    const site = siteFor(req);
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const price = prices.data[0];
    if (!price) return json({ error: "That plan isn't set up in Stripe yet." }, 503);

    // Royal Flush has 5 places. Members already on Royal Flush can still change term.
    const royalCheck = async () => {
      if (plan !== 'royal' || profile.tier === 'royal') return true;
      const { data: left, error } = await admin.rpc('royal_places_left');
      if (error) throw error;
      return !(typeof left === 'number' && left <= 0);
    };

    // Already paying: changes happen in the billing portal, which shows the proration and handles
    // card authentication. If they picked a different plan or term, go straight to confirming it.
    if (profile.stripe_customer_id && profile.stripe_subscription_id && LIVE_STATUSES.includes(profile.subscription_status ?? '')) {
      const sub = await stripe.subscriptions.retrieve(profile.stripe_subscription_id);
      const item = sub.items.data[0];
      const changing = item && sub.items.data.length === 1 && item.price.id !== price.id && LIVE_STATUSES.includes(sub.status);
      if (changing && !(await royalCheck())) return json({ error: ROYAL_FULL }, 409);
      let configuration: string | undefined;
      if (changing) {
        const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 20 });
        configuration = configs.data.find((c) => c.metadata?.purpose === UPGRADE_CONFIG)?.id;
      }
      const portal = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${site}/#/you`,
        ...(changing
          ? {
              ...(configuration ? { configuration } : {}),
              flow_data: {
                type: 'subscription_update_confirm' as const,
                subscription_update_confirm: {
                  subscription: sub.id,
                  items: [{ id: item.id, price: price.id, quantity: 1 }],
                },
                after_completion: { type: 'redirect' as const, redirect: { return_url: `${site}/?changed=${plan}#/you` } },
              },
            }
          : {}),
      });
      return json({ url: portal.url });
    }

    if (!(await royalCheck())) return json({ error: ROYAL_FULL }, 409);

    let customerId = profile.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email: user.email ?? undefined, name: profile.name ?? undefined, metadata: { user_id: user.id } },
        { idempotencyKey: `customer-${user.id}` },
      );
      customerId = customer.id;
      const { error } = await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
      if (error) throw error;
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: price.id, quantity: 1 }],
      subscription_data: { metadata: { user_id: user.id } },
      metadata: { user_id: user.id },
      allow_promotion_codes: true,
      consent_collection: { terms_of_service: 'required' },
      custom_text: {
        terms_of_service_acceptance: {
          message: `I agree to the [Membership Terms](https://jackofalltrades.life/#/terms) and want my membership to start straight away. If I cancel within 14 days of my first payment, I'm refunded as the terms set out.`,
        },
      },
      integration_identifier: INTEGRATION_ID,
      // Royal Flush places are checked when checkout starts, so keep that window short.
      ...(plan === 'royal' ? { expires_at: Math.floor(Date.now() / 1000) + 31 * 60 } : {}),
      success_url: `${site}/?checkout=success#/you`,
      cancel_url: `${site}/#/you`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error('create-checkout failed', err);
    return json({ error: "Couldn't start checkout. Try again in a minute." }, 500);
  }
});
