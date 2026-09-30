# Straits Payroll Core 🇸🇬

Production-tested, pure TypeScript Singapore statutory payroll calculation engine and banking formats.

Shared core engine powering **Being Kids HR** and **Straits HR**.

## Features

- **Singapore CPF Engine (`cpf.ts`)**:
  - Full age-tier contribution rates (≤55, 55–60, 60–65, 65–70, >70).
  - Permanent Resident year-graduated rates (PR Year 1, Year 2, Year 3+).
  - Monthly Ordinary Wage (OW) ceiling and annual Additional Wage (AW) ceiling calculation.
  - Bonus and leave encashment AW handling.
- **Skills Development Levy (`sdl.ts`)**:
  - 0.25% with $2.00 minimum and $11.25 maximum statutory caps.
- **Self-Help Group Funds (`shg.ts`)**:
  - CDAC, MBMF, SINDA, and ECF wage brackets and opt-out handling.
- **MOM Statutory Leave & Overtime (`leave.ts`, `overtime.ts`)**:
  - Employment Act overtime 1.5x and 2.0x rates.
  - MOM statutory leave proration, encashment, and unpaid leave deduction formulas.
  - Resignation/termination leave settlement & clawback rules (`leaverSettlement.ts`).
- **DBS Banking Formats (`payrollFile.ts`)**:
  - DBS IDEAL Universal File Format (UFF) salary payment file generator.
  - ABS participating GIRO bank code to SWIFT BIC mapper.
  - Bank account validation and sanity checks.
- **Malaysia EPF (`epfMy.ts`)**:
  - Support for cross-border Malaysian employees.

## Usage

```bash
npm install github:kesonlim/straits-payroll-core
```

```typescript
import {
  calculatePayrollLine,
  calculateCpf,
  buildDbsPayrollFile,
} from "straits-payroll-core";
```

## Running Tests

```bash
npm test
```
