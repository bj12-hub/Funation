import { describe, expect, it } from "vitest";
import { platformLabel } from "./platformLabel";
import { messagesFor, translate, type MessageKey } from "./translate";

const tFor = (locale: "ko" | "en") => (key: MessageKey) => translate(messagesFor(locale), key);

describe("platformLabel", () => {
  it("reads 치지직 as CHZZK in English and keeps it in Korean", () => {
    expect(platformLabel("CHZZK", tFor("en"))).toBe("CHZZK");
    expect(platformLabel("CHZZK", tFor("ko"))).toBe("치지직");
  });

  it("keeps the other platform names the same in both languages", () => {
    for (const p of ["YOUTUBE", "FLEXTV", "SOOP"] as const) {
      expect(platformLabel(p, tFor("en"))).toBe(platformLabel(p, tFor("ko")));
    }
    expect(platformLabel("SOOP", tFor("en"))).toBe("SOOP");
  });
});
