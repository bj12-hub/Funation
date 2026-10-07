import { describe, expect, it } from "vitest";
import { runAction } from "./runAction";

/** Console forms: a Server Action that throws is shown inline as UNAVAILABLE, never as the page's error screen. */
describe("runAction", () => {
  it("passes the site's result through", async () => {
    expect(await runAction(async () => ({ status: "OK" }))).toEqual({ status: "OK" });
    expect(await runAction(async () => ({ status: "INVALID", message: "처리 메모를 입력해 주세요." }))).toEqual({ status: "INVALID", message: "처리 메모를 입력해 주세요." });
  });

  it("turns a thrown call into UNAVAILABLE", async () => {
    expect(await runAction(() => Promise.reject(new TypeError("Failed to fetch")))).toEqual({ status: "UNAVAILABLE" });
    expect(
      await runAction(() => {
        throw new Error("Server Action not found");
      })
    ).toEqual({ status: "UNAVAILABLE" });
  });
});
