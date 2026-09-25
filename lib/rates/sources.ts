/** Pages the Nimble crawler pulls each morning. */
export interface RateSource {
  id: string;
  url: string;
  /** Hint passed to the parser about what shape to expect. */
  kind: 'aggregator' | 'bank_page';
}

export const SOURCES: RateSource[] = [
  { id: 'depositaccounts', url: 'https://www.depositaccounts.com/savings/', kind: 'aggregator' },
  { id: 'bankrate',        url: 'https://www.bankrate.com/banking/savings/rates/', kind: 'aggregator' },
  { id: 'nerdwallet',      url: 'https://www.nerdwallet.com/best/banking/savings-rates', kind: 'aggregator' },
];
