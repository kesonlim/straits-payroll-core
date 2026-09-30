/**
 * Guards for the payroll form inputs shared by the create-run and edit-line-item paths, so both
 * apply exactly the same rules.
 */
export declare function isLeaverForPeriod(lastWorkingDay: string | null, periodEnd: string): boolean;
/** Lieu payout, notice pay and clawback only exist for a leaver; anyone else gets 0. Annual encashment
 * days are deliberately not touched here (year-end encashment is allowed for anyone). */
export declare function settlementInputsFor<T extends {
    lieuPayoutDays: number;
    clawbackDollars: number;
    noticeDollars: number;
}>(isLeaver: boolean, values: T): T;
/** A leaver whose annual leave is marked forfeited can never be paid it out, whatever the form sends. */
export declare function annualEncashDaysFor(leaveForfeited: number | null | undefined, days: number): number;
/** Name of the first field that is non-finite or absurdly large, or null. Number(x) || 0 lets Infinity through. */
export declare function firstInvalidAmount(v: {
    encashDays: number;
    lieuPayoutDays: number;
    clawbackDollars: number;
    noticeDollars: number;
    allowanceDollars: number;
    bonusDollars?: number;
    unpaidDays: number;
}): string | null;
