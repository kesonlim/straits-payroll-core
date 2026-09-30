import { calculateCpf, ageAt, prYearsSinceConversion } from "./cpf";
import { calculateEpfMy } from "./epfMy";
import { calculateSdl } from "./sdl";
import { calculateShg } from "./shg";
import { calculateOvertime } from "./overtime";
import { calculateCommissionLines } from "./commission";
import { dailyGrossRateCents, unpaidLeaveDeductionCents, leaveEncashmentPayCents, workingDaysInPeriod as countWorkingDays } from "./leave";
function isoDayBefore(dateIso) {
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
function daysBeforeJoiningInPeriod(periodStart, periodEnd, dateJoined) {
    if (dateJoined <= periodStart)
        return 0;
    if (dateJoined > periodEnd)
        return countWorkingDays(periodStart, periodEnd); // shouldn't normally happen — employee joins after this period ends
    return countWorkingDays(periodStart, isoDayBefore(dateJoined));
}
function isoDayAfter(dateIso) {
    const d = new Date(dateIso);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
}
/** Working days in the period after a leaver's last working day — the mirror of daysBeforeJoiningInPeriod. */
function daysAfterLeavingInPeriod(periodStart, periodEnd, lastWorkingDay) {
    if (!lastWorkingDay || lastWorkingDay >= periodEnd)
        return 0;
    if (lastWorkingDay < periodStart)
        return countWorkingDays(periodStart, periodEnd);
    return countWorkingDays(isoDayAfter(lastWorkingDay), periodEnd);
}
/**
 * Leave encashment is an Additional Wage: CPF is charged on it (CPF Board: "CPF contributions are
 * payable on cash payment given to your employee for encashment of his leave"), outside the monthly
 * OW ceiling but within the annual AW ceiling — pass remainingAdditionalWageCeilingCents to enforce
 * that (CPF members only).
 */
export function calculatePayrollLine(input) {
    const { employee, periodStart, periodEnd, workingDaysInPeriod, overtimeHours, commissionLines: commissionLineInputs, unpaidLeaveDays, leaveEncashmentDays, fxRateToSgd, claimsReimbursementCents, hoursWorked = 0, hourlyRateCents = 0, allowanceCents = 0, bonusCents = 0, noticePayCents = 0, leaveClawbackCents = 0, remainingAdditionalWageCeilingCents, } = input;
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
        throw new Error("Bonus and leave payout together exceed this year's CPF Additional Wage ceiling — calculate this employee's CPF manually against the CPF Board calculator.");
    }
    const owCents = basicPayCents + overtime.overtimePayCents + commissionPayCents + allowanceCents - prorationDeductionCents - leaveDeductionCents;
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
    }
    else if (employee.statutoryScheme === "epf_my") {
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
    const shgCents = employee.statutoryScheme === "cpf" ? calculateShg(employee.shgFund, Math.round(grossPayCents * fxRateToSgd)) : 0;
    // Reimbursement is added straight onto net pay — it's not remuneration, so it never enters
    // grossPayCents and never affects the CPF/SDL/SHG wage base above. Notice pay and the leave
    // clawback work the same way: they only move net pay, never gross or any statutory wage base.
    const netPayCents = grossPayCents - statutoryEmployeeCents - shgCents + claimsReimbursementCents + noticePayCents - leaveClawbackCents;
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
