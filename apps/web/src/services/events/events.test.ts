import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, rejoinWithPhone, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 이벤트 (code-first): phases from dates, idempotent join only while running, no FN credited. */
describe("이벤트", () => {
  beforeEach(() => resetMockStores());

  it("lists by phase and joins a running event once", async () => {
    const { getEvents, joinEvent, getEvent } = await import("./events");
    const { mockAccount } = await import("@/services/account/mockStore");
    const before = mockAccount.fnBalance;
    const all = await getEvents("all");
    expect(all.items.map((e) => e.phase)).toEqual(["ongoing", "upcoming", "ended"]);
    const ongoing = all.items.find((e) => e.phase === "ongoing")!;
    expect(await joinEvent(ongoing.id)).toEqual({ status: "JOINED" });
    expect(await joinEvent(ongoing.id)).toEqual({ status: "JOINED" });
    const detail = (await getEvent(ongoing.id))!;
    expect(detail).toMatchObject({ joined: true, participants: ongoing.participants + 1 });
    // The ended sample event has the sample member's join (so its reward can be tried in the mock).
    expect((await getEvents("mine")).items.map((e) => e.id)).toEqual([ongoing.id, "ev-attendance"]);
    expect(mockAccount.fnBalance).toBe(before);
  });

  it("counts one join per person: a 재가입 with the same phone has joined, another person can join (2026-10-08 결정)", async () => {
    const { getEvents, joinEvent, getEvent } = await import("./events");
    const ongoing = (await getEvents("all")).items.find((e) => e.phase === "ongoing")!;
    expect(await joinEvent(ongoing.id)).toEqual({ status: "JOINED" });

    await rejoinWithPhone("010-1234-5678"); // the same person (the sample account's verified phone)
    expect(await getEvent(ongoing.id)).toMatchObject({ joined: true, participants: ongoing.participants + 1 });
    expect((await getEvents("mine")).items.map((e) => e.id)).toEqual([ongoing.id, "ev-attendance"]);
    expect(await joinEvent(ongoing.id)).toEqual({ status: "JOINED" }); // already in: nothing is added
    expect((await getEvent(ongoing.id))!.participants).toBe(ongoing.participants + 1);

    await rejoinWithPhone("010-0000-0000"); // someone else
    expect(await getEvent(ongoing.id)).toMatchObject({ joined: false, participants: ongoing.participants + 1 });
    expect((await getEvents("mine")).items).toEqual([]);
    expect(await joinEvent(ongoing.id)).toEqual({ status: "JOINED" });
    expect(await getEvent(ongoing.id)).toMatchObject({ joined: true, participants: ongoing.participants + 2 });
    // Who joined never leaves the server.
    const body = JSON.stringify([await getEvents("all"), await getEvent(ongoing.id)]);
    expect(body).not.toMatch(/010-|u-test/);
  });

  it("labels the period with Korean days whatever zone renders it (the detail screen also renders in the browser)", async () => {
    const { eventPeriodLabel } = await import("./eventTypes");
    const zone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles"; // a viewer outside Korea
    try {
      // 00:00 KST on 10-03 is still 10-02 in UTC and in Los Angeles.
      expect(eventPeriodLabel("2026-10-02T15:00:00.000Z", "2026-10-22T14:59:59.999Z")).toBe("2026. 10. 3. ~ 2026. 10. 22.");
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it("runs an event over whole Korean days on a server outside Korea, as its label says", async () => {
    const zone = process.env.TZ;
    process.env.TZ = "UTC"; // e.g. a container: local midnight is 09:00 KST
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T16:00:00Z")); // 10-09 01:00 KST, still 10-08 in UTC
    try {
      const { getEvent } = await import("./events");
      const { eventPeriodLabel } = await import("./eventTypes");
      // ev-first-donation started 5 days ago and runs 20 days: 10-04 00:00 KST to the end of 10-23 KST.
      const e = (await getEvent("ev-first-donation"))!;
      expect([e.startsAt, e.endsAt]).toEqual(["2026-10-03T15:00:00.000Z", "2026-10-23T14:59:59.999Z"]);
      expect(eventPeriodLabel(e.startsAt, e.endsAt)).toBe("2026. 10. 4. ~ 2026. 10. 23.");
      expect(e.phase).toBe("ongoing");
    } finally {
      vi.useRealTimers();
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it("rejects joining upcoming / ended / unknown events and signed-out calls", async () => {
    const { getEvents, joinEvent } = await import("./events");
    const all = await getEvents("all");
    for (const e of all.items.filter((x) => x.phase !== "ongoing")) expect(await joinEvent(e.id)).toEqual({ status: "NOT_OPEN" });
    expect(await joinEvent("nope")).toEqual({ status: "NOT_FOUND" });
    signIn(null);
    expect(await joinEvent(all.items[0].id)).toEqual({ status: "UNAUTHORIZED" });
    expect((await getEvents("mine")).items).toHaveLength(0);
  });
});
