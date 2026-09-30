import { describe, it, expect } from "vitest";
import { calculateEpfMy } from "./epfMy";

describe("calculateEpfMy", () => {
  it("computes 13% employer, 11% employee on gross wages", () => {
    const result = calculateEpfMy(260_000); // RM 2,600
    expect(result.employerCents).toBe(33_800); // RM 338
    expect(result.employeeCents).toBe(28_600); // RM 286
  });

  it("rounds to the nearest cent", () => {
    const result = calculateEpfMy(100_001); // RM 1,000.01
    expect(result.employerCents).toBe(13_000); // 13,000.13 -> 13,000
    expect(result.employeeCents).toBe(11_000); // 11,000.11 -> 11,000
  });
});
