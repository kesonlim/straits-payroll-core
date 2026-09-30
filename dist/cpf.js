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
export const OW_CEILING_CENTS = 800_000; // $8,000/month, effective 1 Jan 2026
/** CPF's annual Additional Wage ceiling is this total-wage figure minus the year's Ordinary Wages
 * subject to CPF (so for an employee on $3,500/month all year, the AW ceiling is $102,000 - $42,000). */
export const ANNUAL_TOTAL_WAGE_CEILING_CENTS = 10_200_000; // $102,000
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
export function additionalWageCeilingCents(input) {
    return Math.max(ANNUAL_TOTAL_WAGE_CEILING_CENTS - input.ytdOrdinaryWageCents - input.remainingOrdinaryWageCents - input.ytdAdditionalWageCents, 0);
}
// Table 1: Citizen / PR-3rd-year+ rates, all wage bands.
const CITIZEN_RATE_BANDS = [
    { maxAge: 55, lowWagePercent: 17, phasedEmployeeRate: 0.6, totalPercent: 37, employeePercent: 20 },
    { maxAge: 60, lowWagePercent: 16, phasedEmployeeRate: 0.54, totalPercent: 34, employeePercent: 18 },
    { maxAge: 65, lowWagePercent: 12.5, phasedEmployeeRate: 0.375, totalPercent: 25, employeePercent: 12.5 },
    { maxAge: 70, lowWagePercent: 9, phasedEmployeeRate: 0.225, totalPercent: 16.5, employeePercent: 7.5 },
    { maxAge: Infinity, lowWagePercent: 7.5, phasedEmployeeRate: 0.15, totalPercent: 12.5, employeePercent: 5 },
];
/**
 * Table 2/3: Graduated contribution rates (G/G) for 1st/2nd year SPRs — this
 * is what applies automatically, with no joint application needed. (An
 * employer and 1st/2nd-year PR employee can jointly apply to CPF Board for
 * higher rates instead — either Full-Employer/Graduated-Employee (Tables 4/5)
 * or Full/Full (Table 1) — which this app does not implement, see module doc;
 * if Being Kids has such an application on file for an employee, compute that
 * employee's CPF manually against the CPF Board calculator.)
 */
const PR_YEAR1_BANDS = [
    { maxAge: 60, lowWagePercent: 4, phasedEmployeeRate: 0.15, totalPercent: 9, employeePercent: 5 },
    { maxAge: Infinity, lowWagePercent: 3.5, phasedEmployeeRate: 0.15, totalPercent: 8.5, employeePercent: 5 },
];
const PR_YEAR2_BANDS = [
    { maxAge: 55, lowWagePercent: 9, phasedEmployeeRate: 0.45, totalPercent: 24, employeePercent: 15 },
    { maxAge: 60, lowWagePercent: 6, phasedEmployeeRate: 0.375, totalPercent: 18.5, employeePercent: 12.5 },
    { maxAge: 65, lowWagePercent: 3.5, phasedEmployeeRate: 0.225, totalPercent: 11, employeePercent: 7.5 },
    { maxAge: Infinity, lowWagePercent: 3.5, phasedEmployeeRate: 0.15, totalPercent: 8.5, employeePercent: 5 },
];
function roundHalfUp(cents) {
    return Math.round(cents / 100) * 100;
}
function roundDown(cents) {
    return Math.floor(cents / 100) * 100;
}
/**
 * Per CPF Board's stated algorithm: round the total contribution to the
 * nearest dollar (half rounds up), round the employee's share DOWN to the
 * nearest dollar, then derive the employer's share by subtraction — not by
 * independently rounding the employer's share.
 */
function splitCpf(cappedWageCents, totalPercent, employeePercent) {
    const totalCents = roundHalfUp((cappedWageCents * totalPercent) / 100);
    const employeeCents = roundDown((cappedWageCents * employeePercent) / 100);
    return { employeeCents, employerCents: totalCents - employeeCents };
}
const LOW_WAGE_NIL_CENTS = 5_000; // $50 or less: no contribution at all
const PHASED_BAND_START_CENTS = 50_000; // > $50 to $500: employer-only
const PHASED_BAND_END_CENTS = 75_000; // > $500 to $750: phased employee share
/** Computes CPF for one age band across all four wage sub-bands ($50-, $50-500, $500-750, >750), picked by total wages (OW + AW). */
function computeFromBand(band, ordinaryWageCents, additionalWageCents) {
    const totalWageCents = ordinaryWageCents + additionalWageCents;
    if (totalWageCents <= LOW_WAGE_NIL_CENTS) {
        return { employeeCents: 0, employerCents: 0 };
    }
    if (totalWageCents <= PHASED_BAND_START_CENTS) {
        const totalCents = roundHalfUp((totalWageCents * band.lowWagePercent) / 100);
        return { employeeCents: 0, employerCents: totalCents };
    }
    if (totalWageCents <= PHASED_BAND_END_CENTS) {
        const excessCents = totalWageCents - PHASED_BAND_START_CENTS;
        const totalCents = roundHalfUp((totalWageCents * band.lowWagePercent) / 100 + excessCents * band.phasedEmployeeRate);
        const employeeCents = roundDown(excessCents * band.phasedEmployeeRate);
        return { employeeCents, employerCents: totalCents - employeeCents };
    }
    const cappedWageCents = Math.min(ordinaryWageCents, OW_CEILING_CENTS) + additionalWageCents;
    return splitCpf(cappedWageCents, band.totalPercent, band.employeePercent);
}
export function calculateCpf(input) {
    const { ageAtPayment, citizenshipStatus, prYearsSinceConversion, ordinaryWageCents, additionalWageCents = 0 } = input;
    if (citizenshipStatus === "foreigner") {
        return { employeeCents: 0, employerCents: 0 };
    }
    const isPrEarlyYears = citizenshipStatus === "pr" && prYearsSinceConversion !== null && prYearsSinceConversion < 3;
    if (isPrEarlyYears) {
        const bands = prYearsSinceConversion === 1 ? PR_YEAR1_BANDS : PR_YEAR2_BANDS;
        const band = bands.find((b) => ageAtPayment <= b.maxAge);
        return computeFromBand(band, ordinaryWageCents, additionalWageCents);
    }
    const band = CITIZEN_RATE_BANDS.find((b) => ageAtPayment <= b.maxAge);
    return computeFromBand(band, ordinaryWageCents, additionalWageCents);
}
export function ageAt(dateOfBirthIso, onDateIso) {
    const dob = new Date(dateOfBirthIso);
    const on = new Date(onDateIso);
    let age = on.getFullYear() - dob.getFullYear();
    const hasHadBirthdayThisYear = on.getMonth() > dob.getMonth() ||
        (on.getMonth() === dob.getMonth() && on.getDate() >= dob.getDate());
    if (!hasHadBirthdayThisYear)
        age--;
    return age;
}
export function prYearsSinceConversion(prStartDateIso, onDateIso) {
    if (!prStartDateIso)
        return null;
    const start = new Date(prStartDateIso);
    const on = new Date(onDateIso);
    const years = on.getFullYear() - start.getFullYear() -
        (on.getMonth() < start.getMonth() ||
            (on.getMonth() === start.getMonth() && on.getDate() < start.getDate())
            ? 1
            : 0);
    return Math.max(years + 1, 1); // "year 1" = the 12 months from conversion
}
