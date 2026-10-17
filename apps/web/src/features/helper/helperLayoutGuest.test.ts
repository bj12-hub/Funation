import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Role } from "@/types/role";

const state: { path: string; session: { nickname: string; roles: Role[] } | null } = { path: "/", session: null };

vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-ssumnation-helper-path": state.path }) }));
vi.mock("@/lib/session", () => ({
  getSession: async () => state.session,
  hasRole: (s: { roles: Role[] } | null, role: Role) => !!s && s.roles.includes(role)
}));
vi.mock("@/services/creator/creatorStudio", () => ({ getCreatorProfile: async () => null }));

/**
 * Ssumnation 도우미 layout for visitors who are not creators: the landing (signed out) or 채널 만들기 (no channel) stands
 * in for the helper's own pages only. The site's pages are the helper's 404 for them too (docs/development/helper-domain.md:
 * "unknown paths → the helper's 404"), not a landing whose sign-in leads to that 404.
 */
describe("도우미 layout, not a creator", () => {
  beforeEach(() => {
    state.session = null;
  });

  async function layout(path: string) {
    state.path = path;
    const { default: HelperLayout } = await import("@/app/helper/layout");
    return HelperLayout({ children: null });
  }

  it("shows the landing on the helper's pages, keeping the address for after sign-in", async () => {
    const { HelperLanding } = await import("./HelperLanding");
    for (const path of ["/", "/overlays", "/remote/guide", "/goal?tab=goal"]) {
      const el = await layout(path);
      expect(el.type, path).toBe(HelperLanding);
      expect(el.props, path).toEqual({ next: path });
    }
  });

  it("answers the site's pages with the 404, signed out or without a channel", async () => {
    for (const path of ["/wallet", "/donation/youtube", "/events", "/mypage"]) {
      await expect(layout(path), path).rejects.toMatchObject({ digest: expect.stringMatching(/;404$/) });
    }
    state.session = { nickname: "후원자", roles: ["SUPPORTER"] };
    await expect(layout("/wallet")).rejects.toMatchObject({ digest: expect.stringMatching(/;404$/) });
    const { HelperNeedsChannel } = await import("./HelperLanding");
    expect((await layout("/remote")).type).toBe(HelperNeedsChannel);
  });
}, 30_000);
