import { describe, expect, it } from "vitest";
import { columnName, sheetName, xlsxFile } from "./xlsx";

/** The parts of a stored ZIP, read back through its central directory. */
function parts(zip: Uint8Array) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  let at = v.getUint32(end + 16, true);
  const out: Record<string, string> = {};
  for (let i = 0; i < v.getUint16(end + 10, true); i++) {
    const size = v.getUint32(at + 20, true);
    const nameLen = v.getUint16(at + 28, true);
    const local = v.getUint32(at + 42, true);
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLen));
    const start = local + 30 + v.getUint16(local + 26, true);
    out[name] = new TextDecoder().decode(zip.subarray(start, start + size));
    at += 46 + nameLen;
  }
  return out;
}

describe("xlsx", () => {
  it("names columns and sheets the way Excel does", () => {
    expect([0, 1, 25, 26, 27, 51, 52, 701, 702].map(columnName)).toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
    expect(sheetName("시즌1/첫 [방송]")).toBe("시즌1 첫  방송");
    expect(sheetName("가".repeat(40))).toHaveLength(31);
    expect(sheetName(" ")).toBe("Sheet1");
  });

  it("packs a workbook whose text cells never become formulas and whose numbers stay numbers", () => {
    const file = xlsxFile("기여도: 시즌1", ["멤버", "점수"], [["=SUM(1+1)", 1_000], ['하늘 <"&">', -5.5], ["\u0001제어", 0]]);
    const p = parts(file);
    expect(Object.keys(p)).toEqual(["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]);
    expect(p["xl/workbook.xml"]).toContain('<sheet name="기여도  시즌1" sheetId="1" r:id="rId1"/>');
    const sheet = p["xl/worksheets/sheet1.xml"];
    // Header bold (style 1), frozen under it.
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">멤버</t></is></c>');
    expect(sheet).toContain('state="frozen"');
    // A would-be formula is an inline string; no <f> anywhere.
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">=SUM(1+1)</t></is></c><c r="B2"><v>1000</v></c>');
    expect(sheet).not.toContain("<f>");
    expect(sheet).toContain("하늘 &lt;&quot;&amp;&quot;&gt;");
    expect(sheet).toContain('<c r="B3"><v>-5.5</v></c>');
    expect(sheet).toContain(">제어<"); // control characters XML cannot carry are dropped
    // Column widths from the longest value (Hangul counts twice).
    expect(sheet).toMatch(/<col min="1" max="1" width="12" customWidth="1"\/>/);
    expect(p["xl/styles.xml"]).toContain('<cellXfs count="2">');
    // A ZIP: local file header signature.
    expect([...file.subarray(0, 4)]).toEqual([0x50, 0x4b, 3, 4]);
  });
});
