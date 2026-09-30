/**
 * Malaysia EPF (Employees Provident Fund) contribution, for foreign employees
 * on the Malaysia EPF scheme instead of Singapore CPF.
 *
 * Rates transcribed from Being Kids' own payroll spreadsheet (Farah Wahidah
 * Binti Ahmad Sukri's payslip template, confirmed 2026-08-14): Employer 13%,
 * Employee 11%, applied as a straight percentage of gross wages with no
 * ceiling. This matches the company's own template exactly, but is *not*
 * the official KWSP contribution rate table (which uses fixed wage-band
 * amounts with small roundings, not a flat percentage) — fine for Being
 * Kids' one MY-payroll case; re-verify against the KWSP table
 * (https://www.kwsp.gov.my) before relying on it beyond that.
 */

export const EPF_MY_EMPLOYER_PERCENT = 13;
export const EPF_MY_EMPLOYEE_PERCENT = 11;

export interface EpfMyResult {
  employeeCents: number;
  employerCents: number;
}

export function calculateEpfMy(grossWageCents: number): EpfMyResult {
  return {
    employeeCents: Math.round((grossWageCents * EPF_MY_EMPLOYEE_PERCENT) / 100),
    employerCents: Math.round((grossWageCents * EPF_MY_EMPLOYER_PERCENT) / 100),
  };
}
