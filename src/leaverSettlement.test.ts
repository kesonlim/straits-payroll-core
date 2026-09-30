import { describe, it, expect } from "vitest";
import {
  leaverProRatedAnnualEntitlement,
  leaverAnnualBalance,
  settleLeaverLeave,
  allocateClawbackByMonth,
} from "./leaverSettlement";

describe("leaverProRatedAnnualEntitlement", () => {
  it("pro-rates by completed months of the calendar year up to the last day", () => {
    // 14 days, left 30 Jun -> 6 completed months -> 7
    expect(leaverProRatedAnnualEntitlement({ fullEntitlement: 14, lastWorkingDay: "2026-06-30", inFirstYearOfService: false })).toBe(7);
    // left 31 Dec -> 12 months -> full 14
    expect(leaverProRatedAnnualEntitlement({ fullEntitlement: 14, lastWorkingDay: "2026-12-31", inFirstYearOfService: false })).toBe(14);
  });

  it("rounds to the half day like the rest of the leave maths", () => {
    // left 15 Mar -> 2 completed months -> 14 x 2/12 = 2.33 -> 2.5 (roundToHalfDay)
    expect(leaverProRatedAnnualEntitlement({ fullEntitlement: 14, lastWorkingDay: "2026-03-15", inFirstYearOfService: false })).toBe(2.5);
  });

  it("leaves a first-year entitlement alone (it is already pro-rated by months of service)", () => {
    expect(leaverProRatedAnnualEntitlement({ fullEntitlement: 3.5, lastWorkingDay: "2026-06-30", inFirstYearOfService: true })).toBe(3.5);
  });
});

describe("leaverAnnualBalance", () => {
  it("is pro-rated entitlement minus leave used, without an opening balance", () => {
    expect(leaverAnnualBalance({ fullEntitlement: 14, proRatedEntitlement: 7, openingBalance: null, used: 5 })).toBe(2);
  });

  it("goes negative when more leave was taken than earned", () => {
    expect(leaverAnnualBalance({ fullEntitlement: 14, proRatedEntitlement: 7, openingBalance: null, used: 9 })).toBe(-2);
  });

  it("starts from the opening balance when one is recorded, still removing the unearned part", () => {
    // opening 10, unearned 14 - 7 = 7, used since opening 3 -> 0
    expect(leaverAnnualBalance({ fullEntitlement: 14, proRatedEntitlement: 7, openingBalance: 10, used: 3 })).toBe(0);
  });

  it("goes negative from an opening balance too, when usage outstrips it", () => {
    // opening 4, unearned 14 - 7 = 7, used 2 -> 4 - 7 - 2 = -5
    expect(leaverAnnualBalance({ fullEntitlement: 14, proRatedEntitlement: 7, openingBalance: 4, used: 2 })).toBe(-5);
  });
});

describe("settleLeaverLeave", () => {
  it("pays out a positive balance and unused lieu days", () => {
    expect(settleLeaverLeave({ annualBalance: 2, lieuRemaining: 1.5, leavingReason: "resigned" })).toEqual({
      annualPayoutDays: 2,
      lieuPayoutDays: 1.5,
      clawbackDays: 0,
    });
  });

  it("claws back a negative balance", () => {
    expect(settleLeaverLeave({ annualBalance: -2, lieuRemaining: 0, leavingReason: "resigned" })).toEqual({
      annualPayoutDays: 0,
      lieuPayoutDays: 0,
      clawbackDays: 2,
    });
  });

  it("defaults the annual payout to 0 on dismissal for misconduct, but still pays lieu days worked", () => {
    expect(settleLeaverLeave({ annualBalance: 3, lieuRemaining: 1, leavingReason: "dismissed_misconduct" })).toEqual({
      annualPayoutDays: 0,
      lieuPayoutDays: 1,
      clawbackDays: 0,
    });
  });

  it("still claws back a negative balance on dismissal for misconduct", () => {
    expect(settleLeaverLeave({ annualBalance: -2, lieuRemaining: 1, leavingReason: "dismissed_misconduct" })).toEqual({
      annualPayoutDays: 0,
      lieuPayoutDays: 1,
      clawbackDays: 2,
    });
  });
});

describe("allocateClawbackByMonth", () => {
  const rates = { "2026-05": 14_286, "2026-06": 13_636 };

  it("takes the excess from the most recent leave first and prices it at that month's daily rate", () => {
    // 3 days: 2 from the 10 Jun leave (June rate), 1 from the 20 May leave (May rate)
    const r = allocateClawbackByMonth({
      clawbackDays: 3,
      annualLeaveTaken: [
        { dateFrom: "2026-05-20", days: 2 },
        { dateFrom: "2026-06-10", days: 2 },
      ],
      dailyRateCentsByMonth: rates,
    });
    expect(r.months).toEqual([
      { month: "2026-06", days: 2, cents: 27_272 },
      { month: "2026-05", days: 1, cents: 14_286 },
    ]);
    expect(r.unallocatedDays).toBe(0);
    expect(r.missingRateMonths).toEqual([]);
  });

  it("reports days it couldn't match to recorded leave", () => {
    const r = allocateClawbackByMonth({ clawbackDays: 3, annualLeaveTaken: [{ dateFrom: "2026-06-10", days: 1 }], dailyRateCentsByMonth: rates });
    expect(r.months).toEqual([{ month: "2026-06", days: 1, cents: 13_636 }]);
    expect(r.unallocatedDays).toBe(2);
    expect(r.missingRateMonths).toEqual([]);
  });

  it("returns nothing when there is nothing to claw back", () => {
    expect(allocateClawbackByMonth({ clawbackDays: 0, annualLeaveTaken: [{ dateFrom: "2026-06-10", days: 1 }], dailyRateCentsByMonth: rates })).toEqual({
      months: [],
      unallocatedDays: 0,
      missingRateMonths: [],
    });
  });

  it("never prices a month at $0 — days with no rate on file are unallocated and the month is flagged", () => {
    // 3 days: 2 from the 10 Jun leave (rate present), 1 from the 15 Apr leave (no rate on file)
    const r = allocateClawbackByMonth({
      clawbackDays: 3,
      annualLeaveTaken: [
        { dateFrom: "2026-04-15", days: 2 },
        { dateFrom: "2026-06-10", days: 2 },
      ],
      dailyRateCentsByMonth: rates,
    });
    expect(r.months).toEqual([{ month: "2026-06", days: 2, cents: 27_272 }]);
    expect(r.unallocatedDays).toBe(1);
    expect(r.missingRateMonths).toEqual(["2026-04"]);
  });
});
