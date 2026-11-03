// A friend's referral link: jackofalltrades.life/?ref=CAM-7K2P
//
// The code is read once from the address and kept in memory only (no cookies or browser storage).
// Signing up saves it on the new account, so it still applies after the confirmation email; joining Ace
// sends it to checkout, which applies the £50 off. Anyone can also type a code in at checkout.

const PATTERN = /^[A-Z0-9-]{4,24}$/;

export function cleanRef(value: string | null | undefined): string | null {
  const v = (value ?? '').trim().toUpperCase();
  return PATTERN.test(v) ? v : null;
}

let pending: string | null = (() => {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = cleanRef(params.get('ref'));
    if (params.has('ref')) {
      params.delete('ref');
      const rest = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
    }
    return code;
  } catch {
    return null;
  }
})();

/** The referral code this visit arrived with, if any. */
export const pendingRef = () => pending;
export const clearPendingRef = () => { pending = null; };

/** The link a member shares. */
export const referralLink = (code: string) => `https://jackofalltrades.life/?ref=${encodeURIComponent(code)}`;
