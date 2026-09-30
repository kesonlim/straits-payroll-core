import { describe, it, expect } from "vitest";
import { calculateCpf, ageAt, prYearsSinceConversion, ANNUAL_TOTAL_WAGE_CEILING_CENTS, additionalWageCeilingCents } from "./cpf";

describe("calculateCpf", () => {
  it("computes citizen <=55 at 37% total, 20% employee", () => {
    const result = calculateCpf({
      ageAtPayment: 30,
      citizenshipStatus: "citizen",
      prYearsSinceConversion: null,
      ordinaryWageCents: 500_000, // $5,000
    });
    expect(result.employeeCents).toBe(100_000); // 20%
    expect(result.employeeCents + result.employerCents).toBe(185_000); // 37%
  });

  it("computes citizen above 55-60 at 34% total, 18% employee", () => {
    const result = calculateCpf({
      ageAtPayment: 57,
      citizenshipStatus: "citizen",
      prYearsSinceConversion: null,
      ordinaryWageCents: 500_000,
    });
    expect(result.employeeCents).toBe(90_000); // 18%
    expect(result.employeeCents + result.employerCents).toBe(170_000); // 34%
  });

  it("computes citizen above 60-65 at 25% total, 12.5% employee", () => {
    const result = calculateCpf({
      ageAtPayment: 62,
      citizenshipStatus: "citizen",
      prYearsSinceConversion: null,
      ordinaryWageCents: 500_000,
    });
    expect(result.employeeCents).toBe(62_500); // 12.5%
    expect(result.employeeCents + result.employerCents).toBe(125_000); // 25%
  });

  it("contributes zero CPF for foreigners regardless of wage or age", () => {
    const result = calculateCpf({
      ageAtPayment: 30,
      citizenshipStatus: "foreigner",
      prYearsSinceConversion: null,
      ordinaryWageCents: 500_000,
    });
    expect(result).toEqual({ employeeCents: 0, employerCents: 0 });
  });

  it("caps at the $8,000 OW ceiling", () => {
    const result = calculateCpf({
      ageAtPayment: 30,
      citizenshipStatus: "citizen",
      prYearsSinceConversion: null,
      ordinaryWageCents: 1_000_000, // $10,000 > $8,000 ceiling
    });
    expect(result.employeeCents).toBe(160_000); // 20% of 800,000
    expect(result.employeeCents + result.employerCents).toBe(296_000); // 37% of 800,000
  });

  it("contributes nil CPF for wages of $50 or less", () => {
    const result = calculateCpf({
      ageAtPayment: 30,
      citizenshipStatus: "citizen",
      prYearsSinceConversion: null,
      ordinaryWageCents: 3_000, // $30
    });
    expect(result).toEqual({ employeeCents: 0, employerCents: 0 });
  });

  it("is employer-only for wages > $50 to $500 (17% of TW, citizen <=55)", () => {
    const result = calculateCpf({
      ageAtPayment: 30,
      citizenshipStatus: "citizen",
      prYearsSinceConversion: null,
      ordinaryWageCents: 50_000, // exactly $500 — still in the employer-only band
    });
    expect(result.employeeCents).toBe(0);
    expect(result.employerCents).toBe(8_500); // 17% of $500
  });

  it("applies the phased employee contribution for wages > $500 to $750 (real Ang Sheau Yin case, $620/month)", () => {
    // total = 17%(620) + 0.6*(620-500) = 105.40 + 72 = 177.40 -> rounds to $177
    // employee = 0.6*(620-500) = $72 exactly, employer = 177 - 72 = $105
    const result = calculateCpf({
      ageAtPayment: 30,
      citizenshipStatus: "citizen",
      prYearsSinceConversion: null,
      ordinaryWageCents: 62_000,
    });
    expect(result.employeeCents).toBe(7_200);
    expect(result.employerCents).toBe(10_500);
    expect(result.employeeCents + result.employerCents).toBe(17_700);
  });

  it("applies the phased employee contribution at exactly $700/month", () => {
    // total = 17%(700) + 0.6*(700-500) = 119 + 120 = $239 exactly; employee = $120; employer = $119
    const result = calculateCpf({
      ageAtPayment: 30,
      citizenshipStatus: "citizen",
      prYearsSinceConversion: null,
      ordinaryWageCents: 70_000,
    });
    expect(result.employeeCents).toBe(12_000);
    expect(result.employerCents).toBe(11_900);
  });

  it("rounds the total to the nearest dollar and the employee's share down, deriving employer by subtraction", () => {
    // $1,234.56 at the <=55 band (37% total, 20% employee)
    const result = calculateCpf({
      ageAtPayment: 30,
      citizenshipStatus: "citizen",
      prYearsSinceConversion: null,
      ordinaryWageCents: 123_456,
    });
    // total = round(456.7872) = $457; employee = floor(246.912) = $246; employer = 457 - 246 = $211
    expect(result.employeeCents).toBe(24_600);
    expect(result.employeeCents + result.employerCents).toBe(45_700);
    expect(result.employerCents).toBe(21_100);
  });

  it("applies PR year 1 graduated (G/G) rates under 55: 9% total, 5% employee", () => {
    const result = calculateCpf({
      ageAtPayment: 30,
      citizenshipStatus: "pr",
      prYearsSinceConversion: 1,
      ordinaryWageCents: 500_000,
    });
    expect(result.employeeCents).toBe(25_000); // 5%
    expect(result.employeeCents + result.employerCents).toBe(45_000); // 9%
  });

  it("applies PR year 2 graduated (G/G) rates under 55: 24% total, 15% employee", () => {
    const result = calculateCpf({
      ageAtPayment: 30,
      citizenshipStatus: "pr",
      prYearsSinceConversion: 2,
      ordinaryWageCents: 500_000,
    });
    expect(result.employeeCents).toBe(75_000); // 15%
    expect(result.employeeCents + result.employerCents).toBe(120_000); // 24%
  });

  it("applies PR year 1 graduated (G/G) rates above 60: 8.5% total, 5% employee", () => {
    const result = calculateCpf({
      ageAtPayment: 62,
      citizenshipStatus: "pr",
      prYearsSinceConversion: 1,
      ordinaryWageCents: 500_000,
    });
    expect(result.employeeCents).toBe(25_000); // 5%
    expect(result.employeeCents + result.employerCents).toBe(42_500); // 8.5%
  });

  it("applies PR year 2 graduated (G/G) rates above 60-65: 11% total, 7.5% employee", () => {
    const result = calculateCpf({
      ageAtPayment: 62,
      citizenshipStatus: "pr",
      prYearsSinceConversion: 2,
      ordinaryWageCents: 500_000,
    });
    expect(result.employeeCents).toBe(37_500); // 7.5%
    expect(result.employeeCents + result.employerCents).toBe(55_000); // 11%
  });

  it("uses citizen rates for PR year 3+", () => {
    const result = calculateCpf({
      ageAtPayment: 30,
      citizenshipStatus: "pr",
      prYearsSinceConversion: 3,
      ordinaryWageCents: 500_000,
    });
    expect(result.employeeCents).toBe(100_000);
    expect(result.employeeCents + result.employerCents).toBe(185_000);
  });
});

describe("ageAt", () => {
  it("computes age correctly before and after birthday", () => {
    expect(ageAt("1990-08-10", "2026-08-08")).toBe(35); // birthday not yet reached
    expect(ageAt("1990-08-10", "2026-08-10")).toBe(36); // birthday reached
  });
});

describe("prYearsSinceConversion", () => {
  it("returns 1 for the first year after conversion", () => {
    expect(prYearsSinceConversion("2026-01-01", "2026-06-01")).toBe(1);
  });
  it("returns 2 in the second year", () => {
    expect(prYearsSinceConversion("2025-01-01", "2026-06-01")).toBe(2);
  });
  it("returns 3 in the third year", () => {
    expect(prYearsSinceConversion("2024-01-01", "2026-06-01")).toBe(3);
  });
  it("returns null for non-PR", () => {
    expect(prYearsSinceConversion(null, "2026-06-01")).toBe(null);
  });
});

describe("calculateCpf with Additional Wages", () => {
  const citizen30 = { ageAtPayment: 30, citizenshipStatus: "citizen" as const, prYearsSinceConversion: null };

  it("adds AW to OW for a citizen <=55 (37% total, 20% employee)", () => {
    // TW = $3,000 + $500 = $3,500 -> total 37% = $1,295, employee 20% = $700, employer $595
    const r = calculateCpf({ ...citizen30, ordinaryWageCents: 300_000, additionalWageCents: 50_000 });
    expect(r.employeeCents).toBe(70_000);
    expect(r.employerCents).toBe(59_500);
  });

  it("caps OW at the OW ceiling but not AW", () => {
    // OW $8,500 -> capped $8,000, + AW $1,000 = $9,000 -> total $3,330, employee $1,800
    const r = calculateCpf({ ...citizen30, ordinaryWageCents: 850_000, additionalWageCents: 100_000 });
    expect(r.employeeCents).toBe(180_000);
    expect(r.employeeCents + r.employerCents).toBe(333_000);
  });

  it("uses total wages (OW + AW) to pick the low-wage band", () => {
    // TW $600 is in the >$500-$750 band: total = 17% x 600 + 0.6 x (600 - 500) = 102 + 60 = $162; employee = $60
    const r = calculateCpf({ ...citizen30, ordinaryWageCents: 40_000, additionalWageCents: 20_000 });
    expect(r.employeeCents).toBe(6_000);
    expect(r.employerCents).toBe(10_200);
  });

  it("treats a missing additionalWageCents as 0 (existing callers unchanged)", () => {
    expect(calculateCpf({ ...citizen30, ordinaryWageCents: 500_000 })).toEqual(
      calculateCpf({ ...citizen30, ordinaryWageCents: 500_000, additionalWageCents: 0 })
    );
  });

  it("still returns zero for foreigners", () => {
    const r = calculateCpf({ ageAtPayment: 30, citizenshipStatus: "foreigner", prYearsSinceConversion: null, ordinaryWageCents: 300_000, additionalWageCents: 50_000 });
    expect(r).toEqual({ employeeCents: 0, employerCents: 0 });
  });
});

describe("additionalWageCeilingCents", () => {
  it("is $102,000 minus the year's OW so far and still to come", () => {
    // $3,500/month for 12 months = $42,000 -> ceiling $60,000
    expect(
      additionalWageCeilingCents({ ytdOrdinaryWageCents: 2_450_000, remainingOrdinaryWageCents: 1_750_000, ytdAdditionalWageCents: 0 })
    ).toBe(6_000_000);
    expect(ANNUAL_TOTAL_WAGE_CEILING_CENTS).toBe(10_200_000);
  });

  it("never goes below zero", () => {
    expect(
      additionalWageCeilingCents({ ytdOrdinaryWageCents: 9_000_000, remainingOrdinaryWageCents: 2_000_000, ytdAdditionalWageCents: 0 })
    ).toBe(0);
  });

  it("also subtracts Additional Wages already paid this year", () => {
    expect(
      additionalWageCeilingCents({ ytdOrdinaryWageCents: 2_450_000, remainingOrdinaryWageCents: 1_750_000, ytdAdditionalWageCents: 1_000_000 })
    ).toBe(5_000_000);
  });
});
