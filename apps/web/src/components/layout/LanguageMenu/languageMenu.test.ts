import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { byText, mount } from "@/test/hookHarness";

vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<object>()), ...(await import("@/test/hookHarness")).harnessHooks }));
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/i18n/actions", () => ({ setLocale: vi.fn() }));

type Clickable = ReactElement<{ onClick: () => void }>;

/**
 * Header 언어 선택 (Figma 265:242). A failed change (network / server) keeps the current language — before, it took the
 * whole site, header included, to the error screen.
 */
describe("언어 선택 · 변경 실패", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the page and the current language when the change fails, and changes it on the next try", async () => {
    // The open menu listens for outside clicks and Escape on the document.
    vi.stubGlobal("document", { addEventListener() {}, removeEventListener() {} });
    const { LanguageMenu } = await import("./LanguageMenu");
    const { setLocale } = vi.mocked(await import("@/lib/i18n/actions"));
    const view = mount(LanguageMenu, {});
    (byText(view.render(), "한국어", "button") as Clickable).props.onClick();

    setLocale.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    (byText(view.render(), "ENGLISH", "button") as Clickable).props.onClick();
    await expect(view.settle()).resolves.toBeUndefined();
    expect(setLocale).toHaveBeenCalledWith("en");
    expect(router.refresh).not.toHaveBeenCalled();

    (byText(view.render(), "한국어", "button") as Clickable).props.onClick();
    setLocale.mockResolvedValueOnce({ status: "SAVED" });
    (byText(view.render(), "ENGLISH", "button") as Clickable).props.onClick();
    await view.settle();
    expect(router.refresh).toHaveBeenCalledTimes(1);
  }, 30_000);
});
