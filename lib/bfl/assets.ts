// The images AutoSvr generates, and the prompts that produce them.
//
// Deliberately abstract and architectural. A financial site must not show
// invented charts, fabricated rate figures, or synthetic "customers" — a
// plausible-looking chart that means nothing is worse than no image, and
// generated bank marks would be someone else's trademark. Atmosphere only;
// every real number on the page comes from the ledger.

export interface GeneratedAsset {
  /** Where the file lands, relative to the repo root. */
  path: string;
  width: number;
  height: number;
  prompt: string;
  /** Why this image exists, so a reviewer can judge whether it earns its place. */
  purpose: string;
}

const STYLE =
  'Editorial photography for a serious financial institution. Restrained, ' +
  'confident, expensive. Deep navy and warm off-white palette with a single ' +
  'muted teal accent. Soft directional daylight, long gentle shadows, fine ' +
  'film grain. No text, no letters, no numbers, no logos, no charts, no ' +
  'graphs, no user interface, no people, no faces.';

export const ASSETS: GeneratedAsset[] = [
  {
    path: 'app/(depositor)/opengraph-image.png',
    width: 1200,
    height: 630,
    purpose:
      'Social preview card. Next serves this automatically from the route ' +
      'group, so sharing the link anywhere renders it with no code.',
    prompt:
      'A wide minimalist still life: smooth interlocking curved forms in deep ' +
      'navy stone and pale limestone, suggesting movement from one place to ' +
      'another. Shallow depth of field, generous negative space on the left ' +
      `for a title to sit. ${STYLE}`,
  },
  {
    path: 'public/generated/safety-band.jpg',
    width: 1440,
    height: 600,
    purpose:
      'Atmospheric band behind the deposit-protection section. Conveys ' +
      'institutional solidity without implying a specific bank or guarantee.',
    prompt:
      'Architectural detail of a modern vault-like structure: heavy brushed ' +
      'metal and pale stone, calm symmetry, one soft shaft of daylight across ' +
      `the surface. Wide crop, quiet and monumental. ${STYLE}`,
  },
];
