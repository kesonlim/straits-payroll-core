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
export interface OvertimeInput {
    isWorkman: boolean;
    basicMonthlySalaryCents: number;
    overtimeHours: number;
    /** Set only for hourly-paid employees — their own hourly rate is used directly as the Part IV
     * "hourly basic rate of pay" instead of deriving one from a monthly salary they don't have. Hourly
     * employees are treated as always OT-eligible (they're paid by the hour, so the $2,600/$4,500
     * monthly-salary threshold this Act uses doesn't meaningfully apply to them). */
    hourlyRateOverrideCents?: number;
}
export interface OvertimeResult {
    eligible: boolean;
    hourlyBasicRateCents: number;
    overtimePayCents: number;
    exceedsMonthlyCap: boolean;
}
export declare function calculateOvertime(input: OvertimeInput): OvertimeResult;
