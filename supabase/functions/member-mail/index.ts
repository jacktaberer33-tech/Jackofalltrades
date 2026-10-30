// Scheduled member email jobs, run by pg_cron (see migrations/20261030171000_member_mail_schedule.sql):
//
//   { "job": "sync" }    hourly. Keeps the Resend segment "Members" in step with the site: every member who
//                        has confirmed their email is in it (with their first name), and anyone who has
//                        closed their account is removed. Jack writes the monthly email in Resend as a
//                        broadcast to that segment; Resend adds the unsubscribe link and honours it, and
//                        this sync never re-subscribes anyone.
//   { "job": "digest" }  every evening. Emails Jack a round-up of the day's new Table posts and replies
//                        (not his own), only on days with activity. Ace and Royal Flush posts are flagged,
//                        since those members get first replies from Jack.
//
// Secrets: RESEND_API_KEY (full access, from the Resend team that owns jackofalltrades.life). The cron
// secret lives in the database vault (see resend.ts). Optional: ALERT_EMAIL (where the round-up goes,
// default jackofalltrades.life@gmail.com), MAIL_FROM (default "Jack of All Trades <hello@jackofalltrades.life>").
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { fromCron, json, resend, sleep } from './resend.ts';

const SEGMENT_NAME = 'Members';
const SITE = 'https://jackofalltrades.life';
/** Resend allows about 2 requests a second; stay under it, and cap each run (the next run carries on). */
const WRITE_GAP_MS = 600;
const MAX_WRITES = 60;

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Page<T> = { data: T[]; has_more?: boolean };
type ResendContact = { id: string; email: string; first_name: string | null };

// ---------- Mailing list ----------

async function membersSegmentId(): Promise<string> {
  const list = (await resend('/segments?limit=100')) as Page<{ id: string; name: string }>;
  const found = list.data.find((s) => s.name === SEGMENT_NAME);
  if (found) return found.id;
  const made = (await resend('/segments', { method: 'POST', body: JSON.stringify({ name: SEGMENT_NAME }) })) as { id: string };
  return made.id;
}

/** Everyone with a confirmed email, with the first name on their profile. */
async function confirmedMembers(): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const { data: profiles, error } = await admin.from('profiles').select('id, name');
  if (error) throw error;
  for (const p of profiles ?? []) names.set(p.id, p.name);

  const members = new Map<string, string>(); // email → first name
  for (let page = 1; ; page++) {
    const { data, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (usersError) throw usersError;
    for (const u of data.users) {
      if (!u.email || !u.email_confirmed_at || !names.has(u.id)) continue;
      members.set(u.email.toLowerCase(), names.get(u.id) ?? '');
    }
    if (data.users.length < 1000) break;
  }
  return members;
}

async function segmentContacts(segmentId: string): Promise<ResendContact[]> {
  const all: ResendContact[] = [];
  let after: string | undefined;
  for (;;) {
    const q = new URLSearchParams({ limit: '100', ...(after ? { after } : {}) });
    const page = (await resend(`/segments/${segmentId}/contacts?${q}`)) as Page<ResendContact>;
    all.push(...page.data);
    if (!page.has_more || page.data.length === 0) break;
    after = page.data[page.data.length - 1].id;
  }
  return all;
}

async function syncMailingList() {
  const segmentId = await membersSegmentId();
  const [members, contacts] = await Promise.all([confirmedMembers(), segmentContacts(segmentId)]);
  const inSegment = new Map(contacts.map((c) => [c.email.toLowerCase(), c]));
  let writes = 0;
  const done = { added: 0, renamed: 0, removed: 0, left: 0 };
  const write = async (fn: () => Promise<unknown>) => {
    if (writes >= MAX_WRITES) { done.left++; return false; }
    if (writes++ > 0) await sleep(WRITE_GAP_MS);
    await fn();
    return true;
  };

  for (const [email, firstName] of members) {
    const existing = inSegment.get(email);
    const enc = encodeURIComponent(email);
    if (!existing) {
      const ok = await write(async () => {
        try {
          // New contacts only: never sends `unsubscribed`, so someone who unsubscribed stays unsubscribed.
          await resend('/contacts', { method: 'POST', body: JSON.stringify({ email, first_name: firstName, segments: [{ id: segmentId }] }) });
        } catch (err) {
          const status = (err as { status?: number }).status;
          if (status !== 409 && status !== 422) throw err;
          // Already a contact (for example, added by hand): just put them in the segment.
          await resend(`/contacts/${enc}/segments/${segmentId}`, { method: 'POST' });
        }
      });
      if (ok) done.added++;
    } else if ((existing.first_name ?? '') !== firstName) {
      if (await write(() => resend(`/contacts/${enc}`, { method: 'PATCH', body: JSON.stringify({ first_name: firstName }) }))) done.renamed++;
    }
  }
  // Closed accounts: delete the contact entirely (the privacy policy promises their details go).
  for (const [email, contact] of inSegment) {
    if (members.has(email)) continue;
    if (await write(() => resend(`/contacts/${contact.id}`, { method: 'DELETE' }))) done.removed++;
  }
  console.log('Mailing list synced', { members: members.size, ...done });
  return { members: members.size, ...done };
}

// ---------- Table round-up ----------

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const SUIT: Record<string, string> = { hearts: '♥ Hearts', spades: '♠ Spades', clubs: '♣ Clubs', diamonds: '♦ Diamonds' };
const PLAN: Record<string, string> = { deck: 'Full Deck', ace: 'Ace', royal: 'Royal Flush' };

async function tableDigest() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ data: posts, error: postsError }, { data: replies, error: repliesError }] = await Promise.all([
    admin.from('posts').select('id, author_id, author_name, suit, body, mirror_lesson_id, created_at').eq('from_jack', false).gte('created_at', since).order('created_at'),
    admin.from('post_replies').select('id, post_id, author_id, author_name, body, created_at').eq('from_jack', false).gte('created_at', since).order('created_at'),
  ]);
  if (postsError) throw postsError;
  if (repliesError) throw repliesError;
  if (!posts?.length && !replies?.length) return { sent: false, reason: 'quiet day' };

  const authorIds = [...new Set([...(posts ?? []), ...(replies ?? [])].map((r) => r.author_id))];
  const replyPostIds = [...new Set((replies ?? []).map((r) => r.post_id))];
  const [{ data: authors }, { data: parents }] = await Promise.all([
    admin.from('profiles').select('id, tier').in('id', authorIds),
    replyPostIds.length ? admin.from('posts').select('id, author_name, body').in('id', replyPostIds) : Promise.resolve({ data: [] as { id: string; author_name: string; body: string }[] }),
  ]);
  const tierOf = new Map((authors ?? []).map((a) => [a.id, a.tier as string]));
  const parentOf = new Map((parents ?? []).map((p) => [p.id, p]));
  const badge = (authorId: string) => {
    const tier = tierOf.get(authorId);
    return tier === 'ace' || tier === 'royal'
      ? ` <span style="background:#c81e37;color:#fff;border-radius:99px;padding:1px 8px;font-size:12px">${PLAN[tier]}</span>`
      : '';
  };
  const needsJack = (posts ?? []).filter((p) => ['ace', 'royal'].includes(tierOf.get(p.author_id) ?? '')).length;

  const postHtml = (posts ?? []).map((p) => `
    <div style="border:1px solid #e4e2dc;border-radius:12px;padding:14px;margin:0 0 10px">
      <div style="font-weight:700">${esc(p.author_name)}${badge(p.author_id)}</div>
      <div style="color:#6b6b66;font-size:13px;margin:2px 0 8px">${p.suit ? esc(SUIT[p.suit] ?? p.suit) + ' · ' : ''}${p.mirror_lesson_id ? 'Mirror answer' : 'Post'}</div>
      <div style="white-space:pre-wrap">${esc(clip(p.body, 400))}</div>
    </div>`).join('');
  const replyHtml = (replies ?? []).map((r) => {
    const parent = parentOf.get(r.post_id);
    return `
    <div style="border-left:3px solid #e4e2dc;padding:4px 0 4px 12px;margin:0 0 12px">
      <div><strong>${esc(r.author_name)}</strong>${badge(r.author_id)} <span style="color:#6b6b66;font-size:13px">replied to ${esc(parent?.author_name ?? 'a post')}${parent ? `: “${esc(clip(parent.body, 60))}”` : ''}</span></div>
      <div style="white-space:pre-wrap;margin-top:4px">${esc(clip(r.body, 300))}</div>
    </div>`;
  }).join('');

  const counts = [
    posts?.length ? `${posts.length} new post${posts.length === 1 ? '' : 's'}` : '',
    replies?.length ? `${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}` : '',
  ].filter(Boolean).join(', ');
  const subject = `The Table today: ${counts}${needsJack ? ` (${needsJack} from Ace or Royal Flush)` : ''}`;
  const html = `<!doctype html><html><body style="margin:0;background:#fafaf7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#121211;line-height:1.5">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px">
    <p style="font-family:Menlo,monospace;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#6b6b66;margin:0 0 4px">The Table · last 24 hours</p>
    <h1 style="font-size:22px;margin:0 0 16px">${esc(counts)}</h1>
    ${needsJack ? `<p style="margin:0 0 16px">${needsJack} ${needsJack === 1 ? 'post is' : 'posts are'} from Ace or Royal Flush members, who get first replies from you.</p>` : ''}
    ${postHtml ? `<h2 style="font-size:16px;margin:20px 0 10px">Posts</h2>${postHtml}` : ''}
    ${replyHtml ? `<h2 style="font-size:16px;margin:20px 0 10px">Replies</h2>${replyHtml}` : ''}
    <p style="margin:20px 0"><a href="${SITE}/#/table" style="background:#c81e37;color:#fff;text-decoration:none;padding:10px 18px;border-radius:99px;font-weight:700">Open the Table</a></p>
    <p style="color:#6b6b66;font-size:12px">Sent to you as the admin of Jack of All Trades. Members never see this email.</p>
  </div></body></html>`;

  const day = new Date().toISOString().slice(0, 10);
  await resend('/emails', {
    method: 'POST',
    idempotencyKey: `table-digest-${day}`,
    body: JSON.stringify({
      from: Deno.env.get('MAIL_FROM') ?? 'Jack of All Trades <hello@jackofalltrades.life>',
      to: [Deno.env.get('ALERT_EMAIL') ?? 'jackofalltrades.life@gmail.com'],
      subject,
      html,
    }),
  });
  console.log('Table round-up sent', { posts: posts?.length ?? 0, replies: replies?.length ?? 0 });
  return { sent: true, posts: posts?.length ?? 0, replies: replies?.length ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  if (!(await fromCron(req, admin))) return json({ error: 'Not allowed' }, 401);
  if (!Deno.env.get('RESEND_API_KEY')) {
    console.error('member-mail: RESEND_API_KEY is not set');
    return json({ error: 'Email is not switched on yet' }, 503);
  }
  const { job } = (await req.json().catch(() => ({}))) as { job?: string };
  try {
    if (job === 'sync') return json(await syncMailingList());
    if (job === 'digest') return json(await tableDigest());
    return json({ error: 'Unknown job' }, 400);
  } catch (err) {
    console.error('member-mail failed', job, err);
    return json({ error: 'Failed' }, 500);
  }
});
