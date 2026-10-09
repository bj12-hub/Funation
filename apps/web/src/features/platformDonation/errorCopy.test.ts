import { describe, expect, it } from "vitest";
import { platformErrorCopy, type PlatformErrorKind } from "./errorCopy";

/** 플랫폼 후원 오류 화면 (817:9618 · 817:8948): what it says happened to the FN. */
describe("플랫폼 후원 오류 copy", () => {
  it("says a PENDING donation that failed gave its held FN back — not that nothing was debited (2026-10-09 결정 FN 반환)", () => {
    expect(platformErrorCopy("RESULT_FAILED", "SOOP", true)).toEqual({ title: "후원에 실패했습니다.", text: "후원 결과가 실패로 확인되었습니다.", fnLine: "보류된 FN은 반환되었습니다." });
    // Forfeited (the sender's account has withdrawn since): no FN line at all.
    expect(platformErrorCopy("RESULT_FAILED", "SOOP", false).fnLine).toBeNull();
  });

  it("keeps 「FN은 차감되지 않았습니다.」 for failures before the hold, and no FN line while the result is unknown", () => {
    const refused: PlatformErrorKind[] = ["API_ERROR", "UNAVAILABLE", "NOT_FOUND", "INVALID"];
    for (const kind of refused) expect(platformErrorCopy(kind, "SOOP").fnLine).toBe("FN은 차감되지 않았습니다.");
    for (const kind of ["NETWORK", "PENDING", "IN_PROGRESS"] as const) expect(platformErrorCopy(kind, "SOOP").fnLine).toBeNull();
    expect(platformErrorCopy("PENDING", "FlexTV")).toMatchObject({ title: "처리 결과 확인 중", text: "FlexTV에서 후원 결과를 확인하고 있습니다.", pending: true });
  });
});
