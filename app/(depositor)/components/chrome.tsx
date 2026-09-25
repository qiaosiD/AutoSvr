import Link from 'next/link';
import { BANKS } from '@/lib/banks';
import {
  FDIC_NON_BANK_NOTICE,
  PASS_THROUGH_NOTICE,
  PROGRAM_LEGAL_NAME,
  RATE_VARIABILITY_NOTICE,
} from '@/lib/depositor/disclosures';

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <Link href="/welcome" className="flex items-center gap-2.5 no-underline">
      <span
        className="grid h-8 w-8 place-items-center rounded-lg text-[13px] font-bold text-white"
        style={{ background: light ? '#ffffff22' : 'var(--brand-deep)' }}
      >
        A
      </span>
      <span
        className="text-[17px] font-semibold tracking-tight"
        style={{ color: light ? '#fff' : 'var(--ink)' }}
      >
        AutoSvr
      </span>
    </Link>
  );
}

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur" style={{ borderColor: 'var(--line)' }}>
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Wordmark />
        <div className="hidden items-center gap-8 text-[14px] md:flex" style={{ color: 'var(--ink-soft)' }}>
          <a href="#how" className="no-underline hover:opacity-70">How it works</a>
          <a href="#banks" className="no-underline hover:opacity-70">Partner banks</a>
          <a href="#safety" className="no-underline hover:opacity-70">Safety</a>
        </div>
        <Link
          href="/account"
          className="rounded-lg px-4 py-2 text-[14px] font-semibold text-white no-underline"
          style={{ background: 'var(--brand-deep)' }}
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}

/**
 * The footer carries the disclosures that 12 CFR 328 subpart B requires on any
 * page where a non-bank talks about FDIC insurance — which, for this product,
 * is every page.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-white" style={{ borderColor: 'var(--line)' }}>
      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <Wordmark />
            <p className="mt-3 text-[13px] leading-relaxed" style={{ color: 'var(--ink-faint)' }}>
              A savings account that moves itself to the highest-paying insured bank.
            </p>
          </div>
          <div className="flex gap-12 text-[13px]">
            <div>
              <div className="mb-3 font-semibold">Account</div>
              <ul className="space-y-2" style={{ color: 'var(--ink-faint)' }}>
                <li><Link href="/account" className="no-underline hover:underline">Sign in</Link></li>
                <li><Link href="/account/statements" className="no-underline hover:underline">Statements</Link></li>
                <li><Link href="/account/withdraw" className="no-underline hover:underline">Withdraw</Link></li>
              </ul>
            </div>
            <div>
              <div className="mb-3 font-semibold">Legal</div>
              <ul className="space-y-2" style={{ color: 'var(--ink-faint)' }}>
                <li><a href="#safety" className="no-underline hover:underline">Deposit insurance</a></li>
                <li><a href="#banks" className="no-underline hover:underline">Partner banks</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div
          className="mt-10 space-y-3 border-t pt-8 text-[12px] leading-relaxed"
          style={{ borderColor: 'var(--line)', color: 'var(--ink-faint)' }}
        >
          <p className="font-semibold" style={{ color: 'var(--ink-soft)' }}>{FDIC_NON_BANK_NOTICE}</p>
          <p>{PASS_THROUGH_NOTICE}</p>
          <p>{RATE_VARIABILITY_NOTICE}</p>
          <p>
            Partner banks: {BANKS.map((b) => `${b.name} (FDIC Cert. #${b.fdicCert ?? 'pending'})`).join(', ')}.
          </p>
          <p className="pt-2">
            © {year} {PROGRAM_LEGAL_NAME}. Demonstration environment — figures shown are
            illustrative and no real accounts, transfers, or customer records are involved.
          </p>
        </div>
      </div>
    </footer>
  );
}
