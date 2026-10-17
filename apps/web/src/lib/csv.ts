/**
 * CSV building for downloads — every CSV file of the site and the studio is made here (lib/csv.test.ts guards it).
 * Text that a spreadsheet would treat as a formula (=, +, -, @, tab, CR first) is prefixed with an apostrophe to
 * prevent CSV injection; numbers the code passes stay numbers. A cell holding a quote, a line break or a separator a
 * spreadsheet may split on (comma, or semicolon / tab where the locale or the import uses them) is quoted, so no part
 * of it can start a cell of its own.
 */
const neutralizeFormula = (text: string) => (/^[=+\-@\t\r]/.test(text) ? `'${text}` : text);

/** One cell: `quote` quotes it even when nothing in it needs quoting. */
function csvCell(value: string | number, quote: boolean) {
  const text = typeof value === "number" ? String(value) : neutralizeFormula(value);
  return quote || /[",;\t\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** `quoteAll`: every cell quoted (the 후원 리스트 file's format). */
export function toCsv(header: string[], rows: (string | number)[][], { quoteAll = false } = {}) {
  // BOM so Excel opens Korean text as UTF-8.
  return "﻿" + [header, ...rows].map((row) => row.map((v) => csvCell(v, quoteAll)).join(",")).join("\r\n");
}

export function csvResponse(body: string, filename: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}
