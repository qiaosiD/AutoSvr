'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatCents } from '@/lib/apy';

interface Props {
  availableCents: number;
  linkedAccountMask: string;
  currentBankName: string;
  withdrawalNotice: string;
}

interface Submitted {
  amountCents: number;
  reference: string;
  requestedAt: Date;
  initiatedOn: Date;
  settlesBy: Date;
}

const CUTOFF_HOUR_ET = 14;

function isBusinessDay(d: Date) {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

function addBusinessDays(from: Date, n: number) {
  const d = new Date(from);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) left -= 1;
  }
  return d;
}

/**
 * A request after the 2:00 p.m. ET cutoff, or on a weekend, is initiated the
 * next business day. Quoting "1-3 business days" from today when today is
 * Saturday is the kind of small lie that turns into a support ticket.
 */
function initiationDate(now: Date) {
  const etHour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'America/New_York',
    }).format(now),
  );
  if (!isBusinessDay(now) || etHour >= CUTOFF_HOUR_ET) return addBusinessDays(now, 1);
  return new Date(now);
}

function fmt(d: Date) {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (!cleaned) return null;
  if (!/^\d*\.?\d{0,2}$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export default function WithdrawForm({
  availableCents,
  linkedAccountMask,
  currentBankName,
  withdrawalNotice,
}: Props) {
  const [raw, setRaw] = useState('');
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<Submitted | null>(null);

  const cents = parseAmount(raw);

  const error = useMemo(() => {
    if (!touched || raw === '') return null;
    if (cents === null) return 'Enter an amount like 1,250.00';
    if (cents <= 0) return 'Enter an amount greater than zero';
    if (cents > availableCents)
      return `That's more than your available balance of ${formatCents(availableCents)}`;
    return null;
  }, [touched, raw, cents, availableCents]);

  const valid = cents !== null && cents > 0 && cents <= availableCents;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid || cents === null) return;
    const now = new Date();
    const initiated = initiationDate(now);
    setDone({
      amountCents: cents,
      reference: `WD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
        now.getDate(),
      ).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
      requestedAt: now,
      initiatedOn: initiated,
      settlesBy: addBusinessDays(initiated, 3),
    });
  }

  if (done) {
    return (
      <section
        className="rounded-2xl border bg-white p-8"
        style={{ borderColor: 'var(--line)' }}
      >
        <div
          className="grid h-11 w-11 place-items-center rounded-full text-[20px] font-bold text-white"
          style={{ background: 'var(--gain)' }}
        >
          ✓
        </div>
        <h2 className="mt-4 text-[24px] font-bold tracking-tight">Withdrawal requested</h2>
        <p className="mt-2 text-[15px]" style={{ color: 'var(--ink-soft)' }}>
          {formatCents(done.amountCents)} is on its way to your linked account{' '}
          {linkedAccountMask}.
        </p>

        <dl className="mt-7 space-y-3 text-[14px]">
          {[
            ['Amount', formatCents(done.amountCents)],
            ['From', currentBankName],
            ['To', `Linked account ${linkedAccountMask}`],
            ['Reference', done.reference],
            ['Initiated', fmt(done.initiatedOn)],
            ['Expected by', fmt(done.settlesBy)],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between border-b pb-3"
              style={{ borderColor: 'var(--line)' }}
            >
              <dt style={{ color: 'var(--ink-soft)' }}>{k}</dt>
              <dd className="tnum font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <p
          className="mt-6 rounded-xl px-4 py-3 text-[12.5px] leading-relaxed"
          style={{ background: 'var(--wash)', color: 'var(--ink-soft)' }}
        >
          {withdrawalNotice}
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/account"
            className="rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white no-underline"
            style={{ background: 'var(--brand-deep)' }}
          >
            Back to overview
          </Link>
          <button
            type="button"
            onClick={() => {
              setDone(null);
              setRaw('');
              setTouched(false);
            }}
            className="rounded-lg border bg-white px-4 py-2.5 text-[14px] font-semibold"
            style={{ borderColor: 'var(--line)' }}
          >
            Make another withdrawal
          </button>
        </div>
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border bg-white p-8"
      style={{ borderColor: 'var(--line)' }}
      noValidate
    >
      <label htmlFor="amount" className="block text-[14px] font-semibold">
        How much would you like to withdraw?
      </label>
      <p className="mt-1 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
        Any amount up to {formatCents(availableCents)}. No minimum, no fee, no penalty.
      </p>

      <div className="relative mt-4">
        <span
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[26px] font-semibold"
          style={{ color: error ? '#b91c1c' : 'var(--ink-faint)' }}
        >
          $
        </span>
        <input
          id="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'amount-error' : undefined}
          className="tnum w-full rounded-xl border px-4 py-4 pl-10 text-[26px] font-semibold outline-none"
          style={{
            borderColor: error ? '#b91c1c' : 'var(--line)',
            color: 'var(--ink)',
            background: '#fff',
          }}
        />
      </div>

      {error && (
        <p id="amount-error" role="alert" className="mt-2 text-[13px] font-medium" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {[50_000, 100_000, 500_000].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setRaw((c / 100).toFixed(2));
              setTouched(true);
            }}
            disabled={c > availableCents}
            className="tnum rounded-lg border px-3.5 py-2 text-[13px] font-semibold disabled:opacity-40"
            style={{ borderColor: 'var(--line)' }}
          >
            {formatCents(c)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setRaw((availableCents / 100).toFixed(2));
            setTouched(true);
          }}
          className="rounded-lg border px-3.5 py-2 text-[13px] font-semibold"
          style={{ borderColor: 'var(--line)' }}
        >
          Entire balance
        </button>
      </div>

      <div className="my-7 h-px" style={{ background: 'var(--line)' }} />

      <div className="space-y-3 text-[14px]">
        <div className="flex justify-between">
          <span style={{ color: 'var(--ink-soft)' }}>From</span>
          <span className="font-semibold">{currentBankName}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--ink-soft)' }}>To</span>
          <span className="font-semibold">Linked account {linkedAccountMask}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--ink-soft)' }}>Fee</span>
          <span className="font-semibold" style={{ color: 'var(--gain)' }}>
            None
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={!valid}
        className="mt-7 w-full rounded-xl py-4 text-[15px] font-semibold text-white disabled:opacity-40"
        style={{ background: 'var(--brand-deep)' }}
      >
        {valid ? `Withdraw ${formatCents(cents!)}` : 'Withdraw'}
      </button>

      <p
        className="mt-5 text-[12.5px] leading-relaxed"
        style={{ color: 'var(--ink-faint)' }}
      >
        {withdrawalNotice}
      </p>
    </form>
  );
}
