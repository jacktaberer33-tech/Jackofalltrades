// Starts a Stripe Checkout for the Full Deck, Ace or Royal Flush plan, for the signed-in member.
// If they already pay for a plan, it opens the Stripe billing portal instead: straight onto a
// "confirm this change" screen when they picked a different plan or term, otherwise the portal home
// (switch plans, change card, see invoices, cancel).
//
// Secrets (Supabase → Edge Functions → Secrets): STRIPE_SECRET_KEY (a restricted rk_ key), optional SITE_URL.
// Stripe prices are found by lookup key, one per plan and term (how long is paid for at once):
// deck_monthly; ace_monthly, ace_quarterly, ace_halfyear; royal_quarterly, royal_halfyear.
// Royal Flush is capped at 5 places: starting a Royal Flush checkout (or upgrade) holds a place until it
// expires (public.take_royal_hold). When it's full, the member goes on the waitlist (requested_tier) and
// Jack gets an alert.
// Whether someone already pays is asked of Stripe, not the profile, which only updates when the webhook
// lands: a second Join in another tab goes to the billing portal, and any other open checkout of theirs is
// closed, so nobody can pay twice.
// Checkout asks members to accept the Membership Terms (live mode: set a Terms of service URL in
// Stripe → Settings → Public details).
// Upgrades open a second billing-portal configuration whose metadata.purpose is "upgrade-confirm":
// it includes Royal Flush, which the default configuration leaves out because of the 5-place cap.
// Referrals: joining Ace with a friend's code (sent as `ref`, or saved on the account at sign-up) applies
// their promotion code automatically. Otherwise checkout has a box to type a code in.
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
const ROYAL_FULL = "Royal Flush is full right now, so you're on the waitlist. I'll email you when a place opens.";
// Checkout sessions for Royal Flush expire after 31 minutes; the hold lasts a little longer.
const ROYAL_SESSION_MINUTES = 31;
const ROYAL_HOLD_MINUTES = 32;
const UPGRADE_CONFIG = 'upgrade-confirm';
const REF_PATTERN = /^[A-Z0-9-]{4,24}$/;
const cleanRef = (v: unknown) => (typeof v === 'string' && REF_PATTERN.test(v.trim().toUpperCase()) ? v.trim().toUpperCase() : null);

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

    const { plan, term, ref } = (await req.json().catch(() => ({}))) as { plan?: string; term?: string; ref?: string };
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
    const holdRoyal = async (): Promise<boolean> => {
      if (plan !== 'royal' || profile.tier === 'royal') return true;
      const { data: held, error } = await admin.rpc('take_royal_hold', { p_member: user.id, p_minutes: ROYAL_HOLD_MINUTES });
      if (error) throw error;
      if (held === true) return true;
      // Full: put them on the waitlist, and tell Jack.
      await admin.from('profiles').update({ requested_tier: 'royal' }).eq('id', user.id);
      await admin.from('jack_alerts').upsert(
        { kind: 'royal_waitlist', member_id: user.id, message: `${profile.name} joined the Royal Flush waitlist.`, dedupe: `royal-waitlist-${user.id}` },
        { onConflict: 'dedupe', ignoreDuplicates: true },
      );
      return false;
    };
    const releaseRoyal = async () => {
      if (plan === 'royal' && profile.tier !== 'royal') await admin.from('royal_holds').delete().eq('member_id', user.id);
    };

    // Already paying? Ask Stripe, so a second Join (another tab, or straight after paying) can't start a second plan.
    let liveSub: Stripe.Subscription | null = null;
    if (profile.stripe_customer_id) {
      const subs = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: 'all', limit: 20 });
      const live = subs.data.filter((s) => LIVE_STATUSES.includes(s.status));
      liveSub = live.find((s) => s.id === profile.stripe_subscription_id) ?? live[0] ?? null;
      if (live.length > 1) {
        await admin.from('jack_alerts').upsert(
          { kind: 'double_subscription', member_id: user.id, message: `${profile.name} has ${live.length} live subscriptions in Stripe (${live.map((s) => s.id).join(', ')}). Cancel and refund the extra one.`, dedupe: `double-${live.map((s) => s.id).sort().join('-')}` },
          { onConflict: 'dedupe', ignoreDuplicates: true },
        );
      }
    }

    // Already paying: changes happen in the billing portal, which shows the proration and handles
    // card authentication. If they picked a different plan or term, go straight to confirming it.
    if (liveSub && profile.stripe_customer_id) {
      const sub = liveSub;
      const item = sub.items.data[0];
      const changing = item && sub.items.data.length === 1 && item.price.id !== price.id;
      if (changing && !(await holdRoyal())) return json({ error: ROYAL_FULL, waitlist: true }, 409);
      let configuration: string | undefined;
      if (changing) {
        const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 20 });
        configuration = configs.data.find((c) => c.metadata?.purpose === UPGRADE_CONFIG)?.id;
      }
      try {
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
      } catch (err) {
        if (changing) await releaseRoyal();
        throw err;
      }
    }

    if (!(await holdRoyal())) return json({ error: ROYAL_FULL, waitlist: true }, 409);

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

    // Close any other checkout this member still has open (another tab, or an earlier try), so only one can be paid.
    const open = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 10 });
    for (const old of open.data) {
      await stripe.checkout.sessions.expire(old.id).catch((err) => console.warn('Could not expire checkout', old.id, err?.message));
    }

    // A friend's referral code, if this is Ace and the code belongs to someone else who's still on Ace or Royal Flush.
    let discounts: Stripe.Checkout.SessionCreateParams.Discount[] | undefined;
    const refCode = plan === 'ace' ? cleanRef(ref) ?? cleanRef(user.user_metadata?.ref) : null;
    if (refCode) {
      const { data: owner } = await admin
        .from('referral_codes')
        .select('member_id, promo_id, active, profiles!inner(tier)')
        .eq('code', refCode)
        .maybeSingle();
      const ownerTier = (owner?.profiles as unknown as { tier?: string } | null)?.tier;
      if (owner?.active && owner.member_id !== user.id && (ownerTier === 'ace' || ownerTier === 'royal')) {
        discounts = [{ promotion_code: owner.promo_id }];
      }
    }

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: price.id, quantity: 1 }],
      subscription_data: { metadata: { user_id: user.id } },
      metadata: { user_id: user.id },
      consent_collection: { terms_of_service: 'required' },
      custom_text: {
        terms_of_service_acceptance: {
          message: `I agree to the [Membership Terms](https://jackofalltrades.life/#/terms) and want my membership to start straight away. If I cancel within 14 days of my first payment, I'm refunded as the terms set out.`,
        },
      },
      integration_identifier: INTEGRATION_ID,
      // A Royal Flush place is held while checkout is open, so keep that window short.
      ...(plan === 'royal' ? { expires_at: Math.floor(Date.now() / 1000) + ROYAL_SESSION_MINUTES * 60 } : {}),
      success_url: `${site}/?checkout=success#/you`,
      cancel_url: `${site}/#/you`,
    };
    let session: Stripe.Checkout.Session;
    try {
      try {
        session = await stripe.checkout.sessions.create(discounts ? { ...params, discounts } : { ...params, allow_promotion_codes: true });
      } catch (err) {
        // Stripe can refuse a code (say, this customer has paid before): carry on without it.
        if (!discounts || !(err instanceof Stripe.errors.StripeInvalidRequestError)) throw err;
        console.warn('Referral code not applied', refCode, err.message);
        session = await stripe.checkout.sessions.create({ ...params, allow_promotion_codes: true });
      }
    } catch (err) {
      await releaseRoyal();
      throw err;
    }
    return json({ url: session.url });
  } catch (err) {
    console.error('create-checkout failed', err);
    return json({ error: "Couldn't start checkout. Try again in a minute." }, 500);
  }
});
