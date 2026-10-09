import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatKst, formatKstDate, formatKstTime, kstInstant, kstIsoString, kstParts } from "./format";

/**
 * Service time is Asia/Seoul: the console shows Korea time whatever zone formats it — an operator's browser abroad, or
 * this server on UTC. 2026-10-08T15:04:05Z is 00:04:05 on 10-09 in Korea, still 10-08 in UTC (15:04) and New York (11:04).
 */
const AT = "2026-10-08T15:04:05Z";

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
    expect(new Date(AT).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "medium" })).not.toContain("26. 10. 9.");
  });

  it("formats the console's layouts in Korea time", () => {
    expect(formatKst(AT)).toBe("2026. 10. 9. 오전 12:04:05"); // 회원 탈퇴 · 처리 이력 · 정리 이력
    expect(formatKst(AT, { dateStyle: "short", timeStyle: "medium" })).toBe("26. 10. 9. 오전 12:04:05"); // 감사 로그
    expect(formatKst(AT, { dateStyle: "short", timeStyle: "short" })).toBe("26. 10. 9. 오전 12:04"); // 플랫폼 연동
    expect(formatKstDate(AT)).toBe("2026. 10. 9.");
    expect(formatKstTime(AT, { hour: "2-digit", minute: "2-digit" })).toBe("오전 12:04");
    expect(kstParts(AT)).toEqual({ year: 2026, month: 10, day: 9, hour: 0, minute: 4, second: 5 });
    // "2026-10-09 00:04" (보류 · 결정 · 신고 · 정산 처리 시각) and "2026.10.09" (정지 종료일 · 보관 기한).
    expect(kstIsoString(AT).slice(0, 16).replace("T", " ")).toBe("2026-10-09 00:04");
    expect(kstIsoString(AT).slice(0, 10).replace(/-/g, ".")).toBe("2026.10.09");
  });

  it("reads a zone-less site stamp as Korea time: charge and donation times, dates", () => {
    expect(kstInstant("2026-10-01 15:00:00").toISOString()).toBe("2026-10-01T06:00:00.000Z");
    expect(kstIsoString("2026-10-01 15:00:00").slice(0, 16).replace("T", " ")).toBe("2026-10-01 15:00");
    expect(kstIsoString("2026-10-01 15:00")).toBe("2026-10-01T15:00:00");
    expect(kstIsoString("2025-11-02").slice(0, 10).replace(/-/g, ".")).toBe("2025.11.02");
    expect(formatKstDate("2025-11-02")).toBe("2025. 11. 2.");
  });
});

describe("Korea time under TZ=Asia/Seoul", () => {
  inZone("Asia/Seoul");

  it("keeps each layout exactly as the zone-less call printed it in Korea", () => {
    const d = new Date(AT);
    expect(formatKst(AT)).toBe(d.toLocaleString("ko-KR"));
    expect(formatKst(AT, { dateStyle: "short", timeStyle: "medium" })).toBe(d.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "medium" }));
    expect(formatKst(AT, { dateStyle: "short", timeStyle: "short" })).toBe(d.toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }));
  });
});
