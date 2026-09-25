// Fake account-linking data. No Plaid SDK, no network, no credentials.
//
// Deliberately mirrors the shape Plaid's Link flow returns (institution →
// accounts → a public token you'd exchange server-side), so swapping the real
// SDK in later is a matter of replacing the data source, not the UI.

export interface MockInstitution {
  id: string;
  name: string;
  /** Tailwind class for the tile — stands in for the real institution logo. */
  color: string;
  initials: string;
}

export interface MockAccount {
  id: string;
  institutionId: string;
  name: string;
  subtype: 'checking' | 'savings';
  mask: string;
  balanceCents: number;
  /** What this account currently earns. The number AutoSvr exists to beat. */
  apr: number;
}

export const INSTITUTIONS: MockInstitution[] = [
  { id: 'chase',    name: 'Chase',            color: 'bg-blue-600',    initials: 'CH' },
  { id: 'bofa',     name: 'Bank of America',  color: 'bg-red-700',     initials: 'BA' },
  { id: 'wells',    name: 'Wells Fargo',      color: 'bg-red-600',     initials: 'WF' },
  { id: 'citi',     name: 'Citibank',         color: 'bg-sky-700',     initials: 'CI' },
  { id: 'capone',   name: 'Capital One',      color: 'bg-rose-700',    initials: 'C1' },
  { id: 'usbank',   name: 'U.S. Bank',        color: 'bg-indigo-700',  initials: 'US' },
  { id: 'pnc',      name: 'PNC Bank',         color: 'bg-amber-700',   initials: 'PN' },
  { id: 'truist',   name: 'Truist',           color: 'bg-purple-700',  initials: 'TR' },
];

/** Two accounts per institution, generated deterministically from the id. */
export function accountsFor(institutionId: string): MockAccount[] {
  const seed = [...institutionId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const mask = (offset: number) => String(1000 + ((seed * 7 + offset * 131) % 9000));

  return [
    {
      id: `${institutionId}_chk`,
      institutionId,
      name: 'Total Checking',
      subtype: 'checking',
      mask: mask(1),
      balanceCents: 300_000 + (seed % 40) * 10_000,
      apr: 0.0001,
    },
    {
      id: `${institutionId}_sav`,
      institutionId,
      name: 'Savings',
      subtype: 'savings',
      mask: mask(2),
      // The balance AutoSvr would take over. Big enough for the uplift to matter.
      balanceCents: 4_200_000 + (seed % 25) * 100_000,
      apr: 0.0042,
    },
  ];
}

export function institutionById(id: string): MockInstitution | undefined {
  return INSTITUTIONS.find((i) => i.id === id);
}

/**
 * Stands in for Plaid's public_token. In a real integration this goes to your
 * server to be exchanged for an access_token — it is never a credential and
 * never grants access on its own.
 */
export function mockPublicToken(): string {
  return `public-sandbox-${Math.random().toString(36).slice(2, 10)}`;
}
