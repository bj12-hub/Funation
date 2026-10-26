import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 시그니처 플레이어 (2026-10-25, StreamDonate 시그니처 플레이어 참고) and the 테스트 후원 sent as a signature. */
async function load() {
  const player = await import("./sigPlayer");
  const remote = await import("./alertRemote");
  const core = await import("./alertCore");
  const { mockSignatures } = await import("@/services/donations/signatureCore");
  const { mockCreator } = await import("./mockCreatorStore");
  core.mockAlerts.items.length = 0;
  return { ...player, ...remote, ...core, mockSignatures, overlayKey: mockCreator.integrationKey };
}

describe("시그니처 플레이어", () => {
  beforeEach(() => resetMockStores());

  it("validates and keeps its settings, the creator's", async () => {
    const m = await load();
    expect(await m.getSigPlayerSettings()).toEqual({ mode: "MEMBER", waitSec: 3, sound: false });
    expect(await m.saveSigPlayerSettings({ mode: "MESSAGE", waitSec: 0, sound: true })).toEqual({ status: "SAVED" });
    expect(await m.getSigPlayerSettings()).toEqual({ mode: "MESSAGE", waitSec: 0, sound: true });
    for (const [bad, message] of [
      [{ mode: "BANNER", waitSec: 3, sound: false }, "방식"],
      [{ mode: "MEMBER", waitSec: 11, sound: false }, "0 ~ 10초"],
      [{ mode: "MEMBER", waitSec: 1.5, sound: false }, "0 ~ 10초"],
      [{ mode: "MEMBER", waitSec: 3, sound: "yes" }, "소리"]
    ] as const) {
      const res = await m.saveSigPlayerSettings(bad);
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    signIn(["SUPPORTER"]);
    expect(await m.getSigPlayerSettings()).toBeNull();
    expect(await m.saveSigPlayerSettings({ mode: "MEMBER", waitSec: 3, sound: false })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("shows the signature alert on screen with its member, and nothing for other alerts", async () => {
    const m = await load();
    const read = async () => {
      const res = await m.getOverlaySigPlayer(m.overlayKey);
      if (res === "FORBIDDEN") throw new Error("forbidden");
      return res;
    };
    expect(await m.getOverlaySigPlayer("wrong-key")).toBe("FORBIDDEN");
    expect((await read()).alert).toBeNull();

    // A plain 테스트 후원: not a signature.
    await m.sendTestAlert({ requestId: key(1), amount: 1_000, donor: "A" });
    expect((await read()).alert).toBeNull();
    await m.skipCurrentAlert({ alertId: m.mockAlerts.items[0].id });

    const sig = m.mockSignatures.items[0];
    expect(await m.sendTestAlert({ requestId: key(2), amount: sig.price, donor: "별빛", message: "축하해요", signatureId: sig.id, memberId: "cm-s2" })).toEqual({ status: "SAVED" });
    const shown = await read();
    expect(shown.alert).toMatchObject({ donor: "별빛", message: "축하해요", signatureName: sig.name, imageUrl: sig.imageUrl, member: { name: "하늘", color: "#ec4899" } });
    expect(Date.parse(shown.alert!.endsAt) - Date.parse(shown.alert!.shownAt)).toBe(m.mockAlerts.controls.displaySec * 1000);
    expect(shown).toMatchObject({ settings: { mode: "MEMBER", waitSec: 3 }, volume: 80, on: true });
    // The 테스트 후원 carries the signature for the alert overlay too, and stays a test (never counted).
    expect(m.mockAlerts.items.at(-1)).toMatchObject({ kind: "TEST", typeLabel: `테스트 후원 · ${sig.name}`, signatureId: sig.id, memberId: "cm-s2" });

    // 전체 음소거 → volume 0; 기능 제어 OFF → on false.
    await m.setAlertControls({ muted: true });
    expect((await read()).volume).toBe(0);
    expect(await m.setOverlaySwitch({ target: "sigplayer", on: false })).toEqual({ status: "SAVED" });
    expect((await read()).on).toBe(false);
  });

  it("refuses a signature or member that is not there", async () => {
    const m = await load();
    expect(await m.sendTestAlert({ requestId: key(3), amount: 1_000, signatureId: "sig-nope" })).toEqual({ status: "INVALID", message: "시그니처를 다시 골라 주세요." });
    expect(await m.sendTestAlert({ requestId: key(4), amount: 1_000, memberId: "cm-s4" })).toEqual({ status: "INVALID", message: "멤버를 다시 골라 주세요." }); // not active
    const view = (await m.getRemoteView())!;
    expect(view.testOptions.signatures.map((s) => s.id)).toEqual(m.mockSignatures.items.map((s) => s.id));
    expect(view.testOptions.members.map((x) => x.name)).toEqual(["길동", "하늘", "바다"]);
  });
});
