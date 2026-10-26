import { useEffect, useState } from 'react';
import { FEATURED_LESSON_ID, LESSONS, canWatch, lessonById, seriesById, suitById, tierById, unlockedBy } from '../content';
import { PAYMENTS_LIVE } from '../config';
import { PlanAction } from '../components/PlanAction';
import { canPost, effectiveTier, useStore } from '../store';
import { Link } from '../router';
import { Avatar, SuitMark } from '../components/Cards';
import { Icon, PlayGlyph } from '../components/Icon';
import { fmtDayLong, fmtDayMonth, fmtEventTime, fromISODate, greeting, nextFridayTable, toISODate } from '../dates';

export function Home() {
  const { state, actions } = useStore();
  const member = state.member!;
  const now = new Date();
  const lesson = lessonById(FEATURED_LESSON_ID)!;
  const series = seriesById(lesson.seriesId)!;
  const suit = suitById(lesson.suit);
  const unlocked = canWatch(effectiveTier(member), lesson);
  const answered = state.mirror[lesson.id];
  const friday = nextFridayTable(now);
  const fridayIso = toISODate(friday);
  const going = state.rsvps.includes(fridayIso);
  const [goingCount, setGoingCount] = useState<number | null>(null);
  const latest = (state.posts ?? []).find((p) => !p.pinned);
  const today = toISODate(now);
  const upcomingCall = state.bookings.find((b) => b.date >= today);
  const watchable = LESSONS.filter((l) => canWatch(effectiveTier(member), l));
  const finished = watchable.filter((l) => state.completed.includes(l.id)).length;
  const waitingFor = member.requestedTier && member.requestedTier !== 'open' && member.requestedTier !== member.tier && !member.isAdmin ? member.requestedTier : null;

  useEffect(() => {
    let live = true;
    actions.rsvpCount(fridayIso).then((n) => live && setGoingCount(n));
    return () => { live = false; };
  }, [actions, fridayIso, going]);

  return (
    <div className="stack-16">
      <header className="page-header">
        <div className="stack-4">
          <p className="eyebrow">{fmtDayLong(now)}</p>
          <h1 className="display-l">{greeting(now)}, {member.name}</h1>
        </div>
        <Link to="/you" className="avatar-link" aria-label="Your profile">
          <Avatar name={member.name} size={44} />
        </Link>
      </header>

      {waitingFor && (PAYMENTS_LIVE ? (
        <section className="card card--edge stack-10">
          <p className="strong">{tierById(waitingFor).name} is open.</p>
          <p className="small muted">You asked to join while payments were being set up. Your seat is ready whenever you are.</p>
          <PlanAction plan={waitingFor} />
        </section>
      ) : (
        <section className="card card--edge stack-6">
          <p className="strong">You're on the list for {tierById(waitingFor).name}.</p>
          <p className="small muted">Payments open soon and founding members get moved up first. Until then you're on Open Hand: the first lesson of every suit, and you can read the Table.</p>
        </section>
      ))}

      <Link to={`/lesson/${lesson.id}`} className="feature">
        <div className="feature__top">
          <span className="eyebrow eyebrow--on-block">{suit.symbol} {suit.name} · This week's hand</span>
          {unlocked ? <span className="pill pill--accent">New</span> : <span className="pill pill--on-block"><Icon name="lock" size={12} /> {tierById(unlockedBy(lesson)).name}</span>}
        </div>
        <h2 className="display-m">{series.title}: {lesson.title.toLowerCase()}</h2>
        <div className="feature__meta">
          <span className="play-dot"><PlayGlyph /></span>
          <span>{lesson.minutes} min · Part {lesson.number} of {series.lessons.length}</span>
        </div>
      </Link>

      <section className="card stack-12" aria-labelledby="mirror-q">
        <p className="eyebrow accent-text strong">The Mirror</p>
        <p id="mirror-q" className="mirror-q">{lesson.mirror}</p>
        {answered ? (
          <div className="row-between">
            <span className="small muted"><Icon name="check" size={14} /> Answered {answered.shared ? 'and shared' : 'privately'}</span>
            <Link to={`/lesson/${lesson.id}`} className="btn btn--outline btn--sm">Edit answer</Link>
          </div>
        ) : (
          <Link to={`/lesson/${lesson.id}`} className="btn btn--outline btn--sm self-start">{unlocked ? 'Answer privately' : 'See the lesson'}</Link>
        )}
      </section>

      <div className="grid-2">
        <section className="card card--tight stack-8">
          <p className="eyebrow">Lessons finished</p>
          <p className="stat">{finished}<span> of {watchable.length}</span></p>
          <div className="meter" aria-hidden="true"><span style={{ width: `${watchable.length ? (finished / watchable.length) * 100 : 0}%` }} /></div>
        </section>
        <section className="card card--tight stack-6">
          <p className="eyebrow">Friday Table</p>
          <p className="strong">Live with Jack</p>
          <p className="small muted">{fmtDayMonth(friday)} · {fmtEventTime(friday)}{goingCount ? ` · ${goingCount} going` : ''}</p>
          {canPost(member) ? (
            <button type="button" className="btn btn--outline btn--xs self-start" aria-pressed={going} onClick={() => actions.toggleRsvp(fridayIso)}>
              <Icon name={going ? 'check' : 'calendar'} size={14} />
              {going ? "You're going" : "I'll be there"}
            </button>
          ) : (
            <p className="small muted">Part of the Full Deck</p>
          )}
        </section>
      </div>

      {upcomingCall && (
        <Link to="/ace" className="card row-card">
          <span className="row-card__icon"><Icon name="video" /></span>
          <span className="grow">
            <span className="strong block">Your 1:1 with Jack</span>
            <span className="small muted">{fmtDayMonth(fromISODate(upcomingCall.date))} at {upcomingCall.time}</span>
          </span>
          <Icon name="chevronRight" size={18} />
        </Link>
      )}

      {latest ? (
        <Link to="/table" className="card row-card">
          <Avatar name={latest.author} size={36} />
          <span className="grow">
            <span className="small muted block">From the Table{latest.suit && <> · <SuitMark suit={latest.suit} /></>}</span>
            <span className="clamp-2"><strong>{latest.author}:</strong> {latest.text}</span>
          </span>
          <Icon name="chevronRight" size={18} />
        </Link>
      ) : state.posts && (
        <Link to="/table" className="card row-card">
          <span className="row-card__icon"><Icon name="table" /></span>
          <span className="grow">
            <span className="strong block">The Table is quiet</span>
            <span className="small muted">{canPost(member) ? 'Be the first to say the honest thing.' : 'See who pulls up a chair first.'}</span>
          </span>
          <Icon name="chevronRight" size={18} />
        </Link>
      )}
    </div>
  );
}
