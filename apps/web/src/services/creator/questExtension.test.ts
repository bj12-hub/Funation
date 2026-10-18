import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 퀘스트 제한 시간 연장 (2026-10-18 결정): with the 퀘스트 위젯's 제한시간 연장 사용 on, the creator adds whole minutes (1~60)
 * to a running quest from the 리모컨 퀘스트 card — onto the deadline, or from now once it passed — once per request id, and
 * every place that shows the deadline (리모컨, 받은 후원 › 퀘스트, the supporter's 후원 내역, the OBS 퀘스트 위젯) shows the new one.
 */

const NOW = Date.parse("2026-10-18T03:00:00.000Z"); // 12:00 KST
const at = (offsetMin: number) => new Date(NOW + offsetMin * 60_000).toISOString();
const range = { preset: "range" as const, from: "2000-01-01", to: "2099-12-31" };
const refused = { status: "INVALID", message: "잘못된 요청입니다." };
const outOfBounds = { status: "INVALID", message: "연장 시간은 1~60분으로 입력해 주세요." };

async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const remote = await import("./questRemote");
  const management = await import("./donationManagement");
  const core = await import("@/services/donations/questCore");
  const { requestDonation } = await import("@/services/donations/donate");
  const { getDonationHistory } = await import("@/services/wallet/walletHistory");
  const { getMockDonationCatalog } = await import("@/services/donations/donationCatalog");
  const { widgetStore } = await import("./widgetStore");
  const overlay = await import("./widgetOverlay");
  const { mockCreator } = await import("./mockCreatorStore");
  const creators = await import("@/services/creators/creators");
  mockAccount.fnBalance = 100_000;
  const listed = async () => (await remote.getQuestRemote())!.quests;
  const received = async (id: string) =>
    (await management.getReceivedDonations({ kind: "quest", period: range, status: "ALL", query: "", page: 1 }))!.items.find((d) => d.id === id)!;
  const onStream = async () => {
    const r = await overlay.getOverlayWidget("quest", mockCreator.integrationKey);
    if (r === "FORBIDDEN" || r.widget !== "quest") throw new Error("quest overlay");
    return r.quests;
  };
  const history = async (id: string) => (await getDonationHistory({ period: range, category: "quest" }))!.items.find((d) => d.id === id)!.quest;
  /** A quest the signed-in member sends to the studio (only the studio channel has a 받은 후원 list in mock mode). */
  const sendToStudio = async (n: number) => {
    const c1 = (await creators.getCreatorById("c1"))!;
    vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
    const sent = await requestDonation({ creatorId: "studio", hideProfile: false, type: "QUEST", title: `연장 퀘스트 ${n}`, successReward: 10_000, timeLimitSec: 600, creatorDecides: false, termsAgreed: true, idempotencyKey: key(n) });
    if (sent.status !== "COMPLETED") throw new Error(sent.status);
    return sent.donationId;
  };
  return { ...remote, ...management, ...core, requestDonation, getMockDonationCatalog, widgetStore, listed, received, onStream, history, sendToStudio };
}

describe("퀘스트 제한 시간 연장", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    resetMockStores();
  });
  afterEach(() => vi.useRealTimers());

  it("adds the minutes to the deadline, keeps each extension on the quest, and every deadline moves with it", async () => {
    const m = await load();
    const q1 = m.findQuest("q1")!; // a sample quest sent 3 minutes ago with 10 minutes: deadline 12:07 KST
    expect(m.questEndsAt(q1)).toBe(at(7));
    expect((await m.getQuestRemote())!.allowExtension).toBe(true); // 제한시간 연장 사용 is on by default

    expect(await m.extendQuestTime({ id: "q1", minutes: 10, requestId: key(1) })).toEqual({ status: "OK", minutes: 10, endsAt: at(17), restarted: false });
    vi.setSystemTime(NOW + 60_000);
    expect(await m.extendQuestTime({ id: "q1", minutes: 5, requestId: key(2) })).toEqual({ status: "OK", minutes: 5, endsAt: at(22), restarted: false });
    expect(q1.extensions).toEqual([
      { requestId: key(1), minutes: 10, at: at(0), endsAt: at(17), restarted: false },
      { requestId: key(2), minutes: 5, at: at(1), endsAt: at(22), restarted: false }
    ]);
    expect(q1).toMatchObject({ status: "IN_PROGRESS", timeLimitSec: 600, amount: q1.amount }); // nothing else changes

    // 리모컨 · 받은 후원 › 퀘스트 · OBS 퀘스트 위젯: the new deadline and "+15분".
    expect((await m.listed()).find((r) => r.id === "q1")).toMatchObject({ endsAt: at(22), extendedMin: 15 });
    expect(await m.received("q1")).toMatchObject({ status: "IN_PROGRESS", questEndsAt: at(22), questExtendedMin: 15 });
    expect((await m.onStream()).find((r) => r.id === "q1")).toMatchObject({ endsAt: at(22), extendedMin: 15 });
    // The other running quest is untouched.
    expect((await m.listed()).find((r) => r.id === "q2")).toMatchObject({ endsAt: at(24), extendedMin: 0 });
  }, 30_000);

  it("moves the supporter's 후원 내역 deadline too", async () => {
    const m = await load();
    const id = await m.sendToStudio(1);
    expect(await m.history(id)).toEqual({ status: "IN_PROGRESS", canDecide: true, endsAt: at(10), extendedMin: 0 });
    expect(await m.extendQuestTime({ id, minutes: 30, requestId: key(50) })).toMatchObject({ status: "OK", endsAt: at(40) });
    expect(await m.history(id)).toEqual({ status: "IN_PROGRESS", canDecide: true, endsAt: at(40), extendedMin: 30 });
  }, 30_000);

  it("takes whole minutes from 1 to 60 — the cap of the time limit a supporter sets", async () => {
    const m = await load();
    expect(m.getMockDonationCatalog().game.maxTimeSec).toBe(60 * 60);
    let n = 0;
    for (const minutes of [0, 61, -5, 1.5, "10", null, undefined, Number.NaN]) {
      expect(await m.extendQuestTime({ id: "q1", minutes, requestId: key(++n) }), String(minutes)).toEqual(outOfBounds);
    }
    expect(m.findQuest("q1")!.extensions).toEqual([]);
    expect(await m.extendQuestTime({ id: "q1", minutes: 1, requestId: key(++n) })).toMatchObject({ status: "OK", endsAt: at(8) });
    expect(await m.extendQuestTime({ id: "q1", minutes: 60, requestId: key(++n) })).toMatchObject({ status: "OK", endsAt: at(68) });
  }, 30_000);

  it("needs the creator's session and the studio's own running quest", async () => {
    const m = await load();
    signIn(["SUPPORTER"]);
    expect(await m.extendQuestTime({ id: "q1", minutes: 10, requestId: key(1) })).toEqual({ status: "UNAUTHORIZED" });
    signIn(null);
    expect(await m.extendQuestTime({ id: "q1", minutes: 10, requestId: key(1) })).toEqual({ status: "UNAUTHORIZED" });
    signIn();

    // Another channel's quest (sent to c1) looks missing, as does an unknown id.
    const elsewhere = await m.requestDonation({ creatorId: "c1", hideProfile: false, type: "QUEST", title: "다른 채널", successReward: 5_000, timeLimitSec: 600, creatorDecides: true, termsAgreed: true, idempotencyKey: key(9) });
    if (elsewhere.status !== "COMPLETED") throw new Error(elsewhere.status);
    expect(await m.extendQuestTime({ id: elsewhere.donationId, minutes: 10, requestId: key(2) })).toEqual({ status: "NOT_FOUND" });
    expect(await m.extendQuestTime({ id: "nope", minutes: 10, requestId: key(3) })).toEqual({ status: "NOT_FOUND" });
    expect(m.findQuest(elsewhere.donationId)!.extensions).toEqual([]);

    // A decided quest has no time limit any more.
    expect(await m.decideReceivedQuest({ id: "q2", outcome: "SUCCESS" })).toMatchObject({ status: "OK" });
    expect(await m.extendQuestTime({ id: "q2", minutes: 10, requestId: key(4) })).toEqual({ status: "ALREADY_DECIDED", questStatus: "SUCCESS" });
    expect(m.findQuest("q2")!.extensions).toEqual([]);
    expect(m.findQuest("q1")!.extensions).toEqual([]);
  }, 30_000);

  it("is refused while 제한시간 연장 사용 is off, and the 리모컨 is told to hide it", async () => {
    const m = await load();
    m.widgetStore.QUEST.allowExtension = false;
    expect((await m.getQuestRemote())!.allowExtension).toBe(false);
    expect(await m.extendQuestTime({ id: "q1", minutes: 10, requestId: key(1) })).toEqual({ status: "DISABLED" });
    expect(m.findQuest("q1")!.extensions).toEqual([]);
    m.widgetStore.QUEST.allowExtension = true;
    expect(await m.extendQuestTime({ id: "q1", minutes: 10, requestId: key(1) })).toMatchObject({ status: "OK", endsAt: at(17) });
  }, 30_000);

  it("adds once per request id: a retry gets the first answer, the same id for anything else is refused", async () => {
    const m = await load();
    const first = await m.extendQuestTime({ id: "q1", minutes: 10, requestId: key(1) });
    expect(first).toEqual({ status: "OK", minutes: 10, endsAt: at(17), restarted: false });
    // Retried later (a lost answer), even after another extension: the same answer, nothing added.
    expect(await m.extendQuestTime({ id: "q1", minutes: 5, requestId: key(2) })).toMatchObject({ status: "OK", endsAt: at(22) });
    expect(await m.extendQuestTime({ id: "q1", minutes: 10, requestId: key(1) })).toEqual(first);
    expect(m.questExtendedMin(m.findQuest("q1")!)).toBe(15);

    // A double click racing itself: one extension.
    const [a, b] = await Promise.all([m.extendQuestTime({ id: "q2", minutes: 7, requestId: key(3) }), m.extendQuestTime({ id: "q2", minutes: 7, requestId: key(3) })]);
    expect(a).toEqual({ status: "OK", minutes: 7, endsAt: at(31), restarted: false });
    expect(b).toEqual(a);
    expect(m.findQuest("q2")!.extensions).toHaveLength(1);

    // The same id with other minutes or for another quest is a different request: 잘못된 요청.
    expect(await m.extendQuestTime({ id: "q1", minutes: 11, requestId: key(1) })).toEqual(refused);
    expect(await m.extendQuestTime({ id: "q2", minutes: 10, requestId: key(1) })).toEqual(refused);
    // No usable id at all.
    expect(await m.extendQuestTime({ id: "q1", minutes: 10, requestId: "short" })).toEqual(refused);
    expect(await m.extendQuestTime({ id: "q1", minutes: 10 })).toEqual(refused);
    expect(m.questExtendedMin(m.findQuest("q1")!)).toBe(15);
    expect(m.questExtendedMin(m.findQuest("q2")!)).toBe(7);

    // A retry that reaches the server after the quest was decided still gets its first answer (and adds nothing).
    expect(await m.decideReceivedQuest({ id: "q1", outcome: "FAILED" })).toMatchObject({ status: "OK" });
    expect(await m.extendQuestTime({ id: "q1", minutes: 10, requestId: key(1) })).toEqual(first);
    expect(m.findQuest("q1")!.extensions).toHaveLength(2);
  }, 30_000);

  it("counts from now for a quest already past its deadline (시간 초과 · 결과 대기), which still runs", async () => {
    const m = await load();
    const q1 = m.findQuest("q1")!;
    q1.createdAt = at(-120); // sent two hours ago with 10 minutes: 1:50 overdue
    expect(m.questEndsAt(q1)).toBe(at(-110));
    expect(await m.extendQuestTime({ id: "q1", minutes: 10, requestId: key(1) })).toEqual({ status: "OK", minutes: 10, endsAt: at(10), restarted: true });
    expect((await m.listed()).find((r) => r.id === "q1")).toMatchObject({ endsAt: at(10), extendedMin: 10 });

    // Before the new deadline the next extension adds to it again.
    vi.setSystemTime(NOW + 4 * 60_000);
    expect(await m.extendQuestTime({ id: "q1", minutes: 5, requestId: key(2) })).toEqual({ status: "OK", minutes: 5, endsAt: at(15), restarted: false });
    // Exactly at the deadline it is over: from now.
    vi.setSystemTime(Date.parse(at(15)));
    expect(await m.extendQuestTime({ id: "q1", minutes: 1, requestId: key(3) })).toEqual({ status: "OK", minutes: 1, endsAt: at(16), restarted: true });
    expect(q1.extensions.map((x) => x.restarted)).toEqual([true, false, true]);
    expect(await m.received("q1")).toMatchObject({ questEndsAt: at(16), questExtendedMin: 16 });
  }, 30_000);
});
