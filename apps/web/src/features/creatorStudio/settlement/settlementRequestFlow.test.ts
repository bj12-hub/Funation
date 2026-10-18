import type { ReactElement, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SettlementApplyView, SettlementQuote } from "@/services/creator/settlementTypes";
import { byText, elementsOf, mount } from "@/test/hookHarness";

vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<object>()), ...(await import("@/test/hookHarness")).harnessHooks }));
vi.mock("next/navigation", () => {
  const router = { refresh() {}, push() {} };
  return { useRouter: () => router };
});
vi.mock("@/services/creator/settlementRequests", () => ({ quoteSettlement: vi.fn(), requestSettlement: vi.fn(), setAutoSettlement: vi.fn() }));

const view: SettlementApplyView = {
  availableFn: 200_000,
  minFn: 40_000,
  code: "F0L0E0X0",
  registrant: "홍길동",
  holder: "홍길동",
  bankName: "예시은행",
  accountMasked: "********1234",
  autoSettlement: false,
  hasPending: false,
  monthly: [],
  recent: []
};

const quoteOf = (amountFn: number): SettlementQuote => {
  const fee = Math.round(amountFn * 0.066);
  return { amountFn, paymentFeeRate: 0.066, paymentFeeFn: fee, serviceFeeRate: 0, serviceFeeFn: 0, totalFeeFn: fee, netKrw: amountFn - fee };
};

type Clickable = ReactElement<{ onClick?: () => void }>;
type Input = ReactElement<{ id?: string; onChange?: (e: { target: { value: string } }) => void }>;
type ModalEl = ReactElement<{ title?: string; footer?: ReactNode; children?: ReactNode }>;

/**
 * 정산 신청 (469:2) → 정산 신청 확인 (473:2) → 확인 whose answer was lost (the request may have been made). The confirm step
 * says "다시 확인을 누르면 같은 신청으로 확인돼요 (두 번 신청되지 않아요)" — and 취소 → 정산 신청 → 확인 for the same amount must
 * keep that promise: the same Idempotency-Key, so the server answers with the first request instead of making a second
 * one. Before, every quote minted a new key and the way back made a second request (FN held twice).
 */
async function setup() {
  const { SettlementRequestFlow } = await import("./SettlementRequestFlow");
  const { Modal } = await import("@/components/ui/Modal");
  const api = vi.mocked(await import("@/services/creator/settlementRequests"));
  api.quoteSettlement.mockImplementation(async (amount: unknown) => ({ status: "OK", quote: quoteOf(amount as number) }));
  const flow = mount(SettlementRequestFlow, { view });
  const modal = (title: string) => elementsOf(flow.render()).find((el) => el.type === Modal && el.props.title === title) as ModalEl;
  const press = async (title: string, label: string) => {
    (byText(modal(title).props.footer, label, "button") as Clickable).props.onClick!();
    await flow.settle();
  };
  const typeAmount = (value: string) => (elementsOf(modal("정산 신청").props.children).find((el) => (el as Input).props.id === "settle-amount") as Input).props.onChange!({ target: { value } });
  const open = () => (byText(flow.render(), "정산 신청", "button") as Clickable).props.onClick!();
  const keys = () => api.requestSettlement.mock.calls.map(([input]) => (input as { idempotencyKey: string }).idempotencyKey);
  return { api, open, typeAmount, press, keys };
}

describe("정산 신청 확인 · 응답을 받지 못한 뒤", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("asks about the same request after 취소 → 정산 신청 → 확인 for the same amount", async () => {
    const { api, open, typeAmount, press, keys } = await setup();
    open();
    typeAmount("50000");
    await press("정산 신청", "정산 신청");
    api.requestSettlement.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await press("정산 신청 확인", "확인");

    await press("정산 신청 확인", "취소");
    await press("정산 신청", "정산 신청");
    api.requestSettlement.mockResolvedValueOnce({ status: "REQUESTED", requestId: "st-1", quote: quoteOf(50_000) });
    await press("정산 신청 확인", "확인");

    expect(keys()).toHaveLength(2);
    expect(keys()[1]).toBe(keys()[0]);
  }, 30_000);

  it("keeps the key when the window was closed and opened again for the same amount", async () => {
    const { api, open, typeAmount, press, keys } = await setup();
    open();
    typeAmount("50000");
    await press("정산 신청", "정산 신청");
    api.requestSettlement.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await press("정산 신청 확인", "확인");

    // 정산 신청 again from the card (the confirm window was closed): the field starts empty, the amount is typed again.
    open();
    typeAmount("50000");
    await press("정산 신청", "정산 신청");
    api.requestSettlement.mockResolvedValueOnce({ status: "REQUESTED", requestId: "st-1", quote: quoteOf(50_000) });
    await press("정산 신청 확인", "확인");
    expect(keys()[1]).toBe(keys()[0]);
  }, 30_000);

  it("makes another amount, and the request after a settled answer, a request of its own", async () => {
    const { api, open, typeAmount, press, keys } = await setup();
    open();
    typeAmount("50000");
    await press("정산 신청", "정산 신청");
    api.requestSettlement.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await press("정산 신청 확인", "확인");

    // Another amount is another request.
    await press("정산 신청 확인", "취소");
    typeAmount("60000");
    await press("정산 신청", "정산 신청");
    api.requestSettlement.mockResolvedValueOnce({ status: "CONFLICT" });
    await press("정산 신청 확인", "확인");
    expect(keys()[1]).not.toBe(keys()[0]);

    // CONFLICT went back to the amount: the next quote is a new request again, even for the same amount.
    await press("정산 신청", "정산 신청");
    api.requestSettlement.mockResolvedValueOnce({ status: "REQUESTED", requestId: "st-2", quote: quoteOf(60_000) });
    await press("정산 신청 확인", "확인");
    expect(new Set(keys()).size).toBe(3);
  }, 30_000);
});
