"use client";

import { saveRandomSig } from "@/services/crew/crewGames";
import {
  RANDOM_SIG_MODES,
  RANDOM_SIG_MULTIPLIER_MAX,
  RANDOM_SIG_TIERS_MAX,
  RANDOM_SIG_TITLE_DEFAULT,
  type GamesView,
  type RandomSigSettings
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps the amounts as typed; they are converted when saved. */
type EditTier = { id: string; trigger: string; min: string; max: string };
type Draft = Omit<RandomSigSettings, "tiers" | "multiplier"> & { tiers: EditTier[]; multiplier: string };

const toDraft = (s: RandomSigSettings): Draft => ({
  ...s,
  tiers: s.tiers.map((t) => ({ id: t.id, trigger: String(t.trigger), min: String(t.min), max: String(t.max) })),
  multiplier: String(s.multiplier)
});
const fromDraft = (d: Draft) => ({
  ...d,
  tiers: d.tiers.map((t) => ({ id: t.id, trigger: Number(t.trigger), min: Number(t.min), max: Number(t.max) })),
  multiplier: Number(d.multiplier)
});
const newId = () => `new-${crypto.randomUUID().slice(0, 8)}`;

/**
 * 랜덤시그 — code-first (no Figma frame; StreamDonate 랜덤시그 참고), inside `/creator/crew/games`. 발동 구간 (발동 금액 → 시그
 * 금액 범위), 제외 시그, 기여도 방식 (기본 · 랜덤 결과) and 기본 배수. A 일반 후원 of exactly a 발동 금액 plays a drawn
 * signature as its alert; while live, one sent to a member also records a run. There is no 수동 run.
 */
export function RandomSigPanel({
  settings,
  signatures,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: RandomSigSettings;
  signatures: GamesView["signatures"];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const known = new Set(signatures.map((s) => s.id));
  const setTier = (i: number, patch: Partial<EditTier>) => edit({ tiers: draft.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  // What a tier would draw from, and a 금액 일치 signature that takes its 발동 금액 first.
  const candidates = (t: EditTier) => signatures.filter((s) => s.active && !draft.excluded.includes(s.id) && s.price >= Number(t.min) && s.price <= Number(t.max)).length;
  const takenBy = (t: EditTier) => signatures.find((s) => s.active && s.match === "AMOUNT" && Number(t.trigger) >= (s.rangeMin ?? s.price) && Number(t.trigger) <= s.price);

  return (
    <section id="game-randomsig" className={styles.card} aria-labelledby="game-randomsig-title">
      <h2 id="game-randomsig-title" className={styles.cardTitle}>
        🔀 랜덤시그
      </h2>
      <p className={styles.note}>
        발동 금액과 정확히 같은 일반 후원이 들어오면 그 구간 금액의 시그니처 중 하나를 서버가 뽑아, 후원 알림이 그 시그니처로 나가요(시그 카운트에도 그 시그니처로 세요). 크루 방송 중 멤버를
        고른 후원이면 점수도 들어가요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveRandomSig({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), "랜덤시그 설정을 저장했어요.");
        }}
      >
        <TitleField name="랜덤시그" placeholder={RANDOM_SIG_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />

        <div className={prize.field}>
          <span className={styles.muted}>
            발동 구간 ({draft.tiers.length}/{RANDOM_SIG_TIERS_MAX})
          </span>
          {draft.tiers.length > 0 && (
            <ul className={games.tiers}>
              {draft.tiers.map((t, i) => {
                const taken = t.trigger ? takenBy(t) : undefined;
                return (
                  <li key={t.id}>
                    <span className={games.tierRow}>
                      <span className={styles.muted}>발동</span>
                      <input
                        className={styles.inputSmall}
                        type="number"
                        inputMode="numeric"
                        aria-label={`구간 ${i + 1} 발동 금액`}
                        placeholder="발동 금액"
                        value={t.trigger}
                        onChange={(e) => setTier(i, { trigger: e.target.value })}
                      />
                      <span className={styles.muted}>FN → 시그</span>
                      <input
                        className={styles.inputSmall}
                        type="number"
                        inputMode="numeric"
                        aria-label={`구간 ${i + 1} 시그 최소 금액`}
                        placeholder="최소"
                        value={t.min}
                        onChange={(e) => setTier(i, { min: e.target.value })}
                      />
                      <span className={styles.muted}>~</span>
                      <input
                        className={styles.inputSmall}
                        type="number"
                        inputMode="numeric"
                        aria-label={`구간 ${i + 1} 시그 최대 금액`}
                        placeholder="최대"
                        value={t.max}
                        onChange={(e) => setTier(i, { max: e.target.value })}
                      />
                      <span className={styles.muted}>FN · 후보 {candidates(t)}개</span>
                      <button type="button" className={styles.ghost} onClick={() => edit({ tiers: draft.tiers.filter((_, j) => j !== i) })}>
                        삭제
                      </button>
                    </span>
                    {taken && (
                      <span className={styles.error} role="alert">
                        이 금액은 &apos;{taken.name}&apos; 시그니처가 금액 일치로 먼저 받아요. 다른 발동 금액을 정해 주세요.
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.tiers.length >= RANDOM_SIG_TIERS_MAX}
              onClick={() => edit({ tiers: [...draft.tiers, { id: newId(), trigger: "", min: "", max: "" }] })}
            >
              + 구간 추가
            </button>
          </span>
          <span className={styles.note}>예) 발동 10,000 FN → 7,000 ~ 15,000 FN 시그. 후보는 사용 중이고 제외하지 않은 시그니처예요. 후보가 없으면 일반 후원 그대로 나가요.</span>
        </div>

        <div className={prize.field} role="group" aria-label="기여도 방식">
          <span className={styles.muted}>기여도 방식</span>
          <span className={games.rules}>
            {RANDOM_SIG_MODES.map((m) => (
              <button key={m.key} type="button" className={games.rule} aria-pressed={draft.mode === m.key} onClick={() => edit({ mode: m.key })}>
                <strong>{m.label}</strong>
                <span>{m.note}</span>
              </button>
            ))}
          </span>
        </div>
        {draft.mode === "BONUS" && (
          <label className={games.unit}>
            <span className={styles.muted}>기본 배수</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="decimal"
              aria-label="기본 배수"
              step={0.01}
              min={1.01}
              max={RANDOM_SIG_MULTIPLIER_MAX}
              value={draft.multiplier}
              onChange={(e) => edit({ multiplier: e.target.value })}
            />
            <span className={styles.muted}>배 — 뽑힌 시그 가격이 발동 금액 이상일 때 (×2면 발동 후원 점수만큼 더해져요)</span>
          </label>
        )}

        <AutoFields
          name="랜덤시그"
          verb="돌리기"
          copy={{
            auto: "랜덤시그 켜기 — 발동 금액과 같은 일반 후원을 랜덤 시그니처로 보내요",
            excluded: "랜덤으로 나오지 않을 시그니처 (누르면 제외)",
            note: "제외한 시그니처는 구간 금액 안이어도 나오지 않아요. 크루 방송 중이 아니어도 알림은 뽑힌 시그니처로 나가요."
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 랜덤시그는 저장한 설정으로 뽑혀요.</p>}
          <p className={styles.note}>멤버를 고른 발동 금액 후원이 들어오면 기록돼요. 랜덤시그는 수동으로 돌리지 않아요.</p>
          <RunList name="랜덤시그" runs={live.randomSig.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="randomsig" label="랜덤시그" />
    </section>
  );
}
