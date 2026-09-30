import { describe, it, expect } from "vitest";
import { annualEncashDaysFor, firstInvalidAmount, isLeaverForPeriod, settlementInputsFor } from "./adjustmentGuards";

const ok = { encashDays: 0, lieuPayoutDays: 0, clawbackDollars: 0, noticeDollars: 0, allowanceDollars: 0, unpaidDays: 0 };

describe("firstInvalidAmount", () => {
  it("accepts ordinary values, including negative notice/clawback recoveries", () => {
    expect(firstInvalidAmount({ ...ok, noticeDollars: -500, clawbackDollars: 250.5, unpaidDays: 2 })).toBeNull();
  });
  it("rejects Infinity and NaN", () => {
    expect(firstInvalidAmount({ ...ok, encashDays: Infinity })).toBe("encashment days");
    expect(firstInvalidAmount({ ...ok, allowanceDollars: NaN })).toBe("allowance");
  });
  it("rejects a negative, non-finite or absurd bonus", () => {
    expect(firstInvalidAmount({ ...ok, bonusDollars: -1 })).toBe("bonus");
    expect(firstInvalidAmount({ ...ok, bonusDollars: Infinity })).toBe("bonus");
    expect(firstInvalidAmount({ ...ok, bonusDollars: 1_000_001 })).toBe("bonus");
    expect(firstInvalidAmount({ ...ok, bonusDollars: 5_000 })).toBeNull();
  });
  it("rejects days over 366 and dollars over 1,000,000 in magnitude", () => {
    expect(firstInvalidAmount({ ...ok, unpaidDays: 367 })).toBe("unpaid days");
    expect(firstInvalidAmount({ ...ok, noticeDollars: -1_000_001 })).toBe("notice pay");
    expect(firstInvalidAmount({ ...ok, clawbackDollars: 1_000_001 })).toBe("leave clawback");
  });
});

describe("settlementInputsFor / isLeaverForPeriod", () => {
  const v = { lieuPayoutDays: 2, clawbackDollars: 100, noticeDollars: 50, encashDays: 3 };
  it("zeroes lieu/notice/clawback for a non-leaver but keeps encashment", () => {
    expect(settlementInputsFor(false, v)).toEqual({ lieuPayoutDays: 0, clawbackDollars: 0, noticeDollars: 0, encashDays: 3 });
  });
  it("leaves a leaver's values alone", () => {
    expect(settlementInputsFor(true, v)).toEqual(v);
  });
  it("is a leaver only when the last day is on or before the period end", () => {
    expect(isLeaverForPeriod(null, "2026-08-31")).toBe(false);
    expect(isLeaverForPeriod("2026-09-01", "2026-08-31")).toBe(false);
    expect(isLeaverForPeriod("2026-08-31", "2026-08-31")).toBe(true);
  });
});

describe("annualEncashDaysFor", () => {
  it("forces 0 when annual leave is forfeited, whatever was typed", () => {
    expect(annualEncashDaysFor(1, 6.5)).toBe(0);
  });
  it("passes the days through otherwise", () => {
    expect(annualEncashDaysFor(0, 6.5)).toBe(6.5);
    expect(annualEncashDaysFor(null, 2)).toBe(2);
  });
});
