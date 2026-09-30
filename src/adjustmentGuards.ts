/**
 * Guards for the payroll form inputs shared by the create-run and edit-line-item paths, so both
 * apply exactly the same rules.
 */

export function isLeaverForPeriod(lastWorkingDay: string | null, periodEnd: string): boolean {
  return !!lastWorkingDay && lastWorkingDay <= periodEnd;
}

/** Lieu payout, notice pay and clawback only exist for a leaver; anyone else gets 0. Annual encashment
 * days are deliberately not touched here (year-end encashment is allowed for anyone). */
export function settlementInputsFor<T extends { lieuPayoutDays: number; clawbackDollars: number; noticeDollars: number }>(
  isLeaver: boolean,
  values: T
): T {
  return isLeaver ? values : { ...values, lieuPayoutDays: 0, clawbackDollars: 0, noticeDollars: 0 };
}

/** A leaver whose annual leave is marked forfeited can never be paid it out, whatever the form sends. */
export function annualEncashDaysFor(leaveForfeited: number | null | undefined, days: number): number {
  return leaveForfeited ? 0 : days;
}

const MAX_DAYS = 366;
const MAX_DOLLARS = 1_000_000;

/** Name of the first field that is non-finite or absurdly large, or null. Number(x) || 0 lets Infinity through. */
export function firstInvalidAmount(v: {
  encashDays: number;
  lieuPayoutDays: number;
  clawbackDollars: number;
  noticeDollars: number;
  allowanceDollars: number;
  bonusDollars?: number;
  unpaidDays: number;
}): string | null {
  const days: [string, number][] = [
    ["encashment days", v.encashDays],
    ["lieu payout days", v.lieuPayoutDays],
    ["unpaid days", v.unpaidDays],
  ];
  for (const [name, n] of days) if (!Number.isFinite(n) || n > MAX_DAYS) return name;
  const dollars: [string, number, number][] = [
    ["leave clawback", v.clawbackDollars, Math.abs(v.clawbackDollars)],
    ["notice pay", v.noticeDollars, Math.abs(v.noticeDollars)],
    ["allowance", v.allowanceDollars, v.allowanceDollars],
    ["bonus", v.bonusDollars ?? 0, v.bonusDollars ?? 0],
  ];
  for (const [name, n, magnitude] of dollars) if (!Number.isFinite(n) || magnitude > MAX_DOLLARS) return name;
  if ((v.bonusDollars ?? 0) < 0) return "bonus";
  return null;
}
