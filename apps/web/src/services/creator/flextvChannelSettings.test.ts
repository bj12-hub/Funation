import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Phase 7: the studio's 채널 설정 as FLEXTV's 방송국, against a stubbed FLEXTV API. */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.7", "user-agent": "Mozilla/5.0" })
}));
vi.mock("@/lib/flextv/mode", () => ({ FLEXTV_BACKEND: true, FLEXTV_AUTH: true, FLEXTV_STUDIO: true, FLEXTV_SITE: true, FLEXTV_WEB_URL: "https://www.flextv.test" }));
const member = { creator: true };
vi.mock("@/lib/session", () => ({
  getCreatorSession: async () => (member.creator ? { userId: "601900", nickname: "방송인", ssumnationId: "bj01", avatarUrl: null, roles: ["SUPPORTER", "CREATOR"] } : null),
  getFlextvAccessToken: async () => "member-token"
}));

let channel: { name: string; description: string; backgroundImgUrl: string };
let links: Record<string, string>;
let taken: string[];
let puts: FormData[];
let linkPosts: Record<string, unknown>[];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("FLEXTV_API_URL", "https://api.flextv.test");
  member.creator = true;
  channel = { name: "방송인의 방송국", description: "어서 오세요", backgroundImgUrl: "https://cdn.flextv.test/banner.png" };
  links = { youtube: "https://youtube.com/@bj", title1: "카페", link1: "https://cafe.test/bj" };
  taken = ["있는이름"];
  puts = [];
  linkPosts = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const u = new URL(url);
      const method = init.method ?? "GET";
      if (u.pathname === "/api/my/channel/profile" && method === "GET") return json({ id: 3021, ...channel, owner: { thumbUrl: "https://cdn.flextv.test/me.png" } });
      if (u.pathname === "/api/my/channel/profile" && method === "PUT") {
        const form = init.body as FormData;
        puts.push(form);
        const name = form.get("name");
        if (typeof name === "string") channel.name = decodeURIComponent(name);
        const description = form.get("description");
        if (typeof description === "string") channel.description = description;
        if (form.get("image")) channel.backgroundImgUrl = "https://cdn.flextv.test/new-banner.png";
        return new Response("OK", { status: 200 });
      }
      if (u.pathname === "/api/my/channel/external-link" && method === "GET") return json(links);
      if (u.pathname === "/api/my/channel/external-link" && method === "POST") {
        const body = JSON.parse(String(init.body));
        linkPosts.push(body);
        links = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== "")) as Record<string, string>;
        return json(links);
      }
      if (u.pathname.startsWith("/api/my/channel/")) return new Response(taken.includes(decodeURIComponent(u.pathname.split("/").pop()!)) ? "overlap" : "ok", { status: 200 });
      throw new Error(`unexpected FLEXTV call ${method} ${u.pathname}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("채널 설정", () => {
  it("shows the FLEXTV 방송국 to its streamer only", async () => {
    const { getFlextvChannelSettings } = await import("./flextvChannelSettings");
    expect(await getFlextvChannelSettings()).toEqual({
      channelId: "3021",
      name: "방송인의 방송국",
      description: "어서 오세요",
      bannerUrl: "https://cdn.flextv.test/banner.png",
      avatarUrl: "https://cdn.flextv.test/me.png",
      links: { instagram: "", youtube: "https://youtube.com/@bj", discord: "", tiktok: "", twitter: "" }
    });
    member.creator = false;
    expect(await getFlextvChannelSettings()).toBeNull();
  });

  it("changes the name only within FLEXTV's rule and when it is still free", async () => {
    const { checkFlextvChannelName, saveFlextvChannelName } = await import("./flextvChannelSettings");
    expect(await checkFlextvChannelName("한")).toMatchObject({ status: "INVALID" });
    expect(await checkFlextvChannelName("열여섯글자가넘는아주긴방송국이름이요")).toMatchObject({ status: "INVALID" });
    expect(await checkFlextvChannelName("있는이름")).toEqual({ status: "TAKEN" });
    expect(await checkFlextvChannelName("새 방송국")).toEqual({ status: "AVAILABLE" });
    // Taken between the check and the save.
    taken.push("새 방송국");
    expect(await saveFlextvChannelName("새 방송국")).toEqual({ status: "TAKEN" });
    expect(puts).toHaveLength(0);
    expect(await saveFlextvChannelName("  다른 방송국 ")).toEqual({ status: "SAVED" });
    expect(channel.name).toBe("다른 방송국");
    // One change per call: the name alone.
    expect(puts[0].get("description")).toBeNull();
  });

  it("does not send an empty or too long 소개", async () => {
    const { saveFlextvChannelDescription } = await import("./flextvChannelSettings");
    expect(await saveFlextvChannelDescription("   ")).toMatchObject({ status: "INVALID" });
    expect(await saveFlextvChannelDescription("가".repeat(251))).toMatchObject({ status: "INVALID" });
    expect(await saveFlextvChannelDescription("새 소개")).toEqual({ status: "SAVED" });
    expect(channel.description).toBe("새 소개");
    expect(puts.map((f) => f.get("name"))).toEqual([null]);
  });

  it("takes a real JPG or PNG banner only", async () => {
    const { uploadFlextvChannelBanner } = await import("./flextvChannelSettings");
    const form = (file: File) => {
      const f = new FormData();
      f.set("banner", file);
      return f;
    };
    expect(await uploadFlextvChannelBanner(form(new File(["GIF89a"], "b.gif", { type: "image/gif" })))).toMatchObject({ status: "INVALID" });
    expect(await uploadFlextvChannelBanner(form(new File(["not a png"], "b.png", { type: "image/png" })))).toMatchObject({ status: "INVALID" });
    expect(puts).toHaveLength(0);
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "b.png", { type: "image/png" });
    expect(await uploadFlextvChannelBanner(form(png))).toEqual({ status: "SAVED" });
    expect(channel.backgroundImgUrl).toBe("https://cdn.flextv.test/new-banner.png");
  });

  it("saves the platform links and keeps FLEXTV's free links as they were", async () => {
    const { saveFlextvChannelLinks } = await import("./flextvChannelSettings");
    expect(await saveFlextvChannelLinks({ instagram: "javascript:alert(1)" })).toMatchObject({ status: "INVALID" });
    expect(linkPosts).toHaveLength(0);
    expect(await saveFlextvChannelLinks({ instagram: "https://instagram.com/bj", youtube: "" })).toEqual({ status: "SAVED" });
    expect(linkPosts[0]).toMatchObject({ instagram: "https://instagram.com/bj", youtube: "", title1: "카페", link1: "https://cafe.test/bj", title2: "" });
    expect(links).toEqual({ instagram: "https://instagram.com/bj", title1: "카페", link1: "https://cafe.test/bj" });
  });
});
