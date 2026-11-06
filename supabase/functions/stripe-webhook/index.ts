// Receives events from Stripe and keeps each member's plan in step with their subscription.
// Paying moves a member onto the Full Deck, Ace or Royal Flush; a subscription that ends (cancelled,
// or unpaid after Stripe's retries) moves them back to Open Hand.
//
// Every event is treated as a nudge: the handler fetches the subscription fresh from Stripe and
// saves its current state, so events arriving late, twice or out of order can't leave a stale plan.
//
// The plan comes from the Stripe product (Full Deck, Ace, Royal Flush), not the price, so a price change
// never moves anyone: members on an old price (founding members) keep their plan. If a live subscription's
// plan can't be worked out, the member keeps the plan they have and Jack gets an alert.
//
// Disputes and early fraud warnings cancel the member's subscription straight away, so a disputed
// card isn't charged again. A full refund does the same: under the Membership Terms a refund ends
// the membership. A partial refund of the first payment of a plan the member has cancelled is the
// 14-day cooling-off refund for an upfront plan, so that ends the plan straight away too. Other partial
// refunds are left alone (they can be goodwill).
//
// Jack gets an alert (emailed by the hourly member-mail job) when: a member cancels within 14 days of
// their first payment (a refund is owed), Royal Flush goes over five, a payment has no account behind it,
// someone has two live subscriptions, or a paused referral code is used.
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

type Paid = 'deck' | 'ace' | 'royal';
// Live Stripe products. The lookup keys below are the fallback (and what the sandbox uses).
const TIER_BY_PRODUCT: Record<string, Paid> = {
  prod_VVxH9hxTlhgeg3: 'deck',
  prod_VVxHDFjhyNvLnQ: 'ace',
  prod_VVxHxfwSxJRtEm: 'royal',
};
const TIER_BY_LOOKUP: Record<string, Paid> = {
  deck_monthly: 'deck',
  ace_monthly: 'ace',
  ace_quarterly: 'ace',
  ace_halfyear: 'ace',
  royal_quarterly: 'royal',
  royal_halfyear: 'royal',
};
const LIVE_STATUSES = ['active', 'trialing', 'past_due'];
const RANK: Record<string, number> = { open: 0, deck: 1, ace: 2, royal: 3 };
const PLAN_NAME: Record<string, string> = { open: 'Open Hand', deck: 'Full Deck', ace: 'Ace', royal: 'Royal Flush' };
const DAY = 24 * 60 * 60;
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

/** The plan a subscription item pays for: by product, then by the price's lookup key. */
function tierOfItem(item: Stripe.SubscriptionItem | undefined): Paid | null {
  if (!item?.price) return null;
  return TIER_BY_PRODUCT[idOf(item.price.product) ?? ''] ?? TIER_BY_LOOKUP[item.price.lookup_key ?? ''] ?? null;
}

/** Notes something for Jack. The hourly member-mail job emails new alerts to him. Never throws. */
async function alertJack(kind: string, message: string, dedupe: string, memberId: string | null = null) {
  const { error } = await admin
    .from('jack_alerts')
    .upsert({ kind, message, dedupe, member_id: memberId }, { onConflict: 'dedupe', ignoreDuplicates: true });
  if (error) console.error('Could not save alert', kind, error);
  console.warn('Alert for Jack:', message);
}

const pounds = (pence: number) => `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`;

/** Saves a subscription's current state onto the member it belongs to. */
async function syncSubscription(subId: string, userIdHint: string | null) {
  const sub = await stripe!.subscriptions.retrieve(subId);
  const customerId = idOf(sub.customer)!;
  const item = sub.items.data[0];
  const planTier = tierOfItem(item);
  const live = LIVE_STATUSES.includes(sub.status);
  // A cancellation can be stored either as cancel_at_period_end, or (billing portal, flexible billing
  // mode) as a cancel_at date with that flag false. Either way the member keeps the plan until then.
  const endsAt = sub.cancel_at ?? null;
  const cancelling = !!sub.cancel_at_period_end || !!endsAt;
  const itemEnd = item?.current_period_end ?? null;
  const periodEnd = endsAt && itemEnd ? Math.min(endsAt, itemEnd) : endsAt ?? itemEnd;

  // Find the member by their Stripe customer (saved before checkout), else by the id we stamped on it.
  const columns = 'id, name, tier, requested_tier, is_admin, stripe_subscription_id';
  let { data: profile } = await admin.from('profiles').select(columns).eq('stripe_customer_id', customerId).maybeSingle();
  const userId = userIdHint || (sub.metadata?.user_id as string | undefined);
  if (!profile && userId) {
    ({ data: profile } = await admin.from('profiles').select(columns).eq('id', userId).maybeSingle());
  }
  if (!profile) {
    console.warn('No member for subscription', sub.id, customerId);
    // Usually a closed account. Stripe will keep charging a live subscription until someone stops it.
    if (live && !sub.cancel_at_period_end && !sub.cancel_at) {
      await alertJack('no_member', `Stripe subscription ${sub.id} (customer ${customerId}) is still live but has no account on the site. Cancel it in Stripe if the member has left.`, `no-member-${sub.id}`);
    }
    return;
  }

  // An old, replaced subscription ending must not downgrade someone on a newer one.
  if (!live && profile.stripe_subscription_id && profile.stripe_subscription_id !== sub.id) {
    console.log('Ignoring end of superseded subscription', sub.id);
    return;
  }

  // A live subscription whose plan can't be worked out (a hand-made price, say) keeps the member's plan.
  let tier: string;
  if (!live) tier = 'open';
  else if (planTier) tier = planTier;
  else {
    tier = profile.tier;
    await alertJack('unknown_plan', `${profile.name}'s subscription ${sub.id} uses price ${item?.price?.id ?? '?'}, which isn't on a Full Deck, Ace or Royal Flush product. They've kept ${PLAN_NAME[tier] ?? tier}; check the price in Stripe.`, `unknown-plan-${sub.id}-${item?.price?.id ?? ''}`, profile.id);
  }

  // Royal Flush is capped at 5. Checkout holds a place, so this shouldn't happen; if it does, Jack decides.
  if (tier === 'royal' && profile.tier !== 'royal') {
    await admin.from('royal_holds').delete().eq('member_id', profile.id);
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('tier', 'royal').eq('is_admin', false);
    if ((count ?? 0) >= 5) {
      await alertJack('royal_over', `${profile.name} has just paid for Royal Flush, which makes ${(count ?? 0) + 1} Royal Flush members (the cap is 5). Decide whether to keep them or refund them in Stripe.`, `royal-over-${sub.id}`, profile.id);
    }
  }

  // The plan they asked for at sign-up is met once they're on it (or higher).
  const requestMet = profile.requested_tier && RANK[tier] >= (RANK[profile.requested_tier] ?? 0);

  const { error } = await admin
    .from('profiles')
    .update({
      tier,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: cancelling,
      ...(requestMet && tier !== 'open' ? { requested_tier: null } : {}),
    })
    .eq('id', profile.id);
  if (error) throw error;
  console.log('Synced', profile.id, sub.status, planTier ?? 'no plan');

  // Cancelled within 14 days of the first payment: under the Terms a refund is owed. Tell Jack.
  if (live && cancelling && !profile.is_admin && Date.now() / 1000 - sub.start_date <= 14 * DAY && tier !== 'open') {
    const price = item?.price;
    const termDays = itemEnd ? Math.round((itemEnd - sub.start_date) / DAY) : null;
    const daysUsed = Math.max(1, Math.ceil((Date.now() / 1000 - sub.start_date) / DAY));
    const monthly = price?.recurring?.interval === 'month' && (price.recurring.interval_count ?? 1) === 1;
    const full = price?.unit_amount ?? 0;
    const owed = monthly || !termDays ? full : Math.round(full * Math.max(0, termDays - daysUsed) / termDays);
    await alertJack(
      'refund_owed',
      `${profile.name} cancelled ${PLAN_NAME[tier]} on day ${daysUsed}, inside the 14 days. Under the Terms they're owed ${monthly ? `a full refund of their first payment (${pounds(full)})` : `their first payment minus ${daysUsed} of ${termDays} days: about ${pounds(owed)} of ${pounds(full)}`}. Check what they actually paid (a code may have taken money off), then refund it in Stripe within 14 days. Refunding it ends their plan straight away.`,
      `refund-owed-${sub.id}`,
      profile.id,
    );
  }

  if (!REFERRER_TIERS.includes(tier)) await quietly('pausing referral code', () => pauseReferralCode(profile.id));
}

/**
 * A partial refund of a plan's first payment, after the member cancelled: the 14-day cooling-off refund
 * for an upfront plan (paid minus days used). End the plan now rather than at the end of the term.
 */
async function endCooledOffPlan(charge: Stripe.Charge) {
  const customerId = idOf(charge.customer);
  if (!customerId) return;
  const subs = await stripe!.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
  for (const sub of subs.data) {
    if (!LIVE_STATUSES.includes(sub.status)) continue;
    const cancelled = !!sub.cancel_at_period_end || !!sub.cancel_at;
    const firstPayment = Math.abs(charge.created - sub.start_date) < 60 * 60;
    if (!cancelled || !firstPayment) continue;
    await quietly('reversing a referral credit', () => reverseReferralCredit(charge, 'refunded'));
    await stripe!.subscriptions.cancel(sub.id, {}, { idempotencyKey: `cooling-off-${sub.id}-${charge.id}` });
    console.log('Cooling-off refund → ended', sub.id, 'for', customerId);
    return true;
  }
  return false;
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
  if (!codeRow) {
    // A referral code whose owner has closed their account still works in Stripe until it's switched off.
    for (const promoId of promoIds) {
      const promo = await stripe!.promotionCodes.retrieve(promoId);
      if (promo?.metadata?.kind !== 'ace_referral') continue;
      if (promo.active) await stripe!.promotionCodes.update(promoId, { active: false });
      await alertJack('orphan_referral', `Referral code ${promo.code} was used by a new Ace member, but its owner has left. It's now switched off; no credit was given.`, `orphan-referral-${promoId}-${session.id}`);
    }
    return;
  }
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
        if (session.mode === 'subscription' && subId) {
          await syncSubscription(subId, session.client_reference_id);
          const customerId = idOf(session.customer);
          if (customerId) {
            const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
            const live = subs.data.filter((s) => LIVE_STATUSES.includes(s.status));
            if (live.length > 1) {
              await alertJack('double_subscription', `Customer ${customerId} now has ${live.length} live subscriptions (${live.map((s) => s.id).join(', ')}): they're being charged twice. Cancel and refund the extra one in Stripe.`, `double-${live.map((s) => s.id).sort().join('-')}`);
            }
          }
        }
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
        else if (!(await endCooledOffPlan(charge))) console.log('Partial refund, membership unchanged', charge.id);
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
