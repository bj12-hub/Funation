import { describe, expect, it } from "vitest";
import { messagesFor, translate, type MessageKey } from "./translate";
import { unitText } from "./unitText";

const tFor = (locale: "ko" | "en") => (key: MessageKey) => translate(messagesFor(locale), key);

describe("unitText", () => {
  it("names the platform units and 원 in the viewer's language", () => {
    expect(["KRW", "SOOP_BALLOON", "CHZZK_CHEESE"].map((u) => unitText(u, tFor("en")))).toEqual(["KRW", "Star balloons", "Cheese"]);
    expect(["KRW", "SOOP_BALLOON", "CHZZK_CHEESE", "FLEXTV_UNIT"].map((u) => unitText(u, tFor("ko")))).toEqual(["원", "별풍선", "치즈", "FlexTV 후원"]);
  });

  it("keeps FN and other currencies as written", () => {
    expect(["FN", "USD", "EUR"].map((u) => unitText(u, tFor("en")))).toEqual(["FN", "USD", "EUR"]);
  });
});
