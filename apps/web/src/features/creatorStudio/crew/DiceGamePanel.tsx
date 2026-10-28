"use client";

import { saveDiceGame } from "@/services/crew/crewGames";
import { DICE_PROJECT_RULES_MAX, DICE_RULES, DICE_TITLE_DEFAULT, PROJECT_NAME_MAX, type CrewMember, type DiceSettings, type GamesView } from "@/services/crew/crewTypes";
import { AutoFields, FormActions, ManualPlay, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

const same = (s: DiceSettings) => s;

/**
 * 주사위 게임 — code-first (no Figma frame; StreamDonate 주사위 게임 참고), inside `/creator/crew/games`. Two dice per run,
 * rolled on the server; the rule (룰 1 · 룰 2) turns them into a 배수 on the 기준 후원. 자동 on 시그니처 후원, 수동 while live.
 * 프로젝트별 룰 (2026-10-28): a 프로젝트 can have its own 룰.
 */
export function DiceGamePanel({
  settings,
  projects,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: DiceSettings;
  projects: string[];
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
  const setProject = (i: number, patch: Partial<DiceSettings["projectRules"][number]>) => edit({ projectRules: draft.projectRules.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const liveRule = live ? DICE_RULES.find((r) => r.key === live.dice.rule) : undefined;

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
        <div className={prize.field} role="group" aria-label="프로젝트별 룰">
          <span className={styles.muted}>
            프로젝트별 룰 ({draft.projectRules.length}/{DICE_PROJECT_RULES_MAX})
          </span>
          {draft.projectRules.length > 0 && (
            <ul className={games.tiers}>
              {draft.projectRules.map((p, i) => (
                <li key={i}>
                  <span className={games.tierRow}>
                    <input
                      className={styles.input}
                      list="dice-projects"
                      aria-label={`${i + 1}번째 프로젝트 이름`}
                      placeholder="프로젝트 이름"
                      maxLength={PROJECT_NAME_MAX}
                      value={p.project}
                      onChange={(e) => setProject(i, { project: e.target.value })}
                    />
                    <span className={styles.segment} role="group" aria-label={`${p.project || `${i + 1}번째 프로젝트`} 룰`}>
                      {DICE_RULES.map((r) => (
                        <button key={r.key} type="button" aria-pressed={p.rule === r.key} onClick={() => setProject(i, { rule: r.key })}>
                          {r.label}
                        </button>
                      ))}
                    </span>
                    <button type="button" className={styles.ghost} onClick={() => edit({ projectRules: draft.projectRules.filter((_, j) => j !== i) })}>
                      삭제
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <datalist id="dice-projects">
            {projects.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.projectRules.length >= DICE_PROJECT_RULES_MAX}
              onClick={() => edit({ projectRules: [...draft.projectRules, { project: projects.find((p) => !draft.projectRules.some((x) => x.project === p)) ?? "", rule: draft.rule === "RULE1" ? "RULE2" : "RULE1" }] })}
            >
              + 프로젝트 룰 추가
            </button>
          </span>
          <span className={styles.note}>그 프로젝트로 시작한 방송은 여기 룰로, 다른 방송은 위 룰로 굴려요.</span>
        </div>
        <AutoFields name="주사위 게임" verb="굴리기" auto={draft.auto} excluded={draft.excluded} showIdle={draft.showIdle} signatures={signatures} onChange={edit} />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 주사위는 저장한 룰로 굴러가요.</p>}
          {liveRule && <p className={styles.muted}>{live.project ? `이번 방송(${live.project})은 ${liveRule.label}로 굴려요.` : `이번 방송은 ${liveRule.label}로 굴려요.`}</p>}
          <ManualPlay game="DICE" name="주사위 게임" verb="굴리기" live={live} members={members} pending={pending} run={run} />
          <RunList name="주사위 게임" runs={live.dice.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="dice" label="주사위 게임" />
    </section>
  );
}
