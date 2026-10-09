import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, rejoinWithPhone, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/**
 * 이벤트 보상 (2026-10-08 결정): the operator sets 참여자 전원 무상 FN or 추첨 N명 경품 per event; after the event ends it
 * is paid / drawn once, per person, to the account that belongs to that person now (none: 지급 불가).
 */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };
/** The sample event that has ended (mock events are dated relative to today); the sample member joined it. */
const ENDED = "ev-attendance";
const ONGOING = "ev-first-donation";
const UPCOMING = "ev-crew-season";

async function load() {
  const admin = await import("./events");
  const site = await import("@/services/events/events");
  const core = await import("@/services/events/eventsCore");
  const { mockAccount, currentPersonKey } = await import("@/services/account/mockStore");
  const { mockCredits } = await import("@/services/wallet/mockCreditStore");
  const { getWalletOverview } = await import("@/services/wallet/walletHistory");
  const { auditEntries } = await import("./auditCore");
  core.eventStore(); // the sample join is the person holding the slot when the store is first read: the sample member
  return { ...admin, ...site, core, account: mockAccount, currentPersonKey, mockCredits, getWalletOverview, auditEntries };
}
type M = Awaited<ReturnType<typeof load>>;

const row = async (m: M, id: string) => (await m.listEventsAdmin()).events.find((e) => e.id === id)!;
/** Adds a person's join directly (only a running event takes joins through the site). */
const addJoin = (m: M, eventId: string, person: string) => {
  const joined = m.core.eventStore().joined;
  const people = joined.get(eventId) ?? new Map<string, string>();
  people.set(person, new Date().toISOString());
  joined.set(eventId, people);
};

describe("이벤트 보상 설정", () => {
  beforeEach(() => resetMockStores());

  it("validates the reward on the server and has no default amount", async () => {
    const m = await load();
    const save = (body: Record<string, unknown>) => m.saveEventReward(OP, { id: ONGOING, ...body });
    expect(await save({})).toEqual({ status: "INVALID", message: "보상 종류를 골라 주세요." });
    for (const amountFn of [undefined, 0, -100, 12.5, "1000", 10_000_001]) {
      expect(await save({ kind: "FREE_FN", amountFn })).toEqual({ status: "INVALID", message: "지급 FN을 1~10,000,000 사이의 정수로 입력해 주세요." });
    }
    for (const winners of [undefined, 0, 2.5, "3", 1_001]) {
      expect(await save({ kind: "DRAW", winners, prize: "문화상품권" })).toEqual({ status: "INVALID", message: "당첨 인원을 1~1,000명으로 입력해 주세요." });
    }
    expect(await save({ kind: "DRAW", winners: 3, prize: " 가 " })).toEqual({ status: "INVALID", message: "경품 내용을 2~100자로 입력해 주세요." });
    expect(await save({ kind: "DRAW", winners: 3, prize: "가".repeat(101) })).toEqual({ status: "INVALID", message: "경품 내용을 2~100자로 입력해 주세요." });
    expect(await save({ kind: "DRAW", winners: 3, prize: "운영자 선물" })).toEqual({ status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." });
    expect(await m.saveEventReward(OP, { id: "__proto__", kind: "FREE_FN", amountFn: 100 })).toEqual({ status: "NOT_FOUND" });
    expect((await row(m, ONGOING)).reward).toBeNull();
    expect(m.auditEntries()).toEqual([]);
    // Nothing set: the site keeps the TBD note.
    expect(await m.getEvent(ONGOING)).toMatchObject({ reward: null, outcome: null, rewardNote: "보상 내용과 지급 방식은 정책이 확정되면 안내돼요 (TBD)." });
  });

  it("saves, audits changes only, and shows the reward on the site", async () => {
    const m = await load();
    expect(await m.saveEventReward(OP, { id: ONGOING, kind: "FREE_FN", amountFn: 1_000 })).toEqual({ status: "OK" });
    expect(await m.saveEventReward(OP, { id: ONGOING, kind: "FREE_FN", amountFn: 1_000 })).toEqual({ status: "OK" }); // same: no log
    expect(await m.saveEventReward(OP, { id: ONGOING, kind: "DRAW", winners: 3, prize: "  굿즈 세트  " })).toEqual({ status: "OK" });
    expect(m.auditEntries().map((e) => [e.action, e.target, e.reason])).toEqual([
      ["EVENT_REWARD_SET", `event:${ONGOING}`, "첫 후원 응원 이벤트 · 추첨 3명 경품 · 굿즈 세트 (이전: 참여자 전원 무상 FN · 1인 1,000 FN)"],
      ["EVENT_REWARD_SET", `event:${ONGOING}`, "첫 후원 응원 이벤트 · 참여자 전원 무상 FN · 1인 1,000 FN"]
    ]);
    expect((await row(m, ONGOING)).reward).toMatchObject({ kind: "DRAW", winners: 3, prize: "굿즈 세트", updatedBy: "테스트 운영자" });
    expect((await m.getEvent(ONGOING))!.reward).toEqual({ kind: "DRAW", winners: 3, prize: "굿즈 세트" });
  });
});

describe("이벤트 보상 지급 · 추첨", () => {
  beforeEach(() => resetMockStores());

  it("refuses to pay or draw before the event ends, without a reward, or for the other kind", async () => {
    const m = await load();
    expect(await m.payEventReward(OP, { id: ENDED, requestId: key(1) })).toEqual({ status: "INVALID", message: "먼저 보상을 설정해 주세요." });
    await m.saveEventReward(OP, { id: ONGOING, kind: "FREE_FN", amountFn: 500 });
    await m.saveEventReward(OP, { id: UPCOMING, kind: "DRAW", winners: 1, prize: "굿즈" });
    expect(await m.payEventReward(OP, { id: ONGOING, requestId: key(2) })).toEqual({ status: "INVALID", message: "이벤트가 끝난 뒤에 보상을 지급할 수 있어요." });
    expect(await m.drawEventWinners(OP, { id: UPCOMING, requestId: key(3) })).toEqual({ status: "INVALID", message: "이벤트가 끝난 뒤에 당첨자를 추첨할 수 있어요." });
    expect(await m.drawEventWinners(OP, { id: ONGOING, requestId: key(4) })).toEqual({ status: "INVALID", message: "참여자 전원 무상 FN 이벤트예요. 보상 지급으로 처리해 주세요." });
    expect(await m.payEventReward(OP, { id: ONGOING, requestId: "bad" })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(await m.payEventReward(OP, { id: "nope", requestId: key(5) })).toEqual({ status: "NOT_FOUND" });
    expect((await row(m, ONGOING)).result).toBeNull();
    expect(m.auditEntries().some((e) => e.action === "EVENT_REWARD_PAY" || e.action === "EVENT_DRAW")).toBe(false);
  });

  it("pays each participant's current account once, as free FN with a wallet record", async () => {
    const m = await load();
    const before = m.account.fnBalance;
    await m.saveEventReward(OP, { id: ENDED, kind: "FREE_FN", amountFn: 700 });
    expect(await m.payEventReward(OP, { id: ENDED, requestId: key(10) })).toEqual({ status: "OK" });
    expect(m.account.fnBalance).toBe(before + 700);
    // Free FN (환불 정책 기본값: never refundable), with its FN Wallet record.
    expect(m.mockCredits.credits).toEqual([expect.objectContaining({ fnAmount: 700, reason: "이벤트 보상 · 출석체크 챌린지" })]);
    expect((await m.getWalletOverview({ kind: "REWARD", period: "all" }))!.entries).toContainEqual(expect.objectContaining({ kind: "REWARD", deltaFn: 700, description: "이벤트 보상 · 출석체크 챌린지" }));

    // Once: a retry of the same request answers OK, another request is refused, the balance stays.
    expect(await m.payEventReward(OP, { id: ENDED, requestId: key(10) })).toEqual({ status: "OK" });
    expect(await m.payEventReward(OP, { id: ENDED, requestId: key(11) })).toEqual({ status: "INVALID", message: "이미 보상을 지급한 이벤트예요." });
    expect(await m.payEventReward(OP, { id: ONGOING, requestId: key(10) })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(m.account.fnBalance).toBe(before + 700);
    expect(m.mockCredits.credits).toHaveLength(1);
    expect(await m.saveEventReward(OP, { id: ENDED, kind: "FREE_FN", amountFn: 900 })).toEqual({ status: "INVALID", message: "보상을 지급한 이벤트라 보상 설정을 바꿀 수 없어요." });

    const pays = m.auditEntries().filter((e) => e.action === "EVENT_REWARD_PAY");
    expect(pays.map((e) => e.reason)).toEqual(["출석체크 챌린지 · 1인 700 FN · 지급 1명 · 합계 700 FN · 지급 불가 0명"]);
    expect((await row(m, ENDED)).result).toMatchObject({ kind: "FREE_FN", by: "테스트 운영자", amountFn: 700, totalFn: 700, paid: [{ name: "홍길동", withdrawn: false }], unpaid: [] });
    // The site: 보상이 지급됐어요, and the member's own line.
    expect(await m.getEvent(ENDED)).toMatchObject({ joined: true, outcome: { kind: "FREE_FN" }, myResult: { kind: "PAID", amountFn: 700 } });
    signIn(null);
    expect(await m.getEvent(ENDED)).toMatchObject({ joined: false, outcome: { kind: "FREE_FN" }, myResult: null });
  });

  it("pays the account that belongs to the person now and lists people without one as 지급 불가", async () => {
    const m = await load();
    // The sample member withdraws; someone else signs up in the slot and also took part.
    await rejoinWithPhone("010-0000-0000");
    addJoin(m, ENDED, m.currentPersonKey());
    addJoin(m, ENDED, "person-gone"); // a person key nobody can be found for any more
    m.account.fnBalance = 0;
    await m.saveEventReward(OP, { id: ENDED, kind: "FREE_FN", amountFn: 300 });
    expect(await m.payEventReward(OP, { id: ENDED, requestId: key(20) })).toEqual({ status: "OK" });
    expect(m.account.fnBalance).toBe(300); // one credit: the new member's
    const result = (await row(m, ENDED)).result;
    expect(result).toMatchObject({
      kind: "FREE_FN",
      totalFn: 300,
      paid: [{ name: "다시왔어요", withdrawn: false, memberId: "u-hongGD123" }],
      unpaid: [
        { name: "홍길동", withdrawn: true, memberId: "u-hongGD123-w1" },
        { name: "확인할 수 없는 참여자", withdrawn: true, memberId: null }
      ]
    });
    expect(m.auditEntries().find((e) => e.action === "EVENT_REWARD_PAY")?.reason).toBe("출석체크 챌린지 · 1인 300 FN · 지급 1명 · 합계 300 FN · 지급 불가 2명");
  });

  it("credits a 재가입 account of the same person, and the earlier account's payout is not shown to a later one", async () => {
    const m = await load();
    await rejoinWithPhone("010-1234-5678"); // same phone: the same person, a new account
    m.account.fnBalance = 0;
    await m.saveEventReward(OP, { id: ENDED, kind: "FREE_FN", amountFn: 250 });
    expect(await m.payEventReward(OP, { id: ENDED, requestId: key(30) })).toEqual({ status: "OK" });
    expect(m.account.fnBalance).toBe(250);
    expect(await m.getEvent(ENDED)).toMatchObject({ joined: true, myResult: { kind: "PAID", amountFn: 250 } });
    // Joined again later by the same person with yet another account: that account was not credited.
    await rejoinWithPhone("010-1234-5678", new Date(Date.now() + 1_000));
    expect(await m.getEvent(ENDED)).toMatchObject({ joined: true, myResult: null });
  });

  it("draws the winners once on the server and announces them masked", async () => {
    const m = await load();
    addJoin(m, ENDED, "person-gone");
    await m.saveEventReward(OP, { id: ENDED, kind: "DRAW", winners: 3, prize: "굿즈 세트" });
    expect(await m.drawEventWinners(OP, { id: ENDED, requestId: key(40) })).toEqual({ status: "OK" });
    // Only participants with an account are drawn; asking for more than the pool draws the whole pool.
    expect((await row(m, ENDED)).result).toMatchObject({
      kind: "DRAW",
      winnersWanted: 3,
      prize: "굿즈 세트",
      pool: 1,
      winners: [{ name: "홍길동", masked: "홍*동", withdrawn: false }],
      unpaid: [{ name: "확인할 수 없는 참여자" }]
    });
    expect(await m.getEvent(ENDED)).toMatchObject({ outcome: { kind: "DRAW", winners: ["홍*동"] }, myResult: { kind: "WON" } });
    expect(await m.drawEventWinners(OP, { id: ENDED, requestId: key(40) })).toEqual({ status: "OK" });
    expect(await m.drawEventWinners(OP, { id: ENDED, requestId: key(41) })).toEqual({ status: "INVALID", message: "이미 당첨자를 추첨한 이벤트예요." });
    expect(await m.payEventReward(OP, { id: ENDED, requestId: key(40) })).toEqual({ status: "INVALID", message: "잘못된 요청입니다." });
    expect(m.auditEntries().filter((e) => e.action === "EVENT_DRAW").map((e) => e.reason)).toEqual(["출석체크 챌린지 · 경품 굿즈 세트 · 추첨 대상 1명 중 1명 당첨 · 지급 불가 1명"]);
    // Who won never leaves the server unmasked.
    expect(JSON.stringify(await m.getEvent(ENDED))).not.toContain("홍길동");
  });

  /** 2026-10-09 결정: someone skipped as 지급 불가 sees a neutral line from their 재가입 account, not 당첨되지 않았어요. */
  it("leaves a withdrawn participant out of the draw: back with the same phone they see 탈퇴한 계정으로 참여해 보상 대상에서 빠졌어요", async () => {
    const m = await load();
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0 });
    await m.saveEventReward(OP, { id: ENDED, kind: "DRAW", winners: 1, prize: "굿즈" });
    expect(await m.drawEventWinners(OP, { id: ENDED, requestId: key(50) })).toEqual({ status: "OK" });
    expect((await row(m, ENDED)).result).toMatchObject({ pool: 0, winners: [], unpaid: [{ name: "홍길동", withdrawn: true }] });
    const { startNewAccount } = await import("@/services/account/rejoin");
    startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-1234-5678" }, new Date(Date.now() + 1_000));
    const detail = (await m.getEvent(ENDED))!;
    expect(detail).toMatchObject({ joined: true, outcome: { kind: "DRAW", winners: [] }, myResult: { kind: "UNPAID" } });
    const { myEventResultText } = await import("@/services/events/eventTypes");
    expect(myEventResultText(detail.myResult!)).toBe("탈퇴한 계정으로 참여해 보상 대상에서 빠졌어요");
  });

  it("shows the same line after a 무상 FN payout that skipped the withdrawn participant (they saw nothing before)", async () => {
    const m = await load();
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0 });
    await m.saveEventReward(OP, { id: ENDED, kind: "FREE_FN", amountFn: 400 });
    expect(await m.payEventReward(OP, { id: ENDED, requestId: key(51) })).toEqual({ status: "OK" });
    expect((await row(m, ENDED)).result).toMatchObject({ kind: "FREE_FN", paid: [], unpaid: [{ name: "홍길동", withdrawn: true }] });
    const { startNewAccount } = await import("@/services/account/rejoin");
    startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-1234-5678" }, new Date(Date.now() + 1_000));
    m.account.fnBalance = 0;
    expect(await m.getEvent(ENDED)).toMatchObject({ joined: true, outcome: { kind: "FREE_FN" }, myResult: { kind: "UNPAID" } });
    expect(m.account.fnBalance).toBe(0); // still nothing paid to the new account

    // Someone else in the slot (another phone) did not take part: no result line at all.
    await rejoinWithPhone("010-9999-0000", new Date(Date.now() + 2_000));
    expect(await m.getEvent(ENDED)).toMatchObject({ joined: false, myResult: null });
  });

  it("keeps the other result lines as they were", async () => {
    const { myEventResultText } = await import("@/services/events/eventTypes");
    expect([myEventResultText({ kind: "PAID", amountFn: 1_500 }), myEventResultText({ kind: "WON" }), myEventResultText({ kind: "NOT_WON" })]).toEqual([
      "보상 1,500 FN을 받았어요",
      "당첨됐어요",
      "아쉽지만 당첨되지 않았어요"
    ]);
  });
});

describe("당첨자 추첨 (공정성)", () => {
  it("draws the asked number of distinct entries, at most the pool", async () => {
    const { drawWinners } = await import("@/services/events/eventDraw");
    const pool = Array.from({ length: 10 }, (_, i) => `p${i}`);
    for (let run = 0; run < 200; run++) {
      const w = drawWinners(pool, 3);
      expect(w).toHaveLength(3);
      expect(new Set(w).size).toBe(3);
      expect(w.every((x) => pool.includes(x))).toBe(true);
    }
    expect(new Set(drawWinners(pool, 50)).size).toBe(10);
    expect(drawWinners(pool, 0)).toEqual([]);
    expect(drawWinners([], 3)).toEqual([]);
    expect(pool).toEqual(Array.from({ length: 10 }, (_, i) => `p${i}`)); // the pool itself is not reordered
    // The pick decides: always the first remaining entry.
    expect(drawWinners(pool, 2, () => 0)).toEqual(["p0", "p1"]);
  });

  it("gives every participant the same chance", async () => {
    const { drawWinners } = await import("@/services/events/eventDraw");
    const pool = ["a", "b", "c", "d", "e", "f"];
    const wins = new Map(pool.map((p) => [p, 0]));
    const runs = 6_000;
    for (let i = 0; i < runs; i++) for (const w of drawWinners(pool, 2)) wins.set(w, wins.get(w)! + 1);
    // Expected 2,000 each (2 of 6 per run); the bound is about 8 standard deviations.
    for (const n of wins.values()) expect(Math.abs(n - (runs * 2) / 6)).toBeLessThan(300);
  });

  it("masks winners' nicknames for the site", async () => {
    const { maskNickname } = await import("@/services/events/eventRewardCore");
    expect(["홍길동", "길동", "홍", "별빛시청자", " abc "].map(maskNickname)).toEqual(["홍*동", "길*", "*", "별***자", "a*c"]);
  });

  it("keeps Node built-ins out of the shared event modules (eventTypes is loaded by the browser)", () => {
    for (const file of ["../events/eventTypes.ts", "../events/eventsCore.ts", "../events/eventRewardCore.ts"]) {
      expect(readFileSync(new URL(file, import.meta.url), "utf8")).not.toMatch(/from "node:/);
    }
  });
});

/** 2026-10-09 결정: 보상 지급 and 당첨자 추첨 notify each participant's current account once (header bell). */
describe("이벤트 결과 사이트 알림", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.restoreAllMocks());

  const eventNotices = async () => {
    const { listNotifications } = await import("@/services/notifications/notifications");
    return (await listNotifications({ show: 100 }))!.items.filter((n) => n.kind === "EVENT").map((n) => ({ title: n.title, body: n.body, href: n.href }));
  };

  it("tells the paid account 이벤트 보상 n FN을 받았어요, once", async () => {
    const m = await load();
    await m.saveEventReward(OP, { id: ENDED, kind: "FREE_FN", amountFn: 1_500 });
    expect(await eventNotices()).toEqual([]);
    expect(await m.payEventReward(OP, { id: ENDED, requestId: key(60) })).toEqual({ status: "OK" });
    expect(await m.payEventReward(OP, { id: ENDED, requestId: key(60) })).toEqual({ status: "OK" }); // a retry
    expect(await eventNotices()).toEqual([{ title: "이벤트 보상 1,500 FN을 받았어요", body: "출석체크 챌린지", href: `/events/${ENDED}` }]);
  });

  it("tells a winner 이벤트에 당첨됐어요 and the rest of the pool 당첨자를 발표했어요, once", async () => {
    const m = await load();
    await m.saveEventReward(OP, { id: ENDED, kind: "DRAW", winners: 1, prize: "굿즈 세트" });
    expect(await m.drawEventWinners(OP, { id: ENDED, requestId: key(61) })).toEqual({ status: "OK" });
    expect(await m.drawEventWinners(OP, { id: ENDED, requestId: key(61) })).toEqual({ status: "OK" });
    expect(await eventNotices()).toEqual([{ title: "이벤트에 당첨됐어요", body: "출석체크 챌린지 · 경품 굿즈 세트", href: `/events/${ENDED}` }]);

    // Not drawn (the mock has one account, so the draw is made to pick nobody).
    resetMockStores();
    const again = await load();
    vi.spyOn(await import("@/services/events/eventDraw"), "drawWinners").mockReturnValue([]);
    await again.saveEventReward(OP, { id: ENDED, kind: "DRAW", winners: 1, prize: "굿즈 세트" });
    expect(await again.drawEventWinners(OP, { id: ENDED, requestId: key(62) })).toEqual({ status: "OK" });
    expect(await again.getEvent(ENDED)).toMatchObject({ myResult: { kind: "NOT_WON" } });
    expect(await eventNotices()).toEqual([{ title: "당첨자를 발표했어요", body: "출석체크 챌린지", href: `/events/${ENDED}` }]);
  });

  it("never notifies a withdrawn account, nor the person's later account", async () => {
    const m = await load();
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0 });
    await m.saveEventReward(OP, { id: ENDED, kind: "FREE_FN", amountFn: 500 });
    expect(await m.payEventReward(OP, { id: ENDED, requestId: key(63) })).toEqual({ status: "OK" });
    expect(await eventNotices()).toEqual([]);
    const { startNewAccount } = await import("@/services/account/rejoin");
    startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone: "010-1234-5678" }, new Date(Date.now() + 1_000));
    // The event page tells them they were left out (2026-10-09 결정) — still without a notification.
    expect(await m.getEvent(ENDED)).toMatchObject({ myResult: { kind: "UNPAID" } });
    expect(await eventNotices()).toEqual([]);
  });

  it("keeps Node built-ins out of the notification types (the header bell loads them)", () => {
    expect(readFileSync(new URL("../notifications/notificationTypes.ts", import.meta.url), "utf8")).not.toMatch(/from "node:/);
  });
});
