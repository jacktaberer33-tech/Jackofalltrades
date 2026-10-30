/// <reference types="vite/client" />
// Switches for features that depend on outside services being set up.

/**
 * Whether paid plans go through Stripe. Set by the VITE_PAYMENTS_LIVE build variable in
 * netlify.toml: on for the live site, off for deploy previews (Supabase holds live Stripe keys).
 * While off, paid plans are "requested" and Jack upgrades members by hand.
 */
export const PAYMENTS_LIVE = import.meta.env.VITE_PAYMENTS_LIVE === 'true';

/**
 * Details the policies (Privacy, Terms, Community Guidelines) show. An empty email appears as a
 * highlighted "to add" marker; an empty address or ICO number is simply left off until it's set.
 * Add the address before switching PAYMENTS_LIVE on: consumer law requires it for paid plans.
 */
export const LEGAL = {
  /** Contact email for members and data protection requests. */
  email: 'jackofalltrades.life@gmail.com',
  /** Postal address for the business (a virtual business address is fine). */
  address: 'Jack of All Trades, 49 Station Road, Polegate, East Sussex, BN26 6EA',
  /** ICO registration number, shown once the data protection fee is paid. */
  icoNumber: 'ZC284788',
  /** Date shown as "Last updated" on every policy. */
  updated: '30 October 2026',
};
