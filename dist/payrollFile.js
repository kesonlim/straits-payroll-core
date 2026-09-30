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
export const UFF_COLUMN_COUNT = 68;
/** ABS "SWIFT BIC for Participating GIRO Banks" (updated 15 Apr 2019), keyed by 4-digit bank code. */
const SG_GIRO_BANK_BICS = {
    "7931": "ANZBSGSXXXX",
    "7047": "BKKBSGSGXXX",
    "7065": "BOFASG2XXXX",
    "7083": "BKCHSGSGXXX",
    "7092": "BEASSGSGXXX",
    "7108": "BKIDSGSGXXX",
    "7126": "BOTKSGSXXXX",
    "7418": "BNPASGSGXXX",
    "9353": "CTCBSGSGXXX",
    "7986": "CIBBSGSGXXX",
    "7214": "CITISGSGXXX",
    "9201": "CITISGSLXXX",
    "8606": "COBASGSXXXX",
    "7135": "CRLYSGSGXXX",
    "7171": "DBSSSGSGXXX",
    "7463": "DEUTSGSGXXX",
    "7737": "DNBASGSGXXX",
    "7764": "FCBKSGSGXXX",
    "7287": "HLBBSGSGXXX",
    "7232": "HSBCSGSGXXX",
    "9548": "HSBCSGS2XXX",
    "9186": "ICICSGSGXXX",
    "7241": "IDIBSGSGXXX",
    "7250": "IOBASGSGXXX",
    "8712": "ICBKSGSGXXX",
    "8350": "BCITSGSGXXX",
    "7153": "CHASSGSGXXX",
    "7490": "KOEXSGSGXXX",
    "9636": "MBBESGSGXXX",
    "7302": "MBBESGS2XXX",
    "7621": "MHCBSGSGXXX",
    "8077": "NATASGSGXXX",
    "8518": "NDEASGSGXXX",
    "7339": "OCBCSGSGXXX",
    "7056": "BNINSGSGXXX",
    "9326": "QNBASGSGXXX",
    "7366": "RHBBSGSGXXX",
    "8527": "ESSESGSGXXX",
    "7852": "SOGESGSGXXX",
    "9496": "SCBLSG22XXX",
    "7791": "SBINSGSGXXX",
    "7472": "SMBCSGSGXXX",
    "8493": "HANDSGSGXXX",
    "7685": "UBSWSGSGXXX",
    "7357": "UCBASGSGXXX",
    "8855": "BVBESGSGXXX",
    "7375": "UOVBSGSGXXX",
};
export function bicForBankCode(bankCode) {
    return SG_GIRO_BANK_BICS[(bankCode ?? "").trim()] ?? null;
}
/** Removes only formatting (spaces, hyphens); anything else non-numeric means the number is wrong. */
export function normaliseAccountNumber(raw) {
    const stripped = raw.replace(/[\s-]/g, "");
    return /^\d+$/.test(stripped) ? stripped : null;
}
/** One message per employee whose bank details would make DBS reject (or misroute) the file. */
export function findPayrollFileProblems(rows) {
    const problems = [];
    for (const r of rows) {
        if (r.net_pay_cents < 0) {
            problems.push(`${r.full_name}: net pay is negative — fix the run before paying`);
            continue;
        }
        if (!bicForBankCode(r.bank_code)) {
            problems.push(`${r.full_name}: bank code "${r.bank_code ?? ""}" isn't a recognised Singapore GIRO bank code`);
        }
        else if (!normaliseAccountNumber(r.bank_account_number)) {
            problems.push(`${r.full_name}: bank account number should contain digits only`);
        }
    }
    return problems;
}
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
function ddmmyyyy(isoDate) {
    const [y, m, d] = isoDate.split("-");
    return `${d}${m}${y}`;
}
/** DBS says commas and line breaks make the upload fail, so drop them rather than CSV-quote. */
function clean(value, maxLength) {
    return value.replace(/[\r\n]+/g, " ").replace(/\s*,\s*/g, " ").slice(0, maxLength).trim();
}
function record(fields) {
    const padded = [...fields];
    while (padded.length < UFF_COLUMN_COUNT)
        padded.push("");
    return padded.join(",");
}
export function buildDbsPayrollFile(input) {
    const [year, month] = input.periodEnd.split("-");
    const companyName = input.companyName ?? "Being Kids Pte Ltd";
    const prefix = input.particularsPrefix ?? (input.companyName ? `${clean(companyName, 20).toUpperCase()} SALARY` : "BEING KIDS SALARY");
    const particulars = `${prefix} ${MONTHS[Number(month) - 1]} ${year}`;
    const lines = [record(["HEADER", input.fileCreationDate, input.orgId, companyName, "UFFv2"])];
    let totalCents = 0;
    for (const r of input.rows) {
        totalCents += r.net_pay_cents;
        const d = new Array(UFF_COLUMN_COUNT).fill("");
        d[0] = "PAYMENT"; // D01
        d[1] = "SAL"; // D02 Singapore payroll
        d[2] = input.originatingAccount; // D03
        d[3] = "SGD"; // D04
        d[4] = `SAL RUN ${input.runId}`; // D05 batch reference, same for every row
        d[5] = "SGD"; // D06
        d[7] = ddmmyyyy(input.paymentDate); // D08
        d[10] = clean(r.full_name, 35); // D11 receiving party name
        d[15] = normaliseAccountNumber(r.bank_account_number); // D16, validated by findPayrollFileProblems
        d[20] = bicForBankCode(r.bank_code); // D21 beneficiary bank SWIFT BIC
        d[27] = (r.net_pay_cents / 100).toFixed(2); // D28
        d[32] = "22"; // D33 salary credit
        d[33] = particulars; // D34, printed on the employee's bank statement
        d[42] = "SALA"; // D43 purpose of payment
        lines.push(d.join(","));
    }
    lines.push(record(["TRAILER", String(input.rows.length), (totalCents / 100).toFixed(2)]));
    return lines.join("\r\n");
}
