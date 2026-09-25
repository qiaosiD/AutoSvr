import type { Bank } from './types';

/**
 * Seed universe of high-yield savings providers.
 * fdicCert values are looked up live from banks.data.fdic.gov (free, no key)
 * by scripts/fdic.ts — these are the starting set for offline demo mode.
 */
export const BANKS: Bank[] = [
  { id: 'bask',      name: 'Bask Bank',            fdicCert: '18113', productName: 'Interest Savings' },
  { id: 'ufb',       name: 'UFB Direct',           fdicCert: '3012',  productName: 'Portfolio Savings' },
  { id: 'bread',     name: 'Bread Financial',      fdicCert: '57500', productName: 'High-Yield Savings' },
  { id: 'marcus',    name: 'Marcus by Goldman',    fdicCert: '33124', productName: 'Online Savings' },
  { id: 'ally',      name: 'Ally Bank',            fdicCert: '57803', productName: 'Online Savings' },
  { id: 'synchrony', name: 'Synchrony Bank',       fdicCert: '27314', productName: 'High Yield Savings' },
  { id: 'discover',  name: 'Discover Bank',        fdicCert: '5649',  productName: 'Online Savings' },
  { id: 'amex',      name: 'American Express Bank',fdicCert: '27471', productName: 'High Yield Savings' },
];

export const BANKS_BY_ID = new Map(BANKS.map((b) => [b.id, b]));

export function bankName(id: string): string {
  return BANKS_BY_ID.get(id)?.name ?? id;
}

/** The rate a typical brick-and-mortar savings account pays. The thing we beat. */
export const BASELINE_APR = 0.0042;
