"use client";

import { useState } from "react";
import { controlBingo, markBingo, saveBingo } from "@/services/creator/broadcastTools";
import { BINGO_CELL_MAX, BINGO_SIZES, BINGO_TITLE_MAX, bingoLines, bingoLinesMax, resizeBingo, type BingoSize, type BingoState, type ToolResult } from "@/services/creator/broadcastToolTypes";
import styles from "../crew/crew.module.css";
import local from "./bingo.module.css";

type Run = (action: () => Promise<ToolResult>, ok?: string) => void;

/**
 * The playing part of 빙고 — status, 표시 초기화, 화면에 보이기 and the board, where a click marks or unmarks a filled
 * cell. Shared by the 방송 도구 card and the 리모컨 (2026-10-06 결정).
 */
export function BingoPlay({ state, pending, run }: { state: BingoState; pending: boolean; run: Run }) {
  const lines = bingoLines(state.size, state.marked);
  const done = lines >= state.goal;
  return (
    <>
      <div className={styles.cardHead}>
        <span className={local.status} role="status">
          <strong>{state.title || "빙고"}</strong> · 완성 {lines}줄 / 목표 {state.goal}줄{done && <span className={styles.chip}>🎉 빙고!</span>}
        </span>
        <span className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !state.marked.some(Boolean)} onClick={() => run(() => controlBingo("RESET"), "표시를 모두 지웠어요.")}>
            표시 초기화
          </button>
          <button
            type="button"
            className={state.shown ? styles.ghost : styles.primary}
            disabled={pending}
            onClick={() => run(() => controlBingo(state.shown ? "HIDE" : "SHOW"), state.shown ? "방송 화면에서 내렸어요." : "방송 화면에 띄웠어요.")}
          >
            {state.shown ? "화면에서 내리기" : "화면에 보이기"}
          </button>
        </span>
      </div>

      <div className={local.board} style={{ gridTemplateColumns: `repeat(${state.size}, 1fr)` }} role="group" aria-label="빙고판">
        {state.cells.map((c, i) => (
          <button
            key={i}
            type="button"
            className={local.cell}
            aria-pressed={state.marked[i]}
            aria-label={c ? `${c}${state.marked[i] ? " (표시됨)" : ""}` : `빈 칸 ${i + 1}`}
            disabled={pending || !c}
            onClick={() => run(() => markBingo({ index: i, marked: !state.marked[i], size: state.size, cell: c }))}
          >
            {c || "—"}
          </button>
        ))}
      </div>
      <p className={styles.note}>칸을 누르면 표시되고, 다시 누르면 지워져요. {state.shown ? "방송 화면에 보이는 중이에요." : "지금은 방송 화면에 보이지 않아요."}</p>
    </>
  );
}

/**
 * 빙고 — code-first (funnation 엑셀방송 빙고, 2026-10-06 결정), a card on `/creator/widgets/tools`. The board is the
 * remote: a click marks or unmarks a filled cell. "판 편집" changes the title, size, goal and missions (칸 섞기 is
 * local until 저장). The overlay shows the board only while "화면에 보이기" is on.
 */
export function BingoTool({ state, pending, run }: { state: BingoState; pending: boolean; run: Run }) {
  const [title, setTitle] = useState(state.title);
  const [size, setSize] = useState<BingoSize>(state.size);
  const [cells, setCells] = useState(state.cells);
  const [goal, setGoal] = useState(state.goal);
  const resize = (next: BingoSize) => {
    setCells(resizeBingo({ size, cells, marked: [] }, next).cells);
    setSize(next);
    setGoal((g) => Math.min(g, bingoLinesMax(next)));
  };
  const shuffle = () => {
    const next = [...cells];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setCells(next);
  };

  return (
    <div className={styles.startForm}>
      <BingoPlay state={state} pending={pending} run={run} />

      <details className={local.edit}>
        <summary>판 편집</summary>
        <form
          className={styles.startForm}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveBingo({ title, size, cells, goal }), "빙고판을 저장했어요.");
          }}
        >
          <div className={local.editRow}>
            <input className={styles.input} aria-label="빙고 제목" placeholder="빙고 제목" maxLength={BINGO_TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} />
            <select className={styles.select} aria-label="판 크기" value={size} onChange={(e) => resize(Number(e.target.value) as BingoSize)}>
              {BINGO_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} × {n}
                </option>
              ))}
            </select>
            <select className={styles.select} aria-label="목표 줄 수" value={goal} onChange={(e) => setGoal(Number(e.target.value))}>
              {Array.from({ length: bingoLinesMax(size) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}줄 빙고
                </option>
              ))}
            </select>
          </div>
          <div className={local.editGrid} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
            {cells.map((c, i) => (
              <input
                key={i}
                className={styles.input}
                aria-label={`${Math.floor(i / size) + 1}행 ${(i % size) + 1}열 미션`}
                placeholder="미션"
                maxLength={BINGO_CELL_MAX}
                value={c}
                onChange={(e) => setCells(cells.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
          </div>
          <div className={styles.actions}>
            <span className={styles.muted}>판 크기를 바꾸면 남는 칸의 표시는 그대로예요.</span>
            <button type="button" className={styles.ghost} disabled={pending} onClick={shuffle}>
              칸 섞기
            </button>
            <button type="submit" className={styles.primary} disabled={pending}>
              저장
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
