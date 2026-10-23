"use client";

import { formatNumber } from "@/lib/format";
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
  return (
    <span className={games.weights}>
      {labels.map((label, i) => (
        <label key={label} className={games.weight}>
          <span>{label}</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            aria-label={`${name} ${label} 가중치`}
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
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const known = new Set(signatures.map((s) => s.id));
  const ops = [draft.plusWeight, draft.timesWeight];
  const unit = Number(draft.plusUnit);

  return (
    <section id="game-twowheel" className={styles.card} aria-labelledby="game-twowheel-title">
      <h2 id="game-twowheel-title" className={styles.cardTitle}>
        🎡 투휠 게임
      </h2>
      <p className={styles.note}>수식 릴(+ / ×)과 숫자 릴이 함께 돌아요. +는 숫자만큼 점수를 더하고, ×는 기준 후원 점수에 곱해요. 확률은 가중치로 직접 정해요(0이면 안 나와요).</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveTwoWheel({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), "투휠 게임 설정을 저장했어요.");
        }}
      >
        <TitleField name="투휠 게임" placeholder={TWO_WHEEL_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label="수식 릴">
          <span className={styles.muted}>수식 릴</span>
          <Weights name="수식" labels={["+", "×"]} values={ops} onChange={([plusWeight, timesWeight]) => edit({ plusWeight, timesWeight })} />
        </div>
        <div className={prize.field} role="group" aria-label="+ 숫자 릴">
          <span className={styles.muted}>+ 숫자 릴</span>
          <Weights name="+" labels={draft.plusWeights.map((_, i) => `+${i + 1}`)} values={draft.plusWeights} onChange={(plusWeights) => edit({ plusWeights })} />
          <label className={games.unit}>
            <span className={styles.muted}>+1 =</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label="+1 점수"
              min={1}
              max={TWO_WHEEL_UNIT_MAX}
              value={draft.plusUnit}
              onChange={(e) => edit({ plusUnit: e.target.value })}
            />
            <span className={styles.muted}>점</span>
          </label>
          <span className={styles.note}>{unit > 0 ? `+3이 나오면 ${formatNumber(unit * 3)}점이 더해져요.` : "+1 점수를 넣어 주세요."} 기본값 1,000점은 일반적인 기준이에요.</span>
        </div>
        <div className={prize.field} role="group" aria-label="× 숫자 릴">
          <span className={styles.muted}>× 숫자 릴</span>
          <Weights name="×" labels={draft.timesWeights.map((_, i) => `×${i + 1}`)} values={draft.timesWeights} onChange={(timesWeights) => edit({ timesWeights })} />
          <span className={styles.note}>×1은 점수가 그대로예요.</span>
        </div>
        <AutoFields name="투휠 게임" verb="돌리기" auto={draft.auto} excluded={draft.excluded} showIdle={draft.showIdle} signatures={signatures} onChange={edit} />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 투휠은 저장한 확률로 돌아가요.</p>}
          <ManualPlay game="TWO_WHEEL" name="투휠 게임" verb="돌리기" live={live} members={members} pending={pending} run={run} />
          <RunList name="투휠 게임" runs={live.twoWheel.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="twowheel" label="투휠 게임" />
    </section>
  );
}
