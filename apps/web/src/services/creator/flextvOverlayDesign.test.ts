import { describe, expect, it } from "vitest";
import { DEFAULT_DESIGN, designedSettings, designPartOf, lookOf, readDesign } from "./flextvOverlayDesign";
import { DEFAULT_TYPE_SETTINGS } from "./donationTypeSettings";
import { DEFAULT_WIDGET_SETTINGS } from "./widgetSettingsTypes";

/** Phase 8: the overlay design document FLEXTV keeps for Ssumnation (§10). */

const D = DEFAULT_WIDGET_SETTINGS;

describe("a widget's look from the studio's form", () => {
  it("takes the look only, never the rules", () => {
    expect(designPartOf("ROULETTE", { ...D.ROULETTE, theme: "GLASS", minAmount: 5 })).toEqual({ roulette: { theme: "GLASS" } });
    const mini = designPartOf("MINI", { ...D.MINI, style: "BUBBLE", speed: 80 });
    expect(mini).toMatchObject({ mini: { style: "BUBBLE", speed: 80 } });
    const quest = designPartOf("QUEST", { ...D.QUEST, style: "SIMPLE", maxCount: 3, minAmount: 1, allowExtension: false });
    expect(quest).toEqual({ quest: { theme: "INHERIT", enabled: true, style: "SIMPLE", titleFont: D.QUEST.titleFont, timeFont: D.QUEST.timeFont, prizeFont: D.QUEST.prizeFont, maxCount: 3 } });
  });

  it("keeps each 뽑기's look by its id", () => {
    const form = { ...D.GACHA, overlayTheme: "BOLD", gachas: [{ ...D.GACHA.gachas[0], id: "g-1", style: "BOX", pointColor: "#ff0000", price: 1 }], board: { ...D.GACHA.board, title: "당첨!" } };
    expect(designPartOf("GACHA", form)).toEqual({
      gacha: { theme: "BOLD", credit: D.GACHA.credit, board: { title: "당첨!", speed: D.GACHA.board.speed }, looks: { "g-1": { style: "BOX", pointColor: "#FF0000" } } }
    });
  });

  it("refuses a look it cannot draw", () => {
    expect(designPartOf("ROULETTE", { theme: "NEON" })).toBe("테마를 골라 주세요.");
    expect(designPartOf("GACHA", { ...D.GACHA, board: { ...D.GACHA.board, title: "" } })).toBe("위젯 타이틀은 1~20자로 입력해 주세요.");
    expect(designPartOf("GACHA", { ...D.GACHA, gachas: [{ ...D.GACHA.gachas[0], pointColor: "red" }] })).toBe("뽑기 모양을 확인해 주세요.");
    expect(typeof designPartOf("QUEST", { ...D.QUEST, titleFont: { family: "Comic Sans", color: "#FFFFFF" } })).toBe("string");
    expect(typeof designPartOf("MINI", { ...D.MINI, speed: 500 })).toBe("string");
  });
});

describe("a document as FLEXTV keeps it", () => {
  it("reads what it can and falls back part by part", () => {
    expect(readDesign(null)).toEqual(DEFAULT_DESIGN);
    expect(readDesign("not json")).toEqual(DEFAULT_DESIGN);
    const design = readDesign({ version: 1, appearance: { theme: "GLASS", accent: null }, roulette: { theme: "NOPE" }, mini: { speed: 1000 }, gacha: { theme: "PILL", credit: { historyCount: 3, displaySec: 5 }, board: { title: "보드", speed: "FAST" }, looks: { "g-1": { style: "CREDIT", pointColor: "#00FF00" } } } });
    expect(design.appearance).toEqual({ theme: "GLASS", accent: null });
    expect(design.roulette).toEqual(DEFAULT_DESIGN.roulette);
    expect(design.mini).toEqual(DEFAULT_DESIGN.mini);
    expect(lookOf(design, "g-1")).toEqual({ style: "CREDIT", pointColor: "#00FF00" });
    expect(lookOf(design, "unknown")).toEqual(lookOf(DEFAULT_DESIGN, null));
  });
});

describe("the settings the form and the overlays use", () => {
  it("are the defaults with the design, and 후원 종류 설정's rules for the previews", () => {
    const types = {
      ...DEFAULT_TYPE_SETTINGS,
      roulette: { enabled: true, minAmount: 500, dailyLimit: 2, items: [{ name: "꽝", percent: 60 }, { name: "노래", percent: 40 }] },
      gacha: [{ id: "g-1", enabled: true, name: "행운 뽑기", price: 2000, mode: "STOCK" as const, limit: 3, prizes: [{ name: "사인", blank: false, percent: null, left: 5 }] }],
      quest: { enabled: true, maxTimeSec: 600, allowExtension: false }
    };
    const design = { ...DEFAULT_DESIGN, gacha: { ...DEFAULT_DESIGN.gacha, looks: { "g-1": { style: "BOX" as const, pointColor: "#123456" } } } };
    const s = designedSettings(design, types);
    expect(s.ROULETTE).toMatchObject({ minAmount: 500, dailyLimit: 2, items: [{ name: "꽝", percent: 60 }, { name: "노래", percent: 40 }] });
    expect(s.GACHA.gachas[0]).toMatchObject({ id: "g-1", name: "행운 뽑기", price: 2000, style: "BOX", pointColor: "#123456", prizeMode: "STOCK", limitEnabled: true, limitCount: 3, prizes: [{ name: "사인", kind: "PRIZE", value: 5 }] });
    expect(s.QUEST.allowExtension).toBe(false);
    // Without the rules (an overlay): the defaults and the design only.
    expect(designedSettings(DEFAULT_DESIGN, null).GACHA.gachas).toEqual([]);
  });
});
