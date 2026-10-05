import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 직급 · 직급 배수 (code-first, 2026-10-06): grade list validation, member grades and the scoreboard part. */
async function load() {
  const crew = await import("./crew");
  const bc = await import("./crewBroadcast");
  const feed = await import("./crewFeed");
  return { ...crew, ...bc, ...feed };
}

const T0 = new Date("2026-10-06T12:00:00Z").getTime();

describe("직급 · 직급 배수", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(T0);
  });
  afterEach(() => vi.useRealTimers());

  it("validates the grade list and clears a member's grade when it is removed", async () => {
    const m = await load();
    for (const bad of [
      [{ name: "", multiplier: 1 }],
      [{ name: "부장", multiplier: 0 }],
      [{ name: "부장", multiplier: 11 }],
      [{ name: "부장", multiplier: 1.234 }],
      [{ name: "부장", multiplier: 1 }, { name: "부장", multiplier: 2 }],
      [{ name: "admin", multiplier: 1 }],
      Array.from({ length: 11 }, (_, i) => ({ name: `직급${i}`, multiplier: 1 })),
      "부장"
    ]) {
      expect((await m.saveCrewGrades({ grades: bad })).status).toBe("INVALID");
    }
    expect(await m.saveCrewGrades({ grades: [{ name: " 부장 ", multiplier: 1.5 }, { name: "사원", multiplier: 1 }] })).toEqual({ status: "SAVED" });
    const view = (await m.getCrewStudio())!;
    expect(view.grades.map((g) => [g.name, g.multiplier])).toEqual([["부장", 1.5], ["사원", 1]]);

    const boss = view.grades[0];
    expect(await m.updateCrewMember("cm-s1", { gradeId: boss.id })).toEqual({ status: "SAVED" });
    expect((await m.updateCrewMember("cm-s1", { gradeId: "gr-nope" })).status).toBe("INVALID");
    expect((await m.getCrewStudio())!.members.find((x) => x.id === "cm-s1")!.gradeId).toBe(boss.id);
    // Saving the list without 부장 (kept ids for the rest) puts the member back to none.
    await m.saveCrewGrades({ grades: [{ id: view.grades[1].id, name: "사원", multiplier: 1 }] });
    expect((await m.getCrewStudio())!.members.find((x) => x.id === "cm-s1")!.gradeId).toBeNull();
  });

  it("multiplies what a graded member receives in the broadcast, as its own scoreboard part", async () => {
    const m = await load();
    await m.saveCrewGrades({ grades: [{ name: "부장", multiplier: 2 }, { name: "사원", multiplier: 1 }] });
    const [boss, staff] = (await m.getCrewStudio())!.grades;
    await m.updateCrewMember("cm-s1", { gradeId: boss.id });
    await m.updateCrewMember("cm-s2", { gradeId: staff.id });
    await m.setMemberKeywords({ memberId: "cm-s1", keywords: ["길동"] });
    await m.setMemberKeywords({ memberId: "cm-s2", keywords: ["하늘"] });
    expect(await m.startBroadcast({ title: "직급전", teamMode: false, teams: {} })).toEqual({ status: "SAVED" });
    const id = (await m.getBroadcastView())!.live!.id;
    await m.simulateDonation({ broadcastId: id, requestId: key(1), amount: 3_000, unit: "FN", message: "길동" });
    await m.simulateDonation({ broadcastId: id, requestId: key(2), amount: 5_000, unit: "FN", message: "하늘" });
    const rows = (await m.getBroadcastView())!.live!.rows;
    expect(rows.find((r) => r.memberId === "cm-s1")).toMatchObject({ feed: 3_000, grade: 3_000, score: 6_000 });
    // 사원 (1배) adds nothing; the seed's donation for 하늘 earlier today counts as usual.
    const staffRow = rows.find((r) => r.memberId === "cm-s2")!;
    expect(staffRow).toMatchObject({ feed: 5_000, grade: 0 });
    expect(staffRow.score).toBe(staffRow.donated + 5_000);
    // Changing the 배수 applies at once.
    await m.saveCrewGrades({ grades: [{ id: boss.id, name: "부장", multiplier: 1.5 }, { id: staff.id, name: "사원", multiplier: 1 }] });
    expect((await m.getBroadcastView())!.live!.rows.find((r) => r.memberId === "cm-s1")).toMatchObject({ grade: 1_500, score: 4_500 });
  });

  it("is for creators only", async () => {
    const m = await load();
    signIn(["SUPPORTER"]);
    expect(await m.saveCrewGrades({ grades: [] })).toEqual({ status: "UNAUTHORIZED" });
  });
});
