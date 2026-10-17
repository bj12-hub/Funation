import Link from "next/link";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { byText, elementsOf, mount } from "@/test/hookHarness";

vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<object>()), ...(await import("@/test/hookHarness")).harnessHooks }));
vi.mock("next/navigation", () => {
  const router = { refresh() {}, push() {} };
  return { useRouter: () => router, usePathname: () => "/support" };
});
vi.mock("@/services/wallet/charge", () => ({
  getChargeOptions: vi.fn(async () => ({
    balance: 5_000,
    termsAgreed: true,
    packages: [{ id: "fn-5000", fnAmount: 5_000, price: 5_500 }],
    savedMethods: ["PHONE"],
    availableMethods: ["PHONE", "KAKAO_PAY"],
    minAmount: 1_000
  })),
  quoteCharge: vi.fn(),
  agreeChargeTerms: vi.fn(),
  // 휴대폰결제 fails in the mock with SYSTEM-TEMP-500 (Figma 739:444: 고객센터 · 다시 시도).
  requestCharge: vi.fn(async () => ({ status: "FAILED", code: "SYSTEM-TEMP-500" }))
}));

type Clickable = ReactElement<{ onClick?: () => void; href?: string }>;

/**
 * FN 충전 결제 취소 (739:444) → 고객센터. The side menu's 충전 modal lives in the layout, so following the link left the
 * modal open over the 고객센터 page; the link closes it, like 완료's LIVE 보러가기.
 */
describe("FN 충전 결제 취소 · 고객센터", () => {
  it("closes the charge modal when 고객센터 is followed", async () => {
    const { ChargeModal } = await import("./ChargeModal");
    const onClose = vi.fn();
    const view = mount(ChargeModal, { onClose });
    view.render();
    await view.settle();
    (byText(view.render(), "5,000 FN", "button") as Clickable).props.onClick!();
    (byText(view.render(), "충전하기", "button") as Clickable).props.onClick!();
    await view.settle();

    // The 결제 취소 step: ChargeFailure has no hooks, so it renders by calling it.
    const failure = elementsOf(view.render()).find((el) => typeof el.type === "function" && el.type.name === "ChargeFailure") as ReactElement<object>;
    expect(failure).toBeDefined();
    const shown = (failure.type as (props: object) => ReactElement)(failure.props);
    const support = elementsOf(shown).find((el) => el.type === Link && (el as Clickable).props.href === "/support") as Clickable;
    expect(support).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
    support.props.onClick?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  }, 30_000);
});
