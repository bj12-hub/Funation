import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 크루 방송 후원자 이름 (2026-10-09 결정): the 후원 리스트 and member attributions keep the name as sent for the creator's
 * own screens (방송 운영 후원 리스트, 받은 후원 › 크루 후원), and the name on stream — after the creator's 대체 메시지 rules
 * (익명 or the 대체 문구) — fixed when the donation was sent, so a later 금지어 change does not rewrite it.
 */
async function load() {
  const bc = await import("./crewBroadcast");
  const feed = await import("./crewFeed");
  const core = await import("./crewCore");
  const { mockCrew } = await import("./mockCrewStore");
  const { donationPageStore, donationFilterStore } = await import("@/services/creator/donationPageCore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { requestDonation } = await import("@/services/donations/donate");
  const quests = await import("@/services/donations/quests");
  // The session's donations go to the studio channel (its crew and its live broadcast).
  const creators = await import("@/services/creators/creators");
  const c1 = (await creators.getCreatorById("c1"))!;
  vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
  mockAccount.fnBalance = 100_000;
  Object.assign(donationFilterStore, { strength: "OFF", blockSpam: false, words: [] });
  // 대체 메시지 표시 설정: a name with 길동 shows as the 대체 메시지 on stream.
  donationPageStore.replacement = { applyToNickname: true, applyToText: false, bannedWords: ["길동"], message: "응원 고마워요" };
  expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "크루 방송", teamMode: false })).toEqual({ status: "SAVED" });
  let n = 0;
  const send = (extra: Record<string, unknown> = {}) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "TEXT", amount: 1_000, message: "응원해요", voiceId: null, idempotencyKey: key(++n), ...extra });
  const feedEntries = async () => (await bc.getBroadcastView())!.feed!.entries;
  return { ...bc, ...feed, ...core, ...quests, mockCrew, donationPageStore, overlayKey: mockCreator.integrationKey, send, feedEntries };
}

describe("크루 방송 후원자 이름 (방송 화면 · 운영 화면)", () => {
  beforeEach(() => resetMockStores());

  it("keeps the name as sent for the operator and stores the replaced name for the stream, fixed when sent", async () => {
    const m = await load();
    expect((await m.send()).status).toBe("COMPLETED"); // 후원 리스트 (no member)
    expect((await m.send({ memberId: "cm-s2" })).status).toBe("COMPLETED"); // 멤버 지정
    expect((await m.feedEntries())[0]).toMatchObject({ source: "DONATION", donor: "홍길동", shownDonor: "응원 고마워요" });
    expect(m.mockCrew.attributions.at(-1)).toMatchObject({ channelId: "studio", memberId: "cm-s2", donor: "홍길동", shownDonor: "응원 고마워요" });

    // An empty 대체 메시지 shows 익명 on stream.
    m.donationPageStore.replacement.message = "";
    await m.send();
    await m.send({ memberId: "cm-s3" });
    expect((await m.feedEntries())[0]).toMatchObject({ donor: "홍길동", shownDonor: "익명" });
    expect(m.mockCrew.attributions.at(-1)).toMatchObject({ memberId: "cm-s3", donor: "홍길동", shownDonor: "익명" });

    // The creator drops the 금지어: earlier records keep the name they went out with; a new one is not replaced.
    m.donationPageStore.replacement = { applyToNickname: true, applyToText: false, bannedWords: [], message: "응원 고마워요" };
    await m.send();
    const entries = await m.feedEntries(); // newest first
    expect(entries.map((e) => [e.donor, e.shownDonor])).toEqual([
      ["홍길동", "홍길동"],
      ["홍길동", "익명"],
      ["홍길동", "응원 고마워요"]
    ]);
    expect(m.mockCrew.attributions.filter((a) => a.donor === "홍길동").map((a) => a.shownDonor)).toEqual(["응원 고마워요", "익명"]);

    // 받은 후원 › 크루 후원 (the creator's own list) shows the name as sent.
    expect(m.crewDonationRows("studio").filter((r) => r.member !== "삭제된 멤버").slice(0, 2).map((r) => r.donor)).toEqual(["홍길동", "홍길동"]);
  });

  it("takes a 퀘스트's name on stream from when it was sent, not from when it succeeded", async () => {
    const m = await load();
    const quest = (n: number, extra: Record<string, unknown> = {}) =>
      m.send({ type: "QUEST", title: `퀘스트 ${n}`, successReward: 5_000, timeLimitSec: 600, creatorDecides: false, termsAgreed: true, idempotencyKey: key(100 + n), ...extra });
    const listed = await quest(1);
    const forMember = await quest(2, { memberId: "cm-s1" });
    if (listed.status !== "COMPLETED" || forMember.status !== "COMPLETED") throw new Error("quest not sent");
    // The 금지어 goes before the results: the quests' alerts already went out with the replaced name.
    m.donationPageStore.replacement = { applyToNickname: false, applyToText: false, bannedWords: [], message: "" };
    expect(await m.decideMyQuest({ id: listed.donationId, outcome: "SUCCESS" })).toMatchObject({ status: "OK", questStatus: "SUCCESS" });
    expect(await m.decideMyQuest({ id: forMember.donationId, outcome: "SUCCESS" })).toMatchObject({ status: "OK", questStatus: "SUCCESS" });
    expect((await m.feedEntries())[0]).toMatchObject({ donor: "홍길동", shownDonor: "응원 고마워요", amount: 5_000 });
    expect(m.mockCrew.attributions.find((a) => a.donationId === forMember.donationId)).toMatchObject({ donor: "홍길동", shownDonor: "응원 고마워요" });
  });

  it("leaves platform, 계좌 and 시뮬 entries as sent (their alerts are not replaced)", async () => {
    const m = await load();
    const id = (await m.getBroadcastView())!.live!.id;
    m.recordBroadcastExternal("studio", { platform: "CHZZK", donor: "길동팬", message: "", value: 1_000, unit: "CHZZK_CHEESE" });
    m.recordBroadcastBank("studio", { donor: "홍길동", value: 5_000 });
    expect(await m.simulateDonation({ broadcastId: id, requestId: key(50), amount: 1_000, unit: "FN", donor: "시뮬 길동", message: "" })).toEqual({ status: "SAVED" });
    expect((await m.feedEntries()).map((e) => [e.source, e.donor, e.shownDonor])).toEqual([
      ["SIM", "시뮬 길동", "시뮬 길동"],
      ["BANK", "홍길동", "홍길동"],
      ["DONATION", "길동팬", "길동팬"]
    ]);
  });

  it("never puts a donor's name as sent on the OBS crew overlay", async () => {
    const m = await load();
    await m.send();
    await m.send({ memberId: "cm-s2" });
    const live = await m.getOverlayScoreboard(m.overlayKey);
    if (live === "IDLE" || live === "FORBIDDEN") throw new Error(String(live));
    // The overlay carries members (scores, 랭크업, battles, 강탈), not the 후원 리스트.
    expect(live.rows.find((r) => r.memberId === "cm-s2")?.score).toBeGreaterThan(0);
    expect(JSON.stringify(live)).not.toContain("홍길동");
  });
});
