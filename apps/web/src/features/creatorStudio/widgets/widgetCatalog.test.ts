import { describe, expect, it } from "vitest";
import { EDITABLE_WIDGETS } from "@/services/creator/widgetSettingsTypes";
import { GROUPS, POPULAR, TOOLS } from "./widgetCatalog";

describe("widget catalog (funnation layout)", () => {
  it("keeps every editable widget popup reachable from the 전체 groups", () => {
    const keys = GROUPS.flatMap((g) => g.items).flatMap((i) => (i.action.type === "widget" ? [i.action.key] : []));
    for (const k of EDITABLE_WIDGETS) expect(keys, k).toContain(k);
  });

  it("follows the funnation sections", () => {
    expect(POPULAR.map((i) => i.title)).toEqual(["후원 알림", "후원자 랭킹", "목표"]);
    expect(GROUPS.map((g) => g.title)).toEqual(["후원 알림", "게이지 · 랭킹", "표시 · 자막", "이펙트 · 효과", "게임 · 이벤트", "타이머"]);
    expect(TOOLS.map((i) => i.title)).toContain("이미지·사운드");
  });
});
