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

/** Friday Table runs on the last Friday of each month at 7pm. */
export function nextFridayTable(now: Date): Date {
  const thisMonth = lastFridayOf(now.getFullYear(), now.getMonth());
  if (thisMonth.getTime() + 2 * 60 * 60 * 1000 > now.getTime()) return thisMonth;
  return lastFridayOf(now.getFullYear(), now.getMonth() + 1);
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
