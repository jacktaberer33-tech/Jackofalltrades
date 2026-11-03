// Receives events from Stripe and keeps each member's plan in step with their subscription.
// Paying moves a member onto the Full Deck, Ace or Royal Flush; a subscription that ends (cancelled,
// or unpaid after Stripe's retries) moves them back to Open Hand.
//
// Every event is treated as a nudge: the handler fetches the subscription fresh from Stripe and
// saves its current state, so events arriving late, twice or out of order can't leave a stale plan.
//
// Disputes and early fraud warnings cancel the member's subscription straight away, so a disputed
// card isn't charged again. A full refund does the same: under the Membership Terms a refund ends
// the membership. Partial refunds are left alone (they can be goodwill).
//
// Referrals (give £50, get £50): when a friend's Ace checkout used a member's referral code, the
// referral is recorded and that member gets £50 of Stripe credit off their next payment. If the friend's
// first payment is refunded or disputed, whatever of that credit is still unused is taken back. A
// member's code is paused when they leave Ace and Royal Flush. Referral problems are logged and noted
// for Jack, never allowed to fail the event, so a member's plan always stays in step.
//
// Secrets: STRIPE_SECRET_KEY (a restricted rk_ key), STRIPE_WEBHOOK_SECRET.
// Stripe endpoint: https://<project>.supabase.co/functions/v1/stripe-webhook, listening for:
//   checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
//   customer.subscription.created, customer.subscription.updated, customer.subscription.deleted,
//   customer.subscription.paused, customer.subscription.resumed,
//   invoice.paid, invoice.payment_failed,
//   charge.refunded, charge.dispute.created, radar.early_fraud_warning.created
import Stripe from 'npm:stripe@23.0.0';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';

const TIER_BY_LOOKUP: Record<string, 'deck' | 'ace' | 'royal'> = {
  deck_monthly: 'deck',
  ace_monthly: 'ace',
  ace_quarterly: 'ace',
  ace_halfyear: 'ace',
  royal_quarterly: 'royal',
  royal_halfyear: 'royal',
};
const LIVE_STATUSES = ['active', 'trialing', 'past_due'];
const REFERRAL_CREDIT = 5000; // £50, in pence
const REFERRER_TIERS = ['ace', 'royal'];

const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const stripe = stripeKey ? new Stripe(stripeKey) : null;
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const idOf = (x: string | { id: string } | null | undefined) => (typeof x === 'string' ? x : x?.id ?? null);

/** Saves a subscription's current state onto the member it belongs to. */
async function syncSubscription(subId: string, userIdHint: string | null) {
  const sub = await stripe!.subscriptions.retrieve(subId);
  const customerId = idOf(sub.customer)!;
  const item = sub.items.data[0];
  const planTier = TIER_BY_LOOKUP[item?.price?.lookup_key ?? ''];
  const live = LIVE_STATUSES.includes(sub.status);
  // A cancellation can be stored either as cancel_at_period_end, or (billing portal, flexible billing
  // mode) as a cancel_at date with that flag false. Either way the member keeps the plan until then.
  const endsAt = sub.cancel_at ?? null;
  const cancelling = !!sub.cancel_at_period_end || !!endsAt;
  const itemEnd = item?.current_period_end ?? null;
  const periodEnd = endsAt && itemEnd ? Math.min(endsAt, itemEnd) : endsAt ?? itemEnd;

  // Find the member by their Stripe customer (saved before checkout), else by the id we stamped on it.
  let { data: profile } = await admin
    .from('profiles')
    .select('id, tier, stripe_subscription_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  const userId = userIdHint || (sub.metadata?.user_id as string | undefined);
  if (!profile && userId) {
    ({ data: profile } = await admin.from('profiles').select('id, tier, stripe_subscription_id').eq('id', userId).maybeSingle());
  }
  if (!profile) {
    console.warn('No member for subscription', sub.id, customerId);
    return;
  }

  // An old, replaced subscription ending must not downgrade someone on a newer one.
  if (!live && profile.stripe_subscription_id && profile.stripe_subscription_id !== sub.id) {
    console.log('Ignoring end of superseded subscription', sub.id);
    return;
  }

  // Royal Flush is capped at 5. Checkout checks first, but two people paying at once could overfill it.
  if (live && planTier === 'royal' && profile.tier !== 'royal') {
    const { data: left } = await admin.rpc('royal_places_left');
    if (typeof left === 'number' && left <= 0) console.warn('Royal Flush is over 5 places after', profile.id, 'joined');
  }

  const { error } = await admin
    .from('profiles')
    .update({
      tier: live && planTier ? planTier : 'open',
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: cancelling,
    })
    .eq('id', profile.id);
  if (error) throw error;
  console.log('Synced', profile.id, sub.status, planTier ?? 'no plan');

  const tier = live && planTier ? planTier : 'open';
  if (!REFERRER_TIERS.includes(tier)) await quietly('pausing referral code', () => pauseReferralCode(profile.id));
}

/** Runs a referral step, logging failures instead of throwing: plan syncing must never wait on referrals. */
async function quietly(what: string, step: () => Promise<void>) {
  try {
    await step();
  } catch (err) {
    console.error('Referral problem while', what, err);
  }
}

/** Stops a member's referral code working in Stripe while they aren't on Ace or Royal Flush. */
async function pauseReferralCode(memberId: string) {
  const { data: row } = await admin.from('referral_codes').select('promo_id, active').eq('member_id', memberId).maybeSingle();
  if (!row?.active) return;
  await stripe!.promotionCodes.update(row.promo_id, { active: false });
  await admin.from('referral_codes').update({ active: false }).eq('member_id', memberId);
  console.log('Paused referral code for', memberId);
}

/** A completed checkout that used a member's referral code: record it and credit that member £50. */
async function recordReferral(sessionId: string) {
  const session = await stripe!.checkout.sessions.retrieve(sessionId, { expand: ['total_details.breakdown'] });
  if (session.mode !== 'subscription' || session.payment_status !== 'paid') return;
  const promoIds = [
    ...(session.total_details?.breakdown?.discounts ?? []).map((d) => idOf(d.discount?.promotion_code)),
    ...(session.discounts ?? []).map((d) => idOf(d.promotion_code)),
  ].filter((x): x is string => !!x);
  if (promoIds.length === 0) return;

  const { data: codeRow } = await admin.from('referral_codes').select('member_id, code').in('promo_id', promoIds).limit(1).maybeSingle();
  if (!codeRow) return; // some other promotion code
  const friendId = session.client_reference_id;
  if (!friendId || friendId === codeRow.member_id) return;

  await admin
    .from('referrals')
    .upsert(
      { referrer_id: codeRow.member_id, friend_id: friendId, code: codeRow.code, checkout_session: session.id },
      { onConflict: 'checkout_session', ignoreDuplicates: true },
    );
  const { data: referral } = await admin
    .from('referrals')
    .select('id, referrer_id, credited_at, credit_note')
    .eq('checkout_session', session.id)
    .maybeSingle();
  if (!referral) {
    console.warn('Referral not recorded (friend already referred?)', session.id, friendId);
    return;
  }
  if (referral.credited_at || referral.credit_note) return; // already handled

  const [{ data: referrer }, { data: friend }] = await Promise.all([
    admin.from('profiles').select('tier, stripe_customer_id').eq('id', codeRow.member_id).maybeSingle(),
    admin.from('profiles').select('name').eq('id', friendId).maybeSingle(),
  ]);
  const note = (credit_note: string) => admin.from('referrals').update({ credit_note }).eq('id', referral.id);
  if (!referrer?.stripe_customer_id || !REFERRER_TIERS.includes(referrer.tier)) {
    await note("No credit: they weren't a paying Ace or Royal Flush member when their friend joined.");
    console.log('Referral without credit', referral.id);
    return;
  }
  try {
    const txn = await stripe!.customers.createBalanceTransaction(
      referrer.stripe_customer_id,
      {
        amount: -REFERRAL_CREDIT,
        currency: 'gbp',
        description: `Referral credit: ${friend?.name ?? 'a friend'} joined Ace`,
        metadata: { referral_id: referral.id, friend_id: friendId },
      },
      { idempotencyKey: `referral-credit-${referral.id}` },
    );
    await admin.from('referrals').update({ credit_txn: txn.id, credited_at: new Date().toISOString() }).eq('id', referral.id);
    console.log('Referral credited', referral.id, 'to', codeRow.member_id);
  } catch (err) {
    console.error('Referral credit failed', referral.id, err);
    await note('Credit failed: add £50 credit to their customer in Stripe by hand.');
  }
}

/** The friend's first payment was refunded or disputed: take back whatever of the £50 credit is unused. */
async function reverseReferralCredit(charge: Stripe.Charge, reason: string) {
  const customerId = idOf(charge.customer);
  if (!customerId) return;
  const { data: friend } = await admin.from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();
  if (!friend) return;
  const { data: referral } = await admin
    .from('referrals')
    .select('id, referrer_id, created_at, credited_at, reversed_at')
    .eq('friend_id', friend.id)
    .maybeSingle();
  if (!referral?.credited_at || referral.reversed_at || !referral.referrer_id) return;
  // Only the friend's first payment, which was taken moments before the referral was recorded.
  if (Math.abs(charge.created * 1000 - Date.parse(referral.created_at)) > 60 * 60 * 1000) return;

  const { data: referrer } = await admin.from('profiles').select('stripe_customer_id').eq('id', referral.referrer_id).maybeSingle();
  if (!referrer?.stripe_customer_id) return;
  const customer = await stripe!.customers.retrieve(referrer.stripe_customer_id);
  const credit = 'deleted' in customer && customer.deleted ? 0 : Math.max(0, -(customer as Stripe.Customer).balance);
  const unused = Math.min(REFERRAL_CREDIT, credit);
  if (unused > 0) {
    await stripe!.customers.createBalanceTransaction(
      referrer.stripe_customer_id,
      { amount: unused, currency: 'gbp', description: `Referral credit removed: ${reason}`, metadata: { referral_id: referral.id } },
      { idempotencyKey: `referral-reverse-${referral.id}` },
    );
  }
  const used = REFERRAL_CREDIT - unused;
  await admin
    .from('referrals')
    .update({
      reversed_at: new Date().toISOString(),
      credit_note: `Friend's first payment ${reason}. ${used > 0 ? `£${(used / 100).toFixed(2)} of the credit had already been used.` : 'Credit removed.'}`,
    })
    .eq('id', referral.id);
  console.log('Referral credit reversed', referral.id, 'unused', unused);
}

/** Ends a customer's live subscriptions now. Stripe then sends customer.subscription.deleted, which drops the plan. */
async function cancelSubscriptionsFor(chargeId: string, reason: string) {
  const charge = await stripe!.charges.retrieve(chargeId);
  await quietly('reversing a referral credit', () => reverseReferralCredit(charge, reason === 'Full refund' ? 'refunded' : 'disputed'));
  const customerId = idOf(charge.customer);
  if (!customerId) {
    console.warn(reason, 'on a charge with no customer', chargeId);
    return;
  }
  const subs = await stripe!.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
  for (const sub of subs.data) {
    if (!LIVE_STATUSES.includes(sub.status)) continue;
    await stripe!.subscriptions.cancel(sub.id, {}, { idempotencyKey: `cancel-${sub.id}-${chargeId}` });
    console.log(reason, '→ cancelled', sub.id, 'for', customerId);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Use POST', { status: 405 });
  if (!stripe || !webhookSecret) return new Response('Payments not configured', { status: 503 });

  const signature = req.headers.get('Stripe-Signature') ?? '';
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (err) {
    console.error('Bad Stripe signature', err);
    return new Response('Bad signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object;
        const subId = idOf(session.subscription);
        // The subscription's own status decides access, so a payment still processing grants nothing yet.
        if (session.mode === 'subscription' && subId) await syncSubscription(subId, session.client_reference_id);
        if (event.type !== 'checkout.session.async_payment_failed') await quietly('recording a referral', () => recordReferral(session.id));
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await syncSubscription(event.data.object.id, null);
        break;
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const subId = idOf(invoice.parent?.subscription_details?.subscription);
        if (subId) await syncSubscription(subId, null);
        if (event.type === 'invoice.payment_failed') {
          // Stripe emails the member and retries; this is a note for the logs.
          console.warn('Payment failed', invoice.id, 'customer', idOf(invoice.customer), 'attempt', invoice.attempt_count);
        }
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object;
        if (charge.refunded) await cancelSubscriptionsFor(charge.id, 'Full refund');
        else console.log('Partial refund, membership unchanged', charge.id);
        break;
      }
      case 'charge.dispute.created': {
        const dispute = event.data.object;
        console.warn('Dispute opened', dispute.id, dispute.reason, dispute.amount);
        await cancelSubscriptionsFor(idOf(dispute.charge)!, 'Dispute');
        break;
      }
      case 'radar.early_fraud_warning.created': {
        const warning = event.data.object;
        console.warn('Early fraud warning', warning.id, warning.fraud_type);
        await cancelSubscriptionsFor(idOf(warning.charge)!, 'Early fraud warning');
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handling failed', event.type, err);
    return new Response('Handler error', { status: 500 }); // Stripe retries
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
