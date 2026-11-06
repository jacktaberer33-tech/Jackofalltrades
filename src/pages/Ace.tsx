import { useEffect, useMemo, useState } from 'react';
import { CALL_TIMES, ROYAL_PLACES, hasCalls, tierById } from '../content';
import { useStore, type Booking } from '../store';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/AppShell';
import { PlanAction } from '../components/PlanAction';
import { BANK_HOLIDAYS, fmtDayLong, fmtDayMonth, fmtDayShort, fmtMonth, fromISODate, isFridayTableDay, toISODate, todayUK, todayUKISO, upcomingWeekdays, weekKey } from '../dates';

const monthKey = (iso: string) => iso.slice(0, 7);
/** Times that clash with the Friday Table (7pm) on its evening. */
const FRIDAY_TABLE_CLASH = new Set(['18:45', '19:30']);

export function Ace() {
  const { state } = useStore();
  const member = state.member!;
  const today = todayUKISO();
  const upcoming = state.bookings.filter((b) => b.date >= today);
  const [editing, setEditing] = useState<string | null>(null);
  // Ace books one call a calendar month, so a call already had this month counts too.
  const monthsBooked = (except: string | null) => new Set(state.bookings.filter((b) => b.id !== except).map((b) => monthKey(b.date)));

  if (member.isAdmin) return <JacksCalls />;

  if (!hasCalls(member.tier)) {
    const ace = tierById('ace');
    const royal = tierById('royal');
    return (
      <div className="stack-16">
        <PageHeader title="Your 1:1" sub="Calls with Jack are part of Ace and Royal Flush." />
        <section className="feature feature--static stack-12">
          <p className="eyebrow eyebrow--on-block">Ace · {ace.price}{ace.per}</p>
          <h2 className="display-m">Me in your corner, once a month.</h2>
          <ul className="ticks ticks--on-block">
            {ace.perks.map((p) => <li key={p}><Icon name="check" size={18} />{p}</li>)}
          </ul>
          <PlanAction plan="ace" onBlock />
        </section>
        <section className="card stack-12">
          <p className="eyebrow">Royal Flush · {royal.price}{royal.per} · {ROYAL_PLACES} places</p>
          <h2 className="display-s">{royal.pitch}</h2>
          <ul className="ticks">
            {royal.perks.map((p) => <li key={p}><Icon name="check" size={18} />{p}</li>)}
          </ul>
          <PlanAction plan="royal" className="btn btn--outline btn--sm self-start" />
        </section>
      </div>
    );
  }

  const royal = member.tier === 'royal';

  // Ace: one call a month, shown one at a time. Royal Flush: one a week, booked up to four weeks ahead.
  if (!royal) {
    const booking = upcoming[0] ?? null;
    const hadThisMonth = !booking && monthsBooked(null).has(monthKey(today));
    return (
      <div className="stack-16">
        <PageHeader title="Your 1:1" aside={<span className="pill">A{'♠︎'} Ace member</span>} />
        <section className="feature feature--static stack-8">
          <p className="body-l on-block">45 minutes with Jack, once a month. Bring the thing you can't say anywhere else.</p>
          <p className="mono small on-block-muted">
            {booking
              ? `Your ${fmtMonth(fromISODate(booking.date))} call is booked`
              : hadThisMonth
                ? `You've had your ${fmtMonth(fromISODate(today))} call · next month's opens two weeks ahead`
                : 'One call a month · weekdays'}
          </p>
        </section>
        {booking && editing !== booking.id ? (
          <Booked booking={booking} onChange={() => setEditing(booking.id)} />
        ) : (
          <BookingForm existing={booking} horizon={10} blockedMonths={monthsBooked(booking?.id ?? null)} onDone={() => setEditing(null)} />
        )}
      </div>
    );
  }

  // Royal Flush books one call a week, so a call already had earlier this week counts too.
  const weeksBooked = (except: string | null) =>
    new Set(state.bookings.filter((b) => b.id !== except).map((b) => weekKey(fromISODate(b.date))));
  const editingBooking = upcoming.find((b) => b.id === editing) ?? null;
  const allWeeksBooked = upcomingWeekdays(todayUK(), 20).every((d) => weeksBooked(null).has(weekKey(d)));

  return (
    <div className="stack-16">
      <PageHeader title="Your 1:1" aside={<span className="pill pill--accent">Royal Flush</span>} />
      <section className="feature feature--static stack-8">
        <p className="body-l on-block">45 minutes with Jack, every week. Bring the thing you can't say anywhere else.</p>
        <p className="mono small on-block-muted">
          {upcoming.length ? `${upcoming.length} call${upcoming.length === 1 ? '' : 's'} booked` : 'No calls booked yet'} · one a week · book up to four weeks ahead
        </p>
      </section>

      {editingBooking ? (
        <BookingForm key={editingBooking.id} existing={editingBooking} horizon={20} blockedWeeks={weeksBooked(editingBooking.id)} onDone={() => setEditing(null)} />
      ) : (
        <>
          {upcoming.map((b) => <Booked key={b.id} booking={b} onChange={() => setEditing(b.id)} />)}
          {allWeeksBooked ? (
            <p className="muted small">You're booked for the next four weeks. The next week opens as each one passes.</p>
          ) : (
            <section className="stack-12" aria-labelledby="book-week">
              <h2 id="book-week" className="display-s">{upcoming.length ? 'Book another week' : 'Book your first call'}</h2>
              <BookingForm key={`new-${upcoming.length}`} existing={null} horizon={20} blockedWeeks={weeksBooked(null)} onDone={() => setEditing(null)} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Booked({ booking, onChange }: { booking: Booking; onChange: () => void }) {
  const { actions } = useStore();
  const [confirming, setConfirming] = useState(false);
  const isToday = booking.date === todayUKISO();
  return (
    <section className="card card--edge stack-12" aria-labelledby="booked-title">
      <p className="eyebrow accent-text strong">Booked</p>
      <h2 id="booked-title" className="display-m">{fmtDayLong(fromISODate(booking.date))} at {booking.time} <span className="muted small">UK time</span></h2>
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
          <p className="small muted">You can cancel or move a call up to the end of the day before it.</p>
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

function BookingForm({ existing, onDone, horizon, blockedWeeks, blockedMonths }: {
  existing: Booking | null;
  onDone: () => void;
  /** How many weekdays ahead the member can book. */
  horizon: number;
  /** Royal Flush: weeks that already have a call. */
  blockedWeeks?: Set<string>;
  /** Ace: months that already have a call. */
  blockedMonths?: Set<string>;
}) {
  const { actions } = useStore();
  const days = useMemo(() => upcomingWeekdays(todayUK(), horizon), [horizon]);
  const weekTaken = (iso: string) => blockedWeeks?.has(weekKey(fromISODate(iso))) ?? false;
  const monthTaken = (iso: string) => blockedMonths?.has(monthKey(iso)) ?? false;
  const closed = (iso: string) => BANK_HOLIDAYS.has(iso);
  const unavailable = (iso: string) => weekTaken(iso) || monthTaken(iso) || closed(iso);
  const firstOpen = days.map(toISODate).find((iso) => !unavailable(iso)) ?? null;
  const [date, setDate] = useState<string>(existing?.date ?? firstOpen ?? toISODate(days[0]));
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

  // Taken by someone else, or clashing with the Friday Table that evening.
  const isTaken = (d: string, t: string) => (taken?.has(key(d, t)) ?? false) || (isFridayTableDay(d) && FRIDAY_TABLE_CLASH.has(t));
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

  if (!existing && !firstOpen) {
    return (
      <p className="muted small">
        {blockedMonths?.size
          ? "You've had this month's call. Days in next month appear here two weeks ahead."
          : 'Nothing to book in the next few weeks yet. New days open as each week passes.'}
      </p>
    );
  }

  return (
    <div className="stack-16">
      <div className="stack-8" role="group" aria-labelledby="day-label">
        <p id="day-label" className="label">Pick a day <span className="muted">· {months}</span></p>
        <div className="day-grid">
          {days.map((d) => {
            const iso = toISODate(d);
            const full = dayFull(iso);
            const booked = weekTaken(iso) || monthTaken(iso);
            const holiday = closed(iso);
            const why = holiday ? ', bank holiday, no calls' : weekTaken(iso) ? ', you already have a call that week' : monthTaken(iso) ? ', you already have a call that month' : full ? ', fully booked' : '';
            return (
              <button key={iso} type="button" className="day" aria-pressed={iso === date} disabled={full || booked || holiday} aria-label={`${fmtDayLong(d)}${why}`} title={why ? why.slice(2) : undefined} onClick={() => { setDate(iso); setTime(null); }}>
                <span className="day__dow">{fmtDayShort(d)}</span>
                <span className="day__num">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="stack-8" role="group" aria-labelledby="time-label">
        <p id="time-label" className="label">Pick a time <span className="muted">· UK time</span>{taken === null && <span className="muted"> · checking what's free…</span>}</p>
        {isFridayTableDay(date) && <p className="small muted">It's the Friday Table that evening, so the 18:45 and 19:30 slots are off.</p>}
        <div className="time-grid">
          {CALL_TIMES.map((t) => {
            const gone = isTaken(date, t);
            return (
              <button key={t} type="button" className="time" aria-pressed={t === time} disabled={gone || taken === null} aria-label={gone ? `${t} UK time, not available` : `${t} UK time`} onClick={() => setTime(t)}>
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
        {busy ? 'Booking…' : time ? `${existing ? 'Move to' : 'Book'} ${fmtDayShort(chosen)} ${chosen.getDate()} ${chosen.toLocaleDateString('en-GB', { month: 'short' })} at ${time} UK time` : 'Pick a time to book'}
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
  const today = todayUKISO();

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
      <PageHeader title="1:1 calls" sub="Every upcoming call with Ace and Royal Flush members." />
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
