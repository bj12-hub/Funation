import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { elementsOf, mount } from "@/test/hookHarness";

vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<object>()), ...(await import("@/test/hookHarness")).harnessHooks }));
vi.mock("next/navigation", () => {
  const router = { refresh() {}, push() {} };
  return { useRouter: () => router, usePathname: () => "/creators/c1" };
});
vi.mock("@/services/favorites/favorites", () => ({ addFavorite: vi.fn(), removeFavorite: vi.fn() }));
vi.mock("@/services/moderation/moderation", () => ({ blockAuthorOf: vi.fn(), submitReport: vi.fn() }));

type Toggle = ReactElement<{ onClick: () => void; "aria-pressed": boolean }>;
type ToastEl = ReactElement<{ message: string | null; tone?: string }>;

/**
 * 크리에이터 방 즐겨찾기 (Figma 826:510). A failed request (network / server) keeps the button as it was and says so in
 * the toast — before, it took the whole room (player, chat, a donation being written) to the error screen.
 */
describe("크리에이터 방 · 즐겨찾기 실패", () => {
  it("keeps the favorite state and shows an error toast when the request fails", async () => {
    const { RoomActions } = await import("./RoomActions");
    const { Toast } = await import("@/components/ui/Toast");
    const favorites = vi.mocked(await import("@/services/favorites/favorites"));
    const view = mount(RoomActions, { creatorId: "c1", name: "하루봄", initialFavorite: true, signedIn: true });
    const toggle = (tree: unknown) => elementsOf(tree as ReactElement).find((el) => (el as Toggle).props["aria-pressed"] !== undefined) as Toggle;
    const toast = (tree: unknown) => elementsOf(tree as ReactElement).find((el) => el.type === Toast) as ToastEl;

    favorites.removeFavorite.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    toggle(view.render()).props.onClick();
    await expect(view.settle()).resolves.toBeUndefined();
    const failed = view.render();
    expect(toggle(failed).props["aria-pressed"]).toBe(true);
    expect(toast(failed).props.message).toBe("즐겨찾기를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.");

    favorites.removeFavorite.mockResolvedValueOnce({ status: "REMOVED" } as never);
    toggle(failed).props.onClick();
    await view.settle();
    const done = view.render();
    expect(toggle(done).props["aria-pressed"]).toBe(false);
    expect(toast(done).props.message).toBe("즐겨찾기를 해제했습니다.");
  }, 30_000);
});
