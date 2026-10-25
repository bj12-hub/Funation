import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 9: FLEXTV's 이벤트 and 명예의 전당, against a stubbed FLEXTV API. */

vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_SITE: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));

let calls: string[];
let down: boolean;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const event = (id: number, open = 1) => ({ id, title: `이벤트 ${id}`, imgUrl: "/image/thumbnail.png", open, startDate: "2026-10-01T00:00:00.000Z", endDate: "2026-10-31T00:00:00.000Z", code: id === 50 ? "halloffame" : null });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  calls = [];
  down = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = new URL(url);
      calls.push(`${u.pathname}${u.search}`);
      if (down) return new Response("Internal Server Error", { status: 500 });
      if (u.pathname === "/api/cs/event-list") {
        const ended = u.searchParams.get("option") === "off";
        const all = ended ? [event(40, 7)] : Array.from({ length: 14 }, (_, i) => event(60 - i));
        return json({ data: all.slice(0, Number(u.searchParams.get("limit"))), count: all.length });
      }
      if (u.pathname === "/api/cs/event-page") {
        const id = Number(u.searchParams.get("page"));
        if (id !== 50 && id !== 51) return new Response("Internal Server Error", { status: 500 });
        return json({ events: { ...event(id), bcontent: id === 50 ? "" : "<p>참여하세요</p>" }, prevevents: null, nextevents: null });
      }
      if (u.pathname === "/api/events/find-hof_total_rankings") return json([{ loginId: "fan01", nickname: "열혈팬", memberId: 700, channelId: null, point: 100, rank: 1, badges: [] }]);
      throw new Error(`unexpected FLEXTV call ${u.pathname}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("이벤트", () => {
  it("lists FLEXTV's 진행 중 events, a page at a time, and its 종료 ones", async () => {
    const { getFlextvEvents } = await import("./flextvEvents");
    expect(await getFlextvEvents(undefined, undefined)).toMatchObject({ ended: false, total: 14, show: 12, hasMore: true });
    expect((await getFlextvEvents(undefined, "24")).hasMore).toBe(false);
    expect(await getFlextvEvents("ended", undefined)).toMatchObject({ ended: true, items: [{ id: "40" }], hasMore: false });
  });

  it("opens an event, and links FLEXTV's page by its code when it has one", async () => {
    const { getFlextvEvent } = await import("./flextvEvents");
    expect(await getFlextvEvent("51")).toMatchObject({ title: "이벤트 51", blocks: [{ kind: "text", text: "참여하세요" }], flextvUrl: "https://www.flextv.test/events/proceeding/51" });
    expect(await getFlextvEvent("50")).toMatchObject({ blocks: [], flextvUrl: "https://www.flextv.test/events/proceeding/halloffame" });
  });

  it("tells a missing event from FLEXTV being down", async () => {
    const { getFlextvEvent } = await import("./flextvEvents");
    expect(await getFlextvEvent("99")).toBeNull();
    expect(await getFlextvEvent("../1")).toBeNull();
    expect(calls.filter((c) => c.includes("../1"))).toEqual([]);
    down = true;
    await expect(getFlextvEvent("99")).rejects.toThrow();
  });
});

describe("명예의 전당", () => {
  it("shows this month unless another offered month is asked", async () => {
    const { getFlextvHallOfFame } = await import("@/services/hallOfFame/flextvHallOfFame");
    const view = await getFlextvHallOfFame(undefined);
    expect(view.month).toBe(view.months[0]);
    expect(view.months.at(-1)).toBe("202601");
    expect(view.rows).toEqual([{ rank: 1, nickname: "열혈팬", channelId: null, points: 100, badges: [] }]);
    expect((await getFlextvHallOfFame("202601")).month).toBe("202601");
    expect((await getFlextvHallOfFame("199901")).month).toBe(view.months[0]);
    expect(calls.filter((c) => c.includes("199901"))).toEqual([]);
  });
});
