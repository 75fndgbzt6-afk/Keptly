// Builds the sanitized chat context. Inflows-ready: only "out" flows exist today;
// income ("in") slots in for v2 with no schema change. We send service names,
// categories, and amounts — but NEVER holder names, payment-method labels (type
// only, and we omit even that here), full IDs, scan paths, or notes.
import { Item } from '@/types';
import { CostPerUse } from '@/services/value-engine';
import { itemMonthly } from '@/lib/billing';
import { FinancialDigest, DigestFlow } from '@/lib/ai-types';

export function buildFinancialDigest(
  items: Item[],
  cpuMap: Map<string, CostPerUse>,
  currency: string,
): FinancialDigest {
  const flows: DigestFlow[] = [];
  let monthlyOut = 0;

  for (const item of items) {
    if (item.status !== 'active') continue;
    const monthly = itemMonthly(item);
    if (monthly <= 0) continue;
    monthlyOut += monthly;
    const cpu = cpuMap.get(item.id);
    flows.push({
      direction: 'out',
      label: item.name, // service name only — no holder names, IDs, or payment labels
      category: item.category,
      monthlyAmount: Math.round(monthly),
      costPerUse: cpu && cpu.value !== null ? Math.round(cpu.value * 100) / 100 : null,
      usageTrend: null,
      intent: item.intentFlag,
    });
  }

  flows.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
  const monthlyIn = 0;
  return {
    currency,
    flows,
    totals: { monthlyOut: Math.round(monthlyOut), monthlyIn, net: monthlyIn - Math.round(monthlyOut) },
  };
}
