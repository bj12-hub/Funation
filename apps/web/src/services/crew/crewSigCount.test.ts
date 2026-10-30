import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { DEFAULT_SIG_COUNT, type SigCountSettings } from "./crewTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 시그 카운트 (2026-10-23, StreamDonate 참고, P1-6): signatures each crew member received during the broadcast. */
async function load() {
  const bc = await import("./crewBroadcast");
  const count = await import("./crewSigCount");
  const signatures = await import("@/services/donations/signatures");
  const { mockAlerts } = await import("@/services/creator/alertCore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { requestDonation } = await import("@/services/donations/donate");
  // The session's donations go to the studio channel (its crew and its alert queue).
  const creators = await import("@/services/creators/creators");
  const c1 = (await creators.getCreatorById("c1"))!;
  vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
  mockAccount.fnBalance = 1_000_000;
  const [a, b] = (await signatures.listSignatures())!;
  // b also alerts for a 일반 후원 of 4,000 ~ its price.
  expect((await signatures.saveSignature({ ...b, match: "AMOUNT", rangeMin: b.price - 1_000 })).status).toBe("SAVED");
  let n = 0;
  const sign = (signatureId: string, price: number, memberId?: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "SIGNATURE", signatureId, message: "", amount: price, expectedAmount: price, idempotencyKey: key(++n), memberId });
  const text = (amount: number, memberId?: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "TEXT", amount, message: "응원", voiceId: null, idempotencyKey: key(++n), memberId });
  return { ...bc, ...count, a, b, sign, text, mockAlerts, overlayKey: mockCreator.integrationKey };
}

const settings = (patch: Partial<SigCountSettings> = {}) => ({ ...DEFAULT_SIG_COUNT, ...patch });
const table = async (m: Awaited<ReturnType<typeof load>>) => (await m.getBroadcastView())!.live!.sigCount;
const lines = (t: { rows: { name: string; counts: number[]; total: number }[] }) => t.rows.map((r) => `${r.name} ${r.counts.join("/")} = ${r.total}`);

describe("시그 카운트", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("records the signature and the picked member on the donation alert", async () => {
    const m = await load();
    expect((await m.sign(m.a.id, m.a.price, "cm-s2")).status).toBe("COMPLETED");
    expect(m.mockAlerts.items.at(-1)).toMatchObject({ kind: "DONATION", signatureId: m.a.id, memberId: "cm-s2" });
    expect((await m.text(m.b.price - 500)).status).toBe("COMPLETED"); // 금액범위 match, no member
    const matched = m.mockAlerts.items.at(-1)!;
    expect(matched.signatureId).toBe(m.b.id);
    expect(matched.memberId).toBeUndefined();
    await m.text(m.b.price + 1); // no signature
    expect(m.mockAlerts.items.at(-1)!.signatureId).toBeUndefined();
  });

  it("counts each member's signatures with 미지정 last, from the start or the last 다시 세기", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-23T12:00:00Z"), toFake: ["Date"] });
    const m = await load();
    await m.sign(m.a.id, m.a.price, "cm-s2"); // before the broadcast
    vi.setSystemTime(new Date("2026-10-23T12:01:00Z"));
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "시그 방송", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;
    expect(await m.saveSigCount(settings({ title: " 시그 판 ", signatureIds: [m.a.id, m.b.id] }))).toEqual({ status: "SAVED" });
    expect((await table(m)).rows).toEqual([]);

    vi.setSystemTime(new Date("2026-10-23T12:02:00Z"));
    await m.sign(m.a.id, m.a.price, "cm-s2");
    await m.sign(m.a.id, m.a.price, "cm-s3");
    await m.sign(m.b.id, m.b.price, "cm-s3");
    await m.text(m.b.price - 500, "cm-s3"); // 금액범위 → b
    await m.sign(m.b.id, m.b.price); // 미지정
    await m.text(m.b.price + 1, "cm-s1"); // not a signature
    // 다시 보내기 copies and test alerts never count.
    const src = m.mockAlerts.items.at(-2)!;
    m.mockAlerts.items.push({ ...src, id: "al-replay", replayOf: src.id }, { ...src, id: "al-test", kind: "TEST" });

    let t = await table(m);
    expect(t.settings.title).toBe("시그 판");
    expect(t.columns.map((c) => c.name)).toEqual([m.a.name, m.b.name]);
    expect(lines(t)).toEqual(["바다 1/2 = 3", "하늘 1/0 = 1", "미지정 0/1 = 1"]);
    expect(t.totals).toEqual([2, 3]);
    expect(t.since).toBe("2026-10-23T12:01:00.000Z");

    // 크루 순서 · 활동 멤버 모두 (솔 is inactive).
    await m.saveSigCount(settings({ signatureIds: [m.a.id, m.b.id], sort: "ORDER", rows: "ALL" }));
    expect(lines(await table(m))).toEqual(["길동 0/0 = 0", "하늘 1/0 = 1", "바다 1/2 = 3", "미지정 0/1 = 1"]);

    // 선택한 멤버 (2026-10-28): only the picked ones (0s too) and 미지정; the 합계 counts those rows only.
    expect(await m.saveSigCount(settings({ signatureIds: [m.a.id, m.b.id], sort: "ORDER", rows: "SELECTED", memberIds: ["cm-s3", "cm-s1"] }))).toEqual({ status: "SAVED" });
    t = await table(m);
    expect(lines(t)).toEqual(["길동 0/0 = 0", "바다 1/2 = 3", "미지정 0/1 = 1"]);
    expect(t.totals).toEqual([1, 3]);
    // 출근 BJ만: 바다 on 휴식 leaves the table (and the 합계); 미지정 stays.
    const { mockCrew } = await import("./mockCrewStore");
    const sea = mockCrew.crews.studio.find((x) => x.id === "cm-s3")!;
    sea.active = false;
    await m.saveSigCount(settings({ signatureIds: [m.a.id, m.b.id], sort: "ORDER", rows: "RECEIVED", activeOnly: true }));
    t = await table(m);
    expect(lines(t)).toEqual(["하늘 1/0 = 1", "미지정 0/1 = 1"]);
    expect(t.totals).toEqual([1, 1]);
    sea.active = true;
    await m.saveSigCount(settings({ signatureIds: [m.a.id, m.b.id], sort: "ORDER", rows: "ALL" }));

    // 다시 세기: from now on (a retried reset does not move it again).
    vi.setSystemTime(new Date("2026-10-23T12:03:00Z"));
    expect(await m.resetSigCount({ broadcastId: id, requestId: key(50) })).toEqual({ status: "SAVED" });
    vi.setSystemTime(new Date("2026-10-23T12:04:00Z"));
    await m.sign(m.a.id, m.a.price, "cm-s1");
    await m.resetSigCount({ broadcastId: id, requestId: key(50) });
    t = await table(m);
    expect(t.since).toBe("2026-10-23T12:03:00.000Z");
    expect(lines(t)).toEqual(["길동 1/0 = 1", "하늘 0/0 = 0", "바다 0/0 = 0"]);

    // 시작 시점 수정 (2026-10-28): back to the broadcast's start — the earlier ones count again.
    expect(await m.moveSigCountStart({ broadcastId: id, at: "2026-10-23T12:01:00.000Z" })).toEqual({ status: "SAVED" });
    expect((await table(m)).since).toBe("2026-10-23T12:01:00.000Z");
    expect(lines(await table(m))).toEqual(["길동 1/0 = 1", "하늘 1/0 = 1", "바다 1/2 = 3", "미지정 0/1 = 1"]);
    expect((await m.moveSigCountStart({ broadcastId: id, at: "2026-10-23T11:59:00.000Z" })).status).toBe("INVALID");
    await m.moveSigCountStart({ broadcastId: id, at: "2026-10-23T12:03:00.000Z" });

    // OBS에 표시: the overlay gets the table only through the key.
    expect(await m.setSigCountVisible({ broadcastId: id, on: true })).toEqual({ status: "SAVED" });
    const overlay = await m.getOverlayScoreboard(m.overlayKey);
    expect(overlay !== "IDLE" && overlay !== "FORBIDDEN" && overlay.sigCount).toMatchObject({ visible: true, totals: [1, 0] });

    // After the end, donations no longer count.
    vi.setSystemTime(new Date("2026-10-23T12:05:00Z"));
    await m.endBroadcast(id);
    vi.setSystemTime(new Date("2026-10-23T12:06:00Z"));
    await m.sign(m.a.id, m.a.price, "cm-s1");
    const { sigCountLive } = await import("./crewSigCountCore");
    expect(sigCountLive(mockCrew.broadcasts!.find((b) => b.id === id)!).totals).toEqual([1, 0]);
  });

  it("keeps a deleted signature's column and a removed member's row", async () => {
    const m = await load();
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "시그 방송", teamMode: false });
    await m.saveSigCount(settings({ signatureIds: [m.a.id] }));
    await m.sign(m.a.id, m.a.price, "cm-s2");
    const { deleteSignature } = await import("@/services/donations/signatures");
    const { mockCrew } = await import("./mockCrewStore");
    await deleteSignature(m.a.id);
    mockCrew.crews.studio = mockCrew.crews.studio.filter((x) => x.id !== "cm-s2");
    const t = await table(m);
    expect(t.columns).toEqual([{ id: m.a.id, name: "삭제된 시그니처", imageUrl: null }]);
    expect(t.rows).toEqual([{ memberId: "cm-s2", name: "삭제된 멤버", color: null, counts: [1], total: 1 }]);
    // Saving again needs signatures that exist.
    expect((await m.saveSigCount(settings({ signatureIds: [m.a.id] }))).status).toBe("INVALID");
  });

  it("validates the settings and needs the creator and a live broadcast", async () => {
    const m = await load();
    const { saveSignature } = await import("@/services/donations/signatures");
    await saveSignature({ name: "아홉째", price: 9_999, imageUrl: "/mock/room/signatures/sig-1.png", match: "SELECT", active: true, requestId: key(90) });
    const ids = (await m.getBroadcastView())!.signatures.map((s) => s.id);
    // 2026-10-30: when each was made (the one just saved) and whether it has its image and sound (no sound on the seeds).
    const listed = (await m.getBroadcastView())!.signatures;
    expect(listed.at(-1)).toMatchObject({ name: "아홉째", createdAt: expect.any(String), complete: false });
    expect(listed[0].createdAt).toBeUndefined();
    expect(ids).toHaveLength(9);
    const bad: [Record<string, unknown>, string][] = [
      [{ title: "가".repeat(21) }, "제목"],
      [{ title: "운영자 표" }, "사용할 수 없는"],
      [{ signatureIds: ["sig-nope"] }, "셀 시그니처"],
      [{ signatureIds: "x" }, "셀 시그니처"],
      [{ signatureIds: ids.slice(0, 9) }, "8개"],
      [{ rows: "SOME" }, "표시 설정"],
      [{ sort: "NAME" }, "표시 설정"],
      [{ showTotal: 1 }, "표시 설정"],
      [{ rows: "SELECTED" }, "멤버를 골라"],
      [{ rows: "SELECTED", memberIds: ["cm-nobody"] }, "멤버를 확인"],
      [{ memberIds: "cm-s1" as never }, "멤버를 확인"],
      [{ activeOnly: "yes" as never }, "표시 설정"]
    ];
    for (const [patch, message] of bad) {
      const res = await m.saveSigCount(settings(patch as Partial<SigCountSettings>));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    // A repeated signature is one column.
    expect(await m.saveSigCount(settings({ signatureIds: [ids[0], ids[0]] }))).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.sigCountSettings.signatureIds).toEqual([ids[0]]);
    // A screen from before 선택한 멤버 sends none: none picked.
    const { memberIds: _picked, activeOnly: _active, ...older } = settings({ signatureIds: [ids[0]] });
    expect([_picked, _active]).toEqual([[], false]);
    expect(await m.saveSigCount(older)).toEqual({ status: "SAVED" });
    expect((await m.getBroadcastView())!.sigCountSettings).toMatchObject({ rows: "RECEIVED", memberIds: [], activeOnly: false });

    expect(await m.setSigCountVisible({ broadcastId: "bc-x", on: true })).toEqual({ status: "INVALID", message: "진행 중인 방송이 아니에요." });
    expect((await m.resetSigCount({ broadcastId: "bc-x", requestId: key(1) })).status).toBe("INVALID");
    await m.startBroadcast({ requestId: crypto.randomUUID(), title: "시그 방송", teamMode: false });
    const id = (await m.getBroadcastView())!.live!.id;
    expect((await m.setSigCountVisible({ broadcastId: id, on: "yes" })).status).toBe("INVALID");
    expect((await m.resetSigCount({ broadcastId: id, requestId: "short" })).status).toBe("INVALID");
    signIn(["SUPPORTER"]);
    expect(await m.saveSigCount(settings())).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.setSigCountVisible({ broadcastId: id, on: true })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.resetSigCount({ broadcastId: id, requestId: key(2) })).toEqual({ status: "UNAUTHORIZED" });
  });
});
