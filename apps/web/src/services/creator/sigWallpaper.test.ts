import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import type { AlertItem } from "./alertTypes";
import { sigWallCard, sigWallRows } from "./widgetOverlayCore";
import { DEFAULT_WIDGET_SETTINGS, sigWallSize } from "./widgetSettingsTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 시그 벽지 (code-first, 2026-10-28): one card per 시그니처 후원 at its own address, one style for all. */
let n = 0;
const alert = (patch: Partial<AlertItem>): AlertItem => ({
  id: `a${++n}`,
  kind: "DONATION",
  donor: "후원자",
  message: "",
  fnAmount: 1_000,
  typeLabel: "시그니처 후원",
  createdAt: `2026-10-28T05:0${n}:00.000Z`,
  status: "DONE",
  ...patch
});
const SIGS = [
  { id: "sig-a", name: "제로투" },
  { id: "sig-b", name: "앙카" }
];
const CREW = [{ id: "cm-1", name: "길동" }];

describe("시그 벽지", () => {
  beforeEach(() => {
    resetMockStores();
    n = 0;
  });

  it("lists the counted 시그니처 후원 newest first with the signature and BJ, and draws one by its id", () => {
    const items = [
      alert({ id: "d1", donor: "달빛", fnAmount: 400_000, signatureId: "sig-a", memberId: "cm-1", imageUrl: "/sig-a.png" }),
      alert({ id: "d2", donor: "익명", fnAmount: 10_000 }), // not a signature
      alert({ id: "d3", donor: "별", fnAmount: 24_444, signatureId: "sig-gone" }), // signature deleted since
      alert({ id: "d4", kind: "TEST", signatureId: "sig-a" }), // tests never count
      alert({ id: "d5", signatureId: "sig-b", replayOf: "d1" }), // a 다시 보내기 copy is not another donation
      alert({ id: "d6", donor: "퀘스트", signatureId: "sig-b", questId: "q1" }) // held until the quest succeeds
    ];
    expect(sigWallRows(items, SIGS, CREW).map((r) => `${r.id} ${r.donor} ${r.amount} ${r.signature} ${r.member}`)).toEqual([
      "d3 별 24,444 FN 삭제된 시그니처 미지정",
      "d1 달빛 400,000 FN 제로투 길동"
    ]);
    expect(sigWallRows(items, SIGS, CREW, 1)).toHaveLength(1);

    expect(sigWallCard(items, "d1")).toEqual({ imageUrl: "/sig-a.png", donor: "달빛", amount: "400,000 FN" });
    for (const id of ["d2", "d4", "d6", "nope", "", undefined, 3]) expect(sigWallCard(items, id), String(id)).toBeNull();
  });

  it("sizes the OBS source from the settings", () => {
    const s = DEFAULT_WIDGET_SETTINGS.SIG_WALLPAPER;
    // 15 + 254 + 12 + ceil(24 × 1.3) + 0 + ceil(40 × 1.3) + 14
    expect(sigWallSize(s)).toEqual({ w: 480, h: 15 + 254 + 12 + 32 + 0 + 52 + 14 });
    expect(sigWallSize({ ...s, imagePad: false })).toEqual({ w: 450, h: 254 + 12 + 32 + 52 + 14 });
  });

  it("shows the donation ?d= names on the OBS overlay, with the saved style", async () => {
    const { getOverlayWidget } = await import("./widgetOverlay");
    const { saveWidgetSettings, getWidgetDetail } = await import("./widgetSettings");
    const { mockAlerts } = await import("./alertCore");
    const { mockCreator } = await import("./mockCreatorStore");
    mockAlerts.items.push(alert({ id: "dn-sig", donor: "하루봄", fnAmount: 22_222, signatureId: "sig-x", imageUrl: "/sig-x.png" }));
    const key = mockCreator.integrationKey;

    const shown = await getOverlayWidget("sig-wallpaper", key, "dn-sig");
    if (shown === "FORBIDDEN" || shown.widget !== "sig-wallpaper") throw new Error("expected sig-wallpaper");
    expect(shown.card).toEqual({ imageUrl: "/sig-x.png", donor: "하루봄", amount: "22,222 FN" });
    expect(shown.settings).toEqual(DEFAULT_WIDGET_SETTINGS.SIG_WALLPAPER);
    const none = await getOverlayWidget("sig-wallpaper", key);
    expect(none !== "FORBIDDEN" && none.widget === "sig-wallpaper" && none.card).toBeNull();
    expect(await getOverlayWidget("sig-wallpaper", "wrong-key", "dn-sig")).toBe("FORBIDDEN");

    const ok = { ...DEFAULT_WIDGET_SETTINGS.SIG_WALLPAPER, bgColor: "#ff00aa", amountPrefix: "후원 ", gapLines: -6, top: { ...DEFAULT_WIDGET_SETTINGS.SIG_WALLPAPER.top, accent: "#00ff00" } };
    expect(await saveWidgetSettings("SIG_WALLPAPER", ok)).toEqual({ status: "SAVED" });
    const styled = await getOverlayWidget("sig-wallpaper", key, "dn-sig");
    expect(styled !== "FORBIDDEN" && styled.widget === "sig-wallpaper" && styled.settings).toMatchObject({ bgColor: "#FF00AA", amountPrefix: "후원 ", gapLines: -6, top: { accent: "#00FF00" } });

    // The studio gets the list and the address each card adds ?d= to.
    const detail = await getWidgetDetail("SIG_WALLPAPER");
    expect(detail!.live.sigWallPath).toBe(`/overlay/widget/sig-wallpaper/${key}`);
    expect(detail!.live.sigWalls[0]).toMatchObject({ id: "dn-sig", donor: "하루봄", amount: "22,222 FN", signature: "삭제된 시그니처", member: "미지정" });
  });

  it("validates the style", async () => {
    const { saveWidgetSettings } = await import("./widgetSettings");
    const d = DEFAULT_WIDGET_SETTINGS.SIG_WALLPAPER;
    const bad: [Record<string, unknown>, string][] = [
      [{ bgColor: "red" }, "#RRGGBB"],
      [{ bgOpacity: 101 }, "불투명도"],
      [{ imageWidth: 79 }, "이미지"],
      [{ imageHeight: 1001 }, "이미지"],
      [{ gapLines: -41 }, "여백"],
      [{ gapBottom: 1.5 }, "여백"],
      [{ radius: 61 }, "모서리"],
      [{ topLine: "BOTH" }, "설정 값"],
      [{ font: "Comic Sans" }, "설정 값"],
      [{ imagePad: "yes" }, "설정 값"],
      [{ amountPrefix: "가".repeat(21) }, "20자"],
      [{ top: { ...d.top, size: 9 } }, "글자 크기"],
      [{ top: { ...d.top, stroke: 11 } }, "글자 크기"],
      [{ bottom: { ...d.bottom, accent: "pink" } }, "글자 크기"],
      [{ bottom: { ...d.bottom, bold: "yes" } }, "글자 크기"]
    ];
    for (const [patch, message] of bad) {
      const res = await saveWidgetSettings("SIG_WALLPAPER", { ...d, ...patch });
      expect(res.status === "INVALID" && res.message, JSON.stringify(patch)).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await saveWidgetSettings("SIG_WALLPAPER", d)).toEqual({ status: "UNAUTHORIZED" });
  });
});
