'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCents, formatPct } from '@/lib/apy';
import { BASELINE_APR } from '@/lib/banks';
import {
  accountsFor,
  institutionById,
  INSTITUTIONS,
  mockPublicToken,
  type MockAccount,
} from '@/lib/plaid/mock';

type Step = 'institution' | 'handoff' | 'accounts' | 'payout' | 'done';
type Payout = 'origin_account' | 'omnibus';

/** Mirrors Plaid Link's chrome so the flow reads as familiar, without being it. */
function Shell({ title, subtitle, children, onBack }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="w-full max-w-md rounded-2xl bg-zinc-900 ring-1 ring-white/10">
      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
        {onBack && (
          <button
            onClick={onBack}
            className="-ml-2 rounded px-2 py-1 text-zinc-500 transition hover:text-zinc-200"
            aria-label="Back"
          >
            ←
          </button>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

export function LinkFlow() {
  const [step, setStep] = useState<Step>('institution');
  const [instId, setInstId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [payout, setPayout] = useState<Payout>('origin_account');
  const [token, setToken] = useState('');

  const institution = instId ? institutionById(instId) : undefined;
  const accounts = instId ? accountsFor(instId) : [];
  const selected = accounts.find((a) => a.id === selectedId);

  // The handoff is where Plaid would take over and collect credentials in its
  // own iframe. Nothing is collected here — this is a timed stand-in.
  useEffect(() => {
    if (step !== 'handoff') return;
    const t = setTimeout(() => {
      setToken(mockPublicToken());
      setStep('accounts');
    }, 1900);
    return () => clearTimeout(t);
  }, [step]);

  const visible = INSTITUTIONS.filter((i) =>
    i.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  if (step === 'institution') {
    return (
      <Shell title="Select your bank" subtitle="Link the savings account AutoSvr will manage">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search institutions"
          className="mb-4 w-full rounded-lg bg-white/5 px-3 py-2.5 text-sm outline-none ring-1 ring-white/10 placeholder:text-zinc-600 focus:ring-emerald-500/50"
        />
        <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto">
          {visible.map((inst) => (
            <button
              key={inst.id}
              onClick={() => {
                setInstId(inst.id);
                setStep('handoff');
              }}
              className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-3 text-left text-sm ring-1 ring-white/5 transition hover:bg-white/10"
            >
              <span
                className={`${inst.color} flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white`}
              >
                {inst.initials}
              </span>
              <span className="truncate">{inst.name}</span>
            </button>
          ))}
          {visible.length === 0 && (
            <p className="col-span-2 py-8 text-center text-sm text-zinc-500">
              No institutions match “{query}”.
            </p>
          )}
        </div>
      </Shell>
    );
  }

  if (step === 'handoff') {
    return (
      <Shell title={institution?.name ?? ''} subtitle="Establishing a secure connection">
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-5 flex items-center gap-3">
            <span className={`${institution?.color} flex h-11 w-11 items-center justify-center rounded-lg text-xs font-bold text-white`}>
              {institution?.initials}
            </span>
            <span className="text-zinc-600">↔</span>
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500 text-xs font-bold text-white">
              AS
            </span>
          </div>
          <div className="mb-4 h-1 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] rounded-full bg-emerald-400" />
          </div>
          <p className="text-sm text-zinc-400">Verifying with {institution?.name}…</p>
          <p className="mt-4 max-w-xs text-xs leading-relaxed text-zinc-600">
            In production this step runs inside Plaid&rsquo;s own interface. Your bank
            credentials go to Plaid, never to AutoSvr — we only ever receive a token.
          </p>
        </div>
        <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}`}</style>
      </Shell>
    );
  }

  if (step === 'accounts') {
    return (
      <Shell
        title="Choose an account"
        subtitle={`${institution?.name} · connected`}
        onBack={() => setStep('institution')}
      >
        <div className="space-y-2">
          {accounts.map((a) => (
            <AccountRow
              key={a.id}
              account={a}
              selected={selectedId === a.id}
              onSelect={() => setSelectedId(a.id)}
            />
          ))}
        </div>
        <p className="mt-4 text-xs text-zinc-600">
          AutoSvr manages savings balances. Checking accounts can be linked for
          transfers but are not swept.
        </p>
        <button
          disabled={!selected || selected.subtype !== 'savings'}
          onClick={() => setStep('payout')}
          className="mt-5 w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-medium text-zinc-950 transition enabled:hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {selected && selected.subtype !== 'savings' ? 'Select a savings account' : 'Continue'}
        </button>
      </Shell>
    );
  }

  if (step === 'payout') {
    return (
      <Shell
        title="Where should interest go?"
        subtitle="You can change this at any time"
        onBack={() => setStep('accounts')}
      >
        <div className="space-y-2">
          <PayoutOption
            active={payout === 'origin_account'}
            onClick={() => setPayout('origin_account')}
            title="Back to my savings account"
            body={`Paid to ${institution?.name} ${selected?.mask} each month. Spendable right away.`}
          />
          <PayoutOption
            active={payout === 'omnibus'}
            onClick={() => setPayout('omnibus')}
            title="Keep it in AutoSvr"
            body="Interest joins your managed balance and starts earning the top rate itself."
          />
        </div>
        <button
          onClick={() => setStep('done')}
          className="mt-5 w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
        >
          Finish linking
        </button>
      </Shell>
    );
  }

  const uplift = selected
    ? Math.round((selected.balanceCents * (0.0485 - BASELINE_APR)) / 1)
    : 0;

  return (
    <Shell title="You&rsquo;re connected" subtitle="AutoSvr starts working tomorrow morning">
      <div className="rounded-lg bg-white/5 p-4 ring-1 ring-white/5">
        <Row label="Account" value={`${institution?.name} ${selected?.mask}`} />
        <Row label="Balance" value={formatCents(selected?.balanceCents ?? 0)} />
        <Row label="Current rate" value={formatPct(selected?.apr ?? 0)} />
        <Row
          label="Interest to"
          value={payout === 'origin_account' ? 'Your savings account' : 'AutoSvr balance'}
        />
      </div>

      <div className="mt-4 rounded-lg bg-emerald-400/5 p-4 text-sm ring-1 ring-emerald-400/20">
        At today&rsquo;s top rate you&rsquo;d earn about{' '}
        <strong className="text-emerald-400">{formatCents(uplift)}</strong> more per year
        than the {formatPct(selected?.apr ?? 0)} you&rsquo;re getting now.
      </div>

      <p className="mt-4 break-all font-mono text-[10px] text-zinc-600">public_token: {token}</p>

      <Link
        href="/"
        className="mt-5 block w-full rounded-lg bg-emerald-500 py-2.5 text-center text-sm font-medium text-zinc-950 transition hover:bg-emerald-400"
      >
        Go to dashboard
      </Link>
    </Shell>
  );
}

function AccountRow({ account, selected, onSelect }: {
  account: MockAccount;
  selected: boolean;
  onSelect: () => void;
}) {
  const isSavings = account.subtype === 'savings';
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center justify-between rounded-lg px-4 py-3 text-left ring-1 transition ${
        selected ? 'bg-emerald-400/10 ring-emerald-400/40' : 'bg-white/5 ring-white/5 hover:bg-white/10'
      }`}
    >
      <span>
        <span className="block text-sm">{account.name}</span>
        <span className="block text-xs text-zinc-500">
          ••••{account.mask} · {formatPct(account.apr)} APY
          {!isSavings && ' · not swept'}
        </span>
      </span>
      <span className="text-sm tabular-nums">{formatCents(account.balanceCents)}</span>
    </button>
  );
}

function PayoutOption({ active, onClick, title, body }: {
  active: boolean;
  onClick: () => void;
  title: string;
  body: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-lg px-4 py-3 text-left ring-1 transition ${
        active ? 'bg-emerald-400/10 ring-emerald-400/40' : 'bg-white/5 ring-white/5 hover:bg-white/10'
      }`}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{body}</span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-zinc-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
