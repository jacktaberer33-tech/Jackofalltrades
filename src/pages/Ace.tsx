import { useMemo, useState } from 'react';
import { CALL_TIMES, tierById } from '../content';
import { useStore } from '../store';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/AppShell';
import { fmtDayLong, fmtDayShort, fmtMonth, fromISODate, toISODate, upcomingWeekdays } from '../dates';

export function Ace() {
  const { state, actions } = useStore();
  const member = state.member!;
  const now = new Date();
  const booking = state.booking && state.booking.date >= toISODate(now) ? state.booking : null;
  const [editing, setEditing] = useState(false);

  if (member.tier !== 'ace') {
    const ace = tierById('ace');
    return (
      <div className="stack-16">
        <PageHeader title="Your 1:1" sub="Monthly calls with Jack are part of Ace." />
        <section className="feature feature--static stack-12">
          <p className="eyebrow eyebrow--on-block">Ace · {ace.price}{ace.per}</p>
          <h2 className="display-m">Me in your corner, once a month.</h2>
          <ul className="ticks ticks--on-block">
            {ace.perks.map((p) => <li key={p}><Icon name="check" size={18} />{p}</li>)}
          </ul>
          <button type="button" className="btn btn--accent self-start" onClick={() => actions.setTier('ace')}>Switch to Ace (demo)</button>
        </section>
      </div>
    );
  }

  return (
    <div className="stack-16">
      <PageHeader title="Your 1:1" aside={<span className="pill">A{'♠︎'} Ace member</span>} />
      <section className="feature feature--static stack-8">
        <p className="body-l">45 minutes with Jack, once a month. Bring the thing you can't say anywhere else.</p>
        <p className="mono small on-block-muted">
          {booking ? `Your ${fmtMonth(fromISODate(booking.date))} call is booked` : `1 call left in ${fmtMonth(now)}`}
        </p>
      </section>

      {booking && !editing ? (
        <Booked onChange={() => setEditing(true)} />
      ) : (
        <BookingForm
          initialDate={booking?.date}
          initialTime={booking?.time}
          initialTopic={booking?.topic}
          onDone={() => setEditing(false)}
          onCancelEdit={booking ? () => setEditing(false) : undefined}
        />
      )}
    </div>
  );
}

function Booked({ onChange }: { onChange: () => void }) {
  const { state, actions } = useStore();
  const booking = state.booking!;
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="card card--edge stack-12" aria-labelledby="booked-title">
      <p className="eyebrow accent-text strong">Booked</p>
      <h2 id="booked-title" className="display-m">{fmtDayLong(fromISODate(booking.date))} at {booking.time}</h2>
      <p className="muted small">Video call · 45 minutes · the link arrives by email the day before.</p>
      {booking.topic && (
        <div className="quote">
          <p className="label">You want to talk about</p>
          <p>{booking.topic}</p>
        </div>
      )}
      {confirming ? (
        <div className="stack-8">
          <p className="strong">Cancel this call? You can book another time this month.</p>
          <div className="row-wrap">
            <button type="button" className="btn btn--accent btn--sm" onClick={actions.cancelBooking}>Cancel the call</button>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setConfirming(false)}>Keep it</button>
          </div>
        </div>
      ) : (
        <div className="row-wrap">
          <button type="button" className="btn btn--outline btn--sm" onClick={onChange}>Change time</button>
          <button type="button" className="link-btn small" onClick={() => setConfirming(true)}>Cancel call</button>
        </div>
      )}
    </section>
  );
}

function BookingForm({ initialDate, initialTime, initialTopic, onDone, onCancelEdit }: {
  initialDate?: string;
  initialTime?: string;
  initialTopic?: string;
  onDone: () => void;
  onCancelEdit?: () => void;
}) {
  const { actions } = useStore();
  const days = useMemo(() => upcomingWeekdays(new Date(), 8), []);
  const [date, setDate] = useState<string>(initialDate ?? toISODate(days[0]));
  const [time, setTime] = useState<string | null>(initialTime ?? null);
  const [topic, setTopic] = useState(initialTopic ?? '');
  const months = Array.from(new Set(days.map((d) => fmtMonth(d)))).join(' – ');

  const book = () => {
    if (!time) return;
    actions.book({ date, time, topic });
    onDone();
  };

  const chosen = fromISODate(date);

  return (
    <div className="stack-16">
      <div className="stack-8" role="group" aria-labelledby="day-label">
        <p id="day-label" className="label">Pick a day <span className="muted">· {months}</span></p>
        <div className="day-grid">
          {days.map((d) => {
            const iso = toISODate(d);
            return (
              <button key={iso} type="button" className="day" aria-pressed={iso === date} aria-label={fmtDayLong(d)} onClick={() => setDate(iso)}>
                <span className="day__dow">{fmtDayShort(d)}</span>
                <span className="day__num">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="stack-8" role="group" aria-labelledby="time-label">
        <p id="time-label" className="label">Pick a time</p>
        <div className="time-grid">
          {CALL_TIMES.map((t) => (
            <button key={t} type="button" className="time" aria-pressed={t === time} onClick={() => setTime(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label htmlFor="call-topic" className="label">What do you want to talk about?</label>
        <textarea id="call-topic" className="input textarea" rows={3} placeholder="No need to tidy it up." value={topic} onChange={(e) => setTopic(e.target.value)} />
      </div>

      <button type="button" className="btn btn--accent btn--block btn--lg" disabled={!time} onClick={book}>
        {time ? `Book ${fmtDayShort(chosen)} ${chosen.getDate()} ${chosen.toLocaleDateString('en-GB', { month: 'short' })} at ${time}` : 'Pick a time to book'}
      </button>
      {onCancelEdit && <button type="button" className="link-btn small center" onClick={onCancelEdit}>Keep my current time</button>}
    </div>
  );
}
