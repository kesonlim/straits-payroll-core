import { describe, it, expect } from "vitest";
import { calculatePayrollLine } from "./calculate";
import { calculateEpfMy } from "./epfMy";

const baseEmployee = {
  dateOfBirth: "1990-01-01",
  citizenshipStatus: "citizen" as const,
  prStartDate: null,
  basicMonthlySalaryCents: 300_000, // $3,000
  isWorkman: false,
  statutoryScheme: "cpf" as const,
  shgFund: "none" as const,
  worksInSingapore: true,
};

describe("calculatePayrollLine proration for mid-period joiners", () => {
  it("applies no proration when the employee joined before the period starts", () => {
    const result = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2020-01-01" },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21, // Aug 2026 has 21 weekdays
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 1,
      claimsReimbursementCents: 0,
    });
    expect(result.prorationDeductionCents).toBe(0);
    expect(result.basicPayCents).toBe(300_000);
    expect(result.grossPayCents).toBe(300_000);
  });

  it("prorates basic pay for an employee who joined mid-period", () => {
    // Aug 2026: joins Mon 2026-08-10. Working days Aug 1-9 (before joining) = 6 weekdays (3,4,5,6,7 + none on 1,2 weekend... let's just assert via daily rate math)
    const result = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2026-08-10" },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 1,
      claimsReimbursementCents: 0,
    });
    // daily rate = 300000/21 = 14285.71..., days before joining (Aug 1-9, weekdays only) = 6 (Mon 3, Tue 4, Wed 5, Thu 6, Fri 7 -> 5 days, plus... let's just check it's > 0 and gross is reduced accordingly
    expect(result.prorationDeductionCents).toBeGreaterThan(0);
    expect(result.grossPayCents).toBe(300_000 - result.prorationDeductionCents);
    expect(result.basicPayCents).toBe(300_000); // basicPayCents itself stays the full contractual rate; proration is a separate deduction line
  });

  it("applies no proration when the employee joined exactly on the period start", () => {
    const result = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2026-08-01" },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 1,
      claimsReimbursementCents: 0,
    });
    expect(result.prorationDeductionCents).toBe(0);
  });
});

describe("calculatePayrollLine statutory scheme branching", () => {
  it("applies Malaysia EPF (13%/11%) and converts SDL to SGD for epf_my employees", () => {
    const result = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2020-01-01", statutoryScheme: "epf_my", basicMonthlySalaryCents: 260_000 },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 0.29,
      claimsReimbursementCents: 0,
    });
    expect(result.cpfEmployeeCents).toBe(28_600); // 11% of RM 2,600
    expect(result.cpfEmployerCents).toBe(33_800); // 13% of RM 2,600
    expect(result.netPayCents).toBe(260_000 - 28_600);
    // SDL computed on the SGD-equivalent gross wage (260,000 * 0.29 = 75,400 cents = S$754), not the raw MYR figure.
    expect(result.sdlCents).toBe(200); // 0.25% of S$754 = $1.885, floored to the $2 minimum
  });

  it("applies no statutory contribution for statutoryScheme: none", () => {
    const result = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2020-01-01", statutoryScheme: "none" },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 1,
      claimsReimbursementCents: 0,
    });
    expect(result.cpfEmployeeCents).toBe(0);
    expect(result.cpfEmployerCents).toBe(0);
    expect(result.netPayCents).toBe(result.grossPayCents);
  });

  it("exempts SDL for an employee not working in Singapore, regardless of CPF/EPF status", () => {
    // Real case: Farah (Malaysia-based, on EPF) and Aung Lin Htet (also overseas, statutoryScheme: none)
    // — SDL eligibility is about work location, not CPF/EPF status (verified against CPF Board's SDL page).
    const result = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2020-01-01", statutoryScheme: "epf_my", worksInSingapore: false },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 0.29,
      claimsReimbursementCents: 0,
    });
    expect(result.sdlCents).toBe(0);
  });

  it("deducts SHG for a cpf-scheme employee with a fund set, and reduces net pay", () => {
    const result = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2020-01-01", shgFund: "cdac" },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 1,
      claimsReimbursementCents: 0,
    });
    expect(result.shgCents).toBe(100); // $3,000 gross -> CDAC band > $2,000 to $3,500 = $1
    expect(result.netPayCents).toBe(result.grossPayCents - result.cpfEmployeeCents - 100);
  });

  it("never applies SHG for a non-cpf employee even if shg_fund is set", () => {
    const result = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2020-01-01", statutoryScheme: "epf_my", shgFund: "cdac" },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 1,
      claimsReimbursementCents: 0,
    });
    expect(result.shgCents).toBe(0);
  });
});

describe("calculatePayrollLine claims reimbursement", () => {
  it("adds reimbursement straight to net pay without touching gross pay, CPF, SDL, or SHG", () => {
    const withoutClaim = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2020-01-01", shgFund: "cdac" },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 1,
      claimsReimbursementCents: 0,
    });
    const withClaim = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2020-01-01", shgFund: "cdac" },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 1,
      claimsReimbursementCents: 5_000, // $50 claim
    });

    expect(withClaim.grossPayCents).toBe(withoutClaim.grossPayCents);
    expect(withClaim.cpfEmployeeCents).toBe(withoutClaim.cpfEmployeeCents);
    expect(withClaim.cpfEmployerCents).toBe(withoutClaim.cpfEmployerCents);
    expect(withClaim.sdlCents).toBe(withoutClaim.sdlCents);
    expect(withClaim.shgCents).toBe(withoutClaim.shgCents);
    expect(withClaim.claimsReimbursementCents).toBe(5_000);
    expect(withClaim.netPayCents).toBe(withoutClaim.netPayCents + 5_000);
  });
});

describe("calculatePayrollLine hourly pay", () => {
  it("computes basic pay as hourly rate x hours worked, skipping proration and unpaid-leave deductions", () => {
    const result = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2026-08-10", payType: "hourly", basicMonthlySalaryCents: 0 },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 3, // should have no effect for hourly pay
      leaveEncashmentDays: 0,
      fxRateToSgd: 1,
      claimsReimbursementCents: 0,
      hoursWorked: 40,
      hourlyRateCents: 2_500, // $25/hr
    });
    expect(result.basicPayCents).toBe(100_000); // 40 x $25
    expect(result.prorationDeductionCents).toBe(0); // no proration despite mid-period join
    expect(result.unpaidLeaveDeductionCents).toBe(0);
    expect(result.grossPayCents).toBe(100_000);
  });

  it("computes overtime for an hourly employee off their own hourly rate, not a monthly-derived one", () => {
    const result = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2020-01-01", payType: "hourly", basicMonthlySalaryCents: 0 },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 10,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 1,
      claimsReimbursementCents: 0,
      hoursWorked: 40,
      hourlyRateCents: 2_000, // $20/hr
    });
    expect(result.overtimePayCents).toBe(300_000 / 10); // 1.5 x $20 x 10 = $300 = 30,000 cents
    expect(result.overtimePayCents).toBe(30_000);
  });

  it("charges no SDL for an hourly employee who worked zero hours this period", () => {
    // No wages paid this month means no wage base to levy on — the $2 SDL minimum only applies once
    // some wages, however small, were actually paid.
    const result = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2020-01-01", payType: "hourly", basicMonthlySalaryCents: 0 },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 1,
      claimsReimbursementCents: 0,
      hoursWorked: 0,
      hourlyRateCents: 2_500,
    });
    expect(result.grossPayCents).toBe(0);
    expect(result.sdlCents).toBe(0);
  });
});

describe("calculatePayrollLine allowance", () => {
  it("adds allowance to Ordinary Wages, so it flows into gross pay and the CPF wage base", () => {
    const withoutAllowance = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2020-01-01" },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 1,
      claimsReimbursementCents: 0,
    });
    const withAllowance = calculatePayrollLine({
      employee: { ...baseEmployee, dateJoined: "2020-01-01" },
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      workingDaysInPeriod: 21,
      overtimeHours: 0,
      commissionLines: [],
      unpaidLeaveDays: 0,
      leaveEncashmentDays: 0,
      fxRateToSgd: 1,
      claimsReimbursementCents: 0,
      allowanceCents: 20_000, // $200 allowance
    });
    expect(withAllowance.allowanceCents).toBe(20_000);
    expect(withAllowance.grossPayCents).toBe(withoutAllowance.grossPayCents + 20_000);
    expect(withAllowance.cpfEmployeeCents).toBeGreaterThan(withoutAllowance.cpfEmployeeCents);
  });
});

const aug2026 = {
  periodStart: "2026-08-01",
  periodEnd: "2026-08-31",
  workingDaysInPeriod: 21, // Aug 2026 weekdays: 3-7, 10-14, 17-21, 24-28, 31
  overtimeHours: 0,
  commissionLines: [],
  unpaidLeaveDays: 0,
  leaveEncashmentDays: 0,
  fxRateToSgd: 1,
  claimsReimbursementCents: 0,
};

describe("calculatePayrollLine for leavers", () => {
  it("pro-rates away working days after the last working day", () => {
    // Last day Fri 14 Aug -> not employed 17-21, 24-28, 31 = 11 working days
    // $3,000 / 21 x 11 = 157,142.86 cents -> 157,143
    const r = calculatePayrollLine({ ...aug2026, employee: { ...baseEmployee, dateJoined: "2020-01-01", lastWorkingDay: "2026-08-14" } });
    expect(r.prorationDeductionCents).toBe(157_143);
    expect(r.grossPayCents).toBe(142_857);
  });

  it("combines leaver pro-rating and unpaid leave in the same period", () => {
    // Last day Fri 14 Aug -> 11 working days pro-rated away; plus 2 unpaid leave days
    const r = calculatePayrollLine({
      ...aug2026,
      unpaidLeaveDays: 2,
      employee: { ...baseEmployee, dateJoined: "2020-01-01", lastWorkingDay: "2026-08-14" },
    });
    expect(r.prorationDeductionCents).toBe(157_143);
    expect(r.unpaidLeaveDeductionCents).toBe(28_571);
    expect(r.grossPayCents).toBe(300_000 - 157_143 - 28_571);
    expect(r.grossPayCents).toBe(114_286);
  });

  it("combines joiner and leaver pro-rating in the same period", () => {
    // Joined Mon 10 Aug (misses 3-7 = 5 days), left Fri 21 Aug (misses 24-28, 31 = 6 days) -> 11 days
    const r = calculatePayrollLine({ ...aug2026, employee: { ...baseEmployee, dateJoined: "2026-08-10", lastWorkingDay: "2026-08-21" } });
    expect(r.prorationDeductionCents).toBe(157_143);
  });

  it("does not pro-rate when the last day is on or after the period end", () => {
    const r = calculatePayrollLine({ ...aug2026, employee: { ...baseEmployee, dateJoined: "2020-01-01", lastWorkingDay: "2026-08-31" } });
    expect(r.prorationDeductionCents).toBe(0);
  });

  it("pro-rates the whole period away when the last day is before it", () => {
    const r = calculatePayrollLine({ ...aug2026, employee: { ...baseEmployee, dateJoined: "2020-01-01", lastWorkingDay: "2026-07-31" } });
    expect(r.prorationDeductionCents).toBe(300_000);
  });

  it("charges CPF on leave encashment as Additional Wages", () => {
    // 2 days x $3,000/21 = 28,571.43 -> 28,571. TW = 300,000 + 28,571 = 328,571
    // total 37% = 121,571.27 -> $1,216 = 121,600; employee 20% = 65,714.2 -> $657 = 65,700
    const r = calculatePayrollLine({ ...aug2026, leaveEncashmentDays: 2, employee: { ...baseEmployee, dateJoined: "2020-01-01" } });
    expect(r.leaveEncashmentPayCents).toBe(28_571);
    expect(r.cpfEmployeeCents).toBe(65_700);
    expect(r.cpfEmployerCents).toBe(55_900);
  });

  it("refuses an encashment above the Additional Wage ceiling", () => {
    expect(() =>
      calculatePayrollLine({
        ...aug2026,
        leaveEncashmentDays: 2,
        remainingAdditionalWageCeilingCents: 10_000,
        employee: { ...baseEmployee, dateJoined: "2020-01-01" },
      })
    ).toThrow(/Additional Wage ceiling/);
  });

  it("does not throw when the encashment exactly equals the remaining headroom", () => {
    // 2 days encashment = 28,571 cents (see "charges CPF on leave encashment" above)
    expect(() =>
      calculatePayrollLine({
        ...aug2026,
        leaveEncashmentDays: 2,
        remainingAdditionalWageCeilingCents: 28_571,
        employee: { ...baseEmployee, dateJoined: "2020-01-01" },
      })
    ).not.toThrow();
  });

  it("does not apply the ceiling guard to an EPF (Malaysia) employee", () => {
    expect(() =>
      calculatePayrollLine({
        ...aug2026,
        leaveEncashmentDays: 2,
        remainingAdditionalWageCeilingCents: 100,
        employee: { ...baseEmployee, dateJoined: "2020-01-01", statutoryScheme: "epf_my" },
      })
    ).not.toThrow();
  });

  it("does not apply the ceiling guard to a foreigner", () => {
    expect(() =>
      calculatePayrollLine({
        ...aug2026,
        leaveEncashmentDays: 2,
        remainingAdditionalWageCeilingCents: 100,
        employee: { ...baseEmployee, dateJoined: "2020-01-01", citizenshipStatus: "foreigner" },
      })
    ).not.toThrow();
  });

  it("adds notice pay and subtracts the leave clawback from net pay only", () => {
    // gross 300,000; CPF employee 60,000; +50,000 notice pay; -20,000 clawback -> net 270,000
    const r = calculatePayrollLine({ ...aug2026, noticePayCents: 50_000, leaveClawbackCents: 20_000, employee: { ...baseEmployee, dateJoined: "2020-01-01" } });
    expect(r.grossPayCents).toBe(300_000);
    expect(r.cpfEmployeeCents).toBe(60_000);
    expect(r.noticePayCents).toBe(50_000);
    expect(r.leaveClawbackCents).toBe(20_000);
    expect(r.netPayCents).toBe(270_000);
  });

  it("recovers notice pay owed by the employee (negative notice pay)", () => {
    const r = calculatePayrollLine({ ...aug2026, noticePayCents: -30_000, employee: { ...baseEmployee, dateJoined: "2020-01-01" } });
    expect(r.netPayCents).toBe(300_000 - 60_000 - 30_000);
  });

  it("charges CPF on a bonus as Additional Wages, above the $8,000 monthly Ordinary Wage cap", () => {
    // OW $8,000 (at the cap) + $2,000 bonus: TW $10,000 x 37% = $3,700; employee 20% = $2,000.
    const emp = { ...baseEmployee, dateJoined: "2020-01-01", basicMonthlySalaryCents: 800_000 };
    const r = calculatePayrollLine({ ...aug2026, bonusCents: 200_000, employee: emp });
    expect(r.bonusCents).toBe(200_000);
    expect(r.grossPayCents).toBe(1_000_000);
    expect(r.cpfEmployeeCents).toBe(200_000);
    expect(r.cpfEmployerCents).toBe(170_000);
    expect(r.netPayCents).toBe(800_000);
    // The same $2,000 entered as Allowance is Ordinary Wages, so the monthly cap leaves it without CPF.
    const asAllowance = calculatePayrollLine({ ...aug2026, allowanceCents: 200_000, employee: emp });
    expect(asAllowance.cpfEmployeeCents).toBe(160_000);
  });

  it("refuses a bonus plus leave payout above the Additional Wage ceiling", () => {
    expect(() =>
      calculatePayrollLine({
        ...aug2026,
        bonusCents: 20_000,
        leaveEncashmentDays: 2, // 28,571
        remainingAdditionalWageCeilingCents: 40_000,
        employee: { ...baseEmployee, dateJoined: "2020-01-01" },
      })
    ).toThrow(/Additional Wage ceiling/);
  });

  it("includes a bonus in the EPF wage for a Malaysia employee", () => {
    const r = calculatePayrollLine({
      ...aug2026,
      bonusCents: 100_000,
      employee: { ...baseEmployee, dateJoined: "2020-01-01", statutoryScheme: "epf_my" },
    });
    expect(r.cpfEmployeeCents).toBe(calculateEpfMy(400_000).employeeCents);
  });
});
