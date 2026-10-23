// Receives events from Stripe and keeps each member's plan in step with their subscription.
// Paying moves a member onto the Full Deck, Ace or Royal Flush; cancelling (at period end) or failed
// payments that end the subscription move them back to Open Hand.
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
// Stripe endpoint: https://<project>.supabase.co/functions/v1/stripe-webhook with events
// checkout.session.completed, customer.subscription.created, customer.subscription.updated,
// customer.subscription.deleted.
import Stripe from 'npm:stripe@22.6.2';
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

type Sub = Stripe.Subscription & { current_period_end?: number };

async function syncSubscription(sub: Sub, userIdHint: string | null) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const userId = (sub.metadata?.user_id as string | undefined) || userIdHint;
  const item = sub.items?.data?.[0] as (Stripe.SubscriptionItem & { current_period_end?: number }) | undefined;
  const lookupKey = item?.price?.lookup_key ?? '';
  const planTier = TIER_BY_LOOKUP[lookupKey];
  const live = LIVE_STATUSES.includes(sub.status);
  const periodEnd = item?.current_period_end ?? sub.current_period_end ?? null;

  // Find the member: by the id we stamped on the subscription, else by Stripe customer.
  const query = admin.from('profiles').select('id, stripe_subscription_id');
  const { data: profile } = userId
    ? await query.eq('id', userId).maybeSingle()
    : await query.eq('stripe_customer_id', customerId).maybeSingle();
  if (!profile) {
    console.warn('No member for subscription', sub.id, customerId);
    return;
  }

  // An old, replaced subscription ending must not downgrade someone on a newer one.
  if (!live && profile.stripe_subscription_id && profile.stripe_subscription_id !== sub.id) {
    console.log('Ignoring end of superseded subscription', sub.id);
    return;
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
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub as Sub, session.client_reference_id);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncSubscription(event.data.object as Sub, null);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handling failed', event.type, err);
    return new Response('Handler error', { status: 500 }); // Stripe retries
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
