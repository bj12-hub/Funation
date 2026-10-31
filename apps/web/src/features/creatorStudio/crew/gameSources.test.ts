import { describe, expect, it } from "vitest";
import type { GameRunView, SudopolyLive, TerritoryLive } from "@/services/crew/crewTypes";
import { sudopolyLanded, sudopolyPositions } from "./SudopolyOverlay";
import { territoryRanking } from "./TerritoryOverlay";

/**
 * Separate OBS sources (2026-10-28, StreamDonate 땅따먹기 "점유 현황 (순위)" · 스도폴리 "상태 텍스트 (진행/랩)"): what they show
 * at a moment of the server clock — results not revealed yet do not count.
 */
const T = Date.parse("2026-10-28T05:00:00Z");
const at = (sec: number) => new Date(T + sec * 1000).toISOString();

describe("땅따먹기 점유 현황", () => {
  it("ranks by cells shown now, then 하트; members with neither are left out", () => {
    const territory = {
      members: [
        { memberId: "m1", name: "길동", color: "#111111", hearts: 0 },
        { memberId: "m2", name: "하늘", color: "#222222", hearts: 3 },
        { memberId: "m3", name: "바다", color: "#333333", hearts: 0 }
      ],
      board: {
        cells: [
          { owners: [{ memberId: "m1", revealAt: at(0) }] },
          { owners: [{ memberId: "m1", revealAt: at(0) }, { memberId: "m2", revealAt: at(30) }] }, // taken again, shown later
          { owners: [{ memberId: "m3", revealAt: at(60) }] },
          { owners: [] }
        ]
      }
    } as unknown as TerritoryLive;
    const now = territoryRanking(territory, T + 10_000);
    expect(now.owners).toEqual(["m1", "m1", null, null]);
    expect(now.ranking.map((m) => `${m.name} ${m.cells}`)).toEqual(["길동 2", "하늘 0"]);
    const later = territoryRanking(territory, T + 90_000);
    // Same cells: more 하트 first.
    expect(later.ranking.map((m) => `${m.name} ${m.cells}`)).toEqual(["하늘 1", "길동 1", "바다 1"]);
    expect(territoryRanking({ ...territory, board: null } as unknown as TerritoryLive, T).owners).toEqual([]);
  });
});

describe("스도폴리 상태 텍스트", () => {
  it("keeps a piece on its 칸 and 바퀴 until its roll shows", () => {
    const sudopoly = {
      pieces: [{ key: "m1", name: "길동", color: null, emoji: "🐱", pos: 3, laps: 2, island: 0 }],
      // Newest first: a roll past 출발 (1 → 2 바퀴) waits; the one before it showed.
      runs: [
        { id: "r2", revealAt: at(30), move: { piece: "m1", from: 18, to: 3, laps: 2 } },
        { id: "r1", revealAt: at(0), move: { piece: "m1", from: 10, to: 18, laps: 1 } }
      ]
    } as unknown as SudopolyLive;
    expect(sudopolyPositions(sudopoly, T + 10_000).map((p) => [p.pos, p.laps])).toEqual([[18, 1]]);
    expect(sudopolyPositions(sudopoly, T + 40_000).map((p) => [p.pos, p.laps])).toEqual([[3, 2]]);
  });
});

describe("스도폴리 3D 보드 (2026-10-30)", () => {
  it("lights the piece that moved and its 칸 only once the roll shows", () => {
    const run = { id: "r1", revealAt: at(5), move: { piece: "m1", from: 18, to: 3, laps: 2 } } as unknown as GameRunView;
    expect(sudopolyLanded(run, T)).toBeNull();
    expect(sudopolyLanded(run, T + 5_000)).toEqual({ piece: "m1", cell: 3 });
    expect(sudopolyLanded({ ...run, move: null }, T + 5_000)).toBeNull();
    expect(sudopolyLanded(null, T)).toBeNull();
  });
});
