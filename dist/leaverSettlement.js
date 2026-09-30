import { monthsCompleted, roundToHalfDay } from "./leave";
/**
 * Leave settlement for an employee's final pay (ROADMAP.md item 6). Pure: the caller supplies the
 * entitlement, opening balance and leave used (from balances.server.ts) and per-month daily rates.
 */
function isoDayAfter(dateIso) {
    const d = new Date(`${dateIso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}
/**
 * Past the first year, the app grants the full year's entitlement up front; a leaver has only earned
 * the completed months of the calendar year up to their last day. First-year entitlement is already
 * pro-rated by months of service (proRatedFirstYearEntitlement), so it's returned unchanged.
 */
export function leaverProRatedAnnualEntitlement(input) {
    if (input.inFirstYearOfService)
        return input.fullEntitlement;
    const yearStart = `${input.lastWorkingDay.slice(0, 4)}-01-01`;
    const months = Math.min(monthsCompleted(yearStart, isoDayAfter(input.lastWorkingDay)), 12);
    return roundToHalfDay((input.fullEntitlement * months) / 12);
}
/** Days still owed to (+) or owed by (-) the leaver: the starting point less the unearned part and leave used. */
export function leaverAnnualBalance(input) {
    const base = input.openingBalance ?? input.fullEntitlement;
    return base - (input.fullEntitlement - input.proRatedEntitlement) - input.used;
}
/**
 * Default settlement. MOM: statutory annual leave "can be forfeited" on dismissal for misconduct, so the
 * annual payout defaults to 0 there (an admin can override). Lieu days are days actually worked, so
 * they're paid regardless.
 */
export function settleLeaverLeave(input) {
    const positive = Math.max(input.annualBalance, 0);
    return {
        annualPayoutDays: input.leavingReason === "dismissed_misconduct" ? 0 : positive,
        lieuPayoutDays: Math.max(input.lieuRemaining, 0),
        clawbackDays: Math.max(-input.annualBalance, 0),
    };
}
/**
 * CPF Board: excess leave reduces the wages of the month it was taken. Attribute the clawback to the
 * most recent annual leave first, priced at that month's daily rate, so each month's refund can be
 * claimed from CPF Board. unallocatedDays > 0 means recorded leave didn't cover the clawback, or that
 * days landed in a month with no daily rate on file. A month is never priced at $0 for a missing rate:
 * days attributed to such a month are excluded from `months`, added to `unallocatedDays`, and the
 * month is listed once (most-recent-first) in `missingRateMonths`.
 */
export function allocateClawbackByMonth(input) {
    let remaining = input.clawbackDays;
    const byMonth = new Map();
    const newestFirst = [...input.annualLeaveTaken].sort((a, b) => (a.dateFrom < b.dateFrom ? 1 : a.dateFrom > b.dateFrom ? -1 : 0));
    for (const leave of newestFirst) {
        if (remaining <= 0)
            break;
        const take = Math.min(remaining, leave.days);
        const month = leave.dateFrom.slice(0, 7);
        byMonth.set(month, (byMonth.get(month) ?? 0) + take);
        remaining -= take;
    }
    const months = [];
    const missingRateMonths = [];
    let unpricedDays = 0;
    for (const [month, days] of byMonth.entries()) {
        const rateCents = input.dailyRateCentsByMonth[month];
        if (rateCents === undefined) {
            missingRateMonths.push(month);
            unpricedDays += days;
        }
        else {
            months.push({ month, days, cents: Math.round(days * rateCents) });
        }
    }
    return { months, unallocatedDays: Math.max(remaining, 0) + unpricedDays, missingRateMonths };
}
