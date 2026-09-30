/**
 * Statutory annual leave per MOM Employment Act (the floor for Part IV
 * covered employees — workmen <= $4,500/month basic, other employees
 * <= $2,600/month basic). Applied here as the default entitlement for all
 * employees; override in the employee record if a contract grants more.
 */
const ENTITLEMENT_BY_YEAR_OF_SERVICE = {
    1: 7,
    2: 8,
    3: 9,
    4: 10,
    5: 11,
    6: 12,
    7: 13,
};
const MAX_ENTITLEMENT = 14; // year 8+
function completedYearsOfService(dateJoinedIso, onDateIso) {
    const joined = new Date(dateJoinedIso);
    const on = new Date(onDateIso);
    let years = on.getFullYear() - joined.getFullYear();
    const hadAnniversary = on.getMonth() > joined.getMonth() ||
        (on.getMonth() === joined.getMonth() && on.getDate() >= joined.getDate());
    if (!hadAnniversary)
        years--;
    return Math.max(years, 0);
}
// Rounds to the nearest half day (e.g. 2.33 -> 2.5, 2.2 -> 2). Owner's decision (2026-09-29) to keep
// half-day granularity rather than MOM's whole-day rounding convention.
export function roundToHalfDay(days) {
    return Math.round(days * 2) / 2;
}
/** Full annual entitlement for the leave-year containing onDateIso. */
export function annualLeaveEntitlement(dateJoinedIso, onDateIso) {
    const completedYears = completedYearsOfService(dateJoinedIso, onDateIso);
    const currentServiceYear = completedYears + 1; // the leave-year in progress
    if (currentServiceYear >= 8)
        return MAX_ENTITLEMENT;
    if (currentServiceYear < 1)
        return 0;
    return ENTITLEMENT_BY_YEAR_OF_SERVICE[currentServiceYear];
}
export function monthsCompleted(dateJoinedIso, onDateIso) {
    const joined = new Date(dateJoinedIso);
    const on = new Date(onDateIso);
    return Math.max((on.getFullYear() - joined.getFullYear()) * 12 +
        (on.getMonth() - joined.getMonth()) -
        (on.getDate() < joined.getDate() ? 1 : 0), 0);
}
/**
 * Pro-rated entitlement for an employee still in their first year of service,
 * based on completed months worked so far. Employees past year 1 get the
 * full entitlement for their service-year (no monthly proration).
 */
export function proRatedFirstYearEntitlement(dateJoinedIso, onDateIso) {
    const fullFirstYearEntitlement = ENTITLEMENT_BY_YEAR_OF_SERVICE[1];
    const months = Math.min(monthsCompleted(dateJoinedIso, onDateIso), 12);
    return roundToHalfDay((fullFirstYearEntitlement * months) / 12);
}
/**
 * Statutory paid outpatient sick leave per MOM Employment Act s.89, for
 * employees with >= 3 months of service. Tiered by completed months of
 * service (not pro-rated within a tier). Does not cover hospitalisation
 * leave (a separate, larger entitlement) — out of scope for this app.
 */
export function medicalLeaveEntitlement(dateJoinedIso, onDateIso) {
    const months = monthsCompleted(dateJoinedIso, onDateIso);
    if (months >= 6)
        return 14;
    if (months >= 5)
        return 11;
    if (months >= 4)
        return 8;
    if (months >= 3)
        return 5;
    return 0;
}
function ageOnDate(dobIso, onDateIso) {
    const dob = new Date(dobIso);
    const on = new Date(onDateIso);
    let age = on.getFullYear() - dob.getFullYear();
    const hadBirthday = on.getMonth() > dob.getMonth() || (on.getMonth() === dob.getMonth() && on.getDate() >= dob.getDate());
    if (!hadBirthday)
        age--;
    return age;
}
/**
 * Age used for both childcare leave pools, taken as at 1 Jan of the leave-year — so a child turning 7
 * (or 13) partway through the year still qualifies for that whole year, matching how MOM administers
 * this (an in-year birthday doesn't mid-year disqualify).
 */
function ageAtStartOfYear(dobIso, onDateIso) {
    return ageOnDate(dobIso, `${onDateIso.slice(0, 4)}-01-01`);
}
/**
 * Childcare leave per MOM: 6 days/year for a working parent with a Singapore Citizen child under 7,
 * with >=3 months of service. Per-parent, not per-child. Returns 0 (not an error) when the child isn't
 * in the qualifying age band or service is too short — a legitimate "N/A"-shaped zero, same pattern as
 * medicalLeaveEntitlement() before the 3-month mark.
 */
export function childcareLeaveEntitlement(dateJoinedIso, childDateOfBirthIso, onDateIso) {
    if (!childDateOfBirthIso)
        return 0;
    if (monthsCompleted(dateJoinedIso, onDateIso) < 3)
        return 0;
    return ageAtStartOfYear(childDateOfBirthIso, onDateIso) < 7 ? 6 : 0;
}
/**
 * Extended Childcare leave per MOM: 2 days/year (separate from the 6-day pool above) for a Singapore
 * Citizen child aged 7 to under 13, same >=3-month service requirement.
 */
export function extendedChildcareLeaveEntitlement(dateJoinedIso, childDateOfBirthIso, onDateIso) {
    if (!childDateOfBirthIso)
        return 0;
    if (monthsCompleted(dateJoinedIso, onDateIso) < 3)
        return 0;
    const age = ageAtStartOfYear(childDateOfBirthIso, onDateIso);
    return age >= 7 && age < 13 ? 2 : 0;
}
/**
 * Daily gross rate of pay used for both unpaid-leave deduction and leave
 * encashment, per MOM's formula: gross rate of pay / working days in the
 * period. "Gross rate of pay" for this purpose is basic pay plus fixed
 * allowances — commission and OT are excluded as they're variable.
 * Working days = weekdays (Mon-Fri) in the period; this MVP does not
 * account for public holidays or a company-specific work week.
 */
export function workingDaysInPeriod(periodStartIso, periodEndIso) {
    const start = new Date(periodStartIso);
    const end = new Date(periodEndIso);
    let count = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const day = d.getDay();
        if (day !== 0 && day !== 6)
            count++;
    }
    return count;
}
export function dailyGrossRateCents(basicMonthlySalaryCents, workingDaysThisPeriod) {
    if (workingDaysThisPeriod <= 0)
        return 0;
    return basicMonthlySalaryCents / workingDaysThisPeriod;
}
export function unpaidLeaveDeductionCents(dailyRateCents, unpaidDays) {
    return Math.round(dailyRateCents * unpaidDays);
}
export function leaveEncashmentPayCents(dailyRateCents, encashedDays) {
    return Math.round(dailyRateCents * encashedDays);
}
/**
 * Off-in-lieu credits expire 6 months (2 quarters) after the date they were earned, per the owner's
 * policy (2026-08-28) — a company benefit, not a statutory one, so this figure is ours to define. Uses
 * `setUTCMonth` rather than day-arithmetic so a credit earned on the last day of a shorter month still
 * lands on a sensible date 6 months out (JS Date normalizes an out-of-range day into the next month).
 */
export function lieuCreditExpiryDate(earnedDateIso) {
    const d = new Date(`${earnedDateIso}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 6);
    return d.toISOString().slice(0, 10);
}
