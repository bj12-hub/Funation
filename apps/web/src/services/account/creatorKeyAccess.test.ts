import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, resetMockStores } from "@/test/mockEnv";

// The real session (cookie → sample member), so the 리모컨 below is refused the way a browser is.
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name)
  })
}));
vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));

/**
 * docs/domains/wallet.md: 정지 · 탈퇴 중에는 키 · 링크로 하는 접근도 막힙니다. The OBS overlay key (연동 키) opens every
 * `/overlay/*` page and the reads they poll; while the creator is suspended or withdrawn each answers like an unknown
 * key (FORBIDDEN → the transparent 404), and lifting the suspension opens them again with the same key. Manager chat
 * links and the bank-SMS webhook have their own tests (managerChat.test.ts, bankSms.test.ts).
 */
async function load() {
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const { OVERLAY_TARGETS } = await import("@/services/creator/alertTypes");
  const { TOOL_KEYS } = await import("@/services/creator/broadcastToolTypes");
  const { WIDGET_OVERLAYS } = await import("@/services/creator/widgetOverlayTypes");
  const alert = await import("@/services/creator/alertRemote");
  const chat = await import("@/services/broadcast/unifiedChat");
  const banner = await import("@/services/creator/banner");
  const tools = await import("@/services/creator/broadcastTools");
  const effects = await import("@/services/creator/effects");
  const media = await import("@/services/creator/media");
  const widgets = await import("@/services/creator/widgetOverlay");
  const crew = await import("@/services/crew/crewBroadcast");
  const reads: [string, (k: unknown) => Promise<unknown>][] = [
    ["후원 알림", (k) => alert.getOverlayAlert(k)],
    ...OVERLAY_TARGETS.map((t): [string, (k: unknown) => Promise<unknown>] => [`리모컨 신호 ${t.key}`, (k) => alert.getOverlaySignal(k, t.key)]),
    ["통합 채팅", (k) => chat.getChatOverlay(k)],
    ["배너", (k) => banner.getOverlayBanner(k)],
    ...TOOL_KEYS.map((t): [string, (k: unknown) => Promise<unknown>] => [`방송 도구 ${t}`, (k) => tools.getOverlayTool(t, k)]),
    ["이펙트", (k) => effects.getOverlayEffects(k)],
    ["영상 후원", (k) => media.getOverlayVideo(k)],
    ["그림 후원", (k) => media.getOverlayDrawing(k)],
    ...WIDGET_OVERLAYS.map((w): [string, (k: unknown) => Promise<unknown>] => [`후원 위젯 ${w}`, (k) => widgets.getOverlayWidget(w, k)]),
    ["크루 점수판", (k) => crew.getOverlayScoreboard(k)]
  ];
  /** The reads that refuse the key. */
  const refused = async (k: unknown) => {
    const out: string[] = [];
    for (const [name, read] of reads) if ((await read(k)) === "FORBIDDEN") out.push(name);
    return out;
  };
  return { mockCreator, reads, refused };
}

const suspendCreator = async (until: string | null = null) => {
  const { SAMPLE_MEMBER_ID, memberStore } = await import("@/services/admin/memberCore");
  memberStore().suspensions[SAMPLE_MEMBER_ID] = { reason: "테스트 정지", at: new Date().toISOString(), until, by: "adm-1" };
  return () => delete memberStore().suspensions[SAMPLE_MEMBER_ID];
};
const withdrawCreator = async () => {
  const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
  recordWithdrawal({ at: new Date().toISOString(), requestId: key(99), forfeitedFn: 0, forfeitedEarningsFn: 0 });
};

/** Every OBS overlay page, as OBS opens it with the key. */
async function overlayPages(k: string) {
  const params = <T extends object>(p: T) => ({ params: Promise.resolve({ key: k, ...p }), searchParams: Promise.resolve({}) });
  return [
    ["alert", () => import("@/app/overlay/alert/[key]/page").then((m) => m.default(params({})))],
    ["banner", () => import("@/app/overlay/banner/[key]/page").then((m) => m.default(params({})))],
    ["chat", () => import("@/app/overlay/chat/[key]/page").then((m) => m.default(params({})))],
    ["crew", () => import("@/app/overlay/crew/[key]/page").then((m) => m.default(params({})))],
    ["drawing", () => import("@/app/overlay/drawing/[key]/page").then((m) => m.default(params({})))],
    ["effects", () => import("@/app/overlay/effects/[key]/page").then((m) => m.default(params({})))],
    ["video", () => import("@/app/overlay/video/[key]/page").then((m) => m.default(params({})))],
    ["tool", () => import("@/app/overlay/tool/[tool]/[key]/page").then((m) => m.default(params({ tool: "subtitle" })))],
    ["widget", () => import("@/app/overlay/widget/[widget]/[key]/page").then((m) => m.default(params({ widget: "goal" })))]
  ] as const;
}

/** The pages that answered with the overlay 404 (`notFound()` → `app/overlay/not-found.tsx`, which renders nothing). */
async function notFoundPages(k: string) {
  const out: string[] = [];
  for (const [name, render] of await overlayPages(k)) {
    try {
      await render();
    } catch (e) {
      if ((e as { digest?: string }).digest === "NEXT_HTTP_ERROR_FALLBACK;404") out.push(name);
      else throw e;
    }
  }
  return out;
}

const ALL_PAGES = ["alert", "banner", "chat", "crew", "drawing", "effects", "video", "tool", "widget"];

describe("정지 · 탈퇴 중 OBS 오버레이 키", () => {
  beforeEach(() => {
    resetMockStores();
    cookieJar.clear();
  });

  it("opens every overlay read with the key, and none with another key", async () => {
    const m = await load();
    expect(m.reads.length).toBeGreaterThan(20);
    expect(await m.refused(m.mockCreator.integrationKey)).toEqual([]);
    expect(await m.refused("0000-0000-0000-0000")).toEqual(m.reads.map(([name]) => name));
  }, 30_000); // the first test imports every overlay service (1–4 s under a full parallel run, against the default 5 s)

  it("refuses every overlay read while the creator is suspended, and opens them again with the same key once lifted", async () => {
    const m = await load();
    const k = m.mockCreator.integrationKey;
    const all = m.reads.map(([name]) => name);

    const lift = await suspendCreator();
    expect(await m.refused(k)).toEqual(all);
    lift();
    expect(m.mockCreator.integrationKey).toBe(k);
    expect(await m.refused(k)).toEqual([]);

    // A 기간 정지 ends by itself: the key works again after `until`, with nothing re-issued.
    await suspendCreator(new Date(Date.now() + 60_000).toISOString());
    expect(await m.refused(k)).toEqual(all);
    await suspendCreator(new Date(Date.now() - 1_000).toISOString());
    expect(await m.refused(k)).toEqual([]);
  });

  it("refuses every overlay read after the creator withdraws", async () => {
    const m = await load();
    const k = m.mockCreator.integrationKey;
    await withdrawCreator();
    expect(await m.refused(k)).toEqual(m.reads.map(([name]) => name));
  });

  it("renders every overlay page as the empty overlay 404 while suspended, as for an unknown key", async () => {
    const m = await load();
    const k = m.mockCreator.integrationKey;
    expect(await notFoundPages(k)).toEqual([]);
    expect(await notFoundPages("0000-0000-0000-0000")).toEqual(ALL_PAGES);

    const lift = await suspendCreator();
    expect(await notFoundPages(k)).toEqual(ALL_PAGES);
    lift();
    expect(await notFoundPages(k)).toEqual([]);

    await withdrawCreator();
    expect(await notFoundPages(k)).toEqual(ALL_PAGES);
  }, 30_000); // renders nine overlay pages; slow under a full parallel run

  it("keeps the 리모컨 (/popout/remote) closed while suspended: it has no key or token, only the creator's session", async () => {
    const { startSession } = await import("@/lib/session");
    const { getRemoteView } = await import("@/services/creator/alertRemote");
    const { getOverlayKey, getToolsView } = await import("@/services/creator/broadcastTools");
    const { getVoteRemote } = await import("@/services/creator/voteRemote");
    const { getRouletteRemote } = await import("@/services/creator/rouletteRemote");
    const { getGachaRemote } = await import("@/services/creator/gachaRemote");
    const { getWallpaperRemote } = await import("@/services/creator/wallpaperRemote");
    const remote = () => Promise.all([getRemoteView(), getOverlayKey(), getToolsView(), getVoteRemote(), getRouletteRemote(), getGachaRemote(), getWallpaperRemote()]);
    await startSession({ keepSignedIn: false });
    expect((await remote()).every((v) => v !== null)).toBe(true);

    const lift = await suspendCreator();
    expect((await remote()).every((v) => v === null)).toBe(true);
    lift();
    expect((await remote()).every((v) => v !== null)).toBe(true);
  });
});
