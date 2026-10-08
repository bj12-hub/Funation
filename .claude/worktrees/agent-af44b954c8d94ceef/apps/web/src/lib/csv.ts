/**
 * CSV building for downloads. Cells that a spreadsheet would treat as a formula
 * (=, +, -, @, tab, CR) are prefixed with an apostrophe to prevent CSV injection.
 */
export function toCsv(header: string[], rows: (string | number)[][]) {
  const cell = (value: string | number) => {
    let text = String(value);
    if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  // BOM so Excel opens Korean text as UTF-8.
  return "﻿" + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
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
