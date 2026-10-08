import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, rejoinWithPhone, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** The operator the admin API acts for (the route layer authorises the admin app first). */
const OP = { userId: "adm-test", nickname: "테스트 운영자" };

/** 회원 · 크리에이터 관리: search, reasoned suspend / restore with audit, enforcement on public pages. */
async function load() {
  const members = await import("./members");
  const core = await import("./memberCore");
  const creators = await import("@/services/creators/creators");
  const { auditEntries } = await import("./auditCore");
  return { ...members, ...core, ...creators, auditEntries };
}

describe("admin members", () => {
  beforeEach(() => {
    resetMockStores();
    signIn(["ADMIN"]);
  });

  it("lists and filters the directory", async () => {
    const m = await load();
    const all = (await m.listMembers())!;
    expect(all.total).toBe(31);
    expect(all.items).toHaveLength(20);
    expect((await m.listMembers({ page: 2 }))!.items).toHaveLength(11);
    expect((await m.listMembers({ role: "CREATOR" }))!.total).toBe(11);
    expect((await m.listMembers({ q: "하루봄" }))!.items.map((x) => x.creatorId)).toEqual(["c1"]);
    expect((await m.listMembers({ status: "SUSPENDED" }))!.total).toBe(0);
  });

  it("suspends with a reason once per request, hides a suspended creator and restores with audit", async () => {
    const m = await load();
    const id = m.creatorMemberId("c1");
    expect((await m.suspendMember(OP, { id, days: 7, reason: "짧음", requestId: key(1) })).status).toBe("INVALID");
    expect((await m.suspendMember(OP, { id, days: 3, reason: "운영 정책 위반 (테스트)", requestId: key(1) })).status).toBe("INVALID");
    expect(await m.suspendMember(OP, { id, days: 7, reason: "운영 정책 위반 (테스트)", requestId: key(2) })).toEqual({ status: "OK" });
    expect(await m.suspendMember(OP, { id, days: 7, reason: "운영 정책 위반 (테스트)", requestId: key(2) })).toEqual({ status: "OK" });
    expect((await m.suspendMember(OP, { id, days: 7, reason: "운영 정책 위반 (테스트)", requestId: key(3) })).status).toBe("INVALID");

    expect(await m.getCreatorById("c1")).toBeNull();
    expect((await m.getCreators({ page: 1 })).items.some((c) => c.id === "c1")).toBe(false);
    expect((await m.listAdminCreators())!.find((c) => c.creatorId === "c1")!.status).toBe("SUSPENDED");
    const detail = (await m.getMemberDetail(id))!;
    expect(detail.member.suspension).toMatchObject({ reason: "운영 정책 위반 (테스트)" });
    expect(detail.audit.map((e) => e.action)).toEqual(["MEMBER_SUSPEND"]);

    expect(await m.restoreMember(OP, { id, reason: "소명 확인 후 해제" })).toEqual({ status: "OK" });
    expect(await m.restoreMember(OP, { id, reason: "소명 확인 후 해제" })).toEqual({ status: "OK" });
    expect(await m.getCreatorById("c1")).not.toBeNull();
    expect(m.auditEntries().map((e) => e.action)).toEqual(["MEMBER_RESTORE", "MEMBER_SUSPEND"]);
  });

  it("lets a suspension expire and blocks the sample member's sign-in while it lasts", async () => {
    const m = await load();
    await m.suspendMember(OP, { id: m.SAMPLE_MEMBER_ID, days: 1, reason: "테스트 정지 사유", requestId: key(4) });
    expect(m.isMemberSuspended(m.SAMPLE_MEMBER_ID)).toBe(true);
    expect(m.isMemberSuspended(m.SAMPLE_MEMBER_ID, Date.now() + 2 * 86_400_000)).toBe(false);
    const { login } = await import("@/services/auth/login");
    const { mockCredentials } = await import("@/services/account/mockStore");
    expect(await login({ identifier: "hongGD123", password: mockCredentials.password, keepSignedIn: false })).toEqual({ status: "SUSPENDED" });
  });

  it("caps the 회원 · 크리에이터 search text at ADMIN_QUERY_MAX", async () => {
    const m = await load();
    const { ADMIN_QUERY_MAX } = await import("./memberTypes");
    const long = ` ${"가".repeat(ADMIN_QUERY_MAX + 20)} `;
    expect(m.adminSearchQuery(long)).toBe("가".repeat(ADMIN_QUERY_MAX));
    expect(m.adminSearchQuery(["하루봄"])).toBe("");
    expect((await m.listMembers({ q: long }))!.filter.q).toHaveLength(ADMIN_QUERY_MAX);
    expect((await m.listAdminCreators({ q: " 하루봄 " }))!.map((c) => c.creatorId)).toEqual(["c1"]);
    expect(await m.listAdminCreators({ q: long })).toEqual([]);
  });

  it("applies a suspend or restore arriving twice at once (double click, retry) once, with one audit entry", async () => {
    const m = await load();
    const id = m.creatorMemberId("c2");
    const suspend = { id, days: 7, reason: "운영 정책 위반 (테스트)", requestId: key(5) };
    expect(await Promise.all([m.suspendMember(OP, suspend), m.suspendMember(OP, suspend)])).toEqual([{ status: "OK" }, { status: "OK" }]);
    expect(m.auditEntries().map((e) => e.action)).toEqual(["MEMBER_SUSPEND"]);

    // Two operators at once: the first suspension stands, the second is told the member is already suspended.
    const other = m.creatorMemberId("c3");
    const [first, second] = await Promise.all([
      m.suspendMember(OP, { id: other, days: 1, reason: "첫 번째 운영자 정지", requestId: key(6) }),
      m.suspendMember({ userId: "adm-2", nickname: "다른 운영자" }, { id: other, days: null, reason: "두 번째 운영자 정지", requestId: key(7) })
    ]);
    expect([first.status, second]).toEqual(["OK", { status: "INVALID", message: "이미 정지된 회원이에요." }]);
    expect(m.suspensionOf(other)).toMatchObject({ reason: "첫 번째 운영자 정지", by: OP.nickname });

    const restore = { id, reason: "소명 확인 후 해제" };
    expect(await Promise.all([m.restoreMember(OP, restore), m.restoreMember(OP, restore)])).toEqual([{ status: "OK" }, { status: "OK" }]);
    expect(m.auditEntries().map((e) => e.action)).toEqual(["MEMBER_RESTORE", "MEMBER_SUSPEND", "MEMBER_SUSPEND"]);
  });

  it("does not suspend a member who withdrew while the request was being handled", async () => {
    const m = await load();
    const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
    const pending = m.suspendMember(OP, { id: m.SAMPLE_MEMBER_ID, days: null, reason: "운영 정책 위반 (테스트)", requestId: key(8) });
    recordWithdrawal({ at: new Date().toISOString(), requestId: "w-test", forfeitedFn: 0, forfeitedEarningsFn: 0 });
    expect(await pending).toEqual({ status: "INVALID", message: "탈퇴한 회원이에요." });
    expect(m.suspensionOf(m.SAMPLE_MEMBER_ID)).toBeNull();
    expect(m.auditEntries()).toEqual([]);
  });

  it("keeps a withdrawn account's 처리 이력 with `…-w1` after a 재가입 hands the slot id to a new account", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const m = await load();
      vi.setSystemTime(new Date("2026-09-01T00:00:00Z"));
      await m.suspendMember(OP, { id: m.SAMPLE_MEMBER_ID, days: 1, reason: "이전 계정 정지 사유", requestId: key(9) });
      await m.restoreMember(OP, { id: m.SAMPLE_MEMBER_ID, reason: "이전 계정 정지 해제" });
      await rejoinWithPhone("010-0000-0000", new Date("2026-09-02T00:00:00Z"));

      vi.setSystemTime(new Date("2026-09-03T00:00:00Z"));
      expect((await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!.audit).toEqual([]);
      expect((await m.getMemberDetail(m.withdrawnMemberId(1)))!.audit.map((e) => e.reason)).toEqual(["이전 계정 정지 해제", "1일 · 이전 계정 정지 사유"]);

      await m.suspendMember(OP, { id: m.SAMPLE_MEMBER_ID, days: 7, reason: "새 계정 정지 사유", requestId: key(10) });
      expect((await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!.audit.map((e) => e.reason)).toEqual(["7일 · 새 계정 정지 사유"]);
      expect((await m.getMemberDetail(m.withdrawnMemberId(1)))!.audit).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
