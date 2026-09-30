import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

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
    expect((await m.listMembers({ q: "침착" }))!.items.map((x) => x.creatorId)).toEqual(["c1"]);
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

});
