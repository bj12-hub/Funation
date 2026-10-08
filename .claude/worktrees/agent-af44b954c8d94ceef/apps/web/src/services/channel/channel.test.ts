import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetMockStores } from "@/test/mockEnv";

/**
 * 채널 만들기 (code-first): uses the real session module so the granted role is observable
 * through getCreatorSession().
 */

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name)
  })
}));
vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));

async function load(roles: ("SUPPORTER" | "CREATOR")[] = ["SUPPORTER"]) {
  const session = await import("@/lib/session");
  const { mockSessionState } = await import("@/services/account/mockStore");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const channel = await import("./channel");
  await session.startSession({ keepSignedIn: false });
  mockSessionState.roles = roles;
  return { ...channel, ...session, mockCreator };
}

const valid = { slug: "my-channel", name: "새 채널", intro: "게임 방송", agreed: true };

describe("채널 만들기", () => {
  beforeEach(() => {
    resetMockStores();
    cookieJar.clear();
  });

  it("creates the channel and grants the Creator role", async () => {
    const { createChannel, getCreatorSession, mockCreator } = await load();
    expect(await getCreatorSession()).toBeNull();
    expect(await createChannel(valid)).toEqual({ status: "CREATED", slug: "my-channel" });
    expect(await getCreatorSession()).not.toBeNull();
    expect(mockCreator).toMatchObject({ channelName: "새 채널", handle: "my-channel" });
    expect(await createChannel(valid)).toEqual({ status: "ALREADY_CREATOR" });
  });

  it("validates slug, name, intro and consent on the server", async () => {
    const { createChannel, checkChannelSlug } = await load();
    expect((await checkChannelSlug("admin")).status).toBe("TAKEN");
    expect((await checkChannelSlug("ab")).status).toBe("INVALID");
    expect((await checkChannelSlug("-abc")).status).toBe("INVALID");
    expect((await checkChannelSlug("good-one")).status).toBe("AVAILABLE");
    expect(await createChannel({ ...valid, slug: "creator" })).toEqual({ status: "SLUG_TAKEN" });
    expect((await createChannel({ ...valid, slug: "a--b" })).status).toBe("INVALID");
    expect((await createChannel({ ...valid, name: "x" })).status).toBe("INVALID");
    expect((await createChannel({ ...valid, intro: "가".repeat(201) })).status).toBe("INVALID");
    expect((await createChannel({ ...valid, agreed: false })).status).toBe("INVALID");
  });

  it("requires a session", async () => {
    const { createChannel, endSession } = await load();
    await endSession();
    expect(await createChannel(valid)).toEqual({ status: "UNAUTHORIZED" });
  });
});
