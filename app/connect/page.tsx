import Link from 'next/link';
import { LinkFlow } from './LinkFlow';

export const metadata = { title: 'Connect your account — AutoSvr' };

export default function ConnectPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          AutoSvr
        </Link>
        <p className="mt-1 text-sm text-zinc-500">Link the account we&rsquo;ll manage for you</p>
      </div>

      <LinkFlow />

      <p className="mt-8 max-w-md text-center text-xs leading-relaxed text-zinc-600">
        <span className="mr-1.5 rounded bg-amber-400/10 px-1.5 py-0.5 font-medium text-amber-300">
          Sandbox
        </span>
        Simulated linking flow — no bank is contacted and no credentials are
        collected at any step. In production this runs through Plaid, which
        handles credentials in its own interface so they never reach AutoSvr.
      </p>
    </main>
  );
}
