import { useEffect, useState } from 'react';
import { LESSONS, SUITS, TIERS, TIER_RANK, lessonById, suitById, tierById, type Tier } from '../content';
import { PAYMENTS_LIVE } from '../config';
import { PlanAction } from '../components/PlanAction';
import { isPaying, useStore } from '../store';
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

      <section className="stack-10" aria-labelledby="progress-title">
        <h2 id="progress-title" className="display-s">Your progress</h2>
        <div className="card stack-12">
          {SUITS.map((s) => {
            const total = LESSONS.filter((l) => l.suit === s.id).length;
            const done = LESSONS.filter((l) => l.suit === s.id && state.completed.includes(l.id)).length;
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

  useEffect(() => {
    let live = true;
    actions.adminMembers().then((r) => live && setRows(r ?? []));
    return () => { live = false; };
  }, [actions]);

  const change = async (id: string, tier: Tier) => {
    const err = await actions.setMemberTier(id, tier);
    if (!err) {
      setRows((list) => (list ?? []).map((r) => (r.id === id ? { ...r, tier } : r)));
      actions.notify('ok', 'Plan updated.');
    }
  };

  const waiting = (rows ?? []).filter((r) => r.requested_tier && r.requested_tier !== 'open' && r.requested_tier !== r.tier).length;

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
      <p className="small muted">Until payments are live, upgrade founding members here after they've paid you.</p>
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

        {!paying && upgrades.length > 0 && (
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
