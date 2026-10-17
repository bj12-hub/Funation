import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PlatformCreatorDetail } from "@/services/platformDonation/platformTypes";
import { byText, elementsOf, mount, textOf } from "@/test/hookHarness";

vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<object>()), ...(await import("@/test/hookHarness")).harnessHooks }));
vi.mock("next/navigation", () => {
  const router = { refresh() {}, push() {} };
  return { useRouter: () => router };
});
vi.mock("@/services/platformDonation/platformDonation", () => ({ quotePlatformDonation: vi.fn(), requestPlatformDonation: vi.fn() }));

const detail: PlatformCreatorDetail = {
  platform: "SOOP",
  balance: 36_898,
  creator: { id: "kim_stream", nickname: "김스트리머", handle: "@kim_stream", live: true, statusText: "방송 중", viewers: 3_842, avatarColor: "#888" },
  products: [{ id: "sb-10", label: "별풍선 10개", priceFn: 10_000, icon: "⭐" }]
};

type Clickable = ReactElement<{ onClick?: () => void; "aria-pressed"?: boolean }>;

/**
 * 플랫폼 후원 상품 단계 (Figma 817:9242) → 메시지 단계. The 금액 확인 request can fail (network / server): the step stays
 * on the product with an error line and 후원하기 can be pressed again — before, the failure took the whole page to the
 * error screen and the choice was lost.
 */
describe("플랫폼 후원 · 금액 확인 실패", () => {
  it("keeps the product step with an error when the quote request fails, and goes on when it is pressed again", async () => {
    const { PlatformDonationFlow } = await import("./PlatformDonationFlow");
    const actions = vi.mocked(await import("@/services/platformDonation/platformDonation"));
    const view = mount(PlatformDonationFlow, { detail });
    (elementsOf(view.render()).find((el) => (el as Clickable).props["aria-pressed"] === false) as Clickable).props.onClick!();

    actions.quotePlatformDonation.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    (byText(view.render(), "10,000 FN 후원하기", "button") as Clickable).props.onClick!();
    await expect(view.settle()).resolves.toBeUndefined();
    const failed = view.render();
    expect(textOf(failed)).toContain("후원상품");
    expect(textOf(failed)).toContain("일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요");

    actions.quotePlatformDonation.mockResolvedValueOnce({ status: "OK", priceFn: 10_000, balance: 36_898, afterFn: 26_898, sufficient: true, productLabel: "별풍선 10개" });
    (byText(failed, "10,000 FN 후원하기", "button") as Clickable).props.onClick!();
    await view.settle();
    const next = textOf(view.render());
    expect(next).toContain("후원 메시지");
    expect(next).not.toContain("일시적인 오류가 발생했습니다");
  }, 30_000);
});
