import { describe, it, expect } from "vitest";
import { calculateOvertime } from "./overtime";

describe("calculateOvertime", () => {
  it("is ineligible for non-workman above $2,600 basic", () => {
    const result = calculateOvertime({ isWorkman: false, basicMonthlySalaryCents: 300_000, overtimeHours: 10 });
    expect(result.eligible).toBe(false);
    expect(result.overtimePayCents).toBe(0);
  });

  it("computes OT pay for an eligible non-workman", () => {
    // basic $2,600 -> hourly = 12*2600/(52*44) = 31200/2288 = 13.636...
    const result = calculateOvertime({ isWorkman: false, basicMonthlySalaryCents: 260_000, overtimeHours: 10 });
    expect(result.eligible).toBe(true);
    expect(result.hourlyBasicRateCents).toBe(1364); // rounded
    expect(result.overtimePayCents).toBeCloseTo(20455, -1);
  });

  it("flags when OT hours exceed the 72-hour monthly cap", () => {
    const result = calculateOvertime({ isWorkman: true, basicMonthlySalaryCents: 400_000, overtimeHours: 80 });
    expect(result.exceedsMonthlyCap).toBe(true);
  });

  it("workman threshold is higher than non-workman", () => {
    const workman = calculateOvertime({ isWorkman: true, basicMonthlySalaryCents: 400_000, overtimeHours: 5 });
    expect(workman.eligible).toBe(true);
  });

  it("uses an hourly rate override directly for hourly-paid employees, always eligible", () => {
    const result = calculateOvertime({
      isWorkman: false,
      basicMonthlySalaryCents: 0,
      overtimeHours: 10,
      hourlyRateOverrideCents: 2_000, // $20/hr
    });
    expect(result.eligible).toBe(true);
    expect(result.hourlyBasicRateCents).toBe(2_000);
    expect(result.overtimePayCents).toBe(30_000); // 1.5 x $20 x 10
  });
});
