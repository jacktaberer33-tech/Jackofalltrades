import { useState } from 'react';
import { LESSONS, SUITS, TIERS, lessonById, suitById, tierById } from '../content';
import { useStore } from '../store';
import { Link, useRouter } from '../router';
import { Avatar, SuitMark } from '../components/Cards';

export function You() {
  const { state, actions } = useStore();
  const { navigate } = useRouter();
  const member = state.member!;
  const [confirmReset, setConfirmReset] = useState(false);
  const entries = Object.values(state.mirror).sort((a, b) => b.savedAt - a.savedAt);
  const joined = new Date(member.joinedAt).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="stack-24">
      <header className="profile">
        <Avatar name={member.name} size={64} />
        <div className="stack-4">
          <h1 className="display-l">{member.name}</h1>
          <p className="muted small">{tierById(member.tier).name} · member since {joined}</p>
        </div>
      </header>

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

      <section className="stack-10" aria-labelledby="plan-title">
        <h2 id="plan-title" className="display-s">Your hand</h2>
        <fieldset className="tier-picker">
          <legend className="small muted">Change plan (demo, no payment)</legend>
          {TIERS.map((t) => (
            <label key={t.id} className={`tier-option ${member.tier === t.id ? 'is-on' : ''}`}>
              <input type="radio" name="plan-tier" id={`plan-tier-${t.id}`} value={t.id} checked={member.tier === t.id} onChange={() => actions.setTier(t.id)} />
              <span className="tier-option__name">{t.name}</span>
              <span className="tier-option__price">{t.price}{t.per}</span>
            </label>
          ))}
        </fieldset>
      </section>

      <section className="card stack-10">
        <p className="strong">Start the demo again</p>
        <p className="muted small">Clears your progress, answers, posts and bookings in this browser.</p>
        {confirmReset ? (
          <div className="row-wrap">
            <button type="button" className="btn btn--accent btn--sm" onClick={() => { actions.reset(); navigate('/'); }}>Clear everything</button>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setConfirmReset(false)}>Keep it</button>
          </div>
        ) : (
          <button type="button" className="btn btn--outline btn--sm self-start" onClick={() => setConfirmReset(true)}>Reset demo</button>
        )}
      </section>
    </div>
  );
}
