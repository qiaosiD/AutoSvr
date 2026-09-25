import { formatPct } from '@/lib/apy';
import { getDataMap } from '@/lib/depositor/datamap';
import { getDepositorAccount } from '@/lib/depositor/account';

export const dynamic = 'force-dynamic';

/* The spine is laid out vertically on purpose. A left-to-right pipeline needs
   ~950px to stay legible and then scrolls sideways on a phone; stacked stages
   read the same at every width. */
const BOX = { x: 168, w: 364, h: 70 };
const STAGE_Y = [20, 124, 228, 332, 436, 540, 644];

function Stage({
  i,
  title,
  sub,
  note,
  live,
}: {
  i: number;
  title: string;
  sub: string;
  note?: string;
  live?: boolean;
}) {
  const y = STAGE_Y[i];
  return (
    <g>
      <rect
        x={BOX.x}
        y={y}
        width={BOX.w}
        height={BOX.h}
        rx={12}
        fill="#fff"
        stroke={live ? 'var(--brand)' : 'var(--line)'}
        strokeWidth={live ? 2 : 1.25}
      />
      <text x={BOX.x + 20} y={y + 28} fontSize={14} fontWeight={650} fill="var(--ink)">
        {title}
      </text>
      <text x={BOX.x + 20} y={y + 48} fontSize={12} fill="var(--ink-faint)">
        {sub}
      </text>
      {note && (
        <text x={BOX.x + BOX.w + 16} y={y + 34} fontSize={11.5} fill="var(--ink-soft)">
          {note}
        </text>
      )}
      {live && <circle cx={BOX.x + BOX.w - 18} cy={y + 22} r={4.5} fill="var(--gain)" />}
    </g>
  );
}

function Arrow({ from }: { from: number }) {
  const y1 = STAGE_Y[from] + BOX.h;
  const y2 = STAGE_Y[from + 1];
  const x = BOX.x + BOX.w / 2;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2 - 8} stroke="var(--line)" strokeWidth={2} />
      <path d={`M ${x - 5} ${y2 - 9} L ${x} ${y2 - 1} L ${x + 5} ${y2 - 9} Z`} fill="var(--line)" />
    </g>
  );
}

function StatusPill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
      style={{
        background: on ? '#d1fae5' : '#f1f5f9',
        color: on ? '#065f46' : 'var(--ink-faint)',
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: on ? '#059669' : '#94a3b8' }}
      />
      {label}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-7" style={{ borderColor: 'var(--line)' }}>
      {children}
    </section>
  );
}

export default async function HowItWorksPage() {
  const [map, acct] = await Promise.all([getDataMap(), getDepositorAccount()]);

  const fmtCount = (n: number | null) => (n === null ? 'unreadable' : n.toLocaleString('en-US'));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">How it works</h1>
        <p className="mt-1 text-[15px]" style={{ color: 'var(--ink-soft)' }}>
          Every stage between a bank publishing a rate and your balance changing.
        </p>
      </div>

      {/* ---------- Live status ---------- */}
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill on={map.crawl.configured} label={`Crawl · ${map.crawl.detail}`} />
          <StatusPill on={map.parse.configured} label={`Parse · ${map.parse.detail}`} />
          <StatusPill on={map.ledger.configured} label={`Ledger · ${map.ledger.detail}`} />
        </div>
        <p className="mt-4 text-[13.5px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          These reflect what this deployment can reach right now, not what the diagram
          intends. A stage without its credential falls back to a deterministic 90-day
          history, so the pages below never show an empty state — but they also would not
          be telling you anything real, which is why the badge says so.
        </p>
      </Card>

      {/* ---------- The map ---------- */}
      <Card>
        <h2 className="text-[19px] font-semibold tracking-tight">The data map</h2>
        <p className="mt-1.5 text-[14px]" style={{ color: 'var(--ink-soft)' }}>
          Runs once a day at 14:00 UTC, and on demand.
        </p>

        <div className="-mx-2 mt-6 overflow-x-auto px-2">
          <svg
            viewBox="0 0 700 736"
            role="img"
            aria-label="Data flow from bank rate pages through crawling, parsing, the sweep engine, the ledger, and the read layer to the pages you see"
            style={{ width: '100%', minWidth: 560, height: 'auto' }}
          >
            {STAGE_Y.slice(0, -1).map((_, i) => (
              <Arrow key={i} from={i} />
            ))}

            <Stage
              i={0}
              title="Bank rate pages"
              sub={map.sources.join(' · ')}
              note={`${map.sourceCount} sources`}
            />
            <Stage
              i={1}
              title="Nimble"
              sub="Headless crawl, waits for the rate table to render"
              note="HTML in"
              live={map.crawl.configured}
            />
            <Stage
              i={2}
              title="Liquid LFM 2.5"
              sub="Reads the markup, returns structured rate rows"
              note={
                map.liveRateRows === null
                  ? 'not reporting'
                  : `${fmtCount(map.liveRateRows)} live rows`
              }
              live={map.parse.configured}
            />
            <Stage
              i={3}
              title="Sweep engine"
              sub={`Insured · no fee · beats current by ${map.thresholdBps}bp · banking day`}
              note={`${fmtCount(map.sweepRows)} moves`}
            />
            <Stage
              i={4}
              title="RawTree"
              sub="rate_observations · sweep_events · daily_accruals"
              note={`${fmtCount(map.accrualDays)} days booked`}
              live={map.ledger.configured}
            />
            <Stage
              i={5}
              title="Read layer"
              sub="One row per day, blended APY compounded in SQL"
              note="dedupes"
            />
            <Stage
              i={6}
              title="What you see"
              sub="Your balance, placements, statements"
              note="this site"
            />

            {/* Fallback path */}
            <g>
              <rect
                x={14}
                y={470}
                width={132}
                height={96}
                rx={10}
                fill="none"
                stroke="var(--line)"
                strokeWidth={1.25}
                strokeDasharray="5 4"
              />
              <text x={26} y={496} fontSize={12} fontWeight={650} fill="var(--ink-soft)">
                Seeded
              </text>
              <text x={26} y={514} fontSize={11} fill="var(--ink-faint)">
                90-day
              </text>
              <text x={26} y={530} fontSize={11} fill="var(--ink-faint)">
                deterministic
              </text>
              <text x={26} y={546} fontSize={11} fill="var(--ink-faint)">
                history
              </text>
              <line
                x1={146}
                y1={518}
                x2={BOX.x - 8}
                y2={STAGE_Y[5] + 35}
                stroke="var(--line)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
              <text x={24} y={588} fontSize={10.5} fill="var(--ink-faint)">
                used when a
              </text>
              <text x={24} y={602} fontSize={10.5} fill="var(--ink-faint)">
                key is missing
              </text>
            </g>
          </svg>
        </div>
      </Card>

      {/* ---------- What the ledger holds ---------- */}
      <Card>
        <h2 className="text-[19px] font-semibold tracking-tight">What the ledger holds</h2>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr
                className="text-left text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--ink-faint)' }}
              >
                <th className="pb-2.5 pr-3 font-semibold">Record</th>
                <th className="pb-2.5 pr-3 font-semibold">What it is</th>
                <th className="pb-2.5 text-right font-semibold">Count</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Rate observations — crawled', 'Rates read off a real bank page today', fmtCount(map.liveRateRows)],
                ['Rate observations — seeded', 'The deterministic history the demo starts from', fmtCount(map.seedRateRows)],
                ['Transfers', 'Every time your deposit moved bank', fmtCount(map.sweepRows)],
                ['Days booked', 'One interest accrual per day since opening', fmtCount(map.accrualDays)],
              ].map(([a, b, c]) => (
                <tr key={a} className="border-t" style={{ borderColor: 'var(--line)' }}>
                  <td className="py-3 pr-3 font-medium">{a}</td>
                  <td className="py-3 pr-3" style={{ color: 'var(--ink-soft)' }}>
                    {b}
                  </td>
                  <td className="tnum py-3 text-right font-semibold">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {map.lastObservedAt && (
          <p className="mt-4 text-[12.5px]" style={{ color: 'var(--ink-faint)' }}>
            Most recent crawled rate: {map.lastObservedAt.slice(0, 16).replace('T', ' ')} UTC.
          </p>
        )}
      </Card>

      {/* ---------- The rules ---------- */}
      <Card>
        <h2 className="text-[19px] font-semibold tracking-tight">The rules your money follows</h2>
        <div className="mt-5 space-y-4 text-[14.5px] leading-relaxed">
          {[
            [
              'Insured, or it does not qualify',
              'A bank is eligible only if its listing carries FDIC or NCUA insurance. Rate is irrelevant without it.',
            ],
            [
              `A better rate must beat yours by ${map.thresholdBps} basis points`,
              `A transfer costs one to three days of interest in settlement. Moving for less loses money. Right now you hold ${formatPct(acct.currentApy)} and the best we see is ${formatPct(acct.bestAvailableApy)}.`,
            ],
            [
              'Transfers only on banking days',
              'ACH cannot be initiated on a weekend or a federal holiday, so a move decided then waits for the next open day.',
            ],
            [
              'One accrual per day, ever',
              'Interest is booked once per calendar day. Running the job twice cannot book it twice.',
            ],
          ].map(([h, p]) => (
            <div key={h}>
              <div className="font-semibold">{h}</div>
              <div style={{ color: 'var(--ink-soft)' }}>{p}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
