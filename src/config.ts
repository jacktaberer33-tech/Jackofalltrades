// Switches for features that depend on outside services being set up.

/**
 * Turn on once Stripe is set up (plans created with lookup keys deck_monthly and
 * ace_monthly, STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET saved in Supabase).
 * While false, paid plans are "requested" and Jack upgrades members by hand.
 */
export const PAYMENTS_LIVE = false;

/**
 * Details the policies (Privacy, Terms, Community Guidelines) show. Anything left empty
 * appears on those pages as a highlighted "to add" marker, so fill these in before going live.
 */
export const LEGAL = {
  /** Contact email for members and data protection requests. */
  email: '',
  /** Postal address for the business (a virtual business address is fine). */
  address: '',
  /** ICO registration number, shown once the data protection fee is paid. */
  icoNumber: '',
  /** Date shown as "Last updated" on every policy. */
  updated: '15 October 2026',
};
