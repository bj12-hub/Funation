import { describe, expect, it } from "vitest";
import { slugCheckView } from "./slugCheck";

/** 후원 페이지 링크 설정 › 중복확인: an answer is shown only under the address it was about. */
describe("중복확인 answer", () => {
  it("drops an answer that arrives after the address was edited (no 변경 button for an unchecked address)", () => {
    expect(slugCheckView("hong-e2e-qa", "taen", { status: "AVAILABLE" })).toBeNull();
    expect(slugCheckView("admin", "admin-room", { status: "TAKEN" })).toBeNull();
  });

  it("shows the answer for the address in the field", () => {
    expect(slugCheckView("hong-e2e-qa", "hong-e2e-qa", { status: "AVAILABLE" })).toEqual({ tone: "ok", text: "사용할 수 있는 주소입니다.", available: true });
    expect(slugCheckView("honggildong", "honggildong", { status: "SAME" })).toEqual({ tone: "ok", text: "현재 사용 중인 주소입니다." });
    expect(slugCheckView("taen", "taen", { status: "TAKEN" })).toEqual({ tone: "error", text: "이미 사용 중인 주소입니다." });
    expect(slugCheckView("ab", "ab", { status: "INVALID", message: "영문 소문자, 숫자, 하이픈으로 3~30자를 입력해 주세요." })).toEqual({
      tone: "error",
      text: "영문 소문자, 숫자, 하이픈으로 3~30자를 입력해 주세요."
    });
  });
});
