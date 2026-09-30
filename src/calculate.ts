import { calculateCpf, ageAt, prYearsSinceConversion, type CitizenshipStatus } from "./cpf";
import { calculateEpfMy } from "./epfMy";
import { calculateSdl } from "./sdl";
import { calculateShg, type ShgFund } from "./shg";
import { calculateOvertime } from "./overtime";
import { calculateCommissionLines, type CommissionLineInput, type CommissionLineResult } from "./commission";
import { dailyGrossRateCents, unpaidLeaveDeductionCents, leaveEncashmentPayCents, workingDaysInPeriod as countWorkingDays } from "./leave";

export type StatutoryScheme = "cpf" | "epf_my" | "none";

export type PayType = "monthly" | "hourly";

export interface PayrollLineInput {
  employee: {
    dateOfBirth: string;
    dateJoined: string;
    citizenshipStatus: CitizenshipStatus;
    prStartDate: string | null;
    basicMonthlySalaryCents: number;
    isWorkman: boolean;
    statutoryScheme: StatutoryScheme;
    shgFund: ShgFund;
    /** SDL eligibility depends on this, not statutoryScheme — CPF Board: "all employees working in
     * Singapore... regardless of CPF contribution status." Defaults true for the existing roster. */
    worksInSingapore: boolean;
    /** "hourly" replaces the monthly-salary-based basic pay with hourlyRateCents x hoursWorked, and
     * skips the daily-rate proration/unpaid-leave-deduction logic entirely — an hourly employee's pay
     * already reflects only the hours actually entered for the period, so there's no "full month minus
     * days missed" concept to apply on top. Defaults to "monthly" for the existing roster. */
    payType?: PayType;
    /** Last working day for a leaver (app/offboarding.ts). Working days after it in this period are
     * pro-rated away, mirroring the joiner pro-rating. Omitted/null for everyone else. */
    lastWorkingDay?: string | null;
  };
  periodStart: string;
  periodEnd: string; // ISO date, used for age/PR-year lookups and as the CPF contribution month
  workingDaysInPeriod: number;
  overtimeHours: number;
  /** One entry per sales category this employee earns commission from this period (see
   * `calculateCommissionLines()`). Empty for a non-sales employee. */
  commissionLines: CommissionLineInput[];
  unpaidLeaveDays: number;
  leaveEncashmentDays: number;
  /** Rate to convert this employee's native-currency cents to SGD (1 for SGD employees). SDL is always computed in SGD. */
  fxRateToSgd: number;
  /** Approved expense-claim reimbursement for this run — not wages, so it never touches gross pay or
   * the CPF/SDL/SHG wage base, only net pay. */
  claimsReimbursementCents: number;
  /** Hours worked this period — only meaningful (and required for a real basic pay figure) when
   * employee.payType === "hourly". Ignored for monthly-paid employees. */
  hoursWorked?: number;
  /** The hourly rate actually used for this run — only meaningful when employee.payType === "hourly".
   * Passed explicitly (rather than always reading employee.basicMonthlySalaryCents) so a per-run rate
   * override doesn't require having already written back to the employee record. */
  hourlyRateCents?: number;
  /** Ad-hoc allowance for this run (e.g. a responsibility allowance) — CPF-able, so it's folded into
   * Ordinary Wages before the CPF/SDL/SHG wage base is computed, same as basic pay and commission.
   * A bonus is NOT an allowance: pass it as bonusCents so CPF treats it as Additional Wages. */
  allowanceCents?: number;
  /** Bonus paid this run (annual, 13th-month, performance). CPF Board: a bonus is an Additional Wage,
   * so it's outside the $8,000 monthly Ordinary Wage cap but counts against the annual AW ceiling. */
  bonusCents?: number;
  /** Pay in lieu of notice: positive = paid to the employee, negative = recovered from them. CPF Board:
   * not subject to CPF, so it never enters gross pay or the CPF base; it only moves net pay.
   * Also kept out of the SDL base. Whether SDL applies to salary in lieu of notice wasn't confirmed
   * (SkillsFuture's SDL FAQ was unreachable during the build); the owner chose not to pursue it
   * (2026-09-29) — the most at stake is SDL's $11.25/month cap. See HANDOFF. */
  noticePayCents?: number;
  /** Overdrawn leave recovered from a leaver's final pay. Deducted after CPF: CPF Board says excess leave
   * reduces the wages of the month it was taken (refunded via CPF Board), not the current month. */
  leaveClawbackCents?: number;
  /** Remaining Additional Wage headroom for the year, from additionalWageCeilingCents() — i.e. already
   * net of any Additional Wages (encashment, bonus, etc.) paid earlier this year. When set, and the
   * employee is a CPF member (statutoryScheme === "cpf" and not a foreigner), this run's leave
   * encashment must not exceed it. */
  remainingAdditionalWageCeilingCents?: number;
}

export interface PayrollLineResult {
  basicPayCents: number;
  overtimePayCents: number;
  commissionPayCents: number;
  commissionLines: CommissionLineResult[];
  allowanceCents: number;
  bonusCents: number;
  prorationDeductionCents: number;
  unpaidLeaveDeductionCents: number;
  leaveEncashmentPayCents: number;
  grossPayCents: number;
  cpfEmployeeCents: number;
  cpfEmployerCents: number;
  sdlCents: number;
  shgCents: number;
  claimsReimbursementCents: number;
  netPayCents: number;
  noticePayCents: number;
  leaveClawbackCents: number;
}

function isoDayBefore(dateIso: string): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Days in the period before the employee's date joined — i.e. days they
 * weren't yet employed, for a mid-period new hire. Same daily-rate formula
 * as unpaid leave (MOM's incomplete-month-salary calculation), but tracked
 * separately since it isn't leave and shouldn't touch a leave balance.
 */
function daysBeforeJoiningInPeriod(periodStart: string, periodEnd: string, dateJoined: string): number {
  if (dateJoined <= periodStart) return 0;
  if (dateJoined > periodEnd) return countWorkingDays(periodStart, periodEnd); // shouldn't normally happen — employee joins after this period ends
  return countWorkingDays(periodStart, isoDayBefore(dateJoined));
}

function isoDayAfter(dateIso: string): string {
  const d = new Date(dateIso);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Working days in the period after a leaver's last working day — the mirror of daysBeforeJoiningInPeriod. */
function daysAfterLeavingInPeriod(periodStart: string, periodEnd: string, lastWorkingDay: string | null | undefined): number {
  if (!lastWorkingDay || lastWorkingDay >= periodEnd) return 0;
  if (lastWorkingDay < periodStart) return countWorkingDays(periodStart, periodEnd);
  return countWorkingDays(isoDayAfter(lastWorkingDay), periodEnd);
}

/**
 * Leave encashment is an Additional Wage: CPF is charged on it (CPF Board: "CPF contributions are
 * payable on cash payment given to your employee for encashment of his leave"), outside the monthly
 * OW ceiling but within the annual AW ceiling — pass remainingAdditionalWageCeilingCents to enforce
 * that (CPF members only).
 */
export function calculatePayrollLine(input: PayrollLineInput): PayrollLineResult {
  const {
    employee,
    periodStart,
    periodEnd,
    workingDaysInPeriod,
    overtimeHours,
    commissionLines: commissionLineInputs,
    unpaidLeaveDays,
    leaveEncashmentDays,
    fxRateToSgd,
    claimsReimbursementCents,
    hoursWorked = 0,
    hourlyRateCents = 0,
    allowanceCents = 0,
    bonusCents = 0,
    noticePayCents = 0,
    leaveClawbackCents = 0,
    remainingAdditionalWageCeilingCents,
  } = input;
  const isHourly = employee.payType === "hourly";

  const basicPayCents = isHourly ? Math.round(hourlyRateCents * hoursWorked) : employee.basicMonthlySalaryCents;

  const overtime = calculateOvertime({
    isWorkman: employee.isWorkman,
    basicMonthlySalaryCents: employee.basicMonthlySalaryCents,
    overtimeHours,
    hourlyRateOverrideCents: isHourly ? hourlyRateCents : undefined,
  });

  const { lines: commissionLines, totalCents: commissionPayCents } = calculateCommissionLines(commissionLineInputs);

  // Hourly pay already reflects only the hours actually entered for the period, so there's no
  // "full month minus days missed" figure to layer proration or unpaid-leave deductions on top of.
  const dailyRateCents = isHourly ? 0 : dailyGrossRateCents(employee.basicMonthlySalaryCents, workingDaysInPeriod);
  const prorationDays = isHourly
    ? 0
    : daysBeforeJoiningInPeriod(periodStart, periodEnd, employee.dateJoined) +
      daysAfterLeavingInPeriod(periodStart, periodEnd, employee.lastWorkingDay);
  const prorationDeductionCents = unpaidLeaveDeductionCents(dailyRateCents, prorationDays);
  const leaveDeductionCents = isHourly ? 0 : unpaidLeaveDeductionCents(dailyRateCents, unpaidLeaveDays);
  const encashmentPayCents = isHourly ? 0 : leaveEncashmentPayCents(dailyRateCents, leaveEncashmentDays);

  const isCpfMember = employee.statutoryScheme === "cpf" && employee.citizenshipStatus !== "foreigner";
  const additionalWageCents = encashmentPayCents + bonusCents;
  if (isCpfMember && remainingAdditionalWageCeilingCents !== undefined && additionalWageCents > remainingAdditionalWageCeilingCents) {
    throw new Error(
      "Bonus and leave payout together exceed this year's CPF Additional Wage ceiling — calculate this employee's CPF manually against the CPF Board calculator."
    );
  }

  const owCents =
    basicPayCents + overtime.overtimePayCents + commissionPayCents + allowanceCents - prorationDeductionCents - leaveDeductionCents;
  const grossPayCents = owCents + additionalWageCents;

  let statutoryEmployeeCents = 0;
  let statutoryEmployerCents = 0;
  if (employee.statutoryScheme === "cpf") {
    const cpf = calculateCpf({
      ageAtPayment: ageAt(employee.dateOfBirth, periodEnd),
      citizenshipStatus: employee.citizenshipStatus,
      prYearsSinceConversion: prYearsSinceConversion(employee.prStartDate, periodEnd),
      ordinaryWageCents: owCents,
      additionalWageCents,
    });
    statutoryEmployeeCents = cpf.employeeCents;
    statutoryEmployerCents = cpf.employerCents;
  } else if (employee.statutoryScheme === "epf_my") {
    // KWSP: a bonus is wages for EPF; leave encashment isn't (unchanged from before).
    const epf = calculateEpfMy(owCents + bonusCents);
    statutoryEmployeeCents = epf.employeeCents;
    statutoryEmployerCents = epf.employerCents;
  }
  // "none" leaves both at 0 — no statutory contribution at all.

  // SDL applies to anyone working in Singapore, regardless of CPF/EPF status — an employee based
  // overseas (e.g. fully remote from Malaysia) owes no SDL at all. Always computed in SGD regardless
  // of the employee's pay currency — convert the native-currency gross wage before applying it.
  const sdlCents = employee.worksInSingapore ? calculateSdl(Math.round(grossPayCents * fxRateToSgd)) : 0;

  // SHG contributions only apply within the Singapore CPF system — a foreigner on EPF or no scheme
  // isn't part of it, regardless of what shg_fund happens to be set on their record.
  const shgCents =
    employee.statutoryScheme === "cpf" ? calculateShg(employee.shgFund, Math.round(grossPayCents * fxRateToSgd)) : 0;

  // Reimbursement is added straight onto net pay — it's not remuneration, so it never enters
  // grossPayCents and never affects the CPF/SDL/SHG wage base above. Notice pay and the leave
  // clawback work the same way: they only move net pay, never gross or any statutory wage base.
  const netPayCents =
    grossPayCents - statutoryEmployeeCents - shgCents + claimsReimbursementCents + noticePayCents - leaveClawbackCents;

  return {
    basicPayCents,
    overtimePayCents: overtime.overtimePayCents,
    commissionPayCents,
    commissionLines,
    allowanceCents,
    bonusCents,
    prorationDeductionCents,
    unpaidLeaveDeductionCents: leaveDeductionCents,
    leaveEncashmentPayCents: encashmentPayCents,
    grossPayCents,
    cpfEmployeeCents: statutoryEmployeeCents,
    cpfEmployerCents: statutoryEmployerCents,
    sdlCents,
    shgCents,
    claimsReimbursementCents,
    netPayCents,
    noticePayCents,
    leaveClawbackCents,
  };
}
