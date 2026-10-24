// Opens the Stripe billing portal for the signed-in member: change card, switch plan,
// see invoices, or cancel.
//
// Secrets: STRIPE_SECRET_KEY (a restricted rk_ key), optional SITE_URL.
import Stripe from 'npm:stripe@23.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

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

    const { data: profile } = await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
    if (!profile?.stripe_customer_id) return json({ error: "You don't have a paid plan yet." }, 404);

    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${siteFor(req)}/#/you`,
    });
    return json({ url: portal.url });
  } catch (err) {
    console.error('billing-portal failed', err);
    return json({ error: "Couldn't open billing. Try again in a minute." }, 500);
  }
});
