import { describe, expect, it } from "vitest";
import { messagesFor, translate, type MessageKey } from "@/lib/i18n/translate";
import { OVERLAYS } from "@/services/creator/overlayCatalog";
import { overlayDescription, overlayGroup, overlaySize, overlayTitle } from "./overlayCatalogText";

const ko = (key: MessageKey) => translate(messagesFor("ko"), key);
const en = (key: MessageKey) => translate(messagesFor("en"), key);

/** 오버레이 주소 catalog text (2026-11-01): Korean exactly as the catalog writes it, and every entry translated in English. */
describe("overlay catalog text", () => {
  it("keeps the catalog's Korean and translates every title, description, group and worded size", () => {
    for (const o of OVERLAYS) {
      expect(overlayTitle(o, ko)).toBe(o.title);
      expect(overlayDescription(o, ko)).toBe(o.description);
      expect(overlayGroup(o.group, ko)).toBe(o.group);
      expect(overlaySize(o, ko)).toBe(o.size);
      expect(overlayTitle(o, en), o.id).not.toMatch(/[가-힣]/);
      expect(overlayGroup(o.group, en), o.group).not.toMatch(/[가-힣]/);
      expect(overlaySize(o, en), o.id).not.toMatch(/[가-힣]/);
      expect(overlayDescription(o, en), o.id).not.toBe(o.description);
    }
  });

  it("shows an entry it does not know, or whose Korean changed, as written", () => {
    const o = { id: "chat", title: "새 이름", description: "새 설명", group: "새 분류", size: "100 × 100 (새)" };
    expect(overlayTitle(o, en)).toBe("새 이름");
    expect(overlayDescription(o, en)).toBe("새 설명");
    expect(overlayGroup(o.group, en)).toBe("새 분류");
    expect(overlaySize({ id: "widget-sig-queue", size: o.size }, en)).toBe(o.size);
  });
});
