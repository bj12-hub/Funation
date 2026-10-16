import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, resetMockStores } from "@/test/mockEnv";

/**
 * 내역 이관 access with the real session (lib/session.ts): only an active creator. A suspended or withdrawn creator has
 * no session, so every action refuses and every read is empty. The 도우미 host does not serve the tab.
 */

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name)
  })
}));
vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));

const CSV = "후원일시,닉네임,금액\r\n2026-09-01 10:00,별빛,1000\r\n";
const form = () => {
  const fd = new FormData();
  fd.append("file", new File([CSV], "toonation.csv", { type: "text/csv" }));
  return fd;
};

async function signedInCreator() {
  const session = await import("@/lib/session");
  await session.startSession({ keepSignedIn: false });
  const m = await import("./donationImport");
  const r = await m.previewToonationCsv(form());
  if (r.status !== "OK") throw new Error(r.status);
  const imported = await m.importToonationCsv({ previewId: r.preview.previewId, mapping: r.preview.mapping, requestId: key(1) });
  if (imported.status !== "IMPORTED") throw new Error(imported.status);
  return { m, preview: r.preview, batchId: imported.batch.id };
}

async function expectRefused(m: typeof import("./donationImport"), previewId: string, mapping: unknown, batchId: string) {
  expect(await m.getDonationImportOverview()).toBeNull();
  expect(await m.getImportedDonations({})).toBeNull();
  expect(await m.previewToonationCsv(form())).toEqual({ status: "UNAUTHORIZED" });
  expect(await m.remapToonationCsv({ previewId, mapping })).toEqual({ status: "UNAUTHORIZED" });
  expect(await m.importToonationCsv({ previewId, mapping, requestId: key(2) })).toEqual({ status: "UNAUTHORIZED" });
  expect(await m.undoDonationImport({ batchId })).toEqual({ status: "UNAUTHORIZED" });
  expect(await m.syncFlexTvDonations()).toEqual({ status: "UNAUTHORIZED" });
  expect(await m.exportImportedDonationsCsv({})).toEqual({ status: "UNAUTHORIZED" });
}

describe("내역 이관 · 실제 세션", () => {
  beforeEach(() => {
    resetMockStores();
    cookieJar.clear();
  });

  it("serves an active creator only — not a member without the Creator role", async () => {
    const { m, preview, batchId } = await signedInCreator();
    expect((await m.getImportedDonations({}))!.total).toBe(1);
    const { mockSessionState } = await import("@/services/account/mockStore");
    mockSessionState.roles = ["SUPPORTER"];
    await expectRefused(m, preview.previewId, preview.mapping, batchId);
  });

  it("refuses a suspended creator (the records stay for after the suspension)", async () => {
    const { m, preview, batchId } = await signedInCreator();
    const { memberStore, SAMPLE_MEMBER_ID } = await import("@/services/admin/memberCore");
    memberStore().suspensions[SAMPLE_MEMBER_ID] = { reason: "테스트 정지", at: new Date().toISOString(), until: null, by: "adm-1" };
    await expectRefused(m, preview.previewId, preview.mapping, batchId);
    delete memberStore().suspensions[SAMPLE_MEMBER_ID];
    expect((await m.getImportedDonations({}))!.total).toBe(1);
  });

  it("refuses a withdrawn creator", async () => {
    const { m, preview, batchId } = await signedInCreator();
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0 });
    await expectRefused(m, preview.previewId, preview.mapping, batchId);
  });
});

describe("내역 이관 · 도우미 호스트", () => {
  it("is not served on the 도우미 (studio data, not an OBS tool): the studio address goes to the 도우미 home", async () => {
    const { helperPathForStudio, routeHelperRequest } = await import("@/lib/helperRouting");
    expect(helperPathForStudio("/creator/donations", "?tab=import")).toBe("/");
    expect(helperPathForStudio("/creator/donations", "?tab=import&sub=records&source=flextv")).toBe("/");
    expect(routeHelperRequest("/creator/donations", "?tab=import")).toEqual({ action: "redirect", path: "/" });
    // The 도우미 has no helper page of its own for it either: /import is the helper's 404 (no app/helper/import route).
    expect(routeHelperRequest("/import", "")).toEqual({ action: "rewrite", path: "/helper/import" });
    const { HELPER_NAV } = await import("@/features/helper/helperNav");
    expect(HELPER_NAV.flatMap((g) => g.items.map((i) => i.href))).not.toContain("/import");
  });
});
