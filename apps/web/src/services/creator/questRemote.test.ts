import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuestAction, QuestDecideResult } from "@/services/donations/questTypes";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 리모컨 퀘스트 card (code-first, funnation 기본값): the running quests of the studio, settled with the same server action as
 * 후원관리+ › 받은 후원 › 퀘스트 — so a decision in either place is the same decision, made once, refunded once.
 */

const range = { preset: "range" as const, from: "2000-01-01", to: "2099-12-31" };

const quest = (n: number, creatorId: string, creatorDecides: boolean) => ({
  creatorId,
  hideProfile: false,
  type: "QUEST",
  title: `리모컨 퀘스트 ${n}`,
  successReward: 10_000,
  timeLimitSec: 600,
  creatorDecides,
  termsAgreed: true,
  idempotencyKey: key(n)
});

async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const remote = await import("./questRemote");
  const management = await import("./donationManagement");
  const core = await import("@/services/donations/questCore");
  const { requestDonation } = await import("@/services/donations/donate");
  const { decideMyQuest } = await import("@/services/donations/quests");
  const creators = await import("@/services/creators/creators");
  const model = await import("@/features/creatorStudio/remote/questRemoteModel");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  mockAccount.fnBalance = 100_000;
  const received = async () => (await management.getReceivedDonations({ kind: "quest", period: range, status: "ALL", query: "", page: 1 }))!.items;
  const listed = async () => (await remote.getQuestRemote())!.quests;
  /** The studio receives the quests sent from here on (only the studio channel has a 받은 후원 list in mock mode). */
  const toStudio = async () => {
    const c1 = (await creators.getCreatorById("c1"))!;
    vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
  };
  return { ...remote, ...management, ...core, ...model, requestDonation, decideMyQuest, account: mockAccount, walletStore: mockWallet, received, listed, toStudio };
}

describe("리모컨 퀘스트 목록", () => {
  beforeEach(() => resetMockStores());

  it("lists only the studio's running quests, oldest first, with the actions 받은 후원 offers", async () => {
    const m = await load();
    const elsewhere = await m.requestDonation(quest(1, "c1", true)); // another channel's quest
    await m.toStudio();
    const mine = await m.requestDonation(quest(2, "studio", false)); // the supporter keeps 성공 · 실패
    if (elsewhere.status !== "COMPLETED" || mine.status !== "COMPLETED") throw new Error("not sent");

    const rows = await m.listed();
    const running = m.mockQuests.items.filter((q) => q.channelId === "studio" && q.status === "IN_PROGRESS");
    expect(running.length).toBe(3); // two sample quests and the one just sent
    expect(m.mockQuests.items.some((q) => q.status !== "IN_PROGRESS")).toBe(true); // decided ones exist, and stay out
    expect(rows.map((r) => r.id)).toEqual([...running].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((q) => q.id));
    expect(rows.map((r) => r.id)).not.toContain(elsewhere.donationId);
    expect(rows.at(-1)).toMatchObject({ id: mine.donationId, title: "리모컨 퀘스트 2", amount: 10_000, actions: ["CANCELED"] });
    for (const r of rows) {
      const q = m.findQuest(r.id)!;
      // Donor and title as recorded (받은 후원 shows the original text too).
      expect(r).toMatchObject({ donor: q.donor, donorId: q.donorId, title: q.title, createdAt: q.createdAt });
      expect(Date.parse(r.endsAt) - Date.parse(r.createdAt)).toBe(q.timeLimitSec * 1000);
    }

    // The same quests and buttons as 받은 후원 › 퀘스트 (진행중 rows).
    const inList = (await m.received()).filter((d) => d.status === "IN_PROGRESS");
    expect(new Map(rows.map((r) => [r.id, r.actions]))).toEqual(new Map(inList.map((d) => [d.id, d.questActions])));
  }, 30_000);

  it("is closed without a creator session", async () => {
    const m = await load();
    signIn(["SUPPORTER"]);
    expect(await m.getQuestRemote()).toBeNull();
    signIn(null);
    expect(await m.getQuestRemote()).toBeNull();
  }, 30_000);

  it("shows EMPTY once every quest is decided", async () => {
    const m = await load();
    for (const r of await m.listed()) expect(await m.decideReceivedQuest({ id: r.id, outcome: "SUCCESS" })).toMatchObject({ status: "OK" });
    expect(await m.listed()).toEqual([]);
  }, 30_000);
});

describe("리모컨에서 정한 퀘스트 결과", () => {
  beforeEach(() => resetMockStores());

  /** What the card passes: one in-flight set for every click, the browser's confirm (answered 확인) and the action. */
  const deps = (decide: (input: { id: string; outcome: QuestAction }) => Promise<QuestDecideResult>) => ({
    inFlight: new Set<string>(),
    confirm: vi.fn(() => true),
    decide
  });

  it("changes the same record as 받은 후원, and a decision in 받은 후원 leaves the 리모컨 too", async () => {
    const m = await load();
    const [first, second] = await m.listed();

    const fromRemote = await m.decideFromRemote(first, "FAILED", deps(m.decideReceivedQuest));
    expect(fromRemote).toEqual({ kind: "DECIDED", notice: { tone: "ok", text: `‘${first.title}’ 퀘스트를 실패로 정했어요. ${first.amount.toLocaleString("ko-KR")} FN을 후원자에게 전액 환불했어요.` } });
    expect((await m.listed()).map((r) => r.id)).toEqual([second.id]);
    expect((await m.received()).find((d) => d.id === first.id)).toMatchObject({ status: "FAILED", questActions: [] });
    expect(m.findQuest(first.id)).toMatchObject({ status: "FAILED", decidedBy: "CREATOR", refundedFn: first.amount });
    // 받은 후원 sees the result: the same outcome again is the same answer, the other one is refused.
    expect(await m.decideReceivedQuest({ id: first.id, outcome: "FAILED" })).toEqual({ status: "OK", questStatus: "FAILED", refundedFn: first.amount });
    expect(await m.decideReceivedQuest({ id: first.id, outcome: "SUCCESS" })).toEqual({ status: "ALREADY_DECIDED", questStatus: "FAILED" });

    // Decided in 받은 후원: gone from the 리모컨, and the 리모컨's stale row is told so (and refreshes).
    expect(await m.decideReceivedQuest({ id: second.id, outcome: "SUCCESS" })).toMatchObject({ status: "OK", questStatus: "SUCCESS" });
    expect(await m.listed()).toEqual([]);
    expect(await m.decideFromRemote(second, "CANCELED", deps(m.decideReceivedQuest))).toEqual({
      kind: "FAILED",
      notice: { tone: "error", text: "이미 다른 결과로 정해진 퀘스트예요." },
      refresh: true
    });
    expect(m.findQuest(second.id)).toMatchObject({ status: "SUCCESS", refundedFn: 0 });
  }, 30_000);

  it("refunds a cancelled quest to its sender once, even on a double click", async () => {
    const m = await load();
    await m.toStudio();
    const sent = await m.requestDonation(quest(1, "studio", false));
    if (sent.status !== "COMPLETED") throw new Error(sent.status);
    expect(m.account.fnBalance).toBe(90_000);
    const row = (await m.listed()).find((r) => r.id === sent.donationId)!;

    const decide = vi.fn(m.decideReceivedQuest);
    const d = deps(decide);
    const [a, b] = await Promise.all([m.decideFromRemote(row, "CANCELED", d), m.decideFromRemote(row, "CANCELED", d)]);
    expect(a).toMatchObject({ kind: "DECIDED", notice: { tone: "ok", text: "‘리모컨 퀘스트 1’ 퀘스트를 취소했어요. 10,000 FN을 후원자에게 전액 환불했어요." } });
    expect(b).toEqual({ kind: "SKIPPED" });
    expect(decide).toHaveBeenCalledTimes(1);
    expect(d.confirm).toHaveBeenCalledTimes(1);
    expect(d.inFlight.size).toBe(0);
    expect(m.account.fnBalance).toBe(100_000);
    expect(m.walletStore.donations.find((x) => x.id === sent.donationId)!.status).toBe("REFUNDED");

    // A retry after that (a click on the row before the refresh dropped it) gets the first result, not a second refund.
    expect(await m.decideFromRemote(row, "CANCELED", d)).toMatchObject({ kind: "DECIDED" });
    expect(m.account.fnBalance).toBe(100_000);
    // The supporter's own 후원 내역 sees the same result.
    expect(await m.decideMyQuest({ id: sent.donationId, outcome: "SUCCESS" })).toEqual({ status: "ALREADY_DECIDED", questStatus: "CANCELED" });
  }, 30_000);

  it("sends nothing unconfirmed or not offered, and answers a sign-out and a failed request", async () => {
    const m = await load();
    await m.toStudio();
    const sent = await m.requestDonation(quest(1, "studio", false));
    if (sent.status !== "COMPLETED") throw new Error(sent.status);
    const row = (await m.listed()).find((r) => r.id === sent.donationId)!;
    const decide = vi.fn(m.decideReceivedQuest);

    // 취소 is the only action here: 성공 · 실패 belong to the supporter (no dialog either).
    const d = deps(decide);
    expect(await m.decideFromRemote(row, "SUCCESS", d)).toEqual({ kind: "SKIPPED" });
    expect(d.confirm).not.toHaveBeenCalled();
    const no = { ...deps(decide), confirm: vi.fn(() => false) };
    expect(await m.decideFromRemote(row, "CANCELED", no)).toEqual({ kind: "SKIPPED" });
    expect(no.inFlight.size).toBe(0);
    expect(decide).not.toHaveBeenCalled();

    const failing = { ...deps(vi.fn(async () => Promise.reject(new Error("offline")))), onStart: vi.fn() };
    expect(await m.decideFromRemote(row, "CANCELED", failing)).toEqual({ kind: "FAILED", notice: { tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." }, refresh: false });
    expect(failing.onStart).toHaveBeenCalledTimes(1);
    expect(failing.inFlight.size).toBe(0); // the next click can try again

    signIn(["SUPPORTER"]);
    expect(await m.decideFromRemote(row, "CANCELED", deps(m.decideReceivedQuest))).toEqual({ kind: "SIGN_IN" });
    expect(m.findQuest(sent.donationId)!.status).toBe("IN_PROGRESS");
    expect(m.account.fnBalance).toBe(90_000);
  }, 30_000);
});
