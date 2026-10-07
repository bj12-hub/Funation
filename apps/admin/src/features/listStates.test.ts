import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AuditEntry, DonationsView } from "@/types/adminApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/actions", () => ({}));

/** Console lists: every list shows its EMPTY state, and the audit log never offers a 더 보기 it cannot load. */
const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

const noDonations: DonationsView = {
  rows: [],
  byStatus: { COMPLETED: { count: 0, fn: 0 }, PROCESSING: { count: 0, fn: 0 }, FAILED: { count: 0, fn: 0 }, REFUNDING: { count: 0, fn: 0 }, REFUNDED: { count: 0, fn: 0 } },
  byType: []
};

describe("console list states", () => {
  it("shows empty 충전 내역 and 후원 운영 lists as empty, not as bare table headers", async () => {
    const { DonationsAdminScreen, PaymentsScreen } = await import("./payments/PaymentScreens");
    const charges = render(createElement(PaymentsScreen, { view: { charges: [], refunds: [], balance: 0 }, tab: "charges" }));
    expect(charges).toContain("충전 내역이 없어요.");
    expect(charges).not.toContain("<table");

    const donations = render(createElement(DonationsAdminScreen, { view: noDonations, status: null }));
    expect(donations).toContain("완료된 후원이 없어요.");
    expect(donations).toContain("후원 내역이 없어요.");
    expect(donations).not.toContain("<table");
    expect(render(createElement(DonationsAdminScreen, { view: noDonations, status: "REFUNDING" }))).toContain("해당하는 후원이 없어요.");
  });

  it("shows empty 공지사항 and 자주 묻는 질문 lists as empty", async () => {
    const { ContentManager } = await import("./content/ContentManager");
    const notices = render(createElement(ContentManager, { tab: "notices", notices: [], faqs: [] }));
    expect(notices).toContain("등록된 공지사항이 없어요.");
    expect(notices).not.toContain("<table");
    const faqs = render(createElement(ContentManager, { tab: "faq", notices: [], faqs: [] }));
    expect(faqs).toContain("등록된 자주 묻는 질문이 없어요.");
    expect(faqs).not.toContain("<table");
  });

  it("stops offering 더 보기 at the newest 500 entries the site lists", async () => {
    const { AuditLogScreen } = await import("./AdminScreens");
    const entry: AuditEntry = { id: "au-1", at: "2026-10-08T00:00:00.000Z", actorId: "adm-1", actorName: "운영자", action: "MEMBER_SUSPEND", target: "member:u-s001", reason: "7일 · 사유" };
    const more = render(createElement(AuditLogScreen, { page: { items: [entry], total: 600, hasMore: true }, show: 480 }));
    expect(more).toContain('href="/audit?show=500"');
    const capped = render(createElement(AuditLogScreen, { page: { items: [entry], total: 600, hasMore: true }, show: 500 }));
    expect(capped).not.toContain("/audit?show=");
    expect(capped).toContain("최근 500건까지 볼 수 있어요 (전체 600건)");
  });
});
