import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ImportOverview, ImportedDonationPage } from "@/services/creator/donationImportTypes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {}, push() {} }) }));
vi.mock("@/services/creator/donationImport", () => ({
  previewToonationCsv: vi.fn(),
  remapToonationCsv: vi.fn(),
  importToonationCsv: vi.fn(),
  undoDonationImport: vi.fn(),
  syncFlexTvDonations: vi.fn(),
  exportImportedDonationsCsv: vi.fn()
}));
vi.mock("@/services/broadcast/unifiedChat", () => ({ connectBroadcastChannel: vi.fn() }));

/** 후원관리+ › 내역 이관 (code-first): states and copy as rendered, file content shown as text only. */

const overview = (flextv: Partial<ImportOverview["flextv"]> = {}, batches: ImportOverview["batches"] = []): ImportOverview => ({
  batches,
  totals: [
    { source: "TOONATION", count: 0, totals: [] },
    { source: "FLEXTV", count: 0, totals: [] }
  ],
  flextv: { supported: true, unverified: true, linked: null, lastSyncAt: null, lastResult: null, lastError: null, ...flextv }
});

const page = (items: ImportedDonationPage["items"], hasAny = items.length > 0): ImportedDonationPage => ({
  source: "all",
  from: null,
  to: null,
  query: "",
  page: 1,
  totalPages: 1,
  total: items.length,
  items,
  totals: items.length ? [{ unit: "KRW", value: items.reduce((s, i) => s + i.amount, 0) }] : [],
  hasAny
});

async function render(props: Parameters<typeof import("./ImportTab").ImportTab>[0]) {
  const { ImportTab } = await import("./ImportTab");
  return renderToStaticMarkup(createElement(ImportTab, props));
}

describe("내역 이관 화면", () => {
  it("shows the privacy notice, the upload card, the FlexTV link state and an empty 가져온 기록", async () => {
    const html = await render({ sub: "upload", overview: overview(), records: null });
    expect(html).toContain("가져온 내역에는 후원자 닉네임 · 메시지가 들어 있어요. 스튜디오에서 나만 볼 수 있고, 채널 페이지 · 명예의 전당 · 방송 화면에는 보이지 않아요.");
    expect(html).toContain("가져온 내역은 FN · 등급 · 칭호 · 후원자 랭킹 · 수익 · 정산에 들어가지 않아요.");
    expect(html).toContain("투네이션 CSV 가져오기");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>미리보기<\/button>/);
    expect(html).toContain("FlexTV 계정이 연동되어 있지 않아요.");
    expect(html).toContain("FlexTV 계정 연동");
    expect(html).toContain("API 확인 중");
    expect(html).toContain("아직 가져온 기록이 없어요.");
  });

  it("shows the linked account, the last sync and a failure to retry; or that FlexTV is not supported", async () => {
    const linked = await render({
      sub: "upload",
      overview: overview({ linked: { handle: "flexman", title: "flexman 채널" }, lastSyncAt: "2026-10-16T03:04:00.000Z", lastResult: { imported: 20, duplicates: 0, skipped: 1, hasMore: true }, lastError: "TIMEOUT" }),
      records: null
    });
    expect(linked).toContain("@flexman");
    expect(linked).toContain("마지막으로 가져온 시각: 2026. 10. 16. 오후 12:04");
    expect(linked).toContain("20건 새로 가져옴 · 0건 이미 있음 · 읽을 수 없는 1건 건너뜀");
    expect(linked).toContain("남은 내역이 있어요");
    expect(linked).toContain("지난번에 다 가져오지 못했어요: FlexTV 응답이 늦어요. 잠시 후 다시 시도해 주세요.");
    expect(linked).toContain("FlexTV 내역 가져오기");

    const unsupported = await render({ sub: "upload", overview: overview({ supported: false }), records: null });
    expect(unsupported).toContain("FlexTV 내역 가져오기는 아직 지원하지 않아요.");
    expect(unsupported).toMatch(/<button[^>]*disabled=""[^>]*>FlexTV 내역 가져오기<\/button>/);
  });

  it("lists batches with 되돌리기, and undone ones as 되돌림", async () => {
    const html = await render({
      sub: "upload",
      overview: overview({}, [
        { id: "b2", source: "FLEXTV", createdAt: "2026-10-16T03:00:00.000Z", fileName: null, channelHandle: "flexman", rows: 46, imported: 45, invalid: 1, duplicates: 0, totals: [{ unit: "KRW", value: 120_000 }], status: "ACTIVE", undoneAt: null },
        { id: "b1", source: "TOONATION", createdAt: "2026-10-15T03:00:00.000Z", fileName: "내역.csv", channelHandle: null, rows: 5, imported: 3, invalid: 1, duplicates: 1, totals: [{ unit: "KRW", value: 16_000 }], status: "UNDONE", undoneAt: "2026-10-15T04:00:00.000Z" }
      ]),
      records: null
    });
    expect(html).toContain("@flexman");
    expect(html).toContain("120,000원");
    expect(html).toContain("되돌리기");
    expect(html).toContain("되돌림 · 2026.10.15 13:00");
    expect(html).toContain("오류 1 · 중복 1");
  });

  it("shows imported records as text — markup and formulas from the file are never run", async () => {
    const html = await render({
      sub: "records",
      overview: null,
      records: page([{ id: "r1", source: "TOONATION", at: "2026-09-01T01:00:00.000Z", donorName: "<b>별빛</b>", message: '<img src=x onerror="alert(1)">', kind: "=1+1", amount: 1_000, unit: "KRW" }])
    });
    expect(html).toContain("&lt;b&gt;별빛&lt;/b&gt;");
    expect(html).toContain("&lt;img src=x");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("1,000원");
    expect(html).toContain("2026.09.01 10:00");
    expect(html).toContain("전체 기간 · 1건 · 합계 1,000원");
  });

  it("tells 'nothing imported yet' from 'no match'", async () => {
    expect(await render({ sub: "records", overview: null, records: page([], false) })).toContain("아직 가져온 내역이 없어요.");
    expect(await render({ sub: "records", overview: null, records: page([], true) })).toContain("조건에 맞는 내역이 없어요.");
  });

  it("keeps the client components off the server-only modules (node:crypto store, CSV reader)", () => {
    for (const file of ["ToonationImportCard.tsx", "FlexTvImportCard.tsx", "UndoImportButton.tsx", "ImportedCsvButton.tsx"]) {
      const src = readFileSync(join(__dirname, file), "utf8");
      expect(src.startsWith('"use client"'), file).toBe(true);
      expect(src, file).not.toMatch(/donationImportCore|donationImportCsv|node:/);
    }
  });
});
