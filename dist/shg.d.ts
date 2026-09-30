/**
 * Self-Help Group (SHG) contributions — CDAC, SINDA, MBMF (Mosque Building and Mendaki Fund), and ECF
 * (Eurasian Community Fund). Collected alongside CPF for Singapore citizens/PRs, entirely employee-paid,
 * opt-out (an employee can decline — this app models that as `shg_fund: 'none'`, the default for
 * everyone until an admin sets otherwise).
 *
 * Rate tables below were fetched 2026-08-14 from CPF Board's own "Contributions to self-help groups"
 * employer page (cpf.gov.sg/employer/employer-obligations/contributions-to-self-help-groups) via an
 * automated fetch — not read directly off a downloaded PDF the way cpf.ts's table was. Spot-check the
 * live page once more before relying on this for a real deduction, same "verify before trusting a real
 * payment" rule as everywhere else in this app. Each fund revises its rates independently and
 * infrequently (not necessarily every January like CPF) — re-check when in doubt, not on a fixed schedule.
 *
 * Only meaningful for employees on the Singapore CPF scheme — foreigners (EPF or no scheme) aren't part
 * of this system at all, enforced in calculate.ts, not just left to the caller to remember.
 */
export type ShgFund = "none" | "cdac" | "sinda" | "mbmf" | "ecf";
export declare function calculateShg(fund: ShgFund, monthlyTotalWageCents: number): number;
