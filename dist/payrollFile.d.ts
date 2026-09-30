/**
 * DBS IDEAL Universal File Format (UFF) payroll payment file, Product Type "SAL".
 *
 * Laid out to match DBS's own "2-UFF Excel_SAL.xlsx" template (sent by DBS BusinessCare on
 * 2026-08-26, SR-20260822-0000220), which is authoritative over our earlier reading of the UFF v2.1
 * PDF. Two differences from that reading caused the August 2026 IDEAL rejections:
 *
 * - Routing is by Beneficiary Bank SWIFT BIC (D21), with Bank Code (D18) and Branch Code (D19)
 *   left blank. Filling D18/D19 instead made DBS apply the legacy 11-digit GIRO account format and
 *   reject a genuine 12-digit OCBC account. Per ABS's 23 Mar 2015 memo, OCBC account numbers are 10
 *   or 12 digits, HSBC 12, SBI 14 (branch code included), so there's no digit cap here.
 * - The template also fills D05 batch reference, D34 particulars and D43 purpose "SALA", caps D11
 *   at 35 characters, and every record spans all 68 template columns (what Excel's own CSV export
 *   of the template produces). D07 batch ID is left blank for DBS to assign, since it must never
 *   repeat across files and a re-downloaded run would otherwise reuse it.
 */
export declare const UFF_COLUMN_COUNT = 68;
export declare function bicForBankCode(bankCode: string | null): string | null;
/** Removes only formatting (spaces, hyphens); anything else non-numeric means the number is wrong. */
export declare function normaliseAccountNumber(raw: string): string | null;
export interface DbsPayrollRow {
    full_name: string;
    bank_account_number: string;
    bank_code: string | null;
    net_pay_cents: number;
}
/** One message per employee whose bank details would make DBS reject (or misroute) the file. */
export declare function findPayrollFileProblems(rows: DbsPayrollRow[]): string[];
export declare function buildDbsPayrollFile(input: {
    orgId: string;
    originatingAccount: string;
    runId: number;
    periodEnd: string;
    paymentDate: string;
    fileCreationDate: string;
    rows: DbsPayrollRow[];
    companyName?: string;
    particularsPrefix?: string;
}): string;
