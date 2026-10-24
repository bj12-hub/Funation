"use client";

import { useState, type CSSProperties } from "react";
import { ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import { ALPHABET_TITLE_DEFAULT, GAME_TIMING, alphabetBoardAt, type AlphabetLive } from "@/services/crew/crewTypes";
import { useOverlayPage } from "./CrewScoreOverlay";
import { GameCard, currentRun, signedPoints } from "./GameOverlayParts";
import board from "./overlay.module.css";
import styles from "./gameOverlay.module.css";

const MISS = "꽝";
/** Reel copies the strip runs through before it lands. */
const LOOPS = 6;

/**
 * A horizontal reel, keyed by its run: scrolls through the letters (and 꽝) and stops on `result` `sec` seconds after
 * `showAt`; a page loaded mid-spin picks it up where it is.
 */
function HorizontalReel({ items, result, showAt, sec, now }: { items: string[]; result: string; showAt: string; sec: number; now: number }) {
  const [elapsed] = useState(() => Math.max(0, (now - Date.parse(showAt)) / 1000));
  const strip = Array.from({ length: LOOPS }, () => items).flat();
  const target = (LOOPS - 2) * items.length + Math.max(0, items.indexOf(result));
  const style = { "--reel-end": `calc(var(--alpha-cell) * ${-(target - 1)})`, "--reel-sec": `${sec}s`, animationDelay: `-${elapsed}s` } as CSSProperties;
  return (
    <ol className={`${styles.hStrip} ${styles.hSpinning}`} style={style}>
      {strip.map((x, i) => (
        <li key={i} className={ov.display} data-miss={x === MISS || undefined}>
          {x}
        </li>
      ))}
    </ol>
  );
}

/**
 * 알파벳 모으기 overlay (`?alphabet`): the horizontal reel (it spins to a run's letter or 꽝, then rests on it) and each
 * member's word board in the 단어판 테마, replayed up to the OBS clock — a letter lights once its run's result shows, a
 * completed word glows until that member's next letter. The run's result shows below (a 완성 with its 상품). Without runs
 * it waits (대기 중에도 보이기), or the page stays empty.
 */
export function AlphabetOverlay({ alphabet, serverNow, reloadSeq, theme }: { alphabet: AlphabetLive | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!alphabet || now === null || !alphabet.settings.word) return null;
  const run = currentRun(alphabet.runs, "ALPHABET", now);
  if (!run && !alphabet.settings.showIdle) return null;
  const shown = !!run && now >= Date.parse(run.revealAt);
  const items = [...alphabet.letters, MISS];
  // A 완성 run (no letter of its own) rests on the letter of the spin that completed the word.
  const done = !!run?.id.endsWith("-done");
  const spin = run && !done ? run : null;
  const last = done ? alphabet.runs.find((r) => `${r.id}-done` === run!.id) : spin;
  const rest = last ? (last.kind === "MISS" ? MISS : (last.itemId ?? MISS)) : alphabet.letters[0];
  return (
    <GameCard
      theme={theme}
      title={alphabet.settings.title || ALPHABET_TITLE_DEFAULT}
      waiting={alphabet.runs.filter((r) => Date.parse(r.showAt) > now).length}
      run={run}
      shown={shown}
      result={{ main: run?.label ?? "", sub: run?.points ? signedPoints(run.points) : "" }}
      idle={`단어 ${alphabet.settings.word}`}
      playing={done ? "단어 완성!" : "돌아가는 중…"}
      wide
    >
      <div className={styles.hReel} data-hit={shown || undefined}>
        {spin && !shown ? (
          <HorizontalReel key={spin.id} items={items} result={rest} showAt={spin.showAt} sec={GAME_TIMING.ALPHABET.playSec} now={now} />
        ) : (
          <ol className={styles.hStrip}>
            {[items[(items.indexOf(rest) - 1 + items.length) % items.length], rest, items[(items.indexOf(rest) + 1) % items.length]].map((x, i) => (
              <li key={i} className={ov.display} data-miss={x === MISS || undefined}>
                {x}
              </li>
            ))}
          </ol>
        )}
      </div>
      <ul className={styles.alphaBoards} data-theme={alphabet.settings.theme}>
        {alphabet.boards.map((x) => {
          const { lit, done: doneAt } = alphabetBoardAt(x, now);
          return (
            <li key={x.memberId} data-full={lit.every(Boolean) || undefined}>
              <span className={styles.alphaName}>
                {x.color && <i className={board.dot} style={{ background: x.color }} aria-hidden="true" />}
                {x.name}
              </span>
              <span className={styles.alphaWord}>
                {x.slots.map((c, i) => (
                  <span key={i} className={styles.alphaTile} data-on={lit[i] || undefined}>
                    {c.letter}
                  </span>
                ))}
              </span>
              {doneAt > 0 && <span className={styles.alphaDone}>×{doneAt}</span>}
            </li>
          );
        })}
      </ul>
    </GameCard>
  );
}
