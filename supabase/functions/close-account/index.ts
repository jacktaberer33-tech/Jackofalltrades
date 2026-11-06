// Closes the signed-in member's account, from the You page.
//
// Before anything is deleted it asks Stripe whether they still have a plan that renews: if so, it refuses
// ("cancel your plan first"), so nobody is charged for an account that no longer exists. A plan already set
// to end is fine. It also switches off their Ace referral code in Stripe, so a shared code stops working.
// Then the account goes, and with it everything they own (progress, answers, posts, bookings).
//
// Secrets: STRIPE_SECRET_KEY (a restricted rk_ key). Without it, members with no Stripe customer can still close.
import Stripe from 'npm:stripe@23.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const LIVE_STATUSES = ['active', 'trialing', 'past_due'];
const RENEWING = 'Your plan still renews. Cancel it first with "Change plan, card or cancel", then close your account.';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    const user = auth?.user;
    if (authError || !user) return json({ error: 'Sign in first.' }, 401);

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, subscription_status, cancel_at_period_end')
      .eq('id', user.id)
      .maybeSingle();
    const { data: code } = await admin.from('referral_codes').select('promo_id, active').eq('member_id', user.id).maybeSingle();

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (profile?.stripe_customer_id || code?.active) {
      if (!stripeKey) return json({ error: "Couldn't check your plan. Email Jack and he'll close your account for you." }, 503);
      const stripe = new Stripe(stripeKey);
      if (profile?.stripe_customer_id) {
        const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: 'all', limit: 20 });
        const renewing = subs.data.some((s) => LIVE_STATUSES.includes(s.status) && !s.cancel_at_period_end && !s.cancel_at);
        if (renewing) return json({ error: RENEWING }, 409);
      }
      if (code?.active) await stripe.promotionCodes.update(code.promo_id, { active: false });
    } else if (profile && LIVE_STATUSES.includes(profile.subscription_status ?? '') && !profile.cancel_at_period_end) {
      return json({ error: RENEWING }, 409);
    }

    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    console.log('Account closed', user.id);
    return json({ closed: true });
  } catch (err) {
    console.error('close-account failed', err);
    return json({ error: "Couldn't close your account. Try again in a minute, or email Jack." }, 500);
  }
});
