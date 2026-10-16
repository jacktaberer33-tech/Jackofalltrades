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

/** Turns Supabase/Postgres errors into plain English for members. */
export function friendlyError(err: { message?: string; code?: string } | null | undefined): string {
  if (!err) return 'Something went wrong. Try again.';
  const msg = err.message ?? '';
  if (/Invalid login credentials/i.test(msg)) return "That email and password don't match. Check them and try again.";
  if (/User already registered/i.test(msg)) return 'There is already an account with that email. Sign in instead.';
  if (/Email not confirmed/i.test(msg)) return 'Confirm your email first: open the link we sent you, then sign in.';
  if (/Email address not authorized|Error sending/i.test(msg)) return "We couldn't send an email to that address yet. Jack is still switching email on. Try again soon.";
  if (/rate limit|too many/i.test(msg)) return 'Too many tries in a short time. Wait a few minutes and try again.';
  if (/Password should be at least/i.test(msg)) return 'Use a password of at least 8 characters.';
  if (/bookings_slot_taken/i.test(msg)) return 'Someone has just taken that slot. Pick another time.';
  if (/bookings_one_per_(month|period)/i.test(msg)) return "You've already got a call in that week or month. Change that one instead.";
  if (/row-level security|permission denied|42501/i.test(msg + (err.code ?? ''))) return "Your plan doesn't include that yet.";
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return "Couldn't reach the server. Check your connection and try again.";
  if (/delete_my_account/i.test(msg)) return "Closing accounts from here isn't switched on yet. Ask Jack and he'll do it for you.";
  return msg || 'Something went wrong. Try again.';
}
