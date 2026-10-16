// Switches for features that depend on outside services being set up.

/**
 * Turn on once Stripe is set up (plans created with lookup keys deck_monthly, ace_monthly and
 * royal_monthly, STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET saved in Supabase).
 * While false, paid plans are "requested" and Jack upgrades members by hand.
 */
export const PAYMENTS_LIVE = false;

/**
 * Details the policies (Privacy, Terms, Community Guidelines) show. An empty email appears as a
 * highlighted "to add" marker; an empty address or ICO number is simply left off until it's set.
 * Add the address before switching PAYMENTS_LIVE on: consumer law requires it for paid plans.
 */
export const LEGAL = {
  /** Contact email for members and data protection requests. */
  email: 'jackofalltrades.life@gmail.com',
  /** Postal address for the business (a virtual business address is fine). */
  address: '',
  /** ICO registration number, shown once the data protection fee is paid. */
  icoNumber: '',
  /** Date shown as "Last updated" on every policy. */
  updated: '15 October 2026',
};
