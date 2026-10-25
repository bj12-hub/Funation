import { describe, expect, it } from "vitest";
import { FlextvUnavailableError } from "./client";
import { NO_SETTINGS, mapSsumnation, readDonationSettings, readGames } from "./ssumnation";

/** The Ssumnation endpoints' answers as docs/development/flextv-ssumnation-api.md defines them. */

describe("a channel's settings", () => {
  const settings = {
    mini: { enabled: true, minAmount: 100, maxAmount: 999, maxLength: 30, colors: [{ id: "pink", label: "핑크", hex: "#FF5CA8" }, { id: "bad", label: "x", hex: "red" }] },
    wishlist: [{ id: "w1", emoji: "🎧", name: "헤드셋", price: 30000, note: "", inStock: true }, { id: "w2", name: "가격 없음" }],
    drawing: { enabled: true, minAmount: 1000, maxTitle: 40 },
    roulette: { enabled: true, minAmount: 500, dailyLimit: 3, items: [{ name: "노래", percent: 30 }, { name: "꽝", percent: 70 }] },
    gacha: [{ id: "g1", name: "행운 뽑기", price: 3000, mode: "PROBABILITY", prizes: [{ name: "꽝", blank: true, percent: 50, left: null }, { name: "사인", blank: false, percent: 50, left: null }], limit: 2, soldOut: false }]
  };

  it("reads what the streamer turned on", () => {
    const read = readDonationSettings(settings);
    expect(read.mini).toEqual({ minAmount: 100, maxAmount: 999, maxLength: 30, colors: [{ id: "pink", label: "핑크", hex: "#FF5CA8" }] });
    expect(read.wishlist.map((w) => w.id)).toEqual(["w1"]);
    expect(read.drawing).toEqual({ minAmount: 1000, maxTitle: 40 });
    expect(read.roulette).toEqual({ minAmount: 500, dailyLimit: 3, items: settings.roulette.items });
    expect(read.gacha).toEqual([{ ...settings.gacha[0], limit: 2 }]);
  });

  it("leaves anything off or malformed out", () => {
    expect(readDonationSettings({ ...settings, mini: { ...settings.mini, enabled: false } }).mini).toBeNull();
    expect(readDonationSettings({ ...settings, mini: { ...settings.mini, maxAmount: 50 } }).mini).toBeNull();
    // A wheel that does not add up to 100% is not shown.
    expect(readDonationSettings({ ...settings, roulette: { ...settings.roulette, items: [{ name: "노래", percent: 30 }, { name: "꽝", percent: 30 }] } }).roulette).toBeNull();
    expect(readDonationSettings({ ...settings, gacha: [{ ...settings.gacha[0], prizes: [] }] }).gacha).toEqual([]);
    expect(readDonationSettings("Not Found")).toEqual(NO_SETTINGS);
  });
});

describe("a donation's answer", () => {
  it("maps the contract's statuses", () => {
    expect(mapSsumnation({ status: 200, data: { status: "COMPLETED", donationId: 88, amount: 500, balance: 4500 } })).toEqual({ kind: "COMPLETED", donationId: "88", amount: 500, balance: 4500 });
    expect(mapSsumnation({ status: 202, data: { status: "PROCESSING" } })).toEqual({ kind: "PROCESSING" });
    expect(mapSsumnation({ status: 404, data: { status: "NOT_FOUND" } })).toEqual({ kind: "NOT_FOUND" });
    expect(mapSsumnation({ status: 400, data: { status: "INSUFFICIENT", balance: 10 } })).toEqual({ kind: "INSUFFICIENT", balance: 10 });
    expect(mapSsumnation({ status: 400, data: { status: "PRICE_CHANGED", amount: 35000 } })).toEqual({ kind: "PRICE_CHANGED", amount: 35000 });
    expect(mapSsumnation({ status: 400, data: { status: "LIMIT_REACHED", message: "오늘 참여할 수 있는 횟수를 다 썼어요." } })).toEqual({ kind: "REFUSED", message: "오늘 참여할 수 있는 횟수를 다 썼어요." });
    expect(mapSsumnation({ status: 400, data: { status: "INVALID", message: "Error: ER_DUP_ENTRY" } })).toEqual({ kind: "REFUSED", message: null });
    expect(mapSsumnation({ status: 409, data: { status: "CONFLICT" } })).toEqual({ kind: "CONFLICT" });
    expect(mapSsumnation({ status: 401, data: "Unauthorized" })).toEqual({ kind: "UNAUTHORIZED" });
  });

  it("treats anything else as unknown: ask again by the key", () => {
    expect(() => mapSsumnation({ status: 500, data: "InternalError" })).toThrow(FlextvUnavailableError);
    expect(() => mapSsumnation({ status: 200, data: { status: "COMPLETED" } })).toThrow(FlextvUnavailableError);
    expect(() => mapSsumnation({ status: 200, data: { status: "SOMETHING" } })).toThrow(FlextvUnavailableError);
  });
});

describe("the room's games", () => {
  const games = {
    roulette: {
      waiting: 2,
      participantsToday: 5,
      usedToday: 1,
      mine: [
        { id: "s1", no: "#RLT-00001", amount: 500, createdAt: "2026-10-25T01:00:00Z", status: "QUEUED", position: 2, result: "노래" },
        { id: "s2", no: "#RLT-00002", amount: 500, createdAt: "2026-10-25T00:00:00Z", status: "RESULT", position: null, result: "꽝" }
      ]
    },
    gacha: { waiting: 0, usedToday: { g1: 1 }, mine: [{ id: "d1", no: "#GCH-00001", gachaId: "g1", gachaName: "행운 뽑기", amount: 3000, createdAt: "2026-10-25T00:00:00Z", status: "SPINNING", prize: "사인", blank: false }] }
  };

  it("shows a result only once it is revealed", () => {
    const { roulette, gacha } = readGames(games, true);
    expect(roulette).toMatchObject({ waiting: 2, participantsToday: 5, usedToday: 1 });
    expect(roulette.mine.map((s) => s.result)).toEqual([null, "꽝"]);
    expect(gacha.usedToday).toEqual({ g1: 1 });
    expect(gacha.mine[0]).toMatchObject({ status: "SPINNING", prize: null, blank: null });
  });

  it("has nothing of the viewer's own when signed out", () => {
    const { roulette, gacha } = readGames(games, false);
    expect(roulette).toEqual({ waiting: 2, participantsToday: 5, usedToday: null, mine: [] });
    expect(gacha).toEqual({ waiting: 0, usedToday: null, mine: [] });
  });
});
