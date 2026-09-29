import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** Crew (code-first): member management, member-attributed donations and the member ranking. */
async function load() {
  const { mockAccount } = await import("@/services/account/mockStore");
  const crew = await import("./crew");
  const core = await import("./crewCore");
  const store = await import("./mockCrewStore");
  const { requestDonation } = await import("@/services/donations/donate");
  mockAccount.fnBalance = 100_000;
  return { ...crew, ...core, store: store.mockCrew, requestDonation, account: mockAccount };
}

const text = (creatorId: string, amount: number, n: number, memberId?: string | null) => ({
  creatorId,
  hideProfile: false,
  type: "TEXT",
  amount,
  message: "멤버 응원",
  voiceId: null,
  memberId,
  idempotencyKey: key(n)
});

describe("크루", () => {
  beforeEach(() => resetMockStores());

  it("attributes a donation to an active member of that creator's crew", async () => {
    const { requestDonation, memberRanking, account } = await load();
    expect((await requestDonation(text("c4", 3_000, 1, "cm-c4-2"))).status).toBe("COMPLETED");
    expect(account.fnBalance).toBe(97_000);
    const top = memberRanking("c4")[0];
    expect(top).toMatchObject({ memberId: "cm-c4-2", totalFn: 3_000, count: 1, sharePercent: 100 });
  });

  it("rejects a member of another crew, an inactive member or an unknown id — without debiting", async () => {
    const { requestDonation, updateCrewMember, account } = await load();
    expect((await requestDonation(text("c4", 1_000, 2, "cm-s2"))).status).toBe("INVALID");
    expect((await requestDonation(text("c1", 1_000, 3, "cm-c4-1"))).status).toBe("INVALID");
    await updateCrewMember("cm-s1", { active: false });
    expect((await requestDonation(text("studio", 1_000, 4, "cm-s1"))).status).not.toBe("COMPLETED");
    expect(account.fnBalance).toBe(100_000);
  });

  it("donating without a member still works and is not attributed", async () => {
    const { requestDonation, store } = await load();
    const before = store.attributions.length;
    expect((await requestDonation(text("c4", 1_000, 5, null))).status).toBe("COMPLETED");
    expect(store.attributions).toHaveLength(before);
  });

  it("manages members with validation", async () => {
    const { addCrewMember, updateCrewMember, removeCrewMember, getCrewStudio } = await load();
    expect(await addCrewMember({ name: "새멤버", role: "MEMBER" })).toEqual({ status: "SAVED" });
    expect((await addCrewMember({ name: "새멤버", role: "MEMBER" })).status).toBe("INVALID");
    expect((await addCrewMember({ name: "", role: "MEMBER" })).status).toBe("INVALID");
    expect((await addCrewMember({ name: "역할없음", role: "BOSS" })).status).toBe("INVALID");
    const added = (await getCrewStudio())!.members.find((m) => m.name === "새멤버")!;
    expect((await updateCrewMember(added.id, { active: "no" })).status).toBe("INVALID");
    expect(await updateCrewMember(added.id, { name: "바뀐멤버", role: "LEADER" })).toEqual({ status: "SAVED" });
    expect(await removeCrewMember(added.id)).toEqual({ status: "SAVED" });
    expect(await removeCrewMember(added.id)).toEqual({ status: "SAVED" }); // idempotent
    expect((await getCrewStudio())!.members.some((m) => m.id === added.id)).toBe(false);
  });

  it("requires the Creator role for studio actions; the public crew hides inactive members", async () => {
    const { addCrewMember, getCrewStudio, getCrewPublic, updateCrewMember } = await load();
    await updateCrewMember("cm-s2", { active: false });
    const pub = await getCrewPublic("studio");
    expect(pub.members.some((m) => m.id === "cm-s2")).toBe(false);
    signIn(["SUPPORTER"]);
    expect(await getCrewStudio()).toBeNull();
    expect((await addCrewMember({ name: "침입", role: "MEMBER" })).status).toBe("UNAUTHORIZED");
  });
});
