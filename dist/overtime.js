/**
 * Overtime pay per MOM Employment Act Part IV.
 * Part IV covers: "workmen" earning basic monthly salary <= $4,500,
 * and other (non-workman) employees earning basic monthly salary <= $2,600.
 * Employees outside these thresholds are not statutorily entitled to OT pay
 * under the Act (though a contract may still grant it — out of scope here).
 *
 * Hourly basic rate of pay = (12 x monthly basic rate) / (52 x 44)
 * OT pay = 1.5 x hourly basic rate x OT hours worked
 * OT hours are capped at 72/month by the Act — this function flags the
 * cap rather than silently truncating, so the admin can decide how to
 * handle the excess (the cap is a legal limit, not just a pay formula).
 */
const WORKMAN_THRESHOLD_CENTS = 450_000;
const NON_WORKMAN_THRESHOLD_CENTS = 260_000;
const MONTHLY_OT_HOURS_CAP = 72;
const OT_MULTIPLIER = 1.5;
export function calculateOvertime(input) {
    const { isWorkman, basicMonthlySalaryCents, overtimeHours, hourlyRateOverrideCents } = input;
    const eligible = hourlyRateOverrideCents != null
        ? true
        : basicMonthlySalaryCents <= (isWorkman ? WORKMAN_THRESHOLD_CENTS : NON_WORKMAN_THRESHOLD_CENTS);
    if (!eligible || overtimeHours <= 0) {
        return { eligible, hourlyBasicRateCents: 0, overtimePayCents: 0, exceedsMonthlyCap: false };
    }
    const hourlyBasicRateCents = hourlyRateOverrideCents ?? (12 * basicMonthlySalaryCents) / (52 * 44);
    const exceedsMonthlyCap = overtimeHours > MONTHLY_OT_HOURS_CAP;
    const overtimePayCents = Math.round(hourlyBasicRateCents * OT_MULTIPLIER * overtimeHours);
    return {
        eligible,
        hourlyBasicRateCents: Math.round(hourlyBasicRateCents),
        overtimePayCents,
        exceedsMonthlyCap,
    };
}
