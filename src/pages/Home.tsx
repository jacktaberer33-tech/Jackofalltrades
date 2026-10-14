import { FEATURED_LESSON_ID, LESSONS, canWatch, lessonById, seriesById, suitById } from '../content';
import { useStore } from '../store';
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
  const unlocked = canWatch(member.tier, lesson);
  const answered = state.mirror[lesson.id];
  const friday = nextFridayTable(now);
  const latest = state.posts.find((p) => !p.pinned);
  const upcomingCall = state.booking && state.booking.date >= toISODate(now) ? state.booking : null;
  const finished = state.completed.length;

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

      <Link to={`/lesson/${lesson.id}`} className="feature">
        <div className="feature__top">
          <span className="eyebrow eyebrow--on-block">{suit.symbol} {suit.name} · This week's hand</span>
          {unlocked ? <span className="pill pill--accent">New</span> : <span className="pill pill--on-block"><Icon name="lock" size={12} /> Full Deck</span>}
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
          <Link to={`/lesson/${lesson.id}`} className="btn btn--outline btn--sm self-start">Answer privately</Link>
        )}
      </section>

      <div className="grid-2">
        <section className="card card--tight stack-8">
          <p className="eyebrow">Lessons finished</p>
          <p className="stat">{finished}<span> of {LESSONS.length}</span></p>
          <div className="meter" aria-hidden="true"><span style={{ width: `${(finished / LESSONS.length) * 100}%` }} /></div>
        </section>
        <section className="card card--tight stack-6">
          <p className="eyebrow">Friday Table</p>
          <p className="strong">Live with Jack</p>
          <p className="small muted">{fmtDayMonth(friday)} · {fmtEventTime(friday)}</p>
          <button type="button" className="btn btn--outline btn--xs self-start" aria-pressed={state.fridayReminder} onClick={actions.toggleReminder}>
            <Icon name={state.fridayReminder ? 'check' : 'bell'} size={14} />
            {state.fridayReminder ? 'Reminder on' : 'Remind me'}
          </button>
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

      {latest && (
        <Link to="/table" className="card row-card">
          <Avatar name={latest.author} size={36} />
          <span className="grow">
            <span className="small muted block">From the Table{latest.suit && <> · <SuitMark suit={latest.suit} /></>}</span>
            <span className="clamp-2"><strong>{latest.author}:</strong> {latest.text}</span>
          </span>
          <Icon name="chevronRight" size={18} />
        </Link>
      )}
    </div>
  );
}
