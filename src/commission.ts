/** Flat-rate commission: rate x that period's sales entered by the admin, for one category. */
export function calculateCommissionCents(salesAmountCents: number, commissionRatePercent: number): number {
  return Math.round((salesAmountCents * commissionRatePercent) / 100);
}

export interface CommissionLineInput {
  categoryName: string;
  ratePercent: number;
  salesAmountCents: number;
}

export interface CommissionLineResult extends CommissionLineInput {
  commissionCents: number;
}

/**
 * A sales employee can earn commission from more than one sales category at different rates (e.g.
 * Thong Lai Yin: Florist Sales at 3%, ResortsWorld Sales at 0.5% — two separate figures, two separate
 * rates, not one blended number). Computes each category independently and sums for the total —
 * the common single-category case (most sales employees today) is just a one-element list.
 */
export function calculateCommissionLines(lines: CommissionLineInput[]): { lines: CommissionLineResult[]; totalCents: number } {
  const results = lines.map((line) => ({ ...line, commissionCents: calculateCommissionCents(line.salesAmountCents, line.ratePercent) }));
  return { lines: results, totalCents: results.reduce((sum, l) => sum + l.commissionCents, 0) };
}
