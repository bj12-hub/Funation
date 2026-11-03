import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 7: 즐겨찾기 as FLEXTV's, against a stubbed FLEXTV API. */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0" })
}));
vi.mock("@/lib/session", () => ({ getFlextvAccessToken: async () => (signedIn.value ? "member-token" : null) }));
const signedIn = { value: true };

const owner = (n: number) => ({ loginId: `bj0${n}`, nickname: `방송인${n}`, thumbUrl: `https://cdn.flextv.test/${n}.png` });
let state: { verified: boolean; kept: Set<number>; addAnswer: "array" | "FAIL"; addTakes: boolean };
let calls: string[];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  signedIn.value = true;
  calls = [];
  state = { verified: true, kept: new Set([3021, 3022]), addAnswer: "array", addTakes: true };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const method = init.method ?? "GET";
      calls.push(`${method} ${u.pathname}`);
      if (u.pathname === "/api/my/profile") return json({ luv: 0, profile: { loginId: "viewer01", nickname: "시청자", PI: state.verified ? { isAdult: true } : null } });
      if (u.pathname === "/api/subscribes" && method === "GET")
        return json([...state.kept].map((id) => ({ id, name: `방송국${id}`, isInLive: id === 3022, numberOfSubs: id, owner: owner(id % 10) })));
      if (u.pathname === "/api/subscribes" && method === "POST") {
        const id = Number(JSON.parse(String(init.body)).targetId);
        if (state.addTakes) state.kept.add(id);
        return state.addAnswer === "array" ? json([{ id, stat: 1, owner: owner(1) }]) : new Response("FAIL", { status: 200 });
      }
      const check = u.pathname.match(/^\/api\/subscribes\/(\d+)\/check$/);
      if (check) return state.kept.has(Number(check[1])) ? json({ memberId: 1, channelId: Number(check[1]) }) : new Response(null, { status: 204 });
      const del = u.pathname.match(/^\/api\/subscribes\/(\d+)$/);
      if (del && method === "DELETE") {
        state.kept.delete(Number(del[1]));
        return new Response("OK", { status: 200 });
      }
      throw new Error(`unexpected FLEXTV call ${method} ${u.pathname}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("the 즐겨찾기 list", () => {
  it("shows the member's FLEXTV 즐겨찾기 as rooms, searched and paged here", async () => {
    const { flextvFavoritesPage } = await import("./flextvFavorites");
    const page = (await flextvFavoritesPage({}))!;
    expect(page.totalCount).toBe(2);
    expect(page.items[0]).toEqual({ creatorId: "3021", name: "방송인1", avatarUrl: "https://cdn.flextv.test/1.png", subscriberCount: 3021, verified: false, isLive: false });
    expect((await flextvFavoritesPage({ query: "방송인2" }))!.items.map((c) => c.creatorId)).toEqual(["3022"]);
    signedIn.value = false;
    expect(await flextvFavoritesPage({})).toBeNull();
  });
});

describe("adding", () => {
  it("asks for FLEXTV's 본인인증 first and adds nothing without it", async () => {
    state.verified = false;
    const { flextvAddFavorite } = await import("./flextvFavorites");
    expect(await flextvAddFavorite("3030")).toEqual({ status: "NEEDS_VERIFICATION" });
    expect(calls).not.toContain("POST /api/subscribes");
    expect(state.kept.has(3030)).toBe(false);
  });

  it("adds a channel, and settles FLEXTV's unclear 'FAIL' by its check", async () => {
    const { flextvAddFavorite } = await import("./flextvFavorites");
    expect(await flextvAddFavorite("3030")).toEqual({ status: "ADDED" });
    // Already kept: FLEXTV answers FAIL, the end state is the one asked for.
    state.addAnswer = "FAIL";
    state.addTakes = false;
    expect(await flextvAddFavorite("3021")).toEqual({ status: "ADDED" });
    // No such channel: FAIL and not kept.
    expect(await flextvAddFavorite("9999")).toEqual({ status: "NOT_FOUND" });
    expect(await flextvAddFavorite("c1")).toEqual({ status: "NOT_FOUND" });
  });
});

describe("removing", () => {
  it("removes it on FLEXTV", async () => {
    const { flextvRemoveFavorite, flextvIsFavorite } = await import("./flextvFavorites");
    expect(await flextvIsFavorite("3021")).toBe(true);
    expect(await flextvRemoveFavorite("3021")).toEqual({ status: "REMOVED" });
    expect(await flextvIsFavorite("3021")).toBe(false);
    signedIn.value = false;
    expect(await flextvRemoveFavorite("3022")).toEqual({ status: "UNAUTHORIZED" });
  });
});
