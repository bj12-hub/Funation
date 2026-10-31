"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveDiceGame } from "@/services/crew/crewGames";
import {
  DICE_PROJECT_RULES_MAX,
  DICE_RULES,
  DICE_TITLE_DEFAULT,
  PROJECT_NAME_MAX,
  type CrewMember,
  type DiceRule,
  type DiceSettings,
  type GamesView
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, ManualPlay, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

const same = (s: DiceSettings) => s;
/** `DICE_RULES` (룰 1 · 룰 2) as message keys. */
const RULE_TEXT: Record<DiceRule, { label: MessageKey; lines: MessageKey[] }> = {
  RULE1: { label: "crewGameDice.rule1", lines: ["crewGameDice.rule1Line1", "crewGameDice.rule1Line2", "crewGameDice.rule1Line3"] },
  RULE2: { label: "crewGameDice.rule2", lines: ["crewGameDice.rule2Line1", "crewGameDice.rule2Line2", "crewGameDice.rule2Line3", "crewGameDice.rule2Line4"] }
};

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
  const { t } = useI18n();
  const name = t("crewGame.nameDice");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, same, same);
  const known = new Set(signatures.map((s) => s.id));
  const setProject = (i: number, patch: Partial<DiceSettings["projectRules"][number]>) => edit({ projectRules: draft.projectRules.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const liveRule = live ? DICE_RULES.find((r) => r.key === live.dice.rule) : undefined;

  return (
    <section id="game-dice" className={styles.card} aria-labelledby="game-dice-title">
      <h2 id="game-dice-title" className={styles.cardTitle}>
        🎲 {name}
      </h2>
      <p className={styles.note}>{t("crewGameDice.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveDiceGame({ ...draft, excluded: draft.excluded.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={DICE_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label={t("crewGameDice.rulesAria")}>
          <span className={styles.muted}>{t("crewGameDice.rule")}</span>
          <span className={games.rules}>
            {DICE_RULES.map((r) => (
              <button key={r.key} type="button" className={games.rule} aria-pressed={draft.rule === r.key} onClick={() => edit({ rule: r.key })}>
                <strong>{t(RULE_TEXT[r.key].label)}</strong>
                {RULE_TEXT[r.key].lines.map((line) => (
                  <span key={line}>· {t(line)}</span>
                ))}
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewGameDice.projectRulesAria")}>
          <span className={styles.muted}>{t("crewGameDice.projectRules", { count: draft.projectRules.length, max: DICE_PROJECT_RULES_MAX })}</span>
          {draft.projectRules.length > 0 && (
            <ul className={games.tiers}>
              {draft.projectRules.map((p, i) => (
                <li key={i}>
                  <span className={games.tierRow}>
                    <input
                      className={styles.input}
                      list="dice-projects"
                      aria-label={t("crewGameDice.projectNameAria", { n: i + 1 })}
                      placeholder={t("crewGameDice.projectNamePlaceholder")}
                      maxLength={PROJECT_NAME_MAX}
                      value={p.project}
                      onChange={(e) => setProject(i, { project: e.target.value })}
                    />
                    <span className={styles.segment} role="group" aria-label={t("crewGameDice.projectRuleAria", { project: p.project || t("crewGameDice.nthProject", { n: i + 1 }) })}>
                      {DICE_RULES.map((r) => (
                        <button key={r.key} type="button" aria-pressed={p.rule === r.key} onClick={() => setProject(i, { rule: r.key })}>
                          {t(RULE_TEXT[r.key].label)}
                        </button>
                      ))}
                    </span>
                    <button type="button" className={styles.ghost} onClick={() => edit({ projectRules: draft.projectRules.filter((_, j) => j !== i) })}>
                      {t("crewGame.delete")}
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
              {t("crewGameDice.addProjectRule")}
            </button>
          </span>
          <span className={styles.note}>{t("crewGameDice.projectNote")}</span>
        </div>
        <AutoFields name={name} verb={t("crewGame.roll")} auto={draft.auto} excluded={draft.excluded} showIdle={draft.showIdle} signatures={signatures} onChange={edit} />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameDice.unsaved")}</p>}
          {liveRule && (
            <p className={styles.muted}>
              {live.project
                ? t("crewGameDice.liveRuleProject", { project: live.project, rule: t(RULE_TEXT[liveRule.key].label) })
                : t("crewGameDice.liveRule", { rule: t(RULE_TEXT[liveRule.key].label) })}
            </p>
          )}
          <ManualPlay game="DICE" name={name} verb={t("crewGame.roll")} live={live} members={members} pending={pending} run={run} />
          <RunList name={name} runs={live.dice.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="dice" label={name} />
    </section>
  );
}
