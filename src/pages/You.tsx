import { useEffect, useState } from 'react';
import { LESSONS, ROYAL_PLACES, SUITS, TIERS, TIER_RANK, canWatch, lessonById, suitById, tierById, type Tier } from '../content';
import { PAYMENTS_LIVE } from '../config';
import { PlanAction } from '../components/PlanAction';
import { effectiveTier, isPaying, useStore, type AdminReferralRow, type Referral, isFilmed } from '../store';
import { referralLink } from '../referral';
import { Link, useRouter } from '../router';
import { Avatar, SuitMark } from '../components/Cards';
import type { AdminMemberRow } from '../supabase';

export function You() {
  const { state, actions } = useStore();
  const { navigate } = useRouter();
  const member = state.member!;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const entries = Object.values(state.mirror).sort((a, b) => b.savedAt - a.savedAt);
  const joined = new Date(member.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const signOut = async () => {
    await actions.signOut();
    navigate('/');
  };

  return (
    <div className="stack-24">
      <header className="profile">
        <Avatar name={member.name} size={64} />
        <div className="stack-4">
          <h1 className="display-l">{member.name}</h1>
          <p className="muted small">{member.isAdmin ? 'Jack (admin)' : tierById(member.tier).name} · member since {joined}</p>
        </div>
      </header>

      {member.isAdmin && <Members />}
      {member.isAdmin && <FridayTableLink />}

      <section className="stack-10" aria-labelledby="progress-title">
        <h2 id="progress-title" className="display-s">Your progress</h2>
        <div className="card stack-12">
          {SUITS.map((s) => {
            const mine = LESSONS.filter((l) => l.suit === s.id && isFilmed(state.filmed, l.id) && canWatch(effectiveTier(member), l));
            const total = mine.length;
            const done = mine.filter((l) => state.completed.includes(l.id)).length;
            return (
              <div key={s.id} className="progress-row">
                <span className="progress-row__name"><SuitMark suit={s.id} /> {s.name}</span>
                <span className="meter grow" aria-hidden="true"><span style={{ width: `${(done / total) * 100}%` }} /></span>
                <span className="small muted tabular">{done}/{total}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="stack-10" aria-labelledby="journal-title">
        <h2 id="journal-title" className="display-s">Your Mirror</h2>
        {entries.length === 0 ? (
          <div className="card stack-8">
            <p className="strong">Your answers will collect here.</p>
            <p className="muted small">Every lesson ends with one honest question. Only you can see your answers unless you share them.</p>
            <Link to="/deck" className="btn btn--outline btn--sm self-start">Find a lesson</Link>
          </div>
        ) : (
          entries.map((e) => {
            const lesson = lessonById(e.lessonId);
            if (!lesson) return null;
            return (
              <Link key={e.lessonId} to={`/lesson/${lesson.id}`} className="card journal">
                <span className="small muted">
                  <SuitMark suit={lesson.suit} /> {suitById(lesson.suit).name} · {new Date(e.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {e.shared ? ' · Shared' : ' · Private'}
                </span>
                <span className="journal__q">{lesson.mirror}</span>
                <span className="journal__a">{e.text}</span>
              </Link>
            );
          })
        )}
      </section>

      {!member.isAdmin && <YourHand />}
      {!member.isAdmin && (member.tier === 'ace' || member.tier === 'royal') && <BringAFriend />}

      <section className="stack-10" aria-labelledby="account-title">
        <h2 id="account-title" className="display-s">Account</h2>
        <div className="card stack-12">
          <div className="stack-2">
            <span className="small muted">Signed in as</span>
            <span className="selectable">{member.email}</span>
          </div>
          <div className="row-wrap">
            <button type="button" className="btn btn--outline btn--sm" onClick={signOut}>Sign out</button>
            {!member.isAdmin && (
              confirmDelete ? null : <button type="button" className="link-btn small" onClick={() => setConfirmDelete(true)}>Close my account</button>
            )}
          </div>
          {confirmDelete && PAYMENTS_LIVE && isPaying(member) && !member.billing.endsAtPeriodEnd && (
            <div className="stack-8">
              <p className="strong">Cancel your plan first</p>
              <p className="small muted">
                You're on {tierById(member.tier).name}, which renews automatically. Cancel it with "Change plan, card or cancel"
                above so you aren't charged again, then come back here to close your account.
              </p>
              <div className="row-wrap">
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setConfirmDelete(false)}>OK</button>
              </div>
            </div>
          )}
          {confirmDelete && !(PAYMENTS_LIVE && isPaying(member) && !member.billing.endsAtPeriodEnd) && (
            <div className="stack-8">
              <p className="strong">Close your account for good?</p>
              <p className="small muted">
                This removes your progress, Mirror answers, posts and any booked call. It can't be undone.
                {PAYMENTS_LIVE && isPaying(member) && ' Your paid plan has already been cancelled, so you will lose any time left on it.'}
              </p>
              <div className="row-wrap">
                <button type="button" className="btn btn--accent btn--sm" onClick={async () => {
                  const err = await actions.deleteAccount();
                  if (!err) navigate('/');
                }}>Close my account</button>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setConfirmDelete(false)}>Keep it</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** Jack only: everyone who has joined, what they asked for, and their plan. */
function Members() {
  const { state, actions } = useStore();
  const [rows, setRows] = useState<AdminMemberRow[] | null>(null);
  const [referrals, setReferrals] = useState<AdminReferralRow[]>([]);

  useEffect(() => {
    let live = true;
    actions.adminMembers().then((r) => live && setRows(r ?? []));
    actions.adminReferrals().then((r) => live && setReferrals(r));
    return () => { live = false; };
  }, [actions]);
  const nameOf = (id: string | null) => (id && rows?.find((r) => r.id === id)?.name) || 'A closed account';

  const change = async (id: string, tier: Tier) => {
    // One tap on a phone shouldn't email someone a welcome or overfill Royal Flush, so ask first.
    const row = (rows ?? []).find((r) => r.id === id);
    if (!row) return;
    const up = TIER_RANK[tier] > TIER_RANK[row.tier as Tier];
    const royalCount = (rows ?? []).filter((r) => r.tier === 'royal' && r.id !== id).length;
    const lines = [
      `Move ${row.name} to ${tierById(tier).name}?`,
      up && tier !== 'open' ? `They'll get the ${tierById(tier).name} welcome email straight away.` : '',
      tier === 'royal' && royalCount >= ROYAL_PLACES ? `Royal Flush already has ${royalCount} members (the cap is ${ROYAL_PLACES}).` : '',
      "This doesn't touch Stripe.",
    ].filter(Boolean);
    if (!window.confirm(lines.join('\n\n'))) return;
    const err = await actions.setMemberTier(id, tier);
    if (!err) {
      setRows((list) => (list ?? []).map((r) => (r.id === id ? { ...r, tier } : r)));
      actions.notify('ok', 'Plan updated.');
    }
  };

  // Only people who asked for a plan above the one they're on (the Royal Flush waitlist included).
  const waiting = (rows ?? []).filter((r) => r.requested_tier && TIER_RANK[r.requested_tier as Tier] > TIER_RANK[r.tier as Tier]).length;

  return (
    <section className="stack-10" aria-labelledby="members-title">
      <div className="row-between">
        <h2 id="members-title" className="display-s">Members</h2>
        {rows && <span className="small muted">{rows.length} joined · {waiting} waiting to upgrade</span>}
      </div>
      {rows === null && <p className="muted small">Loading members…</p>}
      {rows && (
        <div className="table-scroll">
          <table className="members">
            <thead>
              <tr><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Asked for</th><th scope="col">Plan</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}{r.id === state.member?.id && <span className="muted"> (you)</span>}</td>
                  <td className="selectable">{r.email}</td>
                  <td>{r.requested_tier ? tierById(r.requested_tier).name : '—'}</td>
                  <td>
                    <label className="sr-only" htmlFor={`plan-${r.id}`}>Plan for {r.name}</label>
                    <select id={`plan-${r.id}`} className="select" value={r.tier} onChange={(e) => change(r.id, e.target.value as Tier)}>
                      {TIERS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="small muted">Changing a plan here doesn't touch Stripe, and moving someone up sends that plan's welcome email. Use it for free places and fixes; paid plans update themselves.</p>
      {rows && referrals.length > 0 && (
        <div className="card stack-10">
          <p className="strong">Referrals</p>
          <p className="small muted">Put each friend in the group of the member who brought them, if there's room.</p>
          <ul className="referrals">
            {referrals.map((r) => (
              <li key={r.id} className="stack-2">
                <span><strong>{nameOf(r.friend_id)}</strong> joined Ace with {nameOf(r.referrer_id)}'s code <span className="muted">({r.code})</span></span>
                <span className="small muted">
                  {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {' · '}
                  {r.credit_note ?? (r.credited_at ? `£50 credit given to ${nameOf(r.referrer_id)}` : 'Credit pending')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Ace and Royal Flush: their referral code and link. Give £50, get £50. */
function BringAFriend() {
  const { actions } = useStore();
  const [ref, setRef] = useState<Referral | null>(null);

  useEffect(() => {
    let live = true;
    actions.referral().then((r) => live && setRef(r));
    return () => { live = false; };
  }, [actions]);

  if (ref?.status === 'not_eligible') return null;
  const code = ref?.status === 'ready' ? ref.code : null;
  const link = code ? referralLink(code) : '';

  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      actions.notify('ok', done);
    } catch {
      actions.notify('error', "Couldn't copy. Press and hold to select it instead.");
    }
  };
  const share = async () => {
    if (!code) return;
    const text = `Join Ace at Jack of All Trades with my code ${code} and get £50 off your first payment.`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Jack of All Trades', text, url: link });
        return;
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') return; // they closed the share sheet
      }
    }
    await copy(link, 'Link copied. Send it to your friend.');
  };

  return (
    <section className="stack-10" aria-labelledby="refer-title">
      <h2 id="refer-title" className="display-s">Bring a friend</h2>
      <div className="card stack-12">
        <p>
          A friend who joins Ace with your code gets <strong>£50 off</strong> their first payment, and you get{' '}
          <strong>£50 off</strong> your next one. If there's room, they'll go in your group.
        </p>
        {ref === null && <p className="small muted">Getting your code…</p>}
        {ref?.status === 'error' && <p className="form-error" role="alert">{ref.message}</p>}
        {code && (
          <>
            <div className="refer-code">
              <span className="small muted">Your code</span>
              <span className="refer-code__value selectable">{code}</span>
            </div>
            <div className="row-wrap">
              <button type="button" className="btn btn--accent btn--sm" onClick={share}>Share your link</button>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => copy(code, 'Code copied.')}>Copy code</button>
            </div>
            <p className="small muted">
              {ref?.status === 'ready' && ref.joined > 0
                ? `${ref.joined} ${ref.joined === 1 ? 'friend has' : 'friends have'} joined with your code.`
                : 'Nobody has used your code yet.'}{' '}
              It's for new members joining Ace. See the <Link to="/terms">Membership Terms</Link> for the full rules.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/** Jack only: the one recurring call link members use to join the monthly Friday Table. */
function FridayTableLink() {
  const { actions } = useStore();
  const [saved, setSaved] = useState<string | null | undefined>(undefined); // undefined while loading
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    actions.fridayTableLink().then((url) => {
      if (!live) return;
      setSaved(url);
      setText(url ?? '');
    });
    return () => { live = false; };
  }, [actions]);

  const save = async () => {
    setBusy(true);
    const err = await actions.setFridayTableLink(text);
    setBusy(false);
    if (!err) setSaved(text.trim() || null);
  };

  return (
    <section className="stack-10" aria-labelledby="friday-link-title">
      <h2 id="friday-link-title" className="display-s">Friday Table call</h2>
      <div className="card stack-10">
        <p className="small muted">
          The last Friday of each month at 7pm. Paste one recurring Google Meet link. Paying members see a Join button on the day; free members never see it.
        </p>
        <label htmlFor="friday-link" className="label">Call link</label>
        <input
          id="friday-link"
          className="input"
          type="url"
          inputMode="url"
          placeholder="https://meet.google.com/abc-defg-hij"
          value={text}
          disabled={saved === undefined}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="row-wrap">
          <button type="button" className="btn btn--ink btn--sm" disabled={busy || saved === undefined || text.trim() === (saved ?? '')} onClick={save}>
            Save link
          </button>
          {saved && <a className="link-btn small" href={saved} target="_blank" rel="noopener noreferrer">Test it</a>}
        </div>
      </div>
    </section>
  );
}

function YourHand() {
  const { state, actions } = useStore();
  const member = state.member!;
  const current = tierById(member.tier);
  const paying = isPaying(member);
  const [busy, setBusy] = useState(false);
  const renews = member.billing.renewsOn ? new Date(member.billing.renewsOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : null;
  const upgrades = (['deck', 'ace', 'royal'] as const).filter((t) => TIER_RANK[t] > TIER_RANK[member.tier]);

  const billing = async () => {
    setBusy(true);
    const err = await actions.openBilling();
    if (err) setBusy(false);
  };

  return (
    <section className="stack-10" aria-labelledby="plan-title">
      <h2 id="plan-title" className="display-s">Your hand</h2>
      <div className="card stack-12">
        <p><strong>{current.name}</strong> <span className="muted">· {current.price}{current.per}</span></p>

        {PAYMENTS_LIVE && paying && (
          <p className="small muted">
            {member.billing.status === 'past_due'
              ? "Your last payment didn't go through. Update your card to keep your plan."
              : member.billing.endsAtPeriodEnd
                ? `Cancelled. You keep ${current.name} until ${renews ?? 'the end of this period'}.`
                : renews ? `Renews on ${renews}.` : 'Active.'}
          </p>
        )}

        {upgrades.length > 0 && (
          <div className="row-wrap">
            {upgrades.map((t) => <PlanAction key={t} plan={t} className="btn btn--outline btn--sm" />)}
          </div>
        )}

        {PAYMENTS_LIVE && member.billing.hasAccount && (
          <button type="button" className={paying ? 'btn btn--outline btn--sm self-start' : 'link-btn small self-start'} disabled={busy} onClick={billing}>
            {busy ? 'Opening…' : paying ? 'Change plan, card or cancel' : 'Billing history'}
          </button>
        )}
      </div>
    </section>
  );
}
