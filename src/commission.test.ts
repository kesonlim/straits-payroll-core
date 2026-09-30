import { describe, it, expect } from "vitest";
import { calculateCommissionCents, calculateCommissionLines } from "./commission";

describe("calculateCommissionCents", () => {
  it("computes a flat percentage of the sales amount", () => {
    expect(calculateCommissionCents(1_000_000, 3)).toBe(30_000); // $10,000 sales @ 3% = $300
  });

  it("rounds to the nearest cent", () => {
    expect(calculateCommissionCents(333, 33.33)).toBe(111); // 333 * 0.3333 = 110.99 -> rounds to 111
  });
});

describe("calculateCommissionLines", () => {
  it("computes each category independently and sums for the total", () => {
    // Thong Lai Yin's exact scenario: Florist Sales at 3%, ResortsWorld Sales at 0.5%.
    const { lines, totalCents } = calculateCommissionLines([
      { categoryName: "Florist Sales", ratePercent: 3, salesAmountCents: 500_000 }, // $5,000 -> $150
      { categoryName: "ResortsWorld Sales", ratePercent: 0.5, salesAmountCents: 200_000 }, // $2,000 -> $10
    ]);
    expect(lines).toEqual([
      { categoryName: "Florist Sales", ratePercent: 3, salesAmountCents: 500_000, commissionCents: 15_000 },
      { categoryName: "ResortsWorld Sales", ratePercent: 0.5, salesAmountCents: 200_000, commissionCents: 1_000 },
    ]);
    expect(totalCents).toBe(16_000);
  });

  it("handles the common single-category case exactly like the old flat-rate model", () => {
    const { lines, totalCents } = calculateCommissionLines([
      { categoryName: "General Sales", ratePercent: 1, salesAmountCents: 300_000 },
    ]);
    expect(lines[0].commissionCents).toBe(3_000);
    expect(totalCents).toBe(3_000);
  });

  it("totals 0 for an empty list — a non-sales employee", () => {
    expect(calculateCommissionLines([]).totalCents).toBe(0);
  });
});
