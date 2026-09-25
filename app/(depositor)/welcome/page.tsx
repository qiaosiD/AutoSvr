import Link from 'next/link';
import { BANKS, BASELINE_APR } from '@/lib/banks';
import { formatCents, formatPct } from '@/lib/apy';
import { getDepositorAccount } from '@/lib/depositor/account';
import { SiteFooter, SiteNav } from '../components/chrome';
import { FDIC_NON_BANK_NOTICE, PASS_THROUGH_NOTICE } from '@/lib/depositor/disclosures';

export const dynamic = 'force-dynamic';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em]"
      style={{ color: 'var(--brand)' }}
    >
      {children}
    </div>
  );
}

export default async function WelcomePage() {
  const acct = await getDepositorAccount();
  const topRate = Math.max(acct.bestAvailableApy, acct.currentApy);
  // What $10,000 earns in a year at the top rate versus a typical branch
  // savings account. Concrete beats a percentage for most people.
  const exampleCents = 1_000_000;
  const gainCents = Math.round(exampleCents * (topRate - BASELINE_APR));

  return (
    <>
      <SiteNav />

      {/* ---------- Hero ---------- */}
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-16 md:pt-24">
        <div className="grid items-center gap-14 md:grid-cols-[1.05fr_1fr]">
          <div>
            <Eyebrow>FDIC-insured partner banks</Eyebrow>
            <h1 className="text-[40px] font-bold leading-[1.08] tracking-tight md:text-[54px]">
              Your savings,
              <br />
              always at the{' '}
              <span style={{ color: 'var(--brand)' }}>best rate.</span>
            </h1>
            <p
              className="mt-6 max-w-lg text-[17px] leading-relaxed"
              style={{ color: 'var(--ink-soft)' }}
            >
              Banks compete for new money and quietly leave loyal savers behind. AutoSvr
              checks the market every day and moves your deposit to whichever insured bank
              is paying the most — so you never have to chase a rate again.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/account"
                className="rounded-xl px-6 py-3.5 text-[15px] font-semibold text-white no-underline shadow-sm"
                style={{ background: 'var(--brand-deep)' }}
              >
                Sign in to your account
              </Link>
              <a
                href="#how"
                className="rounded-xl border bg-white px-6 py-3.5 text-[15px] font-semibold no-underline"
                style={{ borderColor: 'var(--line)' }}
              >
                See how it works
              </a>
            </div>

            <p className="mt-5 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              No account fees, no transfer fees, no minimum balance. Withdraw any amount,
              any time.
            </p>
          </div>

          {/* Rate card — the whole pitch in one object. */}
          <div
            className="rounded-2xl border bg-white p-7 shadow-[0_18px_50px_-24px_rgba(11,27,51,0.35)]"
            style={{ borderColor: 'var(--line)' }}
          >
            <div className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-faint)' }}>
              Today&rsquo;s rate
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="tnum text-[56px] font-bold leading-none tracking-tight">
                {formatPct(topRate)}
              </span>
              <span className="text-[15px] font-semibold" style={{ color: 'var(--ink-faint)' }}>
                APY
              </span>
            </div>
            <div className="mt-2 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
              The highest rate across {acct.partnerBankCount} insured partner banks.
            </div>

            <div className="my-6 h-px" style={{ background: 'var(--line)' }} />

            <div className="space-y-3 text-[14px]">
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--ink-soft)' }}>Typical branch savings</span>
                <span className="tnum font-semibold">{formatPct(BASELINE_APR)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--ink-soft)' }}>On $10,000, one year</span>
                <span className="tnum font-semibold" style={{ color: 'var(--gain)' }}>
                  +{formatCents(gainCents)}
                </span>
              </div>
            </div>

            <div
              className="mt-6 rounded-xl px-4 py-3 text-[12px] leading-relaxed"
              style={{ background: 'var(--wash)', color: 'var(--ink-faint)' }}
            >
              Rate is variable and shown as of today. AutoSvr is not a bank; your deposit is
              held at an FDIC-insured partner bank.
            </div>
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="border-y bg-white" style={{ borderColor: 'var(--line)' }}>
        <div className="mx-auto max-w-6xl px-5 py-20">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="max-w-2xl text-[30px] font-bold leading-tight tracking-tight md:text-[38px]">
            Three steps, then nothing to do.
          </h2>

          <div className="mt-12 grid gap-10 md:grid-cols-3">
            {[
              {
                n: '01',
                h: 'Link your bank',
                p: 'Connect the account you already use. We never see your banking credentials — linking happens inside your bank’s own secure flow.',
              },
              {
                n: '02',
                h: 'We place your deposit',
                p: 'Your money goes into a savings account at whichever partner bank is paying the most that day, held in your name for the benefit of you.',
              },
              {
                n: '03',
                h: 'We keep it there — or move it',
                p: 'We re-check every bank daily. When another insured bank beats yours by enough to be worth the transfer, we move it. You get a notice, not a task.',
              },
            ].map((s) => (
              <div key={s.n}>
                <div
                  className="tnum text-[13px] font-bold tracking-widest"
                  style={{ color: 'var(--brand)' }}
                >
                  {s.n}
                </div>
                <h3 className="mt-3 text-[19px] font-semibold tracking-tight">{s.h}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                  {s.p}
                </p>
              </div>
            ))}
          </div>

          <div
            className="mt-12 rounded-xl border px-6 py-5 text-[14px] leading-relaxed"
            style={{ borderColor: 'var(--line)', background: 'var(--wash)', color: 'var(--ink-soft)' }}
          >
            <span className="font-semibold" style={{ color: 'var(--ink)' }}>
              We don&rsquo;t chase every basis point.
            </span>{' '}
            A transfer takes a day or two to settle, and money in transit earns nothing. We
            only move your deposit when the better rate clears that cost — currently a
            margin of 0.25%. When we hold, your statement says so and why.
          </div>
        </div>
      </section>

      {/* ---------- Partner banks ---------- */}
      <section id="banks" className="mx-auto max-w-6xl px-5 py-20">
        <Eyebrow>Where your money sits</Eyebrow>
        <h2 className="max-w-2xl text-[30px] font-bold leading-tight tracking-tight md:text-[38px]">
          Real banks, named, with their FDIC certificate numbers.
        </h2>
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          Your deposit is never held by AutoSvr. It sits in a savings account at one of
          these institutions, and your statement tells you which one held it on every
          single day.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BANKS.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border bg-white px-5 py-4"
              style={{ borderColor: 'var(--line)' }}
            >
              <div className="text-[15px] font-semibold leading-snug">{b.name}</div>
              <div className="mt-1 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
                {b.productName}
              </div>
              <div className="tnum mt-3 text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                FDIC Cert. #{b.fdicCert ?? 'pending'}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Safety ---------- */}
      <section id="safety" className="border-t" style={{ borderColor: 'var(--line)', background: 'var(--brand-deep)' }}>
        <div className="mx-auto max-w-6xl px-5 py-20 text-white">
          <div
            className="mb-4 text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{ color: '#93b4ff' }}
          >
            Safety
          </div>
          <h2 className="max-w-2xl text-[30px] font-bold leading-tight tracking-tight md:text-[38px]">
            What deposit insurance does and doesn&rsquo;t cover.
          </h2>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            <div className="space-y-4 text-[15px] leading-relaxed" style={{ color: '#cbd9f5' }}>
              <p className="font-semibold text-white">{FDIC_NON_BANK_NOTICE}</p>
              <p>{PASS_THROUGH_NOTICE}</p>
            </div>
            <div className="space-y-3">
              {[
                ['Your money is never ours to hold', 'Deposits move directly between your linked account and the partner bank. AutoSvr never takes custody of your principal.'],
                ['A daily record, kept for you', 'We reconcile your balance with every partner bank daily and keep a continuous record of which bank held your money on each day — the record that substantiates an insurance claim.'],
                ['Withdraw without asking', 'There is no lock-up and no notice period. Request any amount and it goes back to your linked account by ACH.'],
              ].map(([h, p]) => (
                <div key={h} className="rounded-xl px-5 py-4" style={{ background: '#ffffff12' }}>
                  <div className="text-[15px] font-semibold text-white">{h}</div>
                  <div className="mt-1.5 text-[14px] leading-relaxed" style={{ color: '#cbd9f5' }}>
                    {p}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12">
            <Link
              href="/account"
              className="inline-block rounded-xl bg-white px-6 py-3.5 text-[15px] font-semibold no-underline"
              style={{ color: 'var(--brand-deep)' }}
            >
              Sign in to your account
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  );
}
