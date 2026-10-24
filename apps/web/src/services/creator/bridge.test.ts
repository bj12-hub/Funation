import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { SAMPLE_EVENT, renderRequest, ruleMatches, type BridgeEvent, type BridgeRule } from "./bridgeTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 외부 프로그램 연동 (2026-10-24, StreamDonate "외부 프로그램 API" 참고) — P3. */
async function load() {
  const bridge = await import("./bridge");
  const remote = await import("./alertRemote");
  const { mockAlerts } = await import("./alertCore");
  const { mockSignatures } = await import("@/services/donations/signatureCore");
  const { mockCreator } = await import("./mockCreatorStore");
  /** A donation alert queued now (it starts showing on the next read). */
  const alert = (patch: Record<string, unknown> = {}) =>
    mockAlerts.items.push({ id: "al-1", kind: "DONATION", donor: "후원자", message: "화이팅", fnAmount: 5000, typeLabel: "텍스트 후원", createdAt: new Date().toISOString(), status: "QUEUED", ...patch });
  return { ...bridge, ...remote, alert, mockAlerts, signatureId: mockSignatures.items[0].id, overlayKey: mockCreator.integrationKey };
}

const rule = (patch: Partial<BridgeRule> = {}): BridgeRule => ({
  id: "rule-1",
  name: "조명",
  enabled: true,
  minFn: 0,
  signatureId: null,
  includeTest: true,
  delaySec: 0,
  method: "POST",
  url: "http://127.0.0.1:8000/api/location/1/0/0/press",
  body: "",
  ...patch
});
const event = (patch: Partial<BridgeEvent> = {}): BridgeEvent => ({ ...SAMPLE_EVENT, kind: "DONATION", id: "al-1", ...patch });

describe("외부 프로그램 연동 규칙", () => {
  it("matches by amount, 시그니처 and 테스트 후원, and platform 후원 only for any amount", () => {
    expect(ruleMatches(rule({ minFn: 10_000 }), event({ amount: 10_000 }))).toBe(true);
    expect(ruleMatches(rule({ minFn: 10_001 }), event({ amount: 10_000 }))).toBe(false);
    expect(ruleMatches(rule({ enabled: false }), event())).toBe(false);
    expect(ruleMatches(rule({ signatureId: "sig-a" }), event({ signatureId: "sig-a" }))).toBe(true);
    expect(ruleMatches(rule({ signatureId: "sig-a" }), event({ signatureId: "sig-b" }))).toBe(false);
    expect(ruleMatches(rule({ includeTest: false }), event({ kind: "TEST" }))).toBe(false);
    expect(ruleMatches(rule(), event({ kind: "EXTERNAL", amount: 0 }))).toBe(true);
    expect(ruleMatches(rule({ minFn: 1 }), event({ kind: "EXTERNAL", amount: 0 }))).toBe(false);
  });

  it("fills the variables — encoded in the address, as is in the body — in one pass", () => {
    const e = event({ nickname: "철수 & {message}", message: "안녕?", amount: 3000 });
    expect(renderRequest(rule({ method: "GET", url: "http://x.local/a?who={nickname}&n={amount}", body: "ignored" }), e)).toEqual({
      method: "GET",
      url: "http://x.local/a?who=%EC%B2%A0%EC%88%98%20%26%20%7Bmessage%7D&n=3000",
      body: ""
    });
    expect(renderRequest(rule({ body: '{"who":"{nickname}","say":"{message}"}' }), e).body).toBe('{"who":"철수 & {message}","say":"안녕?"}');
  });
});

describe("외부 프로그램 연동", () => {
  beforeEach(() => resetMockStores());

  it("validates and saves the rules", async () => {
    const m = await load();
    expect(await m.saveBridgeRules({ rules: [rule({ name: " 조명 ", signatureId: m.signatureId, body: "x" }), rule({ id: "rule-2", method: "GET", body: "dropped" })] })).toEqual({ status: "SAVED" });
    const view = (await m.getBridgeView())!;
    expect(view.rules).toEqual([rule({ signatureId: m.signatureId, body: "x" }), rule({ id: "rule-2", method: "GET", body: "" })]);
    expect(view.bridgePath).toBe(`/overlay/bridge/${m.overlayKey}`);
    expect(view.signatures.length).toBeGreaterThan(0);
    for (const [patch, message] of [
      [{ name: " " }, "규칙 이름은 1~20자로 입력해 주세요."],
      [{ url: "ftp://x.local/a" }, "조명: 주소를 확인해 주세요. http:// 나 https:// 로 시작해야 해요."],
      [{ url: "127.0.0.1:8000" }, "조명: 주소를 확인해 주세요. http:// 나 https:// 로 시작해야 해요."],
      [{ url: "http://admin:pw@192.168.0.10/" }, "조명: 주소에 아이디 · 비밀번호는 넣을 수 없어요."],
      [{ url: `http://x.local/${"a".repeat(500)}` }, "조명: 주소는 1~500자로 입력해 주세요."],
      [{ body: "a".repeat(2001) }, "조명: 보낼 내용은 2000자까지예요."],
      [{ delaySec: 31 }, "조명: 지연은 0 ~ 30초예요."],
      [{ minFn: -1 }, "조명: 최소 금액은 0 이상의 정수로 입력해 주세요."],
      [{ signatureId: "nope" }, "조명: 없는 시그니처예요. 다시 골라 주세요."],
      [{ method: "DELETE" }, "설정을 확인해 주세요."]
    ] as const) {
      expect(await m.saveBridgeRules({ rules: [rule(patch as Partial<BridgeRule>)] })).toEqual({ status: "INVALID", message });
    }
    expect(await m.saveBridgeRules({ rules: Array.from({ length: 21 }, (_, i) => rule({ id: `rule-${i + 10}` })) })).toEqual({ status: "INVALID", message: "규칙은 20개까지 만들 수 있어요." });
    signIn(["SUPPORTER"]);
    expect(await m.saveBridgeRules({ rules: [] })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getBridgeView()).toBeNull();
  });

  it("fires each matching rule once for the alert showing now, however many pages ask, and keeps how sending went", async () => {
    const m = await load();
    expect(await m.getBridgeData("nope")).toBe("FORBIDDEN");
    await m.saveBridgeRules({ rules: [rule({ name: "버튼", body: "{nickname}" }), rule({ id: "rule-big", name: "큰 후원", minFn: 10_000 }), rule({ id: "rule-sig", name: "시그", signatureId: m.signatureId, delaySec: 3 })] });
    expect(await m.getBridgeData(m.overlayKey)).toEqual({ event: null, fire: [], rules: 3, reloadSeq: 0, on: true });

    m.alert({ signatureId: m.signatureId });
    const data = await m.getBridgeData(m.overlayKey);
    if (data === "FORBIDDEN") throw new Error("forbidden");
    expect(data.event).toMatchObject({ id: "al-1", nickname: "후원자", amount: 5000, amountLabel: "5,000 FN", signatureId: m.signatureId });
    expect(data.fire).toEqual(["rule-1", "rule-sig"]);

    const first = await m.claimBridgeRule(m.overlayKey, { alertId: "al-1", ruleId: "rule-1" });
    expect(first).toMatchObject({ status: "FIRE", delaySec: 0, request: { method: "POST", url: rule().url, body: "후원자" } });
    // A second 연동 페이지 asks too.
    expect(await m.claimBridgeRule(m.overlayKey, { alertId: "al-1", ruleId: "rule-1" })).toEqual({ status: "TAKEN" });
    expect(await m.claimBridgeRule(m.overlayKey, { alertId: "al-1", ruleId: "rule-big" })).toEqual({ status: "INVALID" }); // does not match
    expect(await m.claimBridgeRule(m.overlayKey, { alertId: "al-other", ruleId: "rule-1" })).toEqual({ status: "INVALID" }); // not showing
    expect(await m.claimBridgeRule("nope", { alertId: "al-1", ruleId: "rule-sig" })).toEqual({ status: "INVALID" });
    expect(await m.claimBridgeRule(m.overlayKey, { alertId: "al-1", ruleId: "rule-sig" })).toMatchObject({ status: "FIRE", delaySec: 3 });

    if (first.status !== "FIRE") throw new Error("not fired");
    await m.reportBridgeRule(m.overlayKey, { claimId: first.claimId, outcome: "SENT" });
    await m.reportBridgeRule(m.overlayKey, { claimId: first.claimId, outcome: "FAILED" }); // already reported
    expect((await m.getBridgeView())!.log.map((e) => `${e.ruleName} ${e.nickname} ${e.outcome}`)).toEqual(["시그 후원자 FIRED", "버튼 후원자 SENT"]);

    // 리모컨 기능 제어 OFF: nothing to fire, nothing claimable.
    expect(await m.setOverlaySwitch({ target: "bridge", on: false })).toEqual({ status: "SAVED" });
    expect(await m.getBridgeData(m.overlayKey)).toMatchObject({ event: null, fire: [], on: false });
    expect(await m.claimBridgeRule(m.overlayKey, { alertId: "al-1", ruleId: "rule-sig" })).toEqual({ status: "INVALID" });
  });
});
