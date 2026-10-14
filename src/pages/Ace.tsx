import { useEffect, useMemo, useState } from 'react';
import { CALL_TIMES, tierById } from '../content';
import { useStore, type Booking } from '../store';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/AppShell';
import { PlanAction } from '../components/PlanAction';
import { fmtDayLong, fmtDayMonth, fmtDayShort, fmtMonth, fromISODate, toISODate, upcomingWeekdays } from '../dates';

export function Ace() {
  const { state } = useStore();
  const member = state.member!;
  const today = toISODate(new Date());
  const booking = state.bookings.find((b) => b.date >= today) ?? null;
  const [editing, setEditing] = useState(false);

  if (member.isAdmin) return <JacksCalls />;

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
          <PlanAction plan="ace" onBlock />
        </section>
      </div>
    );
  }

  return (
    <div className="stack-16">
      <PageHeader title="Your 1:1" aside={<span className="pill">A{'♠︎'} Ace member</span>} />
      <section className="feature feature--static stack-8">
        <p className="body-l on-block">45 minutes with Jack, once a month. Bring the thing you can't say anywhere else.</p>
        <p className="mono small on-block-muted">
          {booking ? `Your ${fmtMonth(fromISODate(booking.date))} call is booked` : 'One call a month · weekdays'}
        </p>
      </section>

      {booking && !editing ? (
        <Booked booking={booking} onChange={() => setEditing(true)} />
      ) : (
        <BookingForm existing={booking} onDone={() => setEditing(false)} />
      )}
    </div>
  );
}

function Booked({ booking, onChange }: { booking: Booking; onChange: () => void }) {
  const { actions } = useStore();
  const [confirming, setConfirming] = useState(false);
  const isToday = booking.date === toISODate(new Date());
  return (
    <section className="card card--edge stack-12" aria-labelledby="booked-title">
      <p className="eyebrow accent-text strong">Booked</p>
      <h2 id="booked-title" className="display-m">{fmtDayLong(fromISODate(booking.date))} at {booking.time}</h2>
      <p className="muted small">Video call · 45 minutes · Jack sends the link the day before.</p>
      {booking.topic && (
        <div className="quote">
          <p className="label">You want to talk about</p>
          <p>{booking.topic}</p>
        </div>
      )}
      {isToday ? (
        <p className="small muted">Your call is today. Need to move it? Message Jack directly.</p>
      ) : confirming ? (
        <div className="stack-8">
          <p className="strong">Cancel this call? You can book another time.</p>
          <div className="row-wrap">
            <button type="button" className="btn btn--accent btn--sm" onClick={() => actions.cancelBooking(booking.id)}>Cancel the call</button>
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

function BookingForm({ existing, onDone }: { existing: Booking | null; onDone: () => void }) {
  const { actions } = useStore();
  const days = useMemo(() => upcomingWeekdays(new Date(), 10), []);
  const [date, setDate] = useState<string>(existing?.date ?? toISODate(days[0]));
  const [time, setTime] = useState<string | null>(existing?.time ?? null);
  const [topic, setTopic] = useState(existing?.topic ?? '');
  const [taken, setTaken] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState(false);
  const months = Array.from(new Set(days.map((d) => fmtMonth(d)))).join(' – ');
  const key = (d: string, t: string) => `${d} ${t}`;
  const mine = existing ? key(existing.date, existing.time) : null;

  useEffect(() => {
    let live = true;
    actions.takenSlots(toISODate(days[0]), toISODate(days[days.length - 1])).then((slots) => {
      if (live) setTaken(new Set(slots.map((s) => key(s.date, s.time)).filter((k) => k !== mine)));
    });
    return () => { live = false; };
  }, [actions, days, mine]);

  const isTaken = (d: string, t: string) => taken?.has(key(d, t)) ?? false;
  const dayFull = (d: string) => CALL_TIMES.every((t) => isTaken(d, t));

  const book = async () => {
    if (!time) return;
    setBusy(true);
    const err = existing ? await actions.moveBooking(existing.id, date, time, topic) : await actions.book(date, time, topic);
    setBusy(false);
    if (!err) {
      actions.notify('ok', existing ? 'Call moved.' : 'Booked. See you then.');
      onDone();
    } else {
      // Someone may have just taken it: refresh what's free.
      const slots = await actions.takenSlots(toISODate(days[0]), toISODate(days[days.length - 1]));
      setTaken(new Set(slots.map((s) => key(s.date, s.time)).filter((k) => k !== mine)));
      setTime(null);
    }
  };

  const chosen = fromISODate(date);

  return (
    <div className="stack-16">
      <div className="stack-8" role="group" aria-labelledby="day-label">
        <p id="day-label" className="label">Pick a day <span className="muted">· {months}</span></p>
        <div className="day-grid">
          {days.map((d) => {
            const iso = toISODate(d);
            const full = dayFull(iso);
            return (
              <button key={iso} type="button" className="day" aria-pressed={iso === date} disabled={full} aria-label={`${fmtDayLong(d)}${full ? ', fully booked' : ''}`} onClick={() => { setDate(iso); setTime(null); }}>
                <span className="day__dow">{fmtDayShort(d)}</span>
                <span className="day__num">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="stack-8" role="group" aria-labelledby="time-label">
        <p id="time-label" className="label">Pick a time {taken === null && <span className="muted">· checking what's free…</span>}</p>
        <div className="time-grid">
          {CALL_TIMES.map((t) => {
            const gone = isTaken(date, t);
            return (
              <button key={t} type="button" className="time" aria-pressed={t === time} disabled={gone || taken === null} aria-label={gone ? `${t}, taken` : t} onClick={() => setTime(t)}>
                {gone ? <s>{t}</s> : t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="field">
        <label htmlFor="call-topic" className="label">What do you want to talk about?</label>
        <textarea id="call-topic" className="input textarea" rows={3} maxLength={1000} placeholder="No need to tidy it up." value={topic} onChange={(e) => setTopic(e.target.value)} />
      </div>

      <button type="button" className="btn btn--accent btn--block btn--lg" disabled={!time || busy} onClick={book}>
        {busy ? 'Booking…' : time ? `${existing ? 'Move to' : 'Book'} ${fmtDayShort(chosen)} ${chosen.getDate()} ${chosen.toLocaleDateString('en-GB', { month: 'short' })} at ${time}` : 'Pick a time to book'}
      </button>
      {existing && <button type="button" className="link-btn small center" onClick={onDone}>Keep my current time</button>}
    </div>
  );
}

/** Jack's view: every upcoming call, with who booked it and what they want to talk about. */
function JacksCalls() {
  const { actions } = useStore();
  const [calls, setCalls] = useState<Booking[] | null>(null);
  const [names, setNames] = useState<Record<string, { name: string; email: string }>>({});
  const today = toISODate(new Date());

  useEffect(() => {
    let live = true;
    Promise.all([actions.adminUpcomingCalls(today), actions.adminMembers()]).then(([c, m]) => {
      if (!live) return;
      setCalls(c ?? []);
      const map: Record<string, { name: string; email: string }> = {};
      for (const row of m ?? []) map[row.id] = { name: row.name, email: row.email };
      setNames(map);
    });
    return () => { live = false; };
  }, [actions, today]);

  return (
    <div className="stack-16">
      <PageHeader title="1:1 calls" sub="Every upcoming call with an Ace member." />
      {calls === null && <p className="muted">Loading calls…</p>}
      {calls?.length === 0 && (
        <section className="card stack-8">
          <p className="strong">No calls booked yet.</p>
          <p className="muted small">When Ace members book, their calls show up here with what they want to talk about.</p>
        </section>
      )}
      {calls?.map((c) => (
        <section key={c.id} className="card stack-8">
          <div className="row-between">
            <p className="strong">{fmtDayMonth(fromISODate(c.date))} · {c.time}</p>
            <span className="small muted">{names[c.memberId]?.name ?? 'Member'}</span>
          </div>
          {names[c.memberId]?.email && <p className="small muted mono selectable">{names[c.memberId].email}</p>}
          {c.topic && <p className="quote">{c.topic}</p>}
        </section>
      ))}
    </div>
  );
}
