import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { timerSeconds } from "@/features/creatorStudio/widgets/timerMath";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 방송 도구 (code-first): creator-only remote, key-guarded overlays, server-owned timer. */
/** A full 엔딩 크레딧 save (2026-10-23 sections) with `patch` on top. */
const credits = (patch: Record<string, unknown> = {}) => ({
  title: "감사합니다",
  thanks: ["모두 고마워요"],
  style: "FILM",
  durationSec: 40,
  period: "TODAY",
  sections: {
    total: { on: true, title: "", max: 1 },
    mvp: { on: true, title: "", max: 1 },
    top3: { on: true, title: "", max: 3 },
    donors: { on: true, title: "", max: 10 },
    hotSigs: { on: true, title: "", max: 5 },
    highSigs: { on: true, title: "", max: 5 },
    members: { on: true, title: "", max: 10 }
  },
  ...patch
});
async function load() {
  const tools = await import("./broadcastTools");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...tools, overlayKey: mockCreator.integrationKey };
}

describe("방송 도구", () => {
  beforeEach(() => resetMockStores());
  afterEach(() => vi.useRealTimers());

  it("shows saved subtitle and marquee on the overlay, and validates input", async () => {
    const { saveSubtitle, saveMarquee, getOverlayTool, overlayKey } = await load();
    expect(await saveSubtitle({ text: "  잠시 쉬어갈게요  ", size: "L" })).toEqual({ status: "SAVED" });
    expect(await getOverlayTool("subtitle", overlayKey)).toEqual({ tool: "subtitle", state: { text: "잠시 쉬어갈게요", size: "L" }, reloadSeq: 0, on: true, theme: expect.objectContaining({ theme: "PILL" }) });
    expect((await saveSubtitle({ text: "x".repeat(81), size: "M" })).status).toBe("INVALID");
    expect((await saveSubtitle({ text: "운영자 공지", size: "M" })).status).toBe("INVALID");
    expect((await saveSubtitle({ text: "hi", size: "XL" })).status).toBe("INVALID");

    expect(await saveMarquee({ lines: ["공지 1", " ", "공지 2"], speed: "FAST" })).toEqual({ status: "SAVED" });
    expect(await getOverlayTool("marquee", overlayKey)).toEqual({ tool: "marquee", state: { lines: ["공지 1", "공지 2"], speed: "FAST" }, reloadSeq: 0, on: true, theme: expect.objectContaining({ theme: "PILL" }) });
    expect((await saveMarquee({ lines: Array(6).fill("a"), speed: "FAST" })).status).toBe("INVALID");
  });

  it("keeps the timer on the server: start, pause, resume and reset", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-29T12:00:00Z"), toFake: ["Date"] });
    const { configureTimer, controlTimer, getOverlayTool, overlayKey } = await load();
    expect(await configureTimer({ mode: "COUNTDOWN", durationSec: 300 })).toEqual({ status: "SAVED" });
    await controlTimer("START");
    await controlTimer("START"); // repeated start does not restart the clock
    vi.setSystemTime(new Date("2026-09-29T12:01:00Z"));
    await controlTimer("PAUSE");
    const paused = await getOverlayTool("timer", overlayKey);
    if (paused === "FORBIDDEN" || paused.tool !== "timer") throw new Error("expected timer");
    expect(paused.state).toMatchObject({ startedAt: null, elapsedBeforeSec: 60 });
    expect(timerSeconds(paused.state, Date.now())).toBe(240);

    await controlTimer("START");
    vi.setSystemTime(new Date("2026-09-29T12:10:00Z"));
    const running = await getOverlayTool("timer", overlayKey);
    if (running === "FORBIDDEN" || running.tool !== "timer") throw new Error("expected timer");
    expect(timerSeconds(running.state, Date.now())).toBe(0); // countdown never goes negative

    await controlTimer("RESET");
    expect(await getOverlayTool("timer", overlayKey)).toMatchObject({ state: { startedAt: null, elapsedBeforeSec: 0 } });
    expect((await configureTimer({ mode: "COUNTDOWN", durationSec: 0 })).status).toBe("INVALID");
    expect((await controlTimer("REWIND")).status).toBe("INVALID");
  });

  it("computes the credits for today: total, donors by the 후원랭킹 rules, crew members and MVP", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-23T03:00:00Z"), toFake: ["Date"] });
    const { saveCredits, getOverlayTool, getToolsView, overlayKey } = await load();
    const { mockAlerts } = await import("./alertCore");
    const now = Date.now();
    const donation = (id: string, donor: string, fnAmount: number, extra: Record<string, unknown> = {}, at = now) =>
      mockAlerts.items.push({ id, kind: "DONATION", donor, message: "", fnAmount, typeLabel: "일반 후원", createdAt: new Date(at).toISOString(), status: "DONE", ...extra });
    donation("c1", "달빛", 30_000, { donorKey: "k1" });
    donation("c2", "달빛", 5_000, { donorKey: "k1" });
    donation("c3", "익명", 50_000, { donorKey: null }); // 프로필 숨기기: counted, never named
    donation("c4", "대체 문구", 40_000, { donorKey: "k3", nameReplaced: true }); // 대체 메시지 rules: counted, never named
    donation("c5", "초코", 20_000, { donorKey: "k4" });
    donation("c6", "어제손님", 90_000, { donorKey: "k5" }, now - 86_400_000); // yesterday
    expect(await saveCredits(credits())).toEqual({ status: "SAVED" });
    const view = await getOverlayTool("credits", overlayKey);
    if (view === "FORBIDDEN" || view.tool !== "credits") throw new Error("expected credits");
    expect(view.data).toEqual({
      periodLabel: "오늘",
      empty: false,
      total: 145_000,
      donors: [
        { rank: 1, name: "달빛", fnAmount: 35_000 },
        { rank: 2, name: "초코", fnAmount: 20_000 }
      ],
      // The seed donation for 하늘 is stamped now; active members with nothing today still roll.
      members: [
        { rank: 1, name: "하늘", score: 8_000 },
        { rank: 2, name: "길동", score: 0 },
        { rank: 3, name: "바다", score: 0 }
      ],
      memberUnit: "FN",
      mvp: { name: "하늘", score: 8_000 },
      hotSigs: [],
      highSigs: []
    });
    expect((await getToolsView())!.credits).toEqual(view.data);

    // Lists are cut to what the sections show: TOP 3 + 후원 순위 for donors, 멤버별 for members.
    await saveCredits(credits({ sections: { ...credits().sections, top3: { on: false, title: "", max: 3 }, donors: { on: true, title: "", max: 1 }, members: { on: true, title: "", max: 2 } } }));
    const cut = await getOverlayTool("credits", overlayKey);
    if (cut === "FORBIDDEN" || cut.tool !== "credits") throw new Error("expected credits");
    expect([cut.data.donors.length, cut.data.members.length]).toEqual([1, 2]);
  });

  it("reads the crew broadcast on the 크루 방송 period: its scoreboard while live, its frozen result once ended", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-23T03:00:00Z"), toFake: ["Date"] });
    const { saveCredits, getOverlayTool, overlayKey } = await load();
    const { mockAlerts } = await import("./alertCore");
    const bc = await import("@/services/crew/crewBroadcast");
    const data = async () => {
      const v = await getOverlayTool("credits", overlayKey);
      if (v === "FORBIDDEN" || v.tool !== "credits") throw new Error("expected credits");
      return v.data;
    };
    const donation = (id: string, fnAmount: number) =>
      mockAlerts.items.push({ id, kind: "DONATION", donor: "달빛", donorKey: "k1", message: "", fnAmount, typeLabel: "일반 후원", createdAt: new Date().toISOString(), status: "DONE" });
    expect(await saveCredits(credits({ period: "CREW" }))).toEqual({ status: "SAVED" });
    expect(await data()).toMatchObject({ periodLabel: "크루 방송 없음", empty: true, donors: [], members: [], mvp: null });

    donation("before", 70_000); // before the broadcast: not counted
    vi.setSystemTime(new Date("2026-10-23T03:10:00Z"));
    await bc.startBroadcast({ requestId: crypto.randomUUID(), title: "엔딩 테스트", project: "시즌1", teamMode: false });
    const id = (await bc.getBroadcastView())!.live!.id;
    vi.setSystemTime(new Date("2026-10-23T03:20:00Z"));
    donation("during", 12_000);
    await bc.adjustScore({ broadcastId: id, memberId: "cm-s3", points: 5_000, adjustmentId: crypto.randomUUID() });
    expect(await data()).toMatchObject({
      periodLabel: "엔딩 테스트 · 시즌1 1회차",
      empty: false,
      total: 12_000,
      memberUnit: "점",
      mvp: { name: "바다", score: 5_000 },
      members: [
        { rank: 1, name: "바다", score: 5_000 },
        { rank: 2, name: "길동", score: 0 },
        { rank: 3, name: "하늘", score: 0 }
      ]
    });

    vi.setSystemTime(new Date("2026-10-23T03:30:00Z"));
    await bc.endBroadcast(id);
    vi.setSystemTime(new Date("2026-10-23T03:40:00Z"));
    donation("after", 9_000); // after the end: not counted
    expect(await data()).toMatchObject({ total: 12_000, mvp: { name: "바다", score: 5_000 } });
  });

  it("rolls HOT 시그 by how often and HIGH 시그 by the largest donation, for signatures that still exist", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-25T03:00:00Z"), toFake: ["Date"] });
    const { saveCredits, getToolsView } = await load();
    const { mockAlerts } = await import("./alertCore");
    const { mockSignatures } = await import("@/services/donations/signatureCore");
    const [a, b, c] = mockSignatures.items;
    const now = Date.now();
    const sig = (id: string, signatureId: string | undefined, fnAmount: number, extra: Record<string, unknown> = {}, at = now) =>
      mockAlerts.items.push({ id, kind: "DONATION", donor: "달빛", donorKey: "k1", message: "", fnAmount, typeLabel: "시그니처 후원", createdAt: new Date(at).toISOString(), status: "DONE", signatureId, ...extra });
    sig("s1", a.id, a.price);
    sig("s2", a.id, a.price);
    sig("s3", b.id, 70_000); // matched by 금액범위 above its price
    sig("s4", c.id, c.price);
    sig("s5", c.id, c.price, {}, now - 86_400_000); // yesterday: not today's
    sig("s6", "sig-deleted", 999_000); // a signature deleted since
    sig("s7", undefined, 5_000); // no signature
    sig("s8", b.id, 1_000, { kind: "TEST" }); // 테스트 후원 never counts
    expect(await saveCredits(credits({ sections: { ...credits().sections, highSigs: { on: true, title: "", max: 2 } } }))).toEqual({ status: "SAVED" });
    const d = (await getToolsView())!.credits;
    // HOT: a twice; b and c once — the pricier first.
    const once = [b, c].sort((x, y) => y.price - x.price || x.name.localeCompare(y.name));
    expect(d.hotSigs).toEqual([{ rank: 1, name: a.name, count: 2 }, ...once.map((s, i) => ({ rank: i + 2, name: s.name, count: 1 }))]);
    // HIGH: by the largest donation that alerted as each, cut to the section's 2.
    const high = [{ name: a.name, fnAmount: a.price }, { name: b.name, fnAmount: 70_000 }, { name: c.name, fnAmount: c.price }].sort((x, y) => y.fnAmount - x.fnAmount || x.name.localeCompare(y.name));
    expect(d.highSigs).toEqual(high.slice(0, 2).map((r, i) => ({ rank: i + 1, ...r })));

    // A screen from before the sections existed saves without them: they stay as saved.
    const older = Object.fromEntries(Object.entries(credits().sections).filter(([k]) => k !== "hotSigs" && k !== "highSigs"));
    expect(await saveCredits(credits({ sections: older }))).toEqual({ status: "SAVED" });
    expect((await getToolsView())!.states.credits.sections.highSigs).toEqual({ on: true, title: "", max: 2 });
    expect((await saveCredits(credits({ sections: { ...credits().sections, hotSigs: { on: true, title: "", max: 0 } } })))).toEqual({ status: "INVALID", message: "표시 개수는 1~30개예요." });
  });

  it("validates the credits settings and keeps blank section titles for the defaults", async () => {
    const { saveCredits, getToolsView } = await load();
    const bad: [Record<string, unknown>, string][] = [
      [{ title: "" }, "제목"],
      [{ style: "SLIDE" }, "연출 방식"],
      [{ durationSec: 10 }, "스크롤 시간"],
      [{ durationSec: 181 }, "스크롤 시간"],
      [{ durationSec: 30.5 }, "스크롤 시간"],
      [{ period: "WEEK" }, "집계 기간"],
      [{ sections: { ...credits().sections, mvp: { on: "yes", title: "", max: 1 } } }, "섹션 설정"],
      [{ sections: { ...credits().sections, total: { on: true, title: "가".repeat(21), max: 1 } } }, "20자"],
      [{ sections: { ...credits().sections, donors: { on: true, title: "", max: 0 } } }, "1~30명"],
      [{ sections: { ...credits().sections, members: { on: true, title: "", max: 31 } } }, "1~30명"],
      [{ sections: { ...credits().sections, top3: { on: true, title: "운영자 픽", max: 3 } } }, "사용할 수 없는"]
    ];
    for (const [patch, message] of bad) {
      const res = await saveCredits(credits(patch));
      expect(res.status === "INVALID" && res.message, message).toContain(message);
    }
    expect(await saveCredits(credits({ style: "CRAWL", durationSec: 90, sections: { ...credits().sections, mvp: { on: false, title: " 오늘의 주인공 ", max: 1 } } }))).toEqual({ status: "SAVED" });
    expect((await getToolsView())!.states.credits).toMatchObject({ style: "CRAWL", durationSec: 90, sections: { mvp: { on: false, title: "오늘의 주인공", max: 1 }, total: { title: "" } } });
    signIn(["SUPPORTER"]);
    expect(await saveCredits(credits())).toEqual({ status: "UNAUTHORIZED" });
  });

it("퀵 조정 moves the shown time in both modes, clamped at zero", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-30T12:00:00Z"), toFake: ["Date"] });
    const { configureTimer, controlTimer, adjustTimer, getOverlayTool, overlayKey } = await load();
    const shown = async () => {
      const t = await getOverlayTool("timer", overlayKey);
      if (t === "FORBIDDEN" || t.tool !== "timer") throw new Error("expected timer");
      return timerSeconds(t.state, Date.now());
    };
    await configureTimer({ mode: "COUNTDOWN", durationSec: 120 });
    await controlTimer("START");
    vi.setSystemTime(new Date("2026-09-30T12:00:30Z"));
    expect(await shown()).toBe(90);
    await adjustTimer(60);
    expect(await shown()).toBe(150); // running countdown: more time left
    await adjustTimer(-60);
    await adjustTimer(-60);
    await adjustTimer(-60);
    expect(await shown()).toBe(0);
    // Past the end the countdown shows 0: the first +30 gives 30 seconds (not "−70 → 0", nothing).
    vi.setSystemTime(new Date("2026-09-30T12:02:00Z"));
    await adjustTimer(30);
    expect(await shown()).toBe(30);
    await configureTimer({ mode: "STOPWATCH", durationSec: 600 });
    await adjustTimer(30);
    expect(await shown()).toBe(30);
    expect((await adjustTimer(45)).status).toBe("INVALID");
  });

  it("rolls the ending credits only between 시작 and 중지, keeping the roll across saves", async () => {
    const { controlCredits, saveCredits, getOverlayTool, overlayKey } = await load();
    expect(await getOverlayTool("credits", overlayKey)).toMatchObject({ state: { rollingSince: null } });
    await controlCredits("START");
    await saveCredits(credits({ title: "감사합니다", thanks: ["또 만나요"] }));
    const rolling = await getOverlayTool("credits", overlayKey);
    if (rolling === "FORBIDDEN" || rolling.tool !== "credits") throw new Error("expected credits");
    expect(rolling.state.rollingSince).not.toBeNull();
    await controlCredits("STOP");
    expect(await getOverlayTool("credits", overlayKey)).toMatchObject({ state: { rollingSince: null } });
    expect((await controlCredits("PAUSE")).status).toBe("INVALID");
  });

  it("rejects wrong overlay keys, unknown tools and non-creators", async () => {
    const { getOverlayTool, saveSubtitle, getToolsView, controlTimer, overlayKey } = await load();
    expect(await getOverlayTool("subtitle", "wrong-key")).toBe("FORBIDDEN");
    expect(await getOverlayTool("chat", overlayKey)).toBe("FORBIDDEN");
    signIn(["SUPPORTER"]);
    expect(await saveSubtitle({ text: "hi", size: "M" })).toEqual({ status: "UNAUTHORIZED" });
    expect(await controlTimer("START")).toEqual({ status: "UNAUTHORIZED" });
    expect(await getToolsView()).toBeNull();
    signIn(null);
    expect(await getToolsView()).toBeNull();
  });
});
