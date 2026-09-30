import { describe, it, expect } from "vitest";
import { calculateShg } from "./shg";

describe("calculateShg", () => {
  it("returns 0 for 'none'", () => {
    expect(calculateShg("none", 500_000)).toBe(0);
  });

  it("picks the right CDAC band at the boundary", () => {
    expect(calculateShg("cdac", 200_000)).toBe(50); // exactly $2,000 -> lowest band
    expect(calculateShg("cdac", 200_001)).toBe(100); // one cent over -> next band
    expect(calculateShg("cdac", 10_000_000)).toBe(300); // well above top band
  });

  it("computes SINDA correctly across a few bands", () => {
    expect(calculateShg("sinda", 90_000)).toBe(100); // $900 -> <= $1,000
    expect(calculateShg("sinda", 500_000)).toBe(900); // $5,000 -> <= $7,500
    expect(calculateShg("sinda", 2_000_000)).toBe(3_000); // $20,000 -> top band
  });

  it("computes MBMF and ECF at a mid band", () => {
    expect(calculateShg("mbmf", 350_000)).toBe(1_500); // $3,500 -> <= $4,000
    expect(calculateShg("ecf", 300_000)).toBe(900); // $3,000 -> <= $4,000
  });
});
