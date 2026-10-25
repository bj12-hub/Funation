import { zipFiles } from "./zip";

/**
 * A one-sheet Excel workbook (.xlsx, Office Open XML) for downloads (code-first, 2026-10-25 — 기여도 내보내기). No
 * dependency: the parts are written here and packed with lib/zip. Text cells are inline strings, never formulas, so a
 * cell that starts with = + - @ shows as typed — there is nothing to neutralize as in lib/csv. Numbers stay numbers. The
 * header row is bold and frozen, and columns are sized to their longest value.
 */

export type XlsxCell = string | number;

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
/** XML text: escaped, without the control characters XML 1.0 cannot carry (tab and line breaks stay). */
const xmlText = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "").replace(/[&<>"]/g, (c) => ESCAPES[c]);

/** A1 column letters of the 0-based column `i` (0 → A, 25 → Z, 26 → AA). */
export function columnName(i: number) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** A sheet name Excel accepts: none of []:*?/\, at most 31 characters, not empty. */
export const sheetName = (s: string) => s.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet1";

/** Roughly how many character widths a value takes (Hangul and other wide letters count twice). */
const widthOf = (v: XlsxCell) => [...String(v)].reduce((w, ch) => w + ((ch.codePointAt(0) ?? 0) >= 0x1100 ? 2 : 1), 0);

function cell(v: XlsxCell, ref: string, bold: boolean) {
  const style = bold ? ' s="1"' : "";
  if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlText(String(v))}</t></is></c>`;
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";

/** The workbook of one sheet `name`: the header row, then `rows` (a missing cell is left empty). */
export function xlsxFile(name: string, headers: string[], rows: XlsxCell[][], now = new Date()): Uint8Array<ArrayBuffer> {
  const all = [headers, ...rows];
  const widths = headers.map((_, i) => Math.min(60, Math.max(6, ...all.map((r) => (r[i] === undefined ? 0 : widthOf(r[i])))) + 2));
  const sheetRows = all
    .map((r, y) => `<row r="${y + 1}">${r.map((v, x) => cell(v, `${columnName(x)}${y + 1}`, y === 0)).join("")}</row>`)
    .join("");
  const sheet =
    `${XML}<worksheet xmlns="${MAIN}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` +
    `<sheetData>${sheetRows}</sheetData></worksheet>`;
  const enc = new TextEncoder();
  const parts: [string, string][] = [
    [
      "[Content_Types].xml",
      `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
    ],
    ["_rels/.rels", `${XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `${XML}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets><sheet name="${xmlText(sheetName(name))}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    [
      "xl/_rels/workbook.xml.rels",
      `${XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`
    ],
    [
      "xl/styles.xml",
      `${XML}<styleSheet xmlns="${MAIN}"><fonts count="2"><font><sz val="11"/><name val="맑은 고딕"/></font><font><b/><sz val="11"/><name val="맑은 고딕"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
    ],
    ["xl/worksheets/sheet1.xml", sheet]
  ];
  return zipFiles(
    parts.map(([path, text]) => ({ name: path, data: enc.encode(text) })),
    now
  );
}
