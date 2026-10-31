"use client";

import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { saveTwoWheel } from "@/services/crew/crewGames";
import { TWO_WHEEL_TITLE_DEFAULT, TWO_WHEEL_UNIT_MAX, TWO_WHEEL_WEIGHT_MAX, type CrewMember, type GamesView, type TwoWheelSettings } from "@/services/crew/crewTypes";
import { AutoFields, FormActions, ManualPlay, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps the numbers as typed; they are converted when saved ("" = 0). */
type Draft = Omit<TwoWheelSettings, "plusWeight" | "timesWeight" | "plusWeights" | "timesWeights" | "plusUnit"> & {
  plusWeight: string;
  timesWeight: string;
  plusWeights: string[];
  timesWeights: string[];
  plusUnit: string;
};

const toDraft = (s: TwoWheelSettings): Draft => ({
  ...s,
  plusWeight: String(s.plusWeight),
  timesWeight: String(s.timesWeight),
  plusWeights: s.plusWeights.map(String),
  timesWeights: s.timesWeights.map(String),
  plusUnit: String(s.plusUnit)
});
const fromDraft = (d: Draft) => ({
  ...d,
  plusWeight: Number(d.plusWeight),
  timesWeight: Number(d.timesWeight),
  plusWeights: d.plusWeights.map(Number),
  timesWeights: d.timesWeights.map(Number),
  plusUnit: Number(d.plusUnit)
});
const percent = (w: string, all: string[]) => {
  const total = all.reduce((s, x) => s + (Number(x) > 0 ? Number(x) : 0), 0);
  return Number(w) > 0 && total ? `${Math.round((Number(w) / total) * 1000) / 10}%` : "0%";
};

/** A row of weight inputs (one per +n, ×n or operator) with each one's share. */
function Weights({ name, labels, values, onChange }: { name: string; labels: string[]; values: string[]; onChange: (values: string[]) => void }) {
  const { t } = useI18n();
  return (
    <span className={games.weights}>
      {labels.map((label, i) => (
        <label key={label} className={games.weight}>
          <span>{label}</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            aria-label={t("crewGameTwoWheel.weightAria", { name, label })}
            min={0}
            max={TWO_WHEEL_WEIGHT_MAX}
            value={values[i]}
            onChange={(e) => onChange(values.map((v, j) => (j === i ? e.target.value : v)))}
          />
          <span className={styles.muted}>{percent(values[i], values)}</span>
        </label>
      ))}
    </span>
  );
}

/**
 * 투휠 게임 — code-first (no Figma frame; StreamDonate 투휠 참고), inside `/creator/crew/games`. An operator reel (+ / ×) and a
 * number reel with the creator's odds: +n adds n × the +1 점수, ×n multiplies the 기준 후원. 자동 on 시그니처 후원, 수동 while live.
 */
export function TwoWheelPanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: TwoWheelSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const name = t("crewGame.nameTwoWheel");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const known = new Set(signatures.map((s) => s.id));
  const ops = [draft.plusWeight, draft.timesWeight];
  const unit = Number(draft.plusUnit);

  return (
    <section id="game-twowheel" className={styles.card} aria-labelledby="game-twowheel-title">
      <h2 id="game-twowheel-title" className={styles.cardTitle}>
        🎡 {name}
      </h2>
      <p className={styles.note}>{t("crewGameTwoWheel.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveTwoWheel({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={TWO_WHEEL_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label={t("crewGameTwoWheel.opReel")}>
          <span className={styles.muted}>{t("crewGameTwoWheel.opReel")}</span>
          <Weights name={t("crewGameTwoWheel.opName")} labels={["+", "×"]} values={ops} onChange={([plusWeight, timesWeight]) => edit({ plusWeight, timesWeight })} />
        </div>
        <div className={prize.field} role="group" aria-label={t("crewGameTwoWheel.plusReel")}>
          <span className={styles.muted}>{t("crewGameTwoWheel.plusReel")}</span>
          <Weights name="+" labels={draft.plusWeights.map((_, i) => `+${i + 1}`)} values={draft.plusWeights} onChange={(plusWeights) => edit({ plusWeights })} />
          <label className={games.unit}>
            <span className={styles.muted}>+1 =</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameTwoWheel.plusUnitAria")}
              min={1}
              max={TWO_WHEEL_UNIT_MAX}
              value={draft.plusUnit}
              onChange={(e) => edit({ plusUnit: e.target.value })}
            />
            <span className={styles.muted}>{t("crewGameTwoWheel.pointsUnit")}</span>
          </label>
          <span className={styles.note}>
            {unit > 0 ? t("crewGameTwoWheel.plusExample", { points: formatNumber(unit * 3) }) : t("crewGameTwoWheel.plusMissing")} {t("crewGameTwoWheel.plusDefault")}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewGameTwoWheel.timesReel")}>
          <span className={styles.muted}>{t("crewGameTwoWheel.timesReel")}</span>
          <Weights name="×" labels={draft.timesWeights.map((_, i) => `×${i + 1}`)} values={draft.timesWeights} onChange={(timesWeights) => edit({ timesWeights })} />
          <span className={styles.note}>{t("crewGameTwoWheel.timesNote")}</span>
        </div>
        <AutoFields name={name} verb={t("crewGame.spin")} auto={draft.auto} excluded={draft.excluded} showIdle={draft.showIdle} signatures={signatures} onChange={edit} />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameTwoWheel.unsaved")}</p>}
          <ManualPlay game="TWO_WHEEL" name={name} verb={t("crewGame.spin")} live={live} members={members} pending={pending} run={run} />
          <RunList name={name} runs={live.twoWheel.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="twowheel" label={name} />
    </section>
  );
}
