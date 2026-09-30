import { describe, it, expect } from "vitest";
import {
  annualLeaveEntitlement,
  proRatedFirstYearEntitlement,
  medicalLeaveEntitlement,
  workingDaysInPeriod,
  dailyGrossRateCents,
  unpaidLeaveDeductionCents,
  leaveEncashmentPayCents,
  childcareLeaveEntitlement,
  extendedChildcareLeaveEntitlement,
  lieuCreditExpiryDate,
} from "./leave";

describe("annualLeaveEntitlement", () => {
  it("gives 7 days in year 1", () => {
    expect(annualLeaveEntitlement("2026-01-01", "2026-06-01")).toBe(7);
  });
  it("gives 14 days from year 8 onward", () => {
    expect(annualLeaveEntitlement("2015-01-01", "2026-06-01")).toBe(14);
  });
});

describe("proRatedFirstYearEntitlement", () => {
  it("pro-rates by completed months in the first year", () => {
    // joined 2026-01-01, as of 2026-07-01 -> 6 completed months -> 7 * 6/12 = 3.5
    expect(proRatedFirstYearEntitlement("2026-01-01", "2026-07-01")).toBe(3.5);
  });
});

describe("medicalLeaveEntitlement", () => {
  it("gives 0 days below 3 months of service", () => {
    expect(medicalLeaveEntitlement("2026-06-01", "2026-07-01")).toBe(0);
  });
  it("gives 5 days at 3 months", () => {
    expect(medicalLeaveEntitlement("2026-01-01", "2026-04-01")).toBe(5);
  });
  it("gives 8 days at 4 months", () => {
    expect(medicalLeaveEntitlement("2026-01-01", "2026-05-01")).toBe(8);
  });
  it("gives 11 days at 5 months", () => {
    expect(medicalLeaveEntitlement("2026-01-01", "2026-06-01")).toBe(11);
  });
  it("gives 14 days at 6+ months", () => {
    expect(medicalLeaveEntitlement("2026-01-01", "2026-07-01")).toBe(14);
    expect(medicalLeaveEntitlement("2020-01-01", "2026-07-01")).toBe(14);
  });
});

describe("workingDaysInPeriod", () => {
  it("counts weekdays only", () => {
    // Aug 2026: Aug 1 is Sat. Aug 1-31 = 21 weekdays
    expect(workingDaysInPeriod("2026-08-01", "2026-08-31")).toBe(21);
  });
});

describe("daily rate and deductions", () => {
  it("computes daily rate and unpaid leave deduction", () => {
    const daily = dailyGrossRateCents(420_000, 21); // $4,200 / 21 working days
    expect(daily).toBeCloseTo(20_000, 0);
    expect(unpaidLeaveDeductionCents(daily, 2)).toBe(40_000);
  });

  it("computes leave encashment pay", () => {
    const daily = dailyGrossRateCents(420_000, 21);
    expect(leaveEncashmentPayCents(daily, 3)).toBe(60_000);
  });
});

describe("childcareLeaveEntitlement", () => {
  it("gives 0 with no child on record", () => {
    expect(childcareLeaveEntitlement("2020-01-01", null, "2026-06-01")).toBe(0);
  });
  it("gives 0 below 3 months of service even with a qualifying child", () => {
    expect(childcareLeaveEntitlement("2026-06-01", "2022-01-01", "2026-07-01")).toBe(0);
  });
  it("gives 6 days for a child under 7 as at 1 Jan of the leave-year", () => {
    // child born 2020-03-01 -> turns 6 on 2026-03-01, so 5 as at 2026-01-01 -> under 7
    expect(childcareLeaveEntitlement("2020-01-01", "2020-03-01", "2026-06-01")).toBe(6);
  });
  it("still gives 6 for the whole year a child turns 7 in", () => {
    // child born 2019-03-01 -> turns 7 on 2026-03-01, but is 6 as at 2026-01-01 -> still qualifies for all of 2026
    expect(childcareLeaveEntitlement("2020-01-01", "2019-03-01", "2026-11-01")).toBe(6);
  });
  it("gives 0 once the child is 7 or older as at 1 Jan", () => {
    // child born 2018-01-01 -> 8 as at 2026-01-01
    expect(childcareLeaveEntitlement("2020-01-01", "2018-01-01", "2026-06-01")).toBe(0);
  });
});

describe("extendedChildcareLeaveEntitlement", () => {
  it("gives 0 for a child under 7", () => {
    expect(extendedChildcareLeaveEntitlement("2020-01-01", "2020-03-01", "2026-06-01")).toBe(0);
  });
  it("gives 2 days for a child aged 7 to under 13 as at 1 Jan", () => {
    // child born 2017-06-01 -> 8 as at 2026-01-01
    expect(extendedChildcareLeaveEntitlement("2020-01-01", "2017-06-01", "2026-06-01")).toBe(2);
  });
  it("gives 0 once the child is 13 or older as at 1 Jan", () => {
    // child born 2012-01-01 -> 14 as at 2026-01-01
    expect(extendedChildcareLeaveEntitlement("2020-01-01", "2012-01-01", "2026-06-01")).toBe(0);
  });
});

describe("lieuCreditExpiryDate", () => {
  it("expires 6 months after the earned date", () => {
    expect(lieuCreditExpiryDate("2026-01-15")).toBe("2026-07-15");
  });
  it("handles a year rollover", () => {
    expect(lieuCreditExpiryDate("2026-08-28")).toBe("2027-02-28");
  });
  it("normalizes into the next month when the earned day doesn't exist 6 months out", () => {
    // 2026-08-31 + 6 months = "2027-02-31", which doesn't exist -> normalizes to 2027-03-03
    expect(lieuCreditExpiryDate("2026-08-31")).toBe("2027-03-03");
  });
});
