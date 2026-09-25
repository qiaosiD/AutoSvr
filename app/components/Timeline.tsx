import { bankName } from '@/lib/banks';
import { formatPct } from '@/lib/apy';
import type { TimelineDay } from '@/lib/data';

/**
 * The linear map: one column per day, colored by which bank held the money.
 * Contiguous runs at the same bank are drawn as a single labeled block so the
 * moves read as a sequence rather than 90 undifferentiated ticks.
 */
// Ordered so the first banks assigned land far apart in hue — sky next to
// cyan, or violet next to indigo, is unreadable at timeline-block size.
const PALETTE = [
  'bg-sky-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500',
  'bg-violet-500', 'bg-teal-400', 'bg-orange-600', 'bg-lime-400',
];

interface Run {
  bankId: string;
  start: string;
  end: string;
  days: number;
  avgApr: number;
  earnedCents: number;
}

function toRuns(timeline: TimelineDay[]): Run[] {
  const runs: Run[] = [];
  for (const day of timeline) {
    const last = runs.at(-1);
    if (last && last.bankId === day.bankId) {
      last.end = day.date;
      last.days += 1;
      last.avgApr += (day.apr - last.avgApr) / last.days;
      last.earnedCents += day.accruedCents;
    } else {
      runs.push({
        bankId: day.bankId,
        start: day.date,
        end: day.date,
        days: 1,
        avgApr: day.apr,
        earnedCents: day.accruedCents,
      });
    }
  }
  return runs;
}

export function Timeline({ timeline }: { timeline: TimelineDay[] }) {
  const runs = toRuns(timeline);
  const colorFor = new Map<string, string>();
  runs.forEach((r) => {
    if (!colorFor.has(r.bankId)) colorFor.set(r.bankId, PALETTE[colorFor.size % PALETTE.length]);
  });

  return (
    <div className="space-y-4">
      <div className="flex h-14 w-full overflow-hidden rounded-lg ring-1 ring-white/10">
        {runs.map((run) => (
          <div
            key={run.start}
            className={`${colorFor.get(run.bankId)} group relative flex items-center justify-center`}
            style={{ width: `${(run.days / timeline.length) * 100}%` }}
            title={`${bankName(run.bankId)} — ${run.days} days at ~${formatPct(run.avgApr)}`}
          >
            {run.days / timeline.length > 0.12 && (
              <span className="truncate px-2 text-xs font-medium text-white/95">
                {bankName(run.bankId)}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between text-xs text-zinc-500">
        <span>{timeline[0]?.date}</span>
        <span>{timeline.length} days</span>
        <span>{timeline.at(-1)?.date}</span>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-zinc-500">
            <th className="py-2 font-medium">Bank</th>
            <th className="py-2 font-medium">Period</th>
            <th className="py-2 text-right font-medium">Days</th>
            <th className="py-2 text-right font-medium">Avg APR</th>
            <th className="py-2 text-right font-medium">Earned</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.start} className="border-b border-white/5">
              <td className="py-2">
                <span className="flex items-center gap-2">
                  <span className={`${colorFor.get(run.bankId)} h-2.5 w-2.5 rounded-full`} />
                  {bankName(run.bankId)}
                </span>
              </td>
              <td className="py-2 text-zinc-400">{run.start} → {run.end}</td>
              <td className="py-2 text-right tabular-nums">{run.days}</td>
              <td className="py-2 text-right tabular-nums">{formatPct(run.avgApr)}</td>
              <td className="py-2 text-right tabular-nums">
                ${(run.earnedCents / 100).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
