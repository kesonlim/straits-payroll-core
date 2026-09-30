export declare function roundToHalfDay(days: number): number;
/** Full annual entitlement for the leave-year containing onDateIso. */
export declare function annualLeaveEntitlement(dateJoinedIso: string, onDateIso: string): number;
export declare function monthsCompleted(dateJoinedIso: string, onDateIso: string): number;
/**
 * Pro-rated entitlement for an employee still in their first year of service,
 * based on completed months worked so far. Employees past year 1 get the
 * full entitlement for their service-year (no monthly proration).
 */
export declare function proRatedFirstYearEntitlement(dateJoinedIso: string, onDateIso: string): number;
/**
 * Statutory paid outpatient sick leave per MOM Employment Act s.89, for
 * employees with >= 3 months of service. Tiered by completed months of
 * service (not pro-rated within a tier). Does not cover hospitalisation
 * leave (a separate, larger entitlement) — out of scope for this app.
 */
export declare function medicalLeaveEntitlement(dateJoinedIso: string, onDateIso: string): number;
/**
 * Childcare leave per MOM: 6 days/year for a working parent with a Singapore Citizen child under 7,
 * with >=3 months of service. Per-parent, not per-child. Returns 0 (not an error) when the child isn't
 * in the qualifying age band or service is too short — a legitimate "N/A"-shaped zero, same pattern as
 * medicalLeaveEntitlement() before the 3-month mark.
 */
export declare function childcareLeaveEntitlement(dateJoinedIso: string, childDateOfBirthIso: string | null, onDateIso: string): number;
/**
 * Extended Childcare leave per MOM: 2 days/year (separate from the 6-day pool above) for a Singapore
 * Citizen child aged 7 to under 13, same >=3-month service requirement.
 */
export declare function extendedChildcareLeaveEntitlement(dateJoinedIso: string, childDateOfBirthIso: string | null, onDateIso: string): number;
/**
 * Daily gross rate of pay used for both unpaid-leave deduction and leave
 * encashment, per MOM's formula: gross rate of pay / working days in the
 * period. "Gross rate of pay" for this purpose is basic pay plus fixed
 * allowances — commission and OT are excluded as they're variable.
 * Working days = weekdays (Mon-Fri) in the period; this MVP does not
 * account for public holidays or a company-specific work week.
 */
export declare function workingDaysInPeriod(periodStartIso: string, periodEndIso: string): number;
export declare function dailyGrossRateCents(basicMonthlySalaryCents: number, workingDaysThisPeriod: number): number;
export declare function unpaidLeaveDeductionCents(dailyRateCents: number, unpaidDays: number): number;
export declare function leaveEncashmentPayCents(dailyRateCents: number, encashedDays: number): number;
/**
 * Off-in-lieu credits expire 6 months (2 quarters) after the date they were earned, per the owner's
 * policy (2026-08-28) — a company benefit, not a statutory one, so this figure is ours to define. Uses
 * `setUTCMonth` rather than day-arithmetic so a credit earned on the last day of a shorter month still
 * lands on a sensible date 6 months out (JS Date normalizes an out-of-range day into the next month).
 */
export declare function lieuCreditExpiryDate(earnedDateIso: string): string;
