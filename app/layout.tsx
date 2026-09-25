import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutoSvr — always at the best rate',
  description:
    'AutoSvr finds the highest-yielding savings account in the US every day and moves your money there automatically.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
