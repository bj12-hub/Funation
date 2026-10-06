import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";
import { bingoLines, bingoLinesMax, resizeBingo } from "./broadcastToolTypes";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 빙고 (code-first, 2026-10-06): a hand-marked mission board with an OBS overlay. */
async function load() {
  const tools = await import("./broadcastTools");
  const remote = await import("./alertRemote");
  const { mockCreator } = await import("./mockCreatorStore");
  return { ...tools, ...remote, key: mockCreator.integrationKey };
}

const marks = (size: number, cells: number[]) => Array.from({ length: size * size }, (_, i) => cells.includes(i));

/** A click as the screen sends it: the index plus the board it saw. */
async function mark(m: Awaited<ReturnType<typeof load>>, index: number, marked = true) {
  const b = (await m.getToolsView())!.states.bingo;
  return m.markBingo({ index, marked, size: b.size, cell: b.cells[index] });
}
const markedOf = async (m: Awaited<ReturnType<typeof load>>) => (await m.getToolsView())!.states.bingo.marked.flatMap((x, i) => (x ? [i] : []));

describe("빙고", () => {
  beforeEach(() => resetMockStores());

  it("counts rows, columns and both diagonals", () => {
    expect(bingoLines(3, marks(3, []))).toBe(0);
    expect(bingoLines(3, marks(3, [0, 1, 2]))).toBe(1); // top row
    expect(bingoLines(3, marks(3, [0, 4, 8]))).toBe(1); // diagonal
    expect(bingoLines(3, marks(3, [2, 4, 6, 0, 8]))).toBe(2); // both diagonals
    expect(bingoLines(4, marks(4, [1, 5, 9, 13, 4, 6, 7]))).toBe(2); // column 2 + row 2
    expect(bingoLines(3, marks(3, [0, 1, 2, 3, 4, 5, 6, 7, 8]))).toBe(bingoLinesMax(3));
    expect(bingoLinesMax(5)).toBe(12);
  });

  it("keeps cells and marks by row and column when the board is resized", () => {
    const from = { size: 3 as const, cells: ["a", "b", "c", "d", "e", "f", "g", "h", "i"], marked: marks(3, [0, 4, 8]) };
    const big = resizeBingo(from, 4);
    expect(big.cells).toEqual(["a", "b", "c", "", "d", "e", "f", "", "g", "h", "i", "", "", "", "", ""]);
    expect(big.marked.flatMap((m, i) => (m ? [i] : []))).toEqual([0, 5, 10]);
    expect(resizeBingo({ size: 4, ...big }, 3)).toEqual({ cells: from.cells, marked: from.marked });
  });

  it("saves a board, marks cells and shows it on the overlay", async () => {
    const m = await load();
    expect((await m.getToolsView())!.states.bingo).toMatchObject({ size: 3, goal: 1, shown: false });
    const cells = ["노래", "춤", "", "퀴즈", "게임", "사연", "애교", "물", "삼행시"];
    expect(await m.saveBingo({ title: " 미션 빙고 ", size: 3, cells, goal: 2 })).toEqual({ status: "SAVED" });
    expect(await mark(m, 0)).toEqual({ status: "SAVED" });
    expect(await mark(m, 0)).toEqual({ status: "SAVED" }); // retried click
    expect((await mark(m, 2)).status).toBe("INVALID"); // empty cell
    for (const i of [3, 6]) await mark(m, i);

    let overlay = await m.getOverlayTool("bingo", m.key);
    if (overlay === "FORBIDDEN" || overlay.tool !== "bingo") throw new Error("no bingo overlay");
    expect(overlay.state).toMatchObject({ title: "미션 빙고", goal: 2, shown: false });
    expect(bingoLines(3, overlay.state.marked)).toBe(1); // first column
    expect(await m.controlBingo("SHOW")).toEqual({ status: "SAVED" });
    overlay = await m.getOverlayTool("bingo", m.key);
    if (overlay === "FORBIDDEN" || overlay.tool !== "bingo") throw new Error("no bingo overlay");
    expect(overlay).toMatchObject({ on: true, state: { shown: true } });

    // A bigger board keeps the marks of the cells that remain; emptying a marked cell unmarks it.
    await m.saveBingo({ title: "미션 빙고", size: 4, cells: [...resizeBingo({ size: 3, cells, marked: [] }, 4).cells.slice(0, 15), "새 칸"], goal: 3 });
    expect(await markedOf(m)).toEqual([0, 4, 8]);
    await m.saveBingo({ title: "미션 빙고", size: 4, cells: ["", ...resizeBingo({ size: 3, cells, marked: [] }, 4).cells.slice(1)], goal: 3 });
    expect(await markedOf(m)).toEqual([4, 8]);
    expect(await m.controlBingo("RESET")).toEqual({ status: "SAVED" });
    expect((await m.getToolsView())!.states.bingo.marked.every((x) => !x)).toBe(true);

    // 리모컨 기능 제어 OFF hides it.
    expect(await m.setOverlaySwitch({ target: "bingo", on: false })).toEqual({ status: "SAVED" });
    expect(await m.getOverlayTool("bingo", m.key)).toMatchObject({ on: false });
    expect(await m.getOverlayTool("bingo", "wrong-key")).toBe("FORBIDDEN");
  });

  it("keeps each mark on its mission when cells move, and refuses a click from an outdated board", async () => {
    const m = await load();
    const cells = ["가", "나", "다", "라", "마", "바", "사", "아", "자"];
    await m.saveBingo({ title: "빙고", size: 3, cells, goal: 1 });
    await mark(m, 0); // 가
    await mark(m, 4); // 마
    // 칸 섞기: 가 and 마 move; their marks go with them, nothing else becomes marked.
    const shuffled = ["마", "다", "가", "바", "나", "라", "자", "아", "사"];
    await m.saveBingo({ title: "빙고", size: 3, cells: shuffled, goal: 1 });
    expect(await markedOf(m)).toEqual([0, 2]);
    // Rewording a marked mission starts it unmarked.
    await m.saveBingo({ title: "빙고", size: 3, cells: ["마!", ...shuffled.slice(1)], goal: 1 });
    expect(await markedOf(m)).toEqual([2]);
    // A screen still showing the old board (index 0 was 마) cannot mark whatever is there now.
    expect(await m.markBingo({ index: 0, marked: true, size: 3, cell: "마" })).toMatchObject({ status: "INVALID", message: "빙고판이 바뀌었어요. 화면을 새로고침한 뒤 다시 눌러 주세요." });
    expect((await m.markBingo({ index: 0, marked: true, size: 4, cell: "마!" })).status).toBe("INVALID");
    expect(await markedOf(m)).toEqual([2]);
  });

  it("validates the board and is for creators only", async () => {
    const m = await load();
    const cells = Array.from({ length: 9 }, (_, i) => `칸${i}`);
    for (const bad of [
      { size: 6, cells, goal: 1 },
      { size: 3, cells: cells.slice(0, 8), goal: 1 },
      { size: 3, cells: cells.map(() => ""), goal: 1 },
      { size: 3, cells: ["가".repeat(21), ...cells.slice(1)], goal: 1 },
      { size: 3, cells, goal: 0 },
      { size: 3, cells, goal: 9 },
      { size: 3, cells, goal: 1, title: "가".repeat(31) },
      { size: 3, cells: ["운영자", ...cells.slice(1)], goal: 1 }
    ]) {
      expect((await m.saveBingo({ title: "빙고", ...bad })).status).toBe("INVALID");
    }
    expect((await m.markBingo({ index: 9, marked: true })).status).toBe("INVALID");
    expect((await m.markBingo({ index: 0, marked: "yes" })).status).toBe("INVALID");
    expect((await m.controlBingo("SPIN")).status).toBe("INVALID");
    signIn(["SUPPORTER"]);
    expect(await m.saveBingo({ title: "빙고", size: 3, cells, goal: 1 })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.markBingo({ index: 0, marked: true, size: 3, cell: "칸0" })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.controlBingo("SHOW")).toEqual({ status: "UNAUTHORIZED" });
  });
});
