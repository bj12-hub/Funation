import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuestExtendResult, QuestRemoteRow } from "@/services/donations/questTypes";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

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
 * 퀘스트 제한 시간 연장 on screen (2026-10-18 결정): the 리모컨 퀘스트 card's 시간 연장 (only while 제한시간 연장 사용 is on) —
 * minutes checked, confirmed with the new deadline or "지금부터", sent once — and the extended deadline with "연장됨 +N분"
 * on the 리모컨, in 받은 후원 › 퀘스트, in the supporter's 후원 내역 and on the OBS 퀘스트 위젯, in Korea time.
 */

const NOW = Date.parse("2026-10-18T03:00:00.000Z"); // 12:00 KST
const at = (offsetMin: number) => new Date(NOW + offsetMin * 60_000).toISOString();
const range = { preset: "range" as const, from: "2000-01-01", to: "2099-12-31" };

const row = (over: Partial<QuestRemoteRow> = {}): QuestRemoteRow => ({
  id: "q-a",
  donor: "별빛소나타",
  donorId: "starlight",
  title: "노래 한 곡 불러주세요",
  amount: 10_000,
  createdAt: at(-3),
  endsAt: at(7),
  extendedMin: 0,
  actions: ["SUCCESS", "FAILED", "CANCELED"],
  ...over
});

async function load() {
  const model = await import("./questRemoteModel");
  const remote = await import("@/services/creator/questRemote");
  const core = await import("@/services/donations/questCore");
  return { ...model, ...remote, ...core };
}

describe("리모컨 시간 연장 문구", () => {
  it("reads whole minutes from 1 to 60 only", async () => {
    const m = await load();
    expect(["1", " 10 ", "60"].map(m.parseExtendMinutes)).toEqual([1, 10, 60]);
    for (const bad of ["", "0", "61", "1.5", "-3", "10분", "abc", "0060"]) expect(m.parseExtendMinutes(bad), bad).toBeNull();
  });

  it("asks with the new deadline in Korea time, or says the clock starts again from now once the deadline passed", async () => {
    const m = await load();
    expect(m.questExtendConfirmText(row(), 10, NOW)).toBe(
      "‘노래 한 곡 불러주세요’ · 별빛소나타 · 10,000 FN\n\n제한 시간을 10분 연장할까요?\n마감 2026.10.18 12:07 → 2026.10.18 12:17\n연장한 시간은 되돌릴 수 없어요."
    );
    expect(m.questExtendConfirmText(row({ endsAt: at(-30) }), 10, NOW)).toBe(
      "‘노래 한 곡 불러주세요’ · 별빛소나타 · 10,000 FN\n\n제한 시간이 지난 퀘스트예요. 지금부터 10분 뒤를 새 마감으로 정할까요?\n연장한 시간은 되돌릴 수 없어요."
    );
    expect(m.questExtendHint(row(), NOW)).toBe("지금 마감 2026.10.18 12:07에 더해져요 (1~60분).");
    expect(m.questExtendHint(row({ endsAt: at(-30) }), NOW)).toBe("제한 시간이 지난 퀘스트라 지금부터 다시 계산해요 (1~60분).");
    expect(m.questExtendedText(row(), { status: "OK", minutes: 10, endsAt: at(17), restarted: false })).toBe(
      "‘노래 한 곡 불러주세요’ 퀘스트의 제한 시간을 10분 연장했어요 · 새 마감 2026.10.18 12:17"
    );
    expect(m.questExtendedText(row(), { status: "OK", minutes: 10, endsAt: at(10), restarted: true })).toBe(
      "‘노래 한 곡 불러주세요’ 퀘스트는 제한 시간이 지나 지금부터 10분 뒤로 마감을 정했어요 · 새 마감 2026.10.18 12:10"
    );
  });
});

describe("리모컨에서 시간 연장", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    resetMockStores();
  });
  afterEach(() => vi.useRealTimers());

  let ids = 0;
  const deps = (extend: (input: { id: string; minutes: number; requestId: string }) => Promise<QuestExtendResult>) => ({
    inFlight: new Set<string>(),
    pending: new Map<string, { minutes: number; requestId: string }>(),
    newRequestId: vi.fn(() => key(1000 + ++ids)),
    confirm: vi.fn(() => true),
    extend: vi.fn(extend),
    onStart: vi.fn()
  });

  it("extends once on a double click, and a retry after a lost answer adds nothing twice", async () => {
    const m = await load();
    const q1 = (await m.getQuestRemote())!.quests.find((r) => r.id === "q1")!;
    expect(q1.endsAt).toBe(at(7));

    const d = deps(m.extendQuestTime);
    const [a, b] = await Promise.all([m.extendFromRemote(q1, "10", NOW, d), m.extendFromRemote(q1, "10", NOW, d)]);
    expect(a).toEqual({ kind: "EXTENDED", notice: { tone: "ok", text: "‘" + q1.title + "’ 퀘스트의 제한 시간을 10분 연장했어요 · 새 마감 2026.10.18 12:17" } });
    expect(b).toEqual({ kind: "SKIPPED" });
    expect(d.extend).toHaveBeenCalledTimes(1);
    expect(d.confirm).toHaveBeenCalledTimes(1);
    expect(d.inFlight.size).toBe(0);
    expect(d.pending.size).toBe(0);
    expect(m.findQuest("q1")!.extensions).toHaveLength(1);

    // The server extends but the answer is lost: the card keeps the request id, and sending the same minutes again
    // reuses it — the server answers with the first result instead of adding 5 more.
    const lost = deps(async (input) => {
      await m.extendQuestTime(input);
      throw new Error("network");
    });
    expect(await m.extendFromRemote(q1, "5", NOW, lost)).toEqual({ kind: "FAILED", notice: { tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." }, refresh: false });
    const kept = lost.pending.get("q1")!;
    expect(kept.minutes).toBe(5);
    const retry = { ...lost, extend: vi.fn(m.extendQuestTime) };
    expect(await m.extendFromRemote(q1, "5", NOW, retry)).toMatchObject({ kind: "EXTENDED" });
    expect(retry.extend).toHaveBeenCalledWith({ id: "q1", minutes: 5, requestId: kept.requestId });
    expect(m.questExtendedMin(m.findQuest("q1")!)).toBe(15);
    expect(m.questEndsAt(m.findQuest("q1")!)).toBe(at(22));
    // Other minutes after a lost answer are a new extension (a new id).
    const other = deps(m.extendQuestTime);
    other.pending.set("q1", { minutes: 5, requestId: kept.requestId });
    expect(await m.extendFromRemote(q1, "3", NOW, other)).toMatchObject({ kind: "EXTENDED" });
    expect(other.extend.mock.calls[0][0].requestId).not.toBe(kept.requestId);
    expect(m.questExtendedMin(m.findQuest("q1")!)).toBe(18);
  }, 30_000);

  it("sends nothing for minutes out of range or unconfirmed, and answers each refusal", async () => {
    const m = await load();
    const q1 = (await m.getQuestRemote())!.quests.find((r) => r.id === "q1")!;
    const d = deps(m.extendQuestTime);
    expect(await m.extendFromRemote(q1, "61", NOW, d)).toEqual({ kind: "FAILED", notice: { tone: "error", text: "연장 시간은 1~60분으로 입력해 주세요." }, refresh: false });
    expect(await m.extendFromRemote(q1, "", NOW, d)).toMatchObject({ kind: "FAILED" });
    expect(d.confirm).not.toHaveBeenCalled();
    const no = { ...deps(m.extendQuestTime), confirm: vi.fn(() => false) };
    expect(await m.extendFromRemote(q1, "10", NOW, no)).toEqual({ kind: "SKIPPED" });
    expect(no.extend).not.toHaveBeenCalled();
    expect(no.inFlight.size).toBe(0);

    const { widgetStore } = await import("@/services/creator/widgetStore");
    widgetStore.QUEST.allowExtension = false;
    expect(await m.extendFromRemote(q1, "10", NOW, deps(m.extendQuestTime))).toEqual({
      kind: "FAILED",
      notice: { tone: "error", text: "퀘스트 위젯 설정에서 제한시간 연장 사용이 꺼져 있어요." },
      refresh: true
    });
    widgetStore.QUEST.allowExtension = true;

    await m.decideFromRemote(q1, "CANCELED", { inFlight: new Set(), confirm: () => true, decide: (await import("@/services/creator/donationManagement")).decideReceivedQuest });
    expect(await m.extendFromRemote(q1, "10", NOW, deps(m.extendQuestTime))).toEqual({
      kind: "FAILED",
      notice: { tone: "error", text: "이미 결과가 정해진 퀘스트라 연장할 수 없어요." },
      refresh: true
    });
    signIn(["SUPPORTER"]);
    expect(await m.extendFromRemote(q1, "10", NOW, deps(m.extendQuestTime))).toEqual({ kind: "SIGN_IN" });
    expect(m.findQuest("q1")!.extensions).toEqual([]);
  }, 30_000);
});

describe("연장된 마감이 보이는 곳", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    resetMockStores();
  });
  afterEach(() => vi.useRealTimers());

  it("the 리모컨 card: 시간 연장 on each running quest only while the setting is on, the new time left and 연장됨 +10분", async () => {
    const m = await load();
    const { QuestRemote } = await import("./QuestRemote");
    const render = async () => renderToStaticMarkup(createElement(QuestRemote, { view: (await m.getQuestRemote())! }));

    const before = await render();
    expect(before.match(/>시간 연장<\/button>/g)).toHaveLength(2);
    expect(before).toContain("남은 시간 07:00");
    expect(before).not.toContain("연장됨");

    expect(await m.extendQuestTime({ id: "q1", minutes: 10, requestId: key(1) })).toMatchObject({ status: "OK" });
    const after = await render();
    expect(after).toContain("남은 시간 17:00");
    expect(after).not.toContain("남은 시간 07:00");
    expect(after.match(/연장됨 \+10분/g)).toHaveLength(1);

    const { widgetStore } = await import("@/services/creator/widgetStore");
    widgetStore.QUEST.allowExtension = false;
    const off = await render();
    expect(off).not.toContain("시간 연장");
    expect(off).toContain("연장됨 +10분"); // what was added stays visible
    expect(off.match(/>취소 · 환불<\/button>/g)).toHaveLength(2);
  }, 30_000);

  it("the OBS 퀘스트 위젯 counts to the new deadline and says 연장됨 +10분", async () => {
    const m = await load();
    const overlay = await import("@/services/creator/widgetOverlay");
    const { mockCreator } = await import("@/services/creator/mockCreatorStore");
    const { QuestView } = await import("@/features/creatorStudio/widgets/GameViews");
    const render = async () => {
      const r = await overlay.getOverlayWidget("quest", mockCreator.integrationKey);
      if (r === "FORBIDDEN" || r.widget !== "quest") throw new Error("quest overlay");
      return renderToStaticMarkup(createElement(QuestView, { settings: r.settings, quests: r.quests, theme: r.theme, now: NOW }));
    };
    expect(await render()).toContain("남은시간 07:00");
    await m.extendQuestTime({ id: "q1", minutes: 10, requestId: key(1) });
    const html = await render();
    expect(html).toContain("남은시간 17:00");
    expect(html.match(/연장됨 \+10분/g)).toHaveLength(1);
  }, 30_000);

  it("받은 후원 › 퀘스트 shows the running quest's deadline in Korea time, extended", async () => {
    const m = await load();
    const { getReceivedDonations } = await import("@/services/creator/donationManagement");
    const { DonationListTab } = await import("@/features/creatorStudio/donations/DonationListTab");
    const render = async () =>
      renderToStaticMarkup(createElement(DonationListTab, { data: (await getReceivedDonations({ kind: "quest", period: range, status: "IN_PROGRESS", query: "", page: 1 }))! }));
    const before = await render();
    expect(before).toContain("마감 2026.10.18 12:07<");
    expect(before).toContain("마감 2026.10.18 12:24<");
    await m.extendQuestTime({ id: "q1", minutes: 10, requestId: key(1) });
    const after = await render();
    expect(after).toContain("마감 2026.10.18 12:17 · 연장됨 +10분");
    expect(after).not.toContain("마감 2026.10.18 12:07");
    expect(after).toContain("마감 2026.10.18 12:24<"); // the other one as it was
  }, 30_000);

  it("the supporter's 후원 내역 shows the deadline of their running quest, extended", async () => {
    const m = await load();
    const creators = await import("@/services/creators/creators");
    const { requestDonation } = await import("@/services/donations/donate");
    const { getDonationHistory } = await import("@/services/wallet/walletHistory");
    const { DonationTable } = await import("@/features/wallet/DonationTable");
    const { mockAccount } = await import("@/services/account/mockStore");
    mockAccount.fnBalance = 100_000;
    const c1 = (await creators.getCreatorById("c1"))!;
    vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
    const sent = await requestDonation({ creatorId: "studio", hideProfile: false, type: "QUEST", title: "내 퀘스트", successReward: 10_000, timeLimitSec: 600, creatorDecides: false, termsAgreed: true, idempotencyKey: key(7) });
    if (sent.status !== "COMPLETED") throw new Error(sent.status);
    const render = async () => renderToStaticMarkup(createElement(DonationTable, { items: (await getDonationHistory({ period: range, category: "quest" }))!.items }));
    expect(await render()).toContain("마감 2026-10-18 12:10<");
    await m.extendQuestTime({ id: sent.donationId, minutes: 30, requestId: key(1) });
    const html = await render();
    expect(html).toContain("마감 2026-10-18 12:40 · 연장됨 +30분");
    expect(html).not.toContain("마감 2026-10-18 12:10");
  }, 30_000);

  it("the 퀘스트 위젯 settings say what 제한시간 연장 사용 does", async () => {
    const { getWidgetDetail } = await import("@/services/creator/widgetSettings");
    const { QuestForm } = await import("@/features/creatorStudio/widgets/gameForms");
    const detail = await getWidgetDetail("QUEST");
    if (!detail || detail.key !== "QUEST") throw new Error("no quest settings");
    const html = renderToStaticMarkup(createElement(QuestForm, { value: detail.settings as Parameters<typeof QuestForm>[0]["value"], onChange: () => {}, live: detail.live }));
    expect(html).toContain("켜면 리모컨의 퀘스트 카드에서 진행 중인 퀘스트에 시간을 더할 수 있어요 (한 번에 1~60분). 제한 시간이 지난 퀘스트는 지금부터 다시 계산해요.");
  }, 30_000);
});
