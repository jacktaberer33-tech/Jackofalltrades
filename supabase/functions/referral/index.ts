// Gives an Ace or Royal Flush member their personal referral code, making it the first time they ask.
// A friend who joins Ace with the code gets £50 off their first payment; stripe-webhook then credits
// the member £50 off their next one (see supabase/migrations/20261103100000_ace_referrals.sql).
//
// The code is a Stripe promotion code on the "ace-referral-50" coupon (£50 off once, Ace only), limited
// to customers who have never paid. It's paused while the member isn't on Ace or Royal Flush, and
// switched back on here when they return.
//
// Secrets: STRIPE_SECRET_KEY (restricted key: Promotion codes write, Coupons read).
import Stripe from 'npm:stripe@23.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const COUPON_ID = 'ace-referral-50';
const ELIGIBLE = ['ace', 'royal'];
// No 0/O or 1/I/L, so a code read out loud or copied by hand still works.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function randomPart(n: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** "Cam" → "CAM-7K2P". Letters from their first name (up to 8), then 4 random characters. */
export function makeCode(name: string | null | undefined): string {
  const base = (name ?? '').normalize('NFKD').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 8) || 'FRIEND';
  return `${base}-${randomPart(4)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return json({ error: "Referrals aren't switched on yet." }, 503);
  const stripe = new Stripe(stripeKey);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    const user = auth?.user;
    if (authError || !user) return json({ error: 'Sign in first.' }, 401);

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, name, tier, is_admin')
      .eq('id', user.id)
      .single();
    if (profileError || !profile) return json({ error: 'Member not found.' }, 404);
    if (profile.is_admin || !ELIGIBLE.includes(profile.tier)) return json({ status: 'not_eligible' });

    const { count } = await admin
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', user.id);
    const joined = count ?? 0;

    const { data: existing } = await admin
      .from('referral_codes')
      .select('code, promo_id, active')
      .eq('member_id', user.id)
      .maybeSingle();
    if (existing) {
      if (!existing.active) {
        await stripe.promotionCodes.update(existing.promo_id, { active: true });
        await admin.from('referral_codes').update({ active: true }).eq('member_id', user.id);
      }
      return json({ status: 'ready', code: existing.code, joined });
    }

    // New code. Stripe refuses a code that's already in use, so try a few random endings.
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = makeCode(profile.name);
      let promo: Stripe.PromotionCode;
      try {
        promo = await stripe.promotionCodes.create(
          {
            code,
            promotion: { type: 'coupon', coupon: COUPON_ID },
            restrictions: { first_time_transaction: true },
            metadata: { kind: 'ace_referral', referrer_id: user.id },
          },
          { idempotencyKey: `referral-code-${user.id}-${code}` },
        );
      } catch (err) {
        if (err instanceof Stripe.errors.StripeInvalidRequestError && /already exists|in use/i.test(err.message)) continue;
        throw err;
      }
      const { error } = await admin.from('referral_codes').insert({ member_id: user.id, code, promo_id: promo.id });
      if (!error) return json({ status: 'ready', code, joined });
      // Opened in two tabs at once: keep the code that was saved first and switch this one off.
      await stripe.promotionCodes.update(promo.id, { active: false });
      const { data: saved } = await admin.from('referral_codes').select('code').eq('member_id', user.id).maybeSingle();
      if (saved) return json({ status: 'ready', code: saved.code, joined });
      throw error;
    }
    throw new Error('Could not find a free referral code');
  } catch (err) {
    console.error('referral failed', err);
    return json({ error: "Couldn't load your referral code. Try again in a minute." }, 500);
  }
});
