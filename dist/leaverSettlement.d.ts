/**
 * Past the first year, the app grants the full year's entitlement up front; a leaver has only earned
 * the completed months of the calendar year up to their last day. First-year entitlement is already
 * pro-rated by months of service (proRatedFirstYearEntitlement), so it's returned unchanged.
 */
export declare function leaverProRatedAnnualEntitlement(input: {
    fullEntitlement: number;
    lastWorkingDay: string;
    inFirstYearOfService: boolean;
}): number;
/** Days still owed to (+) or owed by (-) the leaver: the starting point less the unearned part and leave used. */
export declare function leaverAnnualBalance(input: {
    fullEntitlement: number;
    proRatedEntitlement: number;
    openingBalance: number | null;
    used: number;
}): number;
/**
 * Default settlement. MOM: statutory annual leave "can be forfeited" on dismissal for misconduct, so the
 * annual payout defaults to 0 there (an admin can override). Lieu days are days actually worked, so
 * they're paid regardless.
 */
export declare function settleLeaverLeave(input: {
    annualBalance: number;
    lieuRemaining: number;
    leavingReason: string | null;
}): {
    annualPayoutDays: number;
    lieuPayoutDays: number;
    clawbackDays: number;
};
/**
 * CPF Board: excess leave reduces the wages of the month it was taken. Attribute the clawback to the
 * most recent annual leave first, priced at that month's daily rate, so each month's refund can be
 * claimed from CPF Board. unallocatedDays > 0 means recorded leave didn't cover the clawback, or that
 * days landed in a month with no daily rate on file. A month is never priced at $0 for a missing rate:
 * days attributed to such a month are excluded from `months`, added to `unallocatedDays`, and the
 * month is listed once (most-recent-first) in `missingRateMonths`.
 */
export declare function allocateClawbackByMonth(input: {
    clawbackDays: number;
    annualLeaveTaken: {
        dateFrom: string;
        days: number;
    }[];
    dailyRateCentsByMonth: Record<string, number>;
}): {
    months: {
        month: string;
        days: number;
        cents: number;
    }[];
    unallocatedDays: number;
    missingRateMonths: string[];
};
