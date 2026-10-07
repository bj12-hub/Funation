import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { parseDepositSms } from "./bankSmsParser";
import { SAMPLE_BANK_SMS, maskName } from "./bankSmsTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** SMS 계좌후원 (code-first mock, 2026-10-06): deposit SMS → 계좌 후원 alert, never FN; nothing but amount + name kept. */
async function load() {
  const sms = await import("./bankSms");
  const core = await import("./bankSmsCore");
  const route = await import("@/app/api/bank-sms/[key]/route");
  const bc = await import("@/services/crew/crewBroadcast");
  const { mockAlerts } = await import("@/services/creator/alertCore");
  const { mockAccount } = await import("@/services/account/mockStore");
  mockAlerts.items.length = 0;
  return { ...sms, ...core, ...bc, POST: route.POST, alerts: mockAlerts, account: mockAccount };
}

const post = (m: Awaited<ReturnType<typeof load>>, k: string, body: string, type = "application/json") =>
  m.POST(new Request(`http://localhost/api/bank-sms/${k}`, { method: "POST", headers: { "content-type": type }, body }), { params: Promise.resolve({ key: k }) });

const suspendCreator = async () => {
  const { SAMPLE_MEMBER_ID, memberStore } = await import("@/services/admin/memberCore");
  memberStore().suspensions[SAMPLE_MEMBER_ID] = { reason: "테스트 정지", at: new Date().toISOString(), until: null, by: "adm-1" };
  return () => delete memberStore().suspensions[SAMPLE_MEMBER_ID];
};
const withdrawCreator = async () => {
  const { withdrawalStore } = await import("@/services/account/withdrawalCore");
  withdrawalStore().withdrawal = { at: new Date().toISOString(), requestId: key(99), forfeitedFn: 0, forfeitedEarningsFn: 0, nickname: "홍길동", funationId: "hongGD123" };
};

describe("SMS 계좌후원", () => {
  beforeEach(() => resetMockStores());

  it("reads the amount and depositor from common deposit layouts, and nothing else", () => {
    expect(parseDepositSms(SAMPLE_BANK_SMS)).toEqual({ amount: 10_000, depositor: "별빛소나타" });
    expect(parseDepositSms("[신한] 10/06 11:20 입금 25,000원 잔액 ******원 달빛고양이")).toEqual({ amount: 25_000, depositor: "달빛고양이" });
    expect(parseDepositSms("농협 입금5,000원 10/06 11:20 ***-****-****-** 새벽감성 잔액******원")).toEqual({ amount: 5_000, depositor: "새벽감성" });
    expect(parseDepositSms("[토스뱅크] 구름빵님이 3,000원을 입금했어요")).toEqual({ amount: 3_000, depositor: "구름빵" });
    // A date or time right after 입금 is not the amount.
    expect(parseDepositSms("[우체국] 입금 10/06 14:05 50,000원 새벽감성")).toEqual({ amount: 50_000, depositor: "새벽감성" });
    expect(parseDepositSms("[우체국] 입금 10/06 14:05 잔액 70,000원 새벽감성")).toBeNull();
    for (const not of ["[신한] 10/06 출금 25,000원 잔액 ******원 편의점", "입금취소 10,000원 별빛소나타", "[국민] 10/06 입금 별빛소나타", "안녕하세요 입금 확인 부탁드려요", "입금 99,999,999원 큰손"]) {
      expect(parseDepositSms(not)).toBeNull();
    }
  });

  it("masks names unless the creator turns it off", () => {
    expect([maskName("별빛소나타"), maskName("민수"), maskName("K")]).toEqual(["별***타", "민*", "K"]);
  });

  it("turns a forwarded SMS into one 계좌 후원 alert and a 원 entry in a live crew broadcast", async () => {
    const m = await load();
    const k = m.bankSmsStore().key;
    const fn = m.account.fnBalance;
    expect((await post(m, k, JSON.stringify({ text: SAMPLE_BANK_SMS }))).status).toBe(403); // off
    expect(await m.setBankSms({ enabled: true })).toEqual({ status: "SAVED" });
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "계좌 후원 방송", teamMode: false, teams: {} });

    const first = await post(m, k, JSON.stringify({ text: SAMPLE_BANK_SMS, id: "msg-1" }));
    expect([first.status, await first.json()]).toEqual([200, { status: "OK", amount: 10_000 }]);
    // The forwarder retries with the same id, with a new id, and a second forwarder sends the text alone: one alert.
    for (const body of [JSON.stringify({ text: SAMPLE_BANK_SMS, id: "msg-1" }), JSON.stringify({ text: SAMPLE_BANK_SMS, id: "msg-2" })]) {
      expect(await (await post(m, k, body)).json()).toEqual({ status: "DUPLICATE" });
    }
    expect(await (await post(m, k, SAMPLE_BANK_SMS, "text/plain")).json()).toEqual({ status: "DUPLICATE" });
    // A different SMS (another deposit) is a new alert.
    expect((await post(m, k, SAMPLE_BANK_SMS.replace("10,000", "20,000"), "text/plain")).status).toBe(200);
    expect(m.alerts.items.map((a) => [a.kind, a.donor, a.amountLabel, a.typeLabel, a.fnAmount])).toEqual([
      ["EXTERNAL", "별***타", "₩10,000", "계좌 후원", 0],
      ["EXTERNAL", "별***타", "₩20,000", "계좌 후원", 0]
    ]);
    expect(m.alerts.items.map((a) => a.native)).toEqual([{ value: 10_000, unit: "KRW" }, { value: 20_000, unit: "KRW" }]);
    expect(m.account.fnBalance).toBe(fn);

    const feed = (await m.getBroadcastView())!.feed!;
    expect(feed.entries.filter((e) => e.source === "BANK").map((e) => [e.amount, e.unit, e.platform])).toEqual([
      [20_000, "KRW", null],
      [10_000, "KRW", null]
    ]);

    expect((await post(m, k, JSON.stringify({ text: "안녕하세요" }))).status).toBe(422);
    expect((await post(m, k, "{not json")).status).toBe(400);
    expect((await post(m, "wrong-key", JSON.stringify({ text: SAMPLE_BANK_SMS }))).status).toBe(404);
    const view = (await m.getBankSms())!;
    expect(view).toMatchObject({ enabled: true, maskNames: true, received: 2, duplicates: 3, unparsed: 1 });
    expect(view.recent.map((d) => d.depositor)).toEqual(["별***타", "별***타"]);
    // Nothing of the text is kept but keyed hashes, and those expire after a day.
    expect(JSON.stringify(m.bankSmsStore())).not.toContain("잔액");
    expect(m.bankSmsStore().seen.every((e) => /^(txt:[0-9a-f]{64}|id:msg-\d)$/.test(e.key))).toBe(true);
    expect(m.receiveBankSms(SAMPLE_BANK_SMS, null, Date.now() + 25 * 3600_000).status).toBe("OK");

    await m.setBankSms({ maskNames: false });
    expect((await m.getBankSms())!.recent[0].depositor).toBe("별빛소나타");
  });

  it("stops taking SMS while the creator is suspended or after they withdraw", async () => {
    const m = await load();
    const k = m.bankSmsStore().key;
    await m.setBankSms({ enabled: true });
    const restore = await suspendCreator();
    expect((await post(m, k, JSON.stringify({ text: SAMPLE_BANK_SMS, id: "msg-s1" }))).status).toBe(403);
    expect(m.alerts.items).toHaveLength(0);
    restore();
    expect((await post(m, k, JSON.stringify({ text: SAMPLE_BANK_SMS, id: "msg-s2" }))).status).toBe(200);
    await withdrawCreator();
    expect((await post(m, k, JSON.stringify({ text: SAMPLE_BANK_SMS, id: "msg-s3" }))).status).toBe(403);
  });

  it("runs 테스트 문자 once per click, reissues the address and is for creators only", async () => {
    const m = await load();
    await m.setBankSms({ enabled: true });
    const req = { text: "[신한] 입금 7,000원 달빛고양이", requestId: key(1) };
    expect(await m.simulateBankSms(req)).toMatchObject({ status: "OK", deposit: { amount: 7_000, depositor: "달***이" } });
    expect(await m.simulateBankSms(req)).toEqual({ status: "DUPLICATE" });
    expect(await m.simulateBankSms({ ...req, text: "광고 문자", requestId: key(2) })).toEqual({ status: "UNPARSED" });
    expect((await m.simulateBankSms({ ...req, text: "", requestId: key(3) })).status).toBe("INVALID");
    expect((await m.setBankSms({ enabled: "yes" })).status).toBe("INVALID");
    expect((await m.setBankSms({})).status).toBe("INVALID");

    const old = m.bankSmsStore().key;
    expect(await m.reissueBankSmsKey()).toEqual({ status: "SAVED" });
    expect((await post(m, old, JSON.stringify({ text: "[신한] 입금 1,000원 새벽감성" }))).status).toBe(404);
    expect((await m.getBankSms())!.hookPath).toBe(`/api/bank-sms/${m.bankSmsStore().key}`);

    signIn(["SUPPORTER"]);
    expect(await m.getBankSms()).toBeNull();
    expect(await m.setBankSms({ enabled: false })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.simulateBankSms({ ...req, requestId: key(4) })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.reissueBankSmsKey()).toEqual({ status: "UNAUTHORIZED" });
  });
});
