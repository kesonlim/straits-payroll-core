/**
 * Skills Development Levy — flat 0.25% of monthly gross wage (OW + AW),
 * min $2, max $11.25 per employee per month. Applies to all employees
 * (citizen, PR, and would apply to work-pass holders too, though this app
 * doesn't handle foreign workers). Rates per SkillsFuture SG / MOM; verify
 * against https://www.skillsfuture.gov.sg/sdl before a real payroll run.
 */
const SDL_RATE_PERCENT = 0.25;
const SDL_MIN_CENTS = 200;
const SDL_MAX_CENTS = 1125;

export function calculateSdl(grossWageCents: number): number {
  // No wages paid this month (e.g. a part-timer who didn't work) means there's no wage base to levy
  // on at all — the $2 minimum only kicks in once *some* wages, however small, were actually paid.
  if (grossWageCents <= 0) return 0;
  const raw = Math.ceil((grossWageCents * SDL_RATE_PERCENT) / 100);
  return Math.min(Math.max(raw, SDL_MIN_CENTS), SDL_MAX_CENTS);
}
