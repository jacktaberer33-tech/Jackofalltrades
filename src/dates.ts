const DAY_MS = 24 * 60 * 60 * 1000;

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The Monday of the week a date falls in, as YYYY-MM-DD. Royal Flush books one call per week. */
export function weekKey(d: Date): string {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return toISODate(monday);
}

/** Today's date in the UK, as YYYY-MM-DD, wherever the member's device is. Calls and the Friday Table run on UK time. */
export function todayUKISO(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
/** Today in the UK, as a local midnight Date (for day grids). */
export const todayUK = (now = new Date()) => fromISODate(todayUKISO(now));

/** England and Wales bank holidays, when there are no 1:1 calls. Add each new year's from gov.uk/bank-holidays. */
export const BANK_HOLIDAYS = new Set([
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28',
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28',
]);

/** True if the Friday Table (7pm) falls on this day. */
export function isFridayTableDay(iso: string): boolean {
  const d = fromISODate(iso);
  return [-1, 0].some((offset) => toISODate(fridayTableFor(d.getFullYear(), d.getMonth() + offset)) === iso);
}

/** The next `count` weekdays (Mon–Fri), starting tomorrow. */
export function upcomingWeekdays(now: Date, count: number): Date[] {
  const out: Date[] = [];
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (out.length < count) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) out.push(new Date(d));
  }
  return out;
}

function lastFridayOf(year: number, month: number): Date {
  const d = new Date(year, month + 1, 0, 19, 0); // last day of the month, 7pm
  while (d.getDay() !== 5) d.setDate(d.getDate() - 1);
  return d;
}

/**
 * Months whose Friday Table moves off the last Friday: 'YYYY-MM' → the date it moves to (still 7pm).
 * Keep in step with FRIDAY_TABLE_MOVED in supabase/functions/member-mail/welcome.ts.
 */
export const FRIDAY_TABLE_MOVED: Record<string, string> = {
  '2026-12': '2027-01-01', // Christmas Day → New Year's Day
};

/** The Friday Table for a month: its last Friday at 7pm, unless that month's call has moved. */
function fridayTableFor(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const key = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}`;
  const moved = FRIDAY_TABLE_MOVED[key];
  if (moved) {
    const [y, m, d] = moved.split('-').map(Number);
    return new Date(y, m - 1, d, 19, 0);
  }
  return lastFridayOf(first.getFullYear(), first.getMonth());
}

/** Friday Table runs on the last Friday of each month at 7pm (see FRIDAY_TABLE_MOVED for exceptions). */
export function nextFridayTable(now: Date): Date {
  // A moved call can fall in the next month, so look at last month's too. Each stays "next" until 9pm.
  const candidates = [-1, 0, 1, 2].map((offset) => fridayTableFor(now.getFullYear(), now.getMonth() + offset));
  return candidates
    .filter((d) => d.getTime() + 2 * 60 * 60 * 1000 > now.getTime())
    .sort((a, b) => a.getTime() - b.getTime())[0];
}

export const fmtDayShort = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short' });
export const fmtDayLong = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
export const fmtDayMonth = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtMonth = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long' });

export function fmtEventTime(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

export function timeAgo(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(diff / DAY_MS);
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}
