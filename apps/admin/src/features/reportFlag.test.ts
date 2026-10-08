import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AdminReportRow } from "@/types/adminApi";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));
vi.mock("@/lib/actions", () => ({}));

/** 2026-10-08 결정 D4c: 신고 처리 marks a report whose content changed since it was filed. */
const report: AdminReportRow = {
  id: "rp-1",
  target: { type: "POST", id: "p-2" },
  authorId: "u-sample-2",
  authorName: "새벽라디오",
  snapshot: "신고 당시 글",
  reason: "ABUSE",
  detail: "",
  reporterName: "홍길동",
  createdAt: "2026-10-08T00:00:00.000Z",
  status: "OPEN",
  resolution: null,
  authorIsMember: true,
  authorWithdrawn: false,
  reporterWithdrawn: false,
  contentChanged: false
};

async function render(rows: AdminReportRow[]) {
  const { ReportsScreen } = await import("./reports/ReportsScreen");
  return renderToStaticMarkup(createElement(ReportsScreen, { view: { rows, counts: { OPEN: rows.length, DISMISSED: 0, ACTIONED: 0 } }, status: "OPEN" }));
}

describe("신고 후 내용 변경됨", () => {
  it("shows the flag in the list item head and explains it in the detail", async () => {
    const html = await render([{ ...report, contentChanged: true }]);
    expect(html).toMatch(/<span class="[^"]*chipWarn[^"]*">신고 후 내용 변경됨<\/span>/);
    expect(html).toContain("신고 후 내용 변경됨 — 사이트의 지금 내용은 신고 당시와 달라요.");
  });

  it("shows nothing for a report whose content is as reported", async () => {
    expect(await render([report])).not.toContain("신고 후 내용 변경됨");
  });
});
