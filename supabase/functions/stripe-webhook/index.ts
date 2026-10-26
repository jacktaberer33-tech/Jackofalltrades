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
  const periodEnd = item?.current_period_end ?? null;

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
      cancel_at_period_end: !!sub.cancel_at_period_end,
    })
    .eq('id', profile.id);
  if (error) throw error;
  console.log('Synced', profile.id, sub.status, planTier ?? 'no plan');
}

/** Ends a customer's live subscriptions now. Stripe then sends customer.subscription.deleted, which drops the plan. */
async function cancelSubscriptionsFor(chargeId: string, reason: string) {
  const charge = await stripe!.charges.retrieve(chargeId);
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
