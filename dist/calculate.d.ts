import { type CitizenshipStatus } from "./cpf.js";
import { type ShgFund } from "./shg.js";
import { type CommissionLineInput, type CommissionLineResult } from "./commission.js";
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
    periodEnd: string;
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
/**
 * Leave encashment is an Additional Wage: CPF is charged on it (CPF Board: "CPF contributions are
 * payable on cash payment given to your employee for encashment of his leave"), outside the monthly
 * OW ceiling but within the annual AW ceiling — pass remainingAdditionalWageCeilingCents to enforce
 * that (CPF members only).
 */
export declare function calculatePayrollLine(input: PayrollLineInput): PayrollLineResult;
