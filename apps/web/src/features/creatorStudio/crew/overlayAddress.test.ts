import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores } from "@/test/mockEnv";
import { shownOverlayAddress } from "./overlayAddress";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }), usePathname: () => "/creator/crew/broadcast" }));

/**
 * 크루 방송 운영: the OBS addresses (점수판 · 배틀 · 강탈 · 시나리오) carry the integration key. Like 오버레이 주소 and the widget
 * popups, the screen shows them with the key masked; only 복사 hands out the full address.
 */
describe("크루 방송 운영 overlay addresses", () => {
  beforeEach(() => resetMockStores());

  it("masks the key after the overlay path and keeps the query", () => {
    expect(shownOverlayAddress("http://localhost:3100", "/overlay/crew/c2b6a1f0-1111-2222-3333-444455556666", "?battle")).toBe("http://localhost:3100/overlay/crew/c2b6-····-····-····?battle");
  });

  it("never shows the full key on the screen while live", async () => {
    const { startBroadcast, getBroadcastView } = await import("@/services/crew/crewBroadcast");
    const { getOverlaySwitches } = await import("@/services/creator/alertRemote");
    const { mockCreator } = await import("@/services/creator/mockCreatorStore");
    const { BroadcastScreen } = await import("./BroadcastScreen");
    expect(await startBroadcast({ requestId: crypto.randomUUID(), title: "주소 확인 방송", teamMode: false })).toEqual({ status: "SAVED" });
    const [view, switches] = await Promise.all([getBroadcastView(), getOverlaySwitches()]);
    if (!view || !switches) throw new Error("no view");
    const html = renderToStaticMarkup(createElement(BroadcastScreen, { view, switches }));
    const key = mockCreator.integrationKey;
    // 점수판 · 배틀 · 강탈 · 시나리오 — four address fields, all masked.
    for (const label of ["오버레이 주소", "배틀 오버레이 주소", "강탈 오버레이 주소", "시나리오 오버레이 주소"]) expect(html).toContain(`aria-label="${label}"`);
    expect(html.split(`${key.slice(0, 4)}-····-····-····`).length - 1).toBeGreaterThanOrEqual(4);
    expect(html).not.toContain(key);
  }, 30_000);
});
