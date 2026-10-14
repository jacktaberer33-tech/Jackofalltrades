// Starts a Stripe Checkout for the Full Deck or Ace plan, for the signed-in member.
// If they already pay for a plan, it sends them to the Stripe billing portal instead,
// where they can switch plans or cancel.
//
// Secrets (Supabase → Edge Functions → Secrets): STRIPE_SECRET_KEY, optional SITE_URL.
// Stripe prices are found by lookup key: deck_monthly and ace_monthly.
import Stripe from 'npm:stripe@22.6.2';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const LOOKUP: Record<string, string> = { deck: 'deck_monthly', ace: 'ace_monthly' };
const LIVE_STATUSES = ['active', 'trialing', 'past_due'];

function siteFor(req: Request): string {
  const site = (Deno.env.get('SITE_URL') ?? 'https://jackofalltrades33.netlify.app').replace(/\/$/, '');
  const origin = req.headers.get('Origin') ?? '';
  const allowed = [site, 'https://jackofalltrades33.netlify.app', 'http://localhost:5173'];
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

    const { plan } = (await req.json().catch(() => ({}))) as { plan?: string };
    const lookupKey = plan ? LOOKUP[plan] : undefined;
    if (!lookupKey) return json({ error: 'Pick the Full Deck or Ace.' }, 400);

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('name, stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) return json({ error: 'Member not found.' }, 404);

    const site = siteFor(req);

    // Already paying: switching or cancelling happens in the billing portal.
    if (profile.stripe_customer_id && profile.stripe_subscription_id && LIVE_STATUSES.includes(profile.subscription_status ?? '')) {
      const portal = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${site}/#/you`,
      });
      return json({ url: portal.url });
    }

    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const price = prices.data[0];
    if (!price) return json({ error: "That plan isn't set up in Stripe yet." }, 503);

    let customerId = profile.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: profile.name ?? undefined,
        metadata: { user_id: user.id },
      });
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
      success_url: `${site}/?checkout=success#/you`,
      cancel_url: `${site}/#/you`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error('create-checkout failed', err);
    return json({ error: "Couldn't start checkout. Try again in a minute." }, 500);
  }
});
