import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());
// `redirect()` ends the render; here it throws the address so the test can read it.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error(`NEXT_REDIRECT ${to}`), { to });
  },
  useRouter: () => ({ refresh() {}, push() {}, replace() {} })
}));
// The screens themselves are not under test (client components).
vi.mock("@/features/creatorStudio/remote/RemoteScreen", () => ({ RemoteScreen: () => null }));
vi.mock("@/features/broadcast/UnifiedChatScreen", () => ({ UnifiedChatScreen: () => null }));
vi.mock("@/features/channel/CreateChannelScreen", () => ({ CreateChannelScreen: () => null }));

/**
 * The 리모컨 and 통합 채팅 windows (`/popout/remote` — the 도우미's "리모컨 열기", an OBS dock, a phone — and
 * `/popout/chat`) for members they cannot show. A signed-in member without a channel (a supporter, or an account that
 * signed up again after 탈퇴) used to be sent to sign-in, which sends a signed-in member straight back: a redirect loop.
 */
async function redirectOf(render: () => unknown): Promise<string | null> {
  try {
    await render();
    return null;
  } catch (e) {
    if (e && typeof e === "object" && "to" in e) return (e as { to: string }).to;
    throw e;
  }
}

const remote = async () => (await import("@/app/popout/remote/page")).default();
const chat = async () => (await import("@/app/popout/chat/page")).default();
const login = async (next: string) => (await import("@/app/(auth)/login/page")).default({ searchParams: Promise.resolve({ next }) });
const createChannel = async () => (await import("@/app/(main)/channel/new/page")).default();

describe("creator-only windows · who gets sent where", () => {
  beforeEach(() => resetMockStores());

  it("shows the windows to a creator", async () => {
    expect(await redirectOf(remote)).toBeNull();
    expect(await redirectOf(chat)).toBeNull();
  });

  it("sends a signed-out visitor to sign-in and back", async () => {
    signIn(null);
    expect(await redirectOf(remote)).toBe("/login?role=creator&next=/popout/remote");
    expect(await redirectOf(chat)).toBe("/login?role=creator&next=/popout/chat");
  });

  it("sends a signed-in member without a channel to 채널 만들기, not into a sign-in loop", async () => {
    signIn(["SUPPORTER"]);
    // Sign-in sends a signed-in member straight back to `next` …
    expect(await redirectOf(() => login("/popout/remote"))).toBe("/popout/remote");
    // … so the windows send them where the chain ends: 채널 만들기, which a member without a channel can use.
    expect(await redirectOf(remote)).toBe("/channel/new");
    expect(await redirectOf(chat)).toBe("/channel/new");
    expect(await redirectOf(createChannel)).toBeNull();
  });
});
