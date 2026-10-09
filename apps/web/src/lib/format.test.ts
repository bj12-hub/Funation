import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatKst, formatKstDate, formatKstTime, kstInstant, kstIsoString, kstParts } from "./format";
import { kstToday, presetRange } from "./period";

/**
 * Service time is Asia/Seoul: the screens show Korea time whatever zone formats them — a viewer's browser abroad, or a
 * server on UTC. 2026-10-08T15:04:05Z is 00:04:05 on 10-09 in Korea, still 10-08 in UTC (15:04) and New York (11:04).
 */
const AT = "2026-10-08T15:04:05Z";

const HM = { hour: "2-digit", minute: "2-digit" } as const;
const HMS = { hour: "2-digit", minute: "2-digit", second: "2-digit" } as const;
const MD = { month: "2-digit", day: "2-digit" } as const;
const YMDHM = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" } as const;
const MDHM = { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" } as const;

function inZone(zone: string) {
  let saved: string | undefined;
  beforeEach(() => {
    saved = process.env.TZ;
    process.env.TZ = zone;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  });
}

describe.each([
  { zone: "UTC", localHour: 15 },
  { zone: "America/New_York", localHour: 11 }
])("Korea time under TZ=$zone", ({ zone, localHour }) => {
  inZone(zone);

  it("runs in that zone (else the checks below prove nothing)", () => {
    expect(new Date(AT).getHours()).toBe(localHour);
    expect(new Date(AT).toLocaleDateString("ko-KR")).toBe("2026. 10. 8."); // what the screens showed before
  });

  it("formats the screens' layouts in Korea time", () => {
    expect(formatKstTime(AT, HM)).toBe("오전 12:04");
    expect(formatKstTime(AT, HMS)).toBe("오전 12:04:05");
    expect(formatKstDate(AT)).toBe("2026. 10. 9.");
    expect(formatKstDate(AT, MD)).toBe("10. 09.");
    expect(formatKst(AT)).toBe("2026. 10. 9. 오전 12:04:05");
    expect(formatKst(AT, YMDHM)).toBe("2026. 10. 09. 오전 12:04");
    expect(formatKst(AT, MDHM)).toBe("10. 09. 오전 12:04");
    expect(formatKst(AT, { dateStyle: "short", timeStyle: "short" })).toBe("26. 10. 9. 오전 12:04");
    expect(formatKst(AT, { dateStyle: "medium", timeStyle: "short" })).toBe("2026. 10. 9. 오전 12:04");
    expect(kstParts(AT)).toEqual({ year: 2026, month: 10, day: 9, hour: 0, minute: 4, second: 5 });
    expect(kstIsoString(AT)).toBe("2026-10-09T00:04:05");
    expect(kstIsoString(Date.parse(AT))).toBe("2026-10-09T00:04:05");
    expect(kstIsoString(new Date(AT))).toBe("2026-10-09T00:04:05");
  });

  it("reads a zone-less server stamp as Korea time, not the runtime's zone (nor a date alone as UTC)", () => {
    expect(kstInstant("2026-10-08 14:32:05").toISOString()).toBe("2026-10-08T05:32:05.000Z");
    expect(kstIsoString("2026-10-08 14:32:05")).toBe("2026-10-08T14:32:05");
    expect(kstIsoString("2026-10-08 14:32")).toBe("2026-10-08T14:32:00");
    expect(kstIsoString("2026-10-08T14:32")).toBe("2026-10-08T14:32:00");
    expect(kstIsoString("2026-10-08")).toBe("2026-10-08T00:00:00");
    expect(formatKstDate("2026-10-08")).toBe("2026. 10. 8.");
    // An ISO time with a zone is that instant.
    expect(kstIsoString("2026-10-08T14:32:05+09:00")).toBe("2026-10-08T14:32:05");
    expect(kstIsoString("2026-10-08T14:32:05.123Z")).toBe("2026-10-08T23:32:05");
  });

  it("fills a period preset with Korean days (HistoryFilter)", () => {
    const now = new Date(AT); // Friday 10-09 in Korea
    expect(presetRange("day", kstToday(now))).toEqual({ from: "2026-10-09", to: "2026-10-09" });
    expect(presetRange("week", kstToday(now))).toEqual({ from: "2026-10-05", to: "2026-10-09" });
    expect(presetRange("month", kstToday(now))).toEqual({ from: "2026-10-01", to: "2026-10-09" });
    expect(presetRange("day", now)).toEqual({ from: "2026-10-08", to: "2026-10-08" }); // the runtime's own day
  });
});

describe("Korea time under TZ=Asia/Seoul", () => {
  inZone("Asia/Seoul");

  it("keeps each screen's layout exactly as the zone-less call printed it in Korea", () => {
    const d = new Date(AT);
    expect(formatKstTime(AT, HM)).toBe(d.toLocaleTimeString("ko-KR", HM));
    expect(formatKstTime(AT, HMS)).toBe(d.toLocaleTimeString("ko-KR", HMS));
    expect(formatKstDate(AT)).toBe(d.toLocaleDateString("ko-KR"));
    expect(formatKstDate(AT, MD)).toBe(d.toLocaleDateString("ko-KR", MD));
    expect(formatKst(AT)).toBe(d.toLocaleString("ko-KR"));
    expect(formatKst(AT, YMDHM)).toBe(d.toLocaleString("ko-KR", YMDHM));
    expect(formatKst(AT, MDHM)).toBe(d.toLocaleString("ko-KR", MDHM));
    for (const dateStyle of ["short", "medium"] as const) {
      for (const timeStyle of ["short", "medium"] as const) expect(formatKst(AT, { dateStyle, timeStyle })).toBe(d.toLocaleString("ko-KR", { dateStyle, timeStyle }));
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    expect(kstIsoString(AT).slice(0, 16).replaceAll("-", ".").replace("T", " ")).toBe(
      `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  });
});
