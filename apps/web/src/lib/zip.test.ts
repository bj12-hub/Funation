import { describe, expect, it } from "vitest";
import { crc32, zipFiles } from "./zip";

/** Reads a stored ZIP back through its central directory (what an unzip tool does), checking each entry's CRC. */
function unzip(zip: Uint8Array) {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.length - 22;
  expect(v.getUint32(end, true)).toBe(0x06054b50);
  const count = v.getUint16(end + 10, true);
  let at = v.getUint32(end + 16, true);
  const dec = new TextDecoder();
  const out: { name: string; data: Uint8Array; flags: number }[] = [];
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(at, true)).toBe(0x02014b50);
    const flags = v.getUint16(at + 8, true);
    const crc = v.getUint32(at + 16, true);
    const size = v.getUint32(at + 20, true);
    const nameLen = v.getUint16(at + 28, true);
    const local = v.getUint32(at + 42, true);
    const name = dec.decode(zip.subarray(at + 46, at + 46 + nameLen));
    expect(v.getUint32(local, true)).toBe(0x04034b50);
    const localName = v.getUint16(local + 26, true);
    const data = zip.subarray(local + 30 + localName, local + 30 + localName + size);
    expect(crc32(data)).toBe(crc);
    out.push({ name, data, flags });
    at += 46 + nameLen;
  }
  return out;
}

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it("stores files with UTF-8 names that read back byte for byte", () => {
    const files = [
      { name: "01_제로투 Zero 2_10002FN.png", data: new Uint8Array([137, 80, 78, 71, 0, 255]) },
      { name: "시그니처 목록.csv", data: new TextEncoder().encode("이름,가격\r\n제로투,10002") },
      { name: "empty.txt", data: new Uint8Array() }
    ];
    const zip = zipFiles(files, new Date(2026, 9, 25, 12, 30, 10));
    const back = unzip(zip);
    expect(back.map((f) => f.name)).toEqual(files.map((f) => f.name));
    back.forEach((f, i) => expect([...f.data]).toEqual([...files[i].data]));
    expect(back.every((f) => f.flags === 0x0800)).toBe(true);
    // DOS date: 2026-10-25 → (46 << 9) | (10 << 5) | 25.
    expect(new DataView(zip.buffer).getUint16(12, true)).toBe((46 << 9) | (10 << 5) | 25);
    expect(unzip(zipFiles([]))).toEqual([]);
  });
});
