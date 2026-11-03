import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { mockSessionModule } from "@/test/mockEnv";
import { DEFAULT_CUMULATIVE, type CumulativeBasis, type CumulativeLive } from "@/services/crew/crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }), usePathname: () => "/creator/crew/broadcast" }));

/**
 * 누적 기여도 둘 다 (2026-11-02, StreamDonate "금액 · 기여도 나란히"): the OBS board and the 방송 운영 preview show the 기여도
 * with each member's 후원금 beside it; 기여도 alone shows no 후원금.
 */
function board(basis: CumulativeBasis): CumulativeLive {
  const both = basis === "BOTH";
  const row = (memberId: string, name: string, rank: number, past: number, current: number, amount: number) => ({
    memberId,
    name,
    color: "#8b5cf6",
    rank,
    past,
    current,
    total: past + current,
    amount: both ? { past: 0, current: amount, total: amount } : null
  });
  const rows = [row("cm-s3", "바다", 1, 20_000, 0, 0), row("cm-s1", "길동", 2, 1_000, 10_000, 10_000)];
  return {
    settings: { ...DEFAULT_CUMULATIVE, basis },
    visible: true,
    project: "시즌1",
    rounds: 3,
    rows,
    total: 31_000,
    unit: "점",
    amountUnit: both ? "FN" : null,
    amountTotal: both ? 10_000 : 0
  };
}
const text = (html: string) => html.replace(/<!-- -->/g, "");

describe("누적 기여도 둘 다", () => {
  it("shows the 기여도 in 점 with the 후원금 beside it on OBS", async () => {
    const { CumulativeOverlay } = await import("./CrewScoreOverlay");
    const { overlayTheme } = await import("@/services/creator/overlayThemeStore");
    const both = text(renderToStaticMarkup(createElement(CumulativeOverlay, { board: board("BOTH"), reloadSeq: 0, theme: overlayTheme() })));
    expect(both).toMatch(/11,000점<small[^>]*> · 10,000 FN<\/small>/);
    expect(both).toMatch(/20,000점<small[^>]*> · 0 FN<\/small>/);
    expect(both).toContain("지난 1,000 · 이번 10,000");

    const points = text(renderToStaticMarkup(createElement(CumulativeOverlay, { board: board("POINTS"), reloadSeq: 0, theme: overlayTheme() })));
    expect(points).toContain("11,000");
    expect(points).not.toContain("FN");
    expect(points).not.toContain("점<small");
  }, 30_000);

  it("previews the 후원금 on the 방송 운영 card with 둘 다 chosen", async () => {
    const { CumulativePanel } = await import("./CumulativePanel");
    const b = board("BOTH");
    const html = text(renderToStaticMarkup(createElement(CumulativePanel, { settings: b.settings, live: { broadcastId: "bc-1", board: b }, overlayPath: "/overlay/crew/key", pending: false, run: () => {} })));
    expect(html).toMatch(/aria-pressed="true"[^>]*>둘 다</);
    expect(html).toContain("지난 1,000 · 이번 10,000 · 후원금 10,000 FN");
    expect(html).toContain("둘 다는 기여도로 순위를 매기고 후원금을 옆에 함께 보여 줘요.");
  }, 30_000);
});
