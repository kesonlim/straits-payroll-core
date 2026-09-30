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

interface WageBand {
  maxWageCents: number; // inclusive upper bound; Infinity for the top band
  contributionCents: number;
}

// Each table ordered ascending by wage band; monthly total wages in cents.
const CDAC_BANDS: WageBand[] = [
  { maxWageCents: 200_000, contributionCents: 50 }, // <= $2,000
  { maxWageCents: 350_000, contributionCents: 100 }, // <= $3,500
  { maxWageCents: 500_000, contributionCents: 150 }, // <= $5,000
  { maxWageCents: 750_000, contributionCents: 200 }, // <= $7,500
  { maxWageCents: Infinity, contributionCents: 300 }, // > $7,500
];

const ECF_BANDS: WageBand[] = [
  { maxWageCents: 100_000, contributionCents: 200 }, // <= $1,000
  { maxWageCents: 150_000, contributionCents: 400 }, // <= $1,500
  { maxWageCents: 250_000, contributionCents: 600 }, // <= $2,500
  { maxWageCents: 400_000, contributionCents: 900 }, // <= $4,000
  { maxWageCents: 700_000, contributionCents: 1_200 }, // <= $7,000
  { maxWageCents: 1_000_000, contributionCents: 1_600 }, // <= $10,000
  { maxWageCents: Infinity, contributionCents: 2_000 }, // > $10,000
];

const MBMF_BANDS: WageBand[] = [
  { maxWageCents: 100_000, contributionCents: 300 }, // <= $1,000
  { maxWageCents: 200_000, contributionCents: 450 }, // <= $2,000
  { maxWageCents: 300_000, contributionCents: 650 }, // <= $3,000
  { maxWageCents: 400_000, contributionCents: 1_500 }, // <= $4,000
  { maxWageCents: 600_000, contributionCents: 1_950 }, // <= $6,000
  { maxWageCents: 800_000, contributionCents: 2_200 }, // <= $8,000
  { maxWageCents: 1_000_000, contributionCents: 2_400 }, // <= $10,000
  { maxWageCents: Infinity, contributionCents: 2_600 }, // > $10,000
];

const SINDA_BANDS: WageBand[] = [
  { maxWageCents: 100_000, contributionCents: 100 }, // <= $1,000
  { maxWageCents: 150_000, contributionCents: 300 }, // <= $1,500
  { maxWageCents: 250_000, contributionCents: 500 }, // <= $2,500
  { maxWageCents: 450_000, contributionCents: 700 }, // <= $4,500
  { maxWageCents: 750_000, contributionCents: 900 }, // <= $7,500
  { maxWageCents: 1_000_000, contributionCents: 1_200 }, // <= $10,000
  { maxWageCents: 1_500_000, contributionCents: 1_800 }, // <= $15,000
  { maxWageCents: Infinity, contributionCents: 3_000 }, // > $15,000
];

const TABLES: Record<Exclude<ShgFund, "none">, WageBand[]> = {
  cdac: CDAC_BANDS,
  ecf: ECF_BANDS,
  mbmf: MBMF_BANDS,
  sinda: SINDA_BANDS,
};

export function calculateShg(fund: ShgFund, monthlyTotalWageCents: number): number {
  if (fund === "none") return 0;
  const band = TABLES[fund].find((b) => monthlyTotalWageCents <= b.maxWageCents)!;
  return band.contributionCents;
}
