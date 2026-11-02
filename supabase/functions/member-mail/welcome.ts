// Welcome emails for paid plans: one per member per plan, the first time they move up onto it (joining
// the Full Deck, going Ace, taking a Royal Flush place). Sent from Jack, with replies going to his inbox.
// public.welcome_sent records what's gone out. Nobody gets the same welcome twice, nobody is welcomed to a
// lower plan after a downgrade, and Jack's own account never gets one.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.117.2';
import { resend, sleep } from './resend.ts';

type Paid = 'deck' | 'ace' | 'royal';
const SITE = 'https://jackofalltrades.life';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** The last Friday of a month at 7pm UK time (the app uses the same rule). */
function lastFriday(year: number, month: number): Date {
  const d = new Date(Date.UTC(year, month + 1, 0, 12));
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
export function nextFridayTable(now = new Date()): string {
  const thisMonth = lastFriday(now.getUTCFullYear(), now.getUTCMonth());
  // Still upcoming if it's that day or later in the month (the call is in the evening).
  const day = thisMonth.toISOString().slice(0, 10) >= now.toISOString().slice(0, 10)
    ? thisMonth
    : lastFriday(now.getUTCFullYear(), now.getUTCMonth() + 1);
  return day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

const button = (href: string, label: string) =>
  `<p style="margin:22px 0"><a href="${href}" style="background:#c81e37;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:99px;font-weight:700;display:inline-block">${label}</a></p>`;

function layout(body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#fafaf7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#121211;line-height:1.55;font-size:16px">
  <div style="max-width:560px;margin:0 auto;padding:28px 18px">
    <p style="font-family:Menlo,monospace;font-size:13px;letter-spacing:.08em;margin:0 0 20px">J ♠ JACK OF ALL TRADES</p>
    ${body}
    <p style="margin:28px 0 0">Jack</p>
    <p style="color:#6b6b66;font-size:12px;margin-top:28px">You're getting this because you joined a plan at ${SITE.replace('https://', '')}. Reply to this email and it comes straight to me.</p>
  </div></body></html>`;
}

/** The three welcome emails. `name` is the member's first name; `friday` is the next Friday Table date. */
export function welcomeEmail(tier: Paid, name: string, friday: string): { subject: string; html: string } {
  const hi = `<p style="margin:0 0 16px">Hi ${esc(name || 'there')},</p>`;
  const fridayLine = `<p><strong>Friday Table:</strong> the last Friday of every month, 7pm, live with me. The next one is ${friday}. A Join button appears on your Home page on the day.</p>`;

  if (tier === 'deck') {
    return {
      subject: "You're at the Table",
      html: layout(`${hi}
        <p>You're in. Welcome to the Full Deck.</p>
        <p>Three things for this week:</p>
        <ol style="padding-left:20px">
          <li style="margin-bottom:8px"><strong>Pick a suit and start at its Ace.</strong> The first five cards of every suit are yours, Ace to 5. Start with the suit that makes you squirm a bit.</li>
          <li style="margin-bottom:8px"><strong>Answer one Mirror question.</strong> Every lesson ends with one. It's private unless you choose to share it.</li>
          <li><strong>Say hello at the Table.</strong> Reply under the pinned post with your name, your suit and one honest sentence about why you joined.</li>
        </ol>
        ${button(`${SITE}/#/deck`, 'Open the Deck')}
        ${fridayLine}
        <p>Glad you're here.</p>`),
    };
  }

  if (tier === 'ace') {
    return {
      subject: "You've gone Ace",
      html: layout(`${hi}
        <p>Welcome to Ace. You've got the whole deck now, every card from Ace to King in all four suits, and me in your corner once a month.</p>
        <p><strong>First, book your 1:1.</strong> Open Your 1:1 in the app and pick a time this month. It's 45 minutes on video, and I'll send the link the day before. Bring the thing you can't say anywhere else.</p>
        ${button(`${SITE}/#/ace`, 'Book your 1:1')}
        <p><strong>Your accountability group:</strong> I'm putting the groups of six together. I'll tell you who's in yours and how it'll run.</p>
        <p><strong>The Table:</strong> when you post, you get first replies from me.</p>
        ${fridayLine}`),
    };
  }

  return {
    subject: "Royal Flush: let's get started",
    html: layout(`${hi}
      <p>Welcome to Royal Flush. There are only five places, and you've taken one. I don't take that lightly.</p>
      <p><strong>Here's how we start:</strong></p>
      <ol style="padding-left:20px">
        <li style="margin-bottom:8px"><strong>Reply to this email</strong> with your mobile number and three times in the next week that suit you for your 60-minute kickoff. I'll WhatsApp you so you've got my number for voice notes.</li>
        <li style="margin-bottom:8px"><strong>In the kickoff</strong> we'll build your 90-day plan. I'll also ask about your goals, your training history and any injuries or health conditions, so I can write your training plan properly.</li>
        <li><strong>Then book your weekly calls</strong> in Your 1:1 in the app, up to four weeks ahead. You get first pick of times.</li>
      </ol>
      <p><strong>Voice notes between calls:</strong> send them whenever. I'll reply within one working day, Monday to Friday. It isn't an emergency line.</p>
      <p><strong>Your Joker lessons</strong>, two in every suit, are unlocked now.</p>
      ${button(`${SITE}/#/deck`, 'See your Jokers')}
      ${fridayLine}`),
  };
}

const RANK: Record<string, number> = { open: 0, deck: 1, ace: 2, royal: 3 };

/**
 * Sends any welcome that's due: to one member (called straight after their plan goes up) or, with no
 * memberId, to every paying member still owed one (the hourly safety net).
 */
export async function sendWelcomes(admin: SupabaseClient, memberId?: string) {
  let query = admin.from('profiles').select('id, name, tier, is_admin').in('tier', ['deck', 'ace', 'royal']).eq('is_admin', false);
  if (memberId) query = query.eq('id', memberId);
  const [{ data: members, error }, { data: sent, error: sentError }] = await Promise.all([
    query,
    admin.from('welcome_sent').select('member_id, tier'),
  ]);
  if (error) throw error;
  if (sentError) throw sentError;
  // The highest plan each member has already been welcomed to. A welcome only goes out for a plan above
  // that, so someone who drops from Ace to the Full Deck isn't welcomed to the Full Deck afterwards.
  const welcomedUpTo = new Map<string, number>();
  for (const s of sent ?? []) welcomedUpTo.set(s.member_id, Math.max(welcomedUpTo.get(s.member_id) ?? 0, RANK[s.tier] ?? 0));
  const friday = nextFridayTable();
  const results: { member: string; tier: string; sent: boolean }[] = [];

  for (const m of members ?? []) {
    if (!(RANK[m.tier] > (welcomedUpTo.get(m.id) ?? 0))) continue;
    const { data: user, error: userError } = await admin.auth.admin.getUserById(m.id);
    if (userError || !user?.user?.email) {
      console.warn('No email for member', m.id);
      continue;
    }
    const { subject, html } = welcomeEmail(m.tier as Paid, m.name, friday);
    if (results.length > 0) await sleep(600);
    // The idempotency key stops a double send if the instant call and the hourly check overlap.
    await resend('/emails', {
      method: 'POST',
      idempotencyKey: `welcome-${m.id}-${m.tier}`,
      body: JSON.stringify({
        from: Deno.env.get('WELCOME_FROM') ?? 'Jack <hello@jackofalltrades.life>',
        to: [user.user.email],
        reply_to: Deno.env.get('REPLY_TO') ?? 'jackofalltrades.life@gmail.com',
        subject,
        html,
      }),
    });
    const { error: insertError } = await admin.from('welcome_sent').upsert({ member_id: m.id, tier: m.tier }, { onConflict: 'member_id,tier', ignoreDuplicates: true });
    if (insertError) console.error('Could not record welcome', m.id, m.tier, insertError);
    console.log('Welcome sent', m.id, m.tier);
    results.push({ member: m.id, tier: m.tier, sent: true });
  }
  return { welcomes: results.length };
}
