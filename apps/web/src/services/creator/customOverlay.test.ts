import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { emptySlot, slotByQuery } from "./customOverlayTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 커스텀 오버레이 (2026-10-24, StreamDonate "오버레이 커스텀" 참고) — P3. */
async function load() {
  const custom = await import("./customOverlay");
  const { mockCreator } = await import("./mockCreatorStore");
  const { chatStore } = await import("@/services/broadcast/chatCore");
  const alerts = await import("./alertCore");
  /** A chat line in the 통합 채팅 feed. */
  const chat = (id: string, name: string, text: string) => {
    const s = chatStore();
    s.seq += 1;
    s.messages.push({
      id,
      seq: s.seq,
      platform: "YOUTUBE",
      externalMessageId: id,
      author: { platformUserId: `u-${name}`, displayName: name, roles: [] },
      text,
      sentAt: new Date().toISOString(),
      receivedAt: new Date().toISOString(),
      hidden: null,
      fromStudio: false
    });
  };
  return { ...custom, chat, alerts, overlayKey: mockCreator.integrationKey };
}

const slot = (patch: Record<string, unknown> = {}) => ({ no: 1, name: "내 알림", enabled: true, html: "<div id='box'></div>", css: "#box { color: red; }", js: "function onData(t, d) {}", ...patch });

describe("커스텀 오버레이", () => {
  beforeEach(() => resetMockStores());

  it("reads ?slot= as 1 ~ 5", () => {
    expect([slotByQuery("3"), slotByQuery("6"), slotByQuery("x"), slotByQuery(undefined)]).toEqual([3, 1, 1, 1]);
  });

  it("saves a slot's code as written, checking the name and the sizes", async () => {
    const m = await load();
    const view = (await m.getCustomOverlayView())!;
    expect(view.overlayKey).toBe(m.overlayKey);
    expect(view.slots).toEqual([1, 2, 3, 4, 5].map(emptySlot));
    // Code is stored as it is (it only ever runs in the sandbox), markup and all.
    const code = slot({ no: 2, name: " 채팅 박스 ", html: "<script>alert(1)</script><img src=x onerror=alert(2)>" });
    expect(await m.saveCustomOverlay(code)).toEqual({ status: "SAVED" });
    expect((await m.getCustomOverlayView())!.slots[1]).toEqual({ name: "채팅 박스", enabled: true, html: code.html, css: code.css, js: code.js });
    for (const [patch, message] of [
      [{ no: 6 }, "잘못된 요청입니다."],
      [{ name: " " }, "이름은 1~20자로 입력해 주세요."],
      [{ name: "가".repeat(21) }, "이름은 1~20자로 입력해 주세요."],
      [{ name: "admin 오버레이" }, "사용할 수 없는 단어가 포함되어 있어요."],
      [{ enabled: "yes" }, "설정을 확인해 주세요."],
      [{ css: 1 }, "설정을 확인해 주세요."],
      [{ js: "x".repeat(20_001) }, "JS는 20,000자까지 넣을 수 있어요."],
      [{ html: "x".repeat(20_001) }, "HTML은 20,000자까지 넣을 수 있어요."]
    ] as const) {
      expect(await m.saveCustomOverlay(slot(patch))).toEqual({ status: "INVALID", message });
    }
    expect(await m.saveCustomOverlay(slot({ js: "x".repeat(20_000) }))).toEqual({ status: "SAVED" });
    signIn(["SUPPORTER"]);
    expect(await m.saveCustomOverlay(slot())).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getCustomOverlayView()).toBeNull();
  });

  it("hands OBS the crew 점수판 (2026-10-25): best first while a crew broadcast is live, empty otherwise", async () => {
    const m = await load();
    const read = async () => {
      const res = await m.getCustomOverlay(m.overlayKey, "1");
      if (res === "FORBIDDEN") throw new Error("forbidden");
      return res;
    };
    expect((await read()).crew).toBeNull(); // the slot is off
    expect(await m.saveCustomOverlay(slot())).toEqual({ status: "SAVED" });
    expect((await read()).crew).toEqual({ live: false, title: "", project: null, round: null, rows: [], total: 0 });

    const bc = await import("@/services/crew/crewBroadcast");
    const { mockCrew } = await import("@/services/crew/mockCrewStore");
    mockCrew.attributions = [];
    expect(await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "커스텀 방송", project: "시즌1", teamMode: false })).toEqual({ status: "SAVED" });
    const id = (await bc.getBroadcastView())!.live!.id;
    await bc.adjustScore({ broadcastId: id, memberId: "cm-s2", points: 5_000, adjustmentId: "test-key-00000001" });
    await bc.adjustScore({ broadcastId: id, memberId: "cm-s1", points: 2_000, adjustmentId: "test-key-00000002" });
    expect((await read()).crew).toEqual({
      live: true,
      title: "커스텀 방송",
      project: "시즌1",
      round: 1,
      rows: [
        { rank: 1, name: "하늘", color: "#ec4899", score: 5_000 },
        { rank: 2, name: "길동", color: "#8b5cf6", score: 2_000 },
        { rank: 3, name: "바다", color: "#3b82f6", score: 0 }
      ],
      total: 7_000
    });
  });

  it("hands OBS the slot's code with the showing donation and recent chat, and nothing while it is off or empty", async () => {
    const m = await load();
    expect(await m.getCustomOverlay("nope", "1")).toBe("FORBIDDEN");
    expect(await m.getCustomOverlay(m.overlayKey, "1")).toEqual({ slot: 1, name: "커스텀 1", code: null, donation: null, chat: [], crew: null, reloadSeq: 0, on: true });

    await m.saveCustomOverlay(slot({ no: 3 }));
    m.chat("c1", "하나", "안녕하세요");
    m.chat("c2", "둘", "ㅋㅋ");
    m.alerts.mockAlerts.items.push({ id: "al-1", kind: "DONATION", donor: "후원자", message: "화이팅", fnAmount: 5000, typeLabel: "텍스트 후원", createdAt: new Date().toISOString(), status: "QUEUED" });
    const live = await m.getCustomOverlay(m.overlayKey, "3");
    if (live === "FORBIDDEN") throw new Error("forbidden");
    expect(live.code).toEqual({ html: slot().html, css: slot().css, js: slot().js });
    expect(live.chat.map((c) => `${c.nickname}:${c.text}`).slice(-2)).toEqual(["하나:안녕하세요", "둘:ㅋㅋ"]);
    expect(live.donation).toMatchObject({ id: "al-1", kind: "DONATION", nickname: "후원자", message: "화이팅", amount: 5000, amountLabel: "5,000 FN", typeLabel: "텍스트 후원", platform: null, imageUrl: null });

    await m.saveCustomOverlay(slot({ no: 3, enabled: false }));
    expect(await m.getCustomOverlay(m.overlayKey, "3")).toMatchObject({ code: null, donation: null, chat: [] });
  });
});
