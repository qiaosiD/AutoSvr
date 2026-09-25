import { getDashboardData } from '../lib/data';
import { formatCents, formatPct } from '../lib/apy';

async function main() {
  const d = await getDashboardData();
  console.log('days           ', d.daysInvested);
  console.log('principal      ', formatCents(d.principalCents));
  console.log('earned         ', formatCents(d.totalAccruedCents));
  console.log('baseline       ', formatCents(d.baselineCents));
  console.log('blended APY    ', formatPct(d.blendedApy));
  console.log('current APR    ', formatPct(d.currentApr), 'at', d.currentBankId);
  console.log('sweeps         ', d.sweeps.length);
  console.log('distinct banks ', new Set(d.timeline.map((t) => t.bankId)).size);
  console.log('top rate today ', formatPct(d.leaderboard[0].apy), d.leaderboard[0].bankName);
  const hand = d.timeline.reduce((s, t) => s + Math.round((t.principalCents * t.apr) / 365), 0);
  console.log('hand-check     ', formatCents(hand), hand === d.totalAccruedCents ? 'MATCH' : 'MISMATCH');
}
main();
