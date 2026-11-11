import { createClient } from '@supabase/supabase-js';

// These two values are designed to be public: they identify the project, and the database's
// row-level security rules decide what each signed-in member can read or change.
// Never put the secret / service_role key in the website.
export const SUPABASE_URL = 'https://zbgktqrnnhntmozuzagk.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_cByRZhqwAdXajvhU1_SSbg_k8fKecpz';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});

// Row shapes, matching supabase/migrations.
export interface ProfileRow {
  id: string;
  name: string;
  tier: 'open' | 'deck' | 'ace' | 'royal';
  requested_tier: 'open' | 'deck' | 'ace' | 'royal' | null;
  is_admin: boolean;
  created_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  /** 1 to 50 for founding members. Missing until the founding-numbers migration is applied. */
  founding_number?: number | null;
}

export interface PostRow {
  id: string;
  author_id: string;
  author_name: string;
  from_jack: boolean;
  suit: string | null;
  body: string;
  mirror_lesson_id: string | null;
  pinned: boolean;
  created_at: string;
  post_replies: { count: number }[];
  post_me_too: { count: number }[];
}

export interface ReplyRow {
  id: string;
  post_id: string;
  author_id: string;
  author_name: string;
  from_jack: boolean;
  body: string;
  created_at: string;
}

export interface BookingRow {
  id: string;
  member_id: string;
  slot_date: string;
  slot_time: string;
  topic: string;
  created_at: string;
}

export interface AdminMemberRow {
  id: string;
  name: string;
  email: string;
  tier: 'open' | 'deck' | 'ace' | 'royal';
  requested_tier: 'open' | 'deck' | 'ace' | 'royal' | null;
  created_at: string;
}

/** Shown when someone signs in before clicking the link in their confirmation email. */
export const UNCONFIRMED = 'Confirm your email first: open the link we sent you, then sign in.';

/** Common slips in email domains, for a "did you mean" hint before anyone joins with a dead address. */
const DOMAIN_FIXES: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmal.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com',
  'gmai.com': 'gmail.com', 'gnail.com': 'gmail.com', 'googlemail.co': 'googlemail.com',
  'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.co.uk', 'hotmail.con': 'hotmail.com',
  'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlook.co': 'outlook.com', 'outlook.con': 'outlook.com',
  'iclod.com': 'icloud.com', 'icloud.co': 'icloud.com', 'icoud.com': 'icloud.com',
  'yahoo.co': 'yahoo.co.uk', 'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com',
  'btinternet.co': 'btinternet.com', 'live.co': 'live.co.uk',
};
/** The corrected address if the domain looks like a typo, else null. */
export function suggestEmail(email: string): string | null {
  const at = email.trim().lastIndexOf('@');
  if (at < 1) return null;
  const domain = email.trim().slice(at + 1).toLowerCase();
  const fix = DOMAIN_FIXES[domain];
  return fix ? `${email.trim().slice(0, at)}@${fix}` : null;
}

/** Turns Supabase/Postgres errors into plain English for members. */
export function friendlyError(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return 'Something went wrong. Try again.';
  const msg = err.message ?? '';
  if (/Invalid login credentials/i.test(msg)) return "That email and password don't match. Check them and try again.";
  if (/User already registered/i.test(msg)) return 'There is already an account with that email. Sign in instead.';
  if (/Email not confirmed/i.test(msg)) return UNCONFIRMED;
  if (/Email address not authorized|Error sending/i.test(msg)) return "We couldn't send an email to that address. Check it's typed correctly, or use a different one.";
  if (/only request this after|security purposes/i.test(msg)) return 'You can ask for another email in a minute.';
  if (/rate limit|too many/i.test(msg)) return 'Too many tries in a short time. Wait a few minutes and try again.';
  if (/Password should be at least/i.test(msg)) return 'Use a password of at least 8 characters.';
  if (/bookings_slot_taken/i.test(msg)) return 'Someone has just taken that slot. Pick another time.';
  if (/bookings_one_per_(month|period)/i.test(msg)) return "You've already had or booked your call for that month (or week, on Royal Flush). Pick a day in the next one.";
  if (/name can't be blank/i.test(msg)) return "Your name can't be blank.";
  if (/posts_body_check|post_replies_body_check/i.test(msg)) return 'That\'s too long for the Table: posts can be up to 2,000 characters.';
  if (/check constraint|23514/i.test(msg + (err.code ?? ''))) return "That's too long, or blank. Check it and try again.";
  if (/row-level security|permission denied|42501/i.test(msg + (err.code ?? ''))) return "That isn't open to you right now. If you think it should be, message Jack.";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "Couldn't reach the server. Check your connection and try again.";
  if (/Cancel your plan first/i.test(msg)) return 'Your plan still renews. Cancel it first with "Change plan, card or cancel", then close your account.';
  return msg || 'Something went wrong. Try again.';
}
