import Link from 'next/link';
import { getDepositorAccount } from '@/lib/depositor/account';
import { Wordmark } from '../components/chrome';
import {
  ERROR_RESOLUTION_NOTICE,
  FDIC_NON_BANK_NOTICE,
  PROGRAM_LEGAL_NAME,
} from '@/lib/depositor/disclosures';

export const dynamic = 'force-dynamic';

const NAV = [
  { href: '/account', label: 'Overview' },
  { href: '/account/statements', label: 'Statements' },
  { href: '/account/withdraw', label: 'Withdraw' },
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const acct = await getDepositorAccount();
  const initials = acct.customerName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);

  return (
    <>
      <header
        className="no-print sticky top-0 z-30 border-b bg-white"
        style={{ borderColor: 'var(--line)' }}
      >
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <div className="flex items-center gap-8">
            <Wordmark />
            <nav className="hidden items-center gap-6 text-[14px] font-medium sm:flex">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="no-underline hover:opacity-70"
                  style={{ color: 'var(--ink-soft)' }}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold text-white"
              style={{ background: 'var(--brand)' }}
            >
              {initials}
            </span>
            <Link
              href="/welcome"
              className="text-[14px] font-medium no-underline hover:opacity-70"
              style={{ color: 'var(--ink-faint)' }}
            >
              Sign out
            </Link>
          </div>
        </div>
        <nav
          className="flex items-center gap-5 border-t px-5 py-2.5 text-[14px] font-medium sm:hidden"
          style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}
        >
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="no-underline">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-10">{children}</main>

      {/*
        Reg E, 12 CFR 1005.8(b), requires the error-resolution notice be given
        at least annually — many institutions satisfy it by carrying an abbreviated
        notice on every statement surface. It costs nothing to keep it reachable.
      */}
      <footer
        className="no-print mt-8 border-t bg-white"
        style={{ borderColor: 'var(--line)' }}
      >
        <div
          className="mx-auto max-w-5xl space-y-3 px-5 py-10 text-[12px] leading-relaxed"
          style={{ color: 'var(--ink-faint)' }}
        >
          <details>
            <summary className="cursor-pointer font-semibold" style={{ color: 'var(--ink-soft)' }}>
              {ERROR_RESOLUTION_NOTICE.heading}
            </summary>
            <div className="mt-3 space-y-2">
              {ERROR_RESOLUTION_NOTICE.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </details>
          <p className="pt-2 font-semibold" style={{ color: 'var(--ink-soft)' }}>
            {FDIC_NON_BANK_NOTICE}
          </p>
          <p>
            © {new Date().getFullYear()} {PROGRAM_LEGAL_NAME}. Demonstration environment —
            figures are illustrative and no real accounts or transfers are involved.
          </p>
        </div>
      </footer>
    </>
  );
}
