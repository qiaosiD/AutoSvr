// Black Forest Labs (FLUX) client.
//
// Verified against docs.bfl.ai. Three things differ from most image APIs and
// each one breaks a naive integration:
//   1. Auth is an `x-key` header, not `Authorization: Bearer`.
//   2. Generation is asynchronous: POST returns a polling_url to poll until
//      status is "Ready". Use the URL it hands back — do not rebuild it.
//   3. The finished image URL is signed and expires in ~10 minutes, so it has
//      to be downloaded immediately rather than stored as a link.

const BASE = 'https://api.bfl.ai/v1';

/** Endpoints, cheapest-capable first. Override with BFL_MODEL. */
export const DEFAULT_MODEL = 'flux-pro-1.1';

export function bflConfigured(): boolean {
  return Boolean(process.env.BFL_API_KEY);
}

function key(): string {
  const k = process.env.BFL_API_KEY;
  if (!k) throw new Error('BFL_API_KEY is not set');
  return k;
}

interface SubmitResponse {
  id: string;
  polling_url: string;
}

interface PollResponse {
  status: 'Pending' | 'Ready' | 'Error' | 'Failed' | string;
  result?: { sample?: string };
  error?: string;
}

export interface GenerateOptions {
  prompt: string;
  width: number;
  height: number;
  model?: string;
  /** Seconds to wait for the render before giving up. */
  timeoutSeconds?: number;
  onProgress?: (status: string, elapsedMs: number) => void;
}

/**
 * Generate one image and return its bytes.
 * Returns bytes rather than a URL because the signed URL expires quickly —
 * handing a caller a link that dies in ten minutes invites a broken page.
 */
export async function generateImage(opts: GenerateOptions): Promise<Uint8Array> {
  // FLUX rejects dimensions that are not multiples of 32, as a 422 whose body
  // has to be read carefully to see which field is at fault. Catching it here
  // costs nothing and says so plainly.
  for (const [name, value] of [['width', opts.width], ['height', opts.height]] as const) {
    if (value % 32 !== 0) {
      const nearest = Math.round(value / 32) * 32;
      throw new Error(
        `FLUX needs ${name} to be a multiple of 32; got ${value}. Use ${nearest}.`,
      );
    }
  }

  const model = opts.model ?? process.env.BFL_MODEL ?? DEFAULT_MODEL;
  const timeoutMs = (opts.timeoutSeconds ?? 120) * 1000;

  const submit = await fetch(`${BASE}/${model}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'x-key': key(),
    },
    body: JSON.stringify({
      prompt: opts.prompt,
      width: opts.width,
      height: opts.height,
    }),
  });

  if (!submit.ok) {
    const body = await submit.text();
    if (submit.status === 401 || submit.status === 403) {
      throw new Error(`BFL rejected the key (${submit.status}). Check BFL_API_KEY. ${body}`);
    }
    if (submit.status === 404) {
      throw new Error(
        `BFL model "${model}" not found (404). Your account may not have access to it — ` +
          `try BFL_MODEL=flux-dev or flux-pro-1.1. ${body}`,
      );
    }
    if (submit.status === 402) {
      throw new Error(`BFL says the account is out of credits (402). ${body}`);
    }
    throw new Error(`BFL submit failed (${submit.status}): ${body}`);
  }

  const { polling_url: pollingUrl } = (await submit.json()) as SubmitResponse;
  if (!pollingUrl) throw new Error('BFL response had no polling_url');

  const started = Date.now();
  let delay = 800;

  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.3, 4000);

    const poll = await fetch(pollingUrl, {
      headers: { accept: 'application/json', 'x-key': key() },
    });
    if (!poll.ok) throw new Error(`BFL poll failed (${poll.status}): ${await poll.text()}`);

    const body = (await poll.json()) as PollResponse;
    opts.onProgress?.(body.status, Date.now() - started);

    if (body.status === 'Ready') {
      const url = body.result?.sample;
      if (!url) throw new Error('BFL reported Ready but returned no image URL');

      // Signed and short-lived — fetch the bytes now, not later.
      const img = await fetch(url);
      if (!img.ok) throw new Error(`Could not download the finished image (${img.status})`);
      return new Uint8Array(await img.arrayBuffer());
    }

    if (body.status === 'Error' || body.status === 'Failed') {
      throw new Error(`BFL generation failed: ${body.error ?? body.status}`);
    }
  }

  throw new Error(`BFL did not finish within ${opts.timeoutSeconds ?? 120}s`);
}
