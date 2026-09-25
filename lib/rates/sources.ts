/** Pages the Nimble crawler pulls each morning. */
export interface RateSource {
  id: string;
  url: string;
  /** Hint passed to the parser about what shape to expect. */
  kind: 'aggregator' | 'bank_page';
  /**
   * CSS selector Nimble waits for before capturing. These pages render their
   * rate tables after first paint, so without this the crawl returns the
   * navigation and an empty table — which looks like a successful crawl and
   * parses to nothing.
   */
  waitFor?: string;
}

export const SOURCES: RateSource[] = [
  {
    id: 'depositaccounts',
    url: 'https://www.depositaccounts.com/savings/',
    kind: 'aggregator',
    waitFor: '.bankName',
  },
  { id: 'bankrate',        url: 'https://www.bankrate.com/banking/savings/rates/', kind: 'aggregator' },
  { id: 'nerdwallet',      url: 'https://www.nerdwallet.com/best/banking/savings-rates', kind: 'aggregator' },
];
