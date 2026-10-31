"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
  const { t } = useI18n();
  const lines = bingoLines(state.size, state.marked);
  const done = lines >= state.goal;
  return (
    <>
      <div className={styles.cardHead}>
        <span className={local.status} role="status">
          <strong>{state.title || t("studioTools.bingoDefault")}</strong>
          {t("studioTools.bingoStatus", { lines, goal: state.goal })}
          {done && <span className={styles.chip}>{t("studioTools.bingoDone")}</span>}
        </span>
        <span className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !state.marked.some(Boolean)} onClick={() => run(() => controlBingo("RESET"), t("studioTools.marksCleared"))}>
            {t("studioTools.clearMarks")}
          </button>
          <button
            type="button"
            className={state.shown ? styles.ghost : styles.primary}
            disabled={pending}
            onClick={() => run(() => controlBingo(state.shown ? "HIDE" : "SHOW"), state.shown ? t("studioTools.takenOffStream") : t("studioTools.shownOnStream"))}
          >
            {state.shown ? t("studioTools.hideFromScreen") : t("studioTools.showOnScreen")}
          </button>
        </span>
      </div>

      <div className={local.board} style={{ gridTemplateColumns: `repeat(${state.size}, 1fr)` }} role="group" aria-label={t("studioTools.boardAria")}>
        {state.cells.map((c, i) => (
          <button
            key={i}
            type="button"
            className={local.cell}
            aria-pressed={state.marked[i]}
            aria-label={c ? `${c}${state.marked[i] ? t("studioTools.markedSuffix") : ""}` : t("studioTools.emptyCell", { n: i + 1 })}
            disabled={pending || !c}
            onClick={() => run(() => markBingo({ index: i, marked: !state.marked[i], size: state.size, cell: c }))}
          >
            {c || "—"}
          </button>
        ))}
      </div>
      <p className={styles.note}>
        {t("studioTools.bingoHelp")} {state.shown ? t("studioTools.bingoVisible") : t("studioTools.bingoHidden")}
      </p>
    </>
  );
}

/**
 * 빙고 — code-first (funnation 엑셀방송 빙고, 2026-10-06 결정), a card on `/creator/widgets/tools`. The board is the
 * remote: a click marks or unmarks a filled cell. "판 편집" changes the title, size, goal and missions (칸 섞기 is
 * local until 저장). The overlay shows the board only while "화면에 보이기" is on.
 */
export function BingoTool({ state, pending, run }: { state: BingoState; pending: boolean; run: Run }) {
  const { t } = useI18n();
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
        <summary>{t("studioTools.editBoard")}</summary>
        <form
          className={styles.startForm}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveBingo({ title, size, cells, goal }), t("studioTools.bingoSaved"));
          }}
        >
          <div className={local.editRow}>
            <input
              className={styles.input}
              aria-label={t("studioTools.bingoTitle")}
              placeholder={t("studioTools.bingoTitle")}
              maxLength={BINGO_TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <select className={styles.select} aria-label={t("studioTools.boardSize")} value={size} onChange={(e) => resize(Number(e.target.value) as BingoSize)}>
              {BINGO_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} × {n}
                </option>
              ))}
            </select>
            <select className={styles.select} aria-label={t("studioTools.goalLines")} value={goal} onChange={(e) => setGoal(Number(e.target.value))}>
              {Array.from({ length: bingoLinesMax(size) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {t("studioTools.goalOption", { n })}
                </option>
              ))}
            </select>
          </div>
          <div className={local.editGrid} style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
            {cells.map((c, i) => (
              <input
                key={i}
                className={styles.input}
                aria-label={t("studioTools.cellMission", { row: Math.floor(i / size) + 1, col: (i % size) + 1 })}
                placeholder={t("studioTools.mission")}
                maxLength={BINGO_CELL_MAX}
                value={c}
                onChange={(e) => setCells(cells.map((x, j) => (j === i ? e.target.value : x)))}
              />
            ))}
          </div>
          <div className={styles.actions}>
            <span className={styles.muted}>{t("studioTools.resizeNote")}</span>
            <button type="button" className={styles.ghost} disabled={pending} onClick={shuffle}>
              {t("studioTools.shuffle")}
            </button>
            <button type="submit" className={styles.primary} disabled={pending}>
              {t("studioTools.save")}
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}
