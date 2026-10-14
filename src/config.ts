// Switches for features that depend on outside services being set up.

/**
 * Turn on once Stripe is set up (plans created with lookup keys deck_monthly and
 * ace_monthly, STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET saved in Supabase).
 * While false, paid plans are "requested" and Jack upgrades members by hand.
 */
export const PAYMENTS_LIVE = false;
