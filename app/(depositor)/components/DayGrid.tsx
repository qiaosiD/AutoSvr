import { formatCents, formatPct } from '@/lib/apy';
import type { DayCell } from '@/lib/depositor/account';

/**
 * One box per calendar day, laid out as a month-by-month grid.
 *
 * The proportional bar this replaced answered "roughly how long at each bank?"
 * but a customer checking a specific date couldn't find it. Fixed 31-column
 * rows mean day 14 sits in the same column in every month, so a date is
 * findable by eye rather than by hovering along a strip.
 */

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysInMonth(year: number, month1: number) {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function DayGrid({
  days,
  colorFor,
}: {
  days: DayCell[];
  colorFor: Map<string, string>;
}) {
  if (days.length === 0) return null;

  // Group into calendar months, preserving order.
  const byMonth = new Map<string, DayCell[]>();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(d);
    byMonth.set(key, list);
  }

  const cellByDate = new Map(days.map((d) => [d.date, d]));
  const banksSeen = [...new Set(days.map((d) => d.bankId))].map((id) => ({
    id,
    name: days.find((d) => d.bankId === id)!.bankName,
  }));

  return (
    <div>
      {/*
        Ruler and rows share one scroll container so their columns stay locked
        together. At phone width 31 columns collapse to ~5px each and the day
        numbers become unreadable, so the grid scrolls rather than shrinks.
      */}
      <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div style={{ minWidth: '600px' }}>
      {/* Column ruler: which day-of-month each column is. */}
      <div
        className="mb-1.5 grid gap-[3px]"
        style={{ gridTemplateColumns: '2.5rem repeat(31, minmax(0, 1fr))' }}
      >
        <div />
        {Array.from({ length: 31 }, (_, i) => (
          <div
            key={i}
            className="tnum text-center text-[9px] font-semibold leading-none"
            style={{ color: 'var(--ink-faint)' }}
          >
            {i + 1}
          </div>
        ))}
      </div>

      <div className="space-y-[3px]">
        {[...byMonth.keys()].map((monthKey) => {
          const [y, m] = monthKey.split('-').map(Number);
          const total = daysInMonth(y, m);

          return (
            <div
              key={monthKey}
              className="grid items-center gap-[3px]"
              style={{ gridTemplateColumns: '2.5rem repeat(31, minmax(0, 1fr))' }}
            >
              <div
                className="pr-1 text-right text-[11px] font-semibold"
                style={{ color: 'var(--ink-soft)' }}
              >
                {MONTH_ABBR[m - 1]}
              </div>

              {Array.from({ length: 31 }, (_, i) => {
                const dayNum = i + 1;
                if (dayNum > total) return <div key={dayNum} />;

                const date = `${monthKey}-${String(dayNum).padStart(2, '0')}`;
                const cell = cellByDate.get(date);

                // A day outside the account's life — before opening, or still
                // ahead of today. Kept as a slot so columns stay aligned.
                if (!cell) {
                  return (
                    <div
                      key={dayNum}
                      className="tnum grid h-7 place-items-center rounded-[4px] text-[9px] leading-none"
                      style={{ background: '#eef1f6', color: '#c3ccda' }}
                    >
                      {dayNum}
                    </div>
                  );
                }

                const when = new Date(`${date}T00:00:00Z`);
                const label = [
                  `${WEEKDAY[when.getUTCDay()]}, ${MONTH_ABBR[m - 1]} ${dayNum}, ${y}`,
                  cell.bankName,
                  `${formatPct(cell.apr)} APY`,
                  `${formatCents(cell.accruedCents)} earned`,
                  cell.isMoveDay ? '— transferred in on this day' : '',
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <div
                    key={dayNum}
                    title={label}
                    className="tnum grid h-7 place-items-center rounded-[4px] text-[9px] font-semibold leading-none text-white"
                    style={{
                      background: colorFor.get(cell.bankId),
                      // A move lands on this day: mark the seam so a customer
                      // can see exactly where one bank handed off to the next.
                      boxShadow: cell.isMoveDay ? 'inset 2px 0 0 0 rgba(255,255,255,0.95)' : undefined,
                    }}
                  >
                    {dayNum}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      </div>
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        {banksSeen.map((b) => (
          <div key={b.id} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ background: colorFor.get(b.id) }}
            />
            <span className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>
              {b.name}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ background: 'var(--ink-faint)', boxShadow: 'inset 2px 0 0 0 #fff' }}
          />
          <span className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>
            Transfer landed
          </span>
        </div>
      </div>

      <p className="mt-3 text-[12px]" style={{ color: 'var(--ink-faint)' }}>
        Each box is one day. Hover a day to see the bank, the rate it paid, and what you
        earned that day.
      </p>
    </div>
  );
}
