"use client";

import { saveDiceGame } from "@/services/crew/crewGames";
import { DICE_RULES, DICE_TITLE_DEFAULT, type CrewMember, type DiceSettings, type GamesView } from "@/services/crew/crewTypes";
import { AutoFields, FormActions, ManualPlay, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

const same = (s: DiceSettings) => s;

/**
 * 주사위 게임 — code-first (no Figma frame; StreamDonate 주사위 게임 참고), inside `/creator/crew/games`. Two dice per run,
 * rolled on the server; the rule (룰 1 · 룰 2) turns them into a 배수 on the 기준 후원. 자동 on 시그니처 후원, 수동 while live.
 */
export function DiceGamePanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: DiceSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, same, same);
  const known = new Set(signatures.map((s) => s.id));

  return (
    <section id="game-dice" className={styles.card} aria-labelledby="game-dice-title">
      <h2 id="game-dice-title" className={styles.cardTitle}>
        🎲 주사위 게임
      </h2>
      <p className={styles.note}>주사위 2개를 굴려 나온 배수를 기준 후원 점수에 곱해요(×2면 그 후원 점수만큼 더해져요). 1배는 점수가 그대로예요. 주사위는 서버가 굴려요.</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveDiceGame({ ...draft, excluded: draft.excluded.filter((id) => known.has(id)) }), "주사위 게임 설정을 저장했어요.");
        }}
      >
        <TitleField name="주사위 게임" placeholder={DICE_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label="주사위 룰">
          <span className={styles.muted}>룰</span>
          <span className={games.rules}>
            {DICE_RULES.map((r) => (
              <button key={r.key} type="button" className={games.rule} aria-pressed={draft.rule === r.key} onClick={() => edit({ rule: r.key })}>
                <strong>{r.label}</strong>
                {r.lines.map((line) => (
                  <span key={line}>· {line}</span>
                ))}
              </button>
            ))}
          </span>
        </div>
        <AutoFields name="주사위 게임" verb="굴리기" auto={draft.auto} excluded={draft.excluded} showIdle={draft.showIdle} signatures={signatures} onChange={edit} />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 주사위는 저장한 룰로 굴러가요.</p>}
          <ManualPlay game="DICE" name="주사위 게임" verb="굴리기" live={live} members={members} pending={pending} run={run} />
          <RunList name="주사위 게임" runs={live.dice.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="dice" label="주사위 게임" />
    </section>
  );
}
