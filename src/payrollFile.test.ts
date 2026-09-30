import { describe, it, expect } from "vitest";
import {
  bicForBankCode,
  normaliseAccountNumber,
  findPayrollFileProblems,
  buildDbsPayrollFile,
  UFF_COLUMN_COUNT,
  type DbsPayrollRow,
} from "./payrollFile";

const row = (overrides: Partial<DbsPayrollRow> = {}): DbsPayrollRow => ({
  full_name: "Tan Mei Ling",
  bank_account_number: "0123456789",
  bank_code: "7171",
  net_pay_cents: 312345,
  ...overrides,
});

const baseInput = {
  orgId: "TESTORG01",
  originatingAccount: "0000000000",
  runId: 42,
  periodEnd: "2026-09-30",
  paymentDate: "2026-09-30",
  fileCreationDate: "28092026",
};

describe("bicForBankCode", () => {
  it("maps ABS participating-GIRO bank codes to their SWIFT BIC", () => {
    expect(bicForBankCode("7171")).toBe("DBSSSGSGXXX");
    expect(bicForBankCode("7339")).toBe("OCBCSGSGXXX");
    expect(bicForBankCode("7375")).toBe("UOVBSGSGXXX");
    expect(bicForBankCode(" 9548 ")).toBe("HSBCSGS2XXX");
  });

  it("returns null for an unknown code rather than guessing", () => {
    expect(bicForBankCode("7144")).toBeNull();
    expect(bicForBankCode("")).toBeNull();
    expect(bicForBankCode(null)).toBeNull();
  });
});

describe("normaliseAccountNumber", () => {
  it("strips spaces and hyphens only", () => {
    expect(normaliseAccountNumber("550-123456-789")).toBe("550123456789");
    expect(normaliseAccountNumber(" 012 345 6789 ")).toBe("0123456789");
  });

  it("returns null if anything other than digits remains", () => {
    expect(normaliseAccountNumber("55O123456789")).toBeNull();
    expect(normaliseAccountNumber("")).toBeNull();
  });
});

describe("findPayrollFileProblems", () => {
  it("accepts a 12-digit OCBC account (ABS memo, 23 Mar 2015: OCBC is 10 or 12 digits)", () => {
    expect(findPayrollFileProblems([row({ bank_code: "7339", bank_account_number: "550123456789" })])).toEqual([]);
  });

  it("flags an unknown bank code and a malformed account number, naming the employee", () => {
    const problems = findPayrollFileProblems([
      row({ full_name: "Alpha", bank_code: "7144" }),
      row({ full_name: "Bravo", bank_account_number: "12-34X" }),
    ]);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain("Alpha");
    expect(problems[1]).toContain("Bravo");
  });

  it("refuses a negative net pay rather than emitting it", () => {
    const problems = findPayrollFileProblems([row({ full_name: "Charlie", net_pay_cents: -100 })]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("Charlie");
    expect(problems[0]).toMatch(/negative/);
  });
});

describe("buildDbsPayrollFile", () => {
  const file = buildDbsPayrollFile({
    ...baseInput,
    rows: [
      row(),
      row({
        full_name: "Lee, Wei Jie Benjamin Alexander Tan Junior",
        bank_code: "7339",
        bank_account_number: "550-123456-789",
        net_pay_cents: 100000,
      }),
    ],
  });
  const lines = file.split("\r\n");
  const cols = lines.map((l) => l.split(","));

  it("uses CRLF and pads every record to the template's 68 columns", () => {
    expect(lines).toHaveLength(4);
    for (const c of cols) expect(c).toHaveLength(UFF_COLUMN_COUNT);
  });

  it("writes the header and trailer", () => {
    expect(cols[0].slice(0, 5)).toEqual(["HEADER", "28092026", "TESTORG01", "Being Kids Pte Ltd", "UFFv2"]);
    expect(cols[3].slice(0, 3)).toEqual(["TRAILER", "2", "4123.45"]);
  });

  it("routes by SWIFT BIC (D21) with bank/branch code (D18/D19) blank, like DBS's template", () => {
    const d = cols[2];
    expect(d[17]).toBe(""); // D18
    expect(d[18]).toBe(""); // D19
    expect(d[20]).toBe("OCBCSGSGXXX"); // D21
  });

  it("fills the template's payroll fields", () => {
    const d = cols[1];
    expect(d[0]).toBe("PAYMENT");
    expect(d[1]).toBe("SAL");
    expect(d[2]).toBe("0000000000"); // D03
    expect(d[4]).toBe("SAL RUN 42"); // D05 batch reference
    expect(d[6]).toBe(""); // D07 batch ID: left for DBS to assign (must never repeat)
    expect(d[7]).toBe("30092026"); // D08
    expect(d[15]).toBe("0123456789"); // D16
    expect(d[20]).toBe("DBSSSGSGXXX"); // D21
    expect(d[27]).toBe("3123.45"); // D28
    expect(d[32]).toBe("22"); // D33
    expect(d[33]).toBe("BEING KIDS SALARY SEP 2026"); // D34
    expect(d[42]).toBe("SALA"); // D43 purpose of payment
  });

  it("keeps a 12-digit account whole, strips commas from names and caps them at 35 chars", () => {
    const d = cols[2];
    expect(d[15]).toBe("550123456789");
    expect(d[10]).toBe("Lee Wei Jie Benjamin Alexander Tan");
  });
});
