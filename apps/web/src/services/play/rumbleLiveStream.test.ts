import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";
import { LIVE_STREAM_IDLE_MS, LIVE_STREAM_MS } from "./rumbleLiveTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 로얄 럼블 (조작형) OBS stream (2026-11-01): the server pushes the battle instead of the overlay asking. */
async function load() {
  const live = await import("./rumbleLive");
  const route = await import("@/app/api/play/rumble-live/[key]/stream/route");
  const { mockCreator } = await import("@/services/creator/mockCreatorStore");
  const open = (overlayKey: string) => {
    const abort = new AbortController();
    const res = route.GET(new Request(`http://local/api/play/rumble-live/${overlayKey}/stream`, { signal: abort.signal }), { params: Promise.resolve({ key: overlayKey }) });
    return { res, abort };
  };
  return { ...live, open, overlayKey: mockCreator.integrationKey };
}

const T0 = new Date("2026-11-01T12:00:00Z").getTime();

/** The `data:` events read so far (each parsed), after letting `ms` of timers run. */
async function events(reader: ReadableStreamDefaultReader<Uint8Array>, until: () => Promise<void>) {
  const decoder = new TextDecoder();
  const out: string[] = [];
  const pending = (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      out.push(...decoder.decode(value).split("\n\n").filter(Boolean));
    }
  })();
  await until();
  return { out, pending };
}

describe("로얄 럼블 (조작형) OBS stream", () => {
  beforeEach(() => {
    resetMockStores();
    vi.useFakeTimers({ now: T0, toFake: ["Date", "setInterval", "clearInterval"] });
  });
  afterEach(() => vi.useRealTimers());

  it("refuses another key", async () => {
    const m = await load();
    const res = await m.open("nope-nope-nope-nope").res;
    expect(res.status).toBe(404);
  });

  it("sends the battle at once, then only when it changes or every second while nothing happens", async () => {
    const m = await load();
    const { res, abort } = m.open(m.overlayKey);
    const r = await res;
    expect(r.headers.get("Content-Type")).toContain("text/event-stream");
    const reader = r.body!.getReader();
    const { out } = await events(reader, async () => {
      await vi.advanceTimersByTimeAsync(LIVE_STREAM_MS * 5); // idle: nothing new
    });
    expect(out).toHaveLength(1);
    expect(JSON.parse(out[0].replace(/^data: /, ""))).toMatchObject({ phase: "NONE" });

    // A round opens: the change goes out on the next tick.
    expect(await m.openLive({ requestId: key(1) })).toEqual({ status: "SAVED" });
    await vi.advanceTimersByTimeAsync(LIVE_STREAM_MS);
    await Promise.resolve();
    expect(out.length).toBe(2);
    expect(JSON.parse(out[1].replace(/^data: /, ""))).toMatchObject({ phase: "OPEN" });
    // Still nothing new: one more after a second (a dropped connection shows).
    await vi.advanceTimersByTimeAsync(LIVE_STREAM_IDLE_MS + LIVE_STREAM_MS);
    expect(out.length).toBe(3);
    abort.abort();
  });

  it("sends every tick while the round counts down and fights", async () => {
    const m = await load();
    expect(await m.openLive({ requestId: key(1) })).toEqual({ status: "SAVED" });
    const round = (await m.getLiveView())!.round!;
    const token = round.invitePath.split("/").pop()!;
    for (const [name, n] of [["하나", 1], ["둘", 2]] as const) expect(await m.joinLiveRound({ token, name, requestId: key(100 + n) })).toMatchObject({ status: "JOINED" });
    expect(await m.startLiveBattle({ roundId: round.id, requestId: key(3) })).toEqual({ status: "SAVED" });
    const { res, abort } = m.open(m.overlayKey);
    const reader = (await res).body!.getReader();
    const { out } = await events(reader, async () => {
      await vi.advanceTimersByTimeAsync(LIVE_STREAM_MS * 4);
    });
    // The first one at once, then one per tick — the countdown and the fight change every tick.
    expect(out.length).toBe(5);
    expect(out.map((e) => JSON.parse(e.replace(/^data: /, "")).phase)).toContain("COUNTDOWN");
    abort.abort();
  });
});
