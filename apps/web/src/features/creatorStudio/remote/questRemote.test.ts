import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QUEST_DECIDE_CONFIRM } from "@/features/donations/questDecideText";
import type { QuestRemoteRow, QuestRemoteView } from "@/services/donations/questTypes";
import { mockSessionModule, resetMockStores } from "@/test/mockEnv";
import { questConfirmText, questTimeLeft } from "./questRemoteModel";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  useRouter: () => ({ refresh() {}, push() {}, replace() {} }),
  usePathname: () => "/creator/remote",
  useSearchParams: () => new URLSearchParams()
}));

/**
 * 리모컨 퀘스트 card (code-first, funnation 기본값): what it shows — running quests with time left, the 받은 후원 buttons,
 * EMPTY — on every 리모컨 (studio page, 작은 창, 도우미), and the 퀘스트 위젯 settings saying where missions are settled.
 */

const NOW = Date.parse("2026-10-18T03:00:00.000Z");
const at = (offsetSec: number) => new Date(NOW + offsetSec * 1000).toISOString();

const row = (over: Partial<QuestRemoteRow>): QuestRemoteRow => ({
  id: "q-a",
  donor: "별빛소나타",
  donorId: "starlight",
  title: "노래 한 곡 불러주세요",
  amount: 10_000,
  createdAt: at(-301),
  endsAt: at(299),
  actions: ["SUCCESS", "FAILED", "CANCELED"],
  ...over
});

describe("리모컨 퀘스트 남은 시간", () => {
  it("counts down, and says 시간 초과 · 결과 대기 once the limit passed", () => {
    expect(questTimeLeft(at(299), NOW)).toEqual({ text: "남은 시간 04:59", over: false });
    expect(questTimeLeft(at(3_723), NOW)).toEqual({ text: "남은 시간 1:02:03", over: false });
    expect(questTimeLeft(at(0), NOW)).toEqual({ text: "시간 초과 · 결과 대기", over: true });
    expect(questTimeLeft(at(-86_400), NOW)).toEqual({ text: "시간 초과 · 결과 대기", over: true });
  });

  it("asks the 받은 후원 question, naming the quest", () => {
    const text = questConfirmText(row({}), "FAILED");
    expect(text).toBe(`‘노래 한 곡 불러주세요’ · 별빛소나타 · 10,000 FN\n\n${QUEST_DECIDE_CONFIRM.FAILED}`);
  });
});

describe("리모컨 퀘스트 카드", () => {
  beforeEach(() => resetMockStores());

  const render = async (view: QuestRemoteView) => {
    const { QuestRemote } = await import("./QuestRemote");
    return renderToStaticMarkup(createElement(QuestRemote, { view }));
  };

  it("lists each running quest with donor, mission, amount, time left and the 받은 후원 buttons", async () => {
    const html = await render({
      serverNow: new Date(NOW).toISOString(),
      quests: [row({ id: "q-a", endsAt: at(-60) }), row({ id: "q-b", donor: "익명", donorId: "", title: "스쿼트 50개", amount: 5_000, endsAt: at(299), actions: ["CANCELED"] })]
    });
    expect(html).toContain("🎯 퀘스트");
    expect(html).toContain("진행 중 2건 · 시간 초과 1건");
    expect(html).toContain("보관 중 15,000 FN");
    expect(html).toContain("노래 한 곡 불러주세요 · 10,000 FN");
    expect(html).toContain("별빛소나타 (starlight)");
    expect(html).toContain("스쿼트 50개 · 5,000 FN");
    expect(html).not.toContain("익명 ()");
    expect(html).toContain("시간 초과 · 결과 대기");
    expect(html).toContain("남은 시간 04:59");
    // 성공 · 실패 · 취소 where the creator may decide; only 취소 where the supporter keeps 성공 · 실패.
    expect(html.match(/>성공<\/button>/g)).toHaveLength(1);
    expect(html.match(/>실패 · 환불<\/button>/g)).toHaveLength(1);
    expect(html.match(/>취소 · 환불<\/button>/g)).toHaveLength(2);
    expect(html).toContain("성공 · 실패는 후원자가 정해요");
    expect(html).not.toContain("진행 중인 퀘스트가 없어요.");
  }, 30_000);

  it("shows EMPTY without running quests", async () => {
    const html = await render({ serverNow: new Date(NOW).toISOString(), quests: [] });
    expect(html).toContain("진행 중인 퀘스트가 없어요.");
    expect(html).toContain("진행 중 0건");
    expect(html).not.toContain("<button");
  }, 30_000);

  it("is on the studio 리모컨, the 작은 창 and the 도우미 리모컨 with the studio's running quests", async () => {
    const { getQuestRemote } = await import("@/services/creator/questRemote");
    const running = (await getQuestRemote())!.quests;
    expect(running.length).toBeGreaterThan(0);
    const pages: [string, () => Promise<{ default: () => Promise<ReactElement | null> }>][] = [
      ["/creator/remote", () => import("@/app/creator/remote/page")],
      ["/popout/remote", () => import("@/app/popout/remote/page")],
      ["/helper/remote", () => import("@/app/helper/remote/page")]
    ];
    for (const [path, page] of pages) {
      const element = await (await page()).default();
      if (!element) throw new Error(`${path}: nothing rendered`);
      const html = renderToStaticMarkup(element);
      expect(html, path).toContain('aria-labelledby="quest-remote"');
      for (const q of running) expect(html, path).toContain(`${q.title} · ${q.amount.toLocaleString("ko-KR")} FN`);
    }
  }, 30_000);
});

describe("퀘스트 위젯 설정 · 미션 확인 및 수락", () => {
  beforeEach(() => resetMockStores());

  it("says missions are settled on the 리모컨 or in 받은 후원 › 퀘스트, not on the 리모컨 only", async () => {
    const { getWidgetDetail } = await import("@/services/creator/widgetSettings");
    const { QuestForm } = await import("@/features/creatorStudio/widgets/gameForms");
    const detail = await getWidgetDetail("QUEST");
    if (!detail || detail.key !== "QUEST") throw new Error("no quest settings");
    const html = renderToStaticMarkup(createElement(QuestForm, { value: detail.settings as Parameters<typeof QuestForm>[0]["value"], onChange: () => {}, live: detail.live }));
    expect(html).toContain("미션 확인 및 수락");
    expect(html).toContain("리모컨의 퀘스트 카드나 후원관리+ › 받은 후원 › 퀘스트에서 미션을 확인하고 결과를 정해요");
    expect(html).not.toContain("리모컨에서만");
  }, 30_000);
});
