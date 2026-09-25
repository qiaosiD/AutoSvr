import type { Metadata } from 'next';
import './depositor.css';

export const metadata: Metadata = {
  title: 'AutoSvr Savings',
  description:
    'A savings account that moves itself to the highest-paying FDIC-insured bank, automatically.',
};

export default function DepositorLayout({ children }: { children: React.ReactNode }) {
  return <div className="depositor">{children}</div>;
}
