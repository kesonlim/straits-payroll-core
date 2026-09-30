/**
 * CPF contribution calculation for Ordinary and Additional Wages.
 *
 * Rates and rounding rules below are transcribed from CPF Board's official
 * "CPF Contribution Rate Table from 1 January 2026" (Tables 1-3), fetched
 * directly from cpf.gov.sg on 2026-08-09, and re-fetched + re-verified
 * 2026-08-15 specifically for the sub-$750 bands (Table 1-3's "$50 or less",
 * "> $50 to $500", and "> $500 to $750" rows, which were previously missing):
 * https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFcontributionratesfrom1Jan2026.pdf
 * CPF Board revises rates most years (effective each 1 January) — re-fetch
 * and re-check this table against the current official one before trusting
 * a real payment run in a later year.
 *
 * Scope covers what Being Kids' roster needs: Singapore Citizens and PRs
 * (3rd year onward, i.e. citizen-equivalent rates) at any wage/age band in
 * Table 1, and 1st/2nd-year PRs under the automatic Graduated/Graduated
 * rates (Tables 2-3) at any wage/age band. Not implemented: the joint-
 * application Full-Employer/Graduated-Employee or Full/Full rates for 1st-
 * /2nd-year PRs (Tables 4-5) — these require an employer-employee joint
 * application to CPF Board, so calculateCpf throws rather than assume a
 * rate Being Kids may not actually have on file; compute manually against
 * the CPF Board calculator if such an application exists for an employee.
 *
 * Foreigners (work-pass holders) are not CPF members at all — CPF Act only
 * covers Singapore Citizens and PRs — so calculateCpf short-circuits to
 * zero for them before any of the above bands apply. SDL still applies to
 * foreign employees (see sdl.ts), this exemption is CPF-only.
 */
export declare const OW_CEILING_CENTS = 800000;
/** CPF's annual Additional Wage ceiling is this total-wage figure minus the year's Ordinary Wages
 * subject to CPF (so for an employee on $3,500/month all year, the AW ceiling is $102,000 - $42,000). */
export declare const ANNUAL_TOTAL_WAGE_CEILING_CENTS = 10200000;
/**
 * The remaining Additional Wage headroom for this calendar year: $102,000 minus Ordinary Wages
 * subject to CPF (year-to-date and still expected) minus Additional Wages already paid this year.
 *
 * ytdOrdinaryWageCents must be OW *subject to CPF* — i.e. each month's contribution already capped
 * at OW_CEILING_CENTS, excluding any Additional Wages, and excluding the current run (that run's OW
 * belongs in remainingOrdinaryWageCents, or is otherwise accounted for by the caller).
 * remainingOrdinaryWageCents is the OW still expected this year after the current month: 0 for a
 * leaver's final month, per CPF's cessation rule.
 */
export declare function additionalWageCeilingCents(input: {
    ytdOrdinaryWageCents: number;
    remainingOrdinaryWageCents: number;
    ytdAdditionalWageCents: number;
}): number;
export type CitizenshipStatus = "citizen" | "pr" | "foreigner";
export interface CpfInput {
    ageAtPayment: number;
    citizenshipStatus: CitizenshipStatus;
    prYearsSinceConversion: number | null;
    ordinaryWageCents: number;
    /** Additional Wages this month (e.g. leave encashment). Not subject to the monthly OW ceiling; the
     * caller is responsible for keeping it within additionalWageCeilingCents(). Defaults to 0. */
    additionalWageCents?: number;
}
export interface CpfResult {
    employeeCents: number;
    employerCents: number;
}
export declare function calculateCpf(input: CpfInput): CpfResult;
export declare function ageAt(dateOfBirthIso: string, onDateIso: string): number;
export declare function prYearsSinceConversion(prStartDateIso: string | null, onDateIso: string): number | null;
