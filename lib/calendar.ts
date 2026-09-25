// When ACH can actually move money.
//
// The sweep engine runs every calendar day, but an ACH transfer can only be
// initiated on a day the Federal Reserve is open. Deciding to move on a
// Saturday produces a settlement date that cannot happen, and a statement that
// claims a transfer landed on a weekend.
//
// Federal Reserve Bank holiday observance differs from the federal-employee
// rule in one place worth getting right: when a fixed-date holiday falls on a
// SUNDAY the Fed is closed the following Monday, but when it falls on a
// SATURDAY the Fed stays OPEN the preceding Friday. Applying the federal-
// employee rule instead would close the banks on a day they are trading.

/** Fixed-date federal holidays, as [month (1-12), day]. */
const FIXED: Array<[number, number]> = [
  [1, 1], // New Year's Day
  [6, 19], // Juneteenth National Independence Day
  [7, 4], // Independence Day
  [11, 11], // Veterans Day
  [12, 25], // Christmas Day
];

/** Floating holidays, as [month, weekday (0=Sun), nth occurrence]. -1 = last. */
const FLOATING: Array<[number, number, number]> = [
  [1, 1, 3], // Martin Luther King, Jr. Day — 3rd Monday in January
  [2, 1, 3], // Washington's Birthday — 3rd Monday in February
  [5, 1, -1], // Memorial Day — last Monday in May
  [9, 1, 1], // Labor Day — 1st Monday in September
  [10, 1, 2], // Columbus Day — 2nd Monday in October
  [11, 4, 4], // Thanksgiving Day — 4th Thursday in November
];

function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The date of a floating holiday in a given year. */
function floatingDate(year: number, month: number, weekday: number, nth: number): string {
  if (nth === -1) {
    const last = new Date(Date.UTC(year, month, 0)); // day 0 of next month
    const back = (last.getUTCDay() - weekday + 7) % 7;
    last.setUTCDate(last.getUTCDate() - back);
    return iso(last);
  }
  const first = new Date(Date.UTC(year, month - 1, 1));
  const forward = (weekday - first.getUTCDay() + 7) % 7;
  first.setUTCDate(1 + forward + (nth - 1) * 7);
  return iso(first);
}

/** Every date the Federal Reserve is closed in a given year. */
function holidaysFor(year: number): Set<string> {
  const out = new Set<string>();

  for (const [month, day] of FIXED) {
    const d = new Date(Date.UTC(year, month - 1, day));
    const dow = d.getUTCDay();
    if (dow === 0) {
      // Sunday holiday — the Fed closes the next day.
      d.setUTCDate(d.getUTCDate() + 1);
      out.add(iso(d));
    } else if (dow === 6) {
      // Saturday holiday — the Fed does NOT close the preceding Friday.
      continue;
    } else {
      out.add(iso(d));
    }
  }

  for (const [month, weekday, nth] of FLOATING) {
    out.add(floatingDate(year, month, weekday, nth));
  }

  // New Year's Day of the following year can land on a Sunday, closing the
  // Fed on January 2 — which belongs to that next year, not this one. The
  // per-year lookup handles it, so nothing extra is needed here.
  return out;
}

const holidayCache = new Map<number, Set<string>>();

function holidays(year: number): Set<string> {
  let set = holidayCache.get(year);
  if (!set) {
    set = holidaysFor(year);
    holidayCache.set(year, set);
  }
  return set;
}

/** True when ACH can be initiated: a weekday the Federal Reserve is open. */
export function isBankingDay(date: string): boolean {
  const d = utc(date);
  const dow = d.getUTCDay();
  if (dow === 0 || dow === 6) return false;
  return !holidays(d.getUTCFullYear()).has(date);
}

/** The first banking day on or after `date`. */
export function nextBankingDay(date: string): string {
  const d = utc(date);
  // A year of slack is far more than any run of closures; the guard just stops
  // a malformed date from spinning forever.
  for (let i = 0; i < 366; i++) {
    const candidate = iso(d);
    if (isBankingDay(candidate)) return candidate;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return date;
}

/** Why the banks are shut, for the move log. */
export function closedReason(date: string): string {
  const dow = utc(date).getUTCDay();
  if (dow === 0 || dow === 6) return 'the weekend';
  return 'a federal holiday';
}
