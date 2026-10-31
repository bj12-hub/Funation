"use client";

import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { deleteRandomSigPreset, saveRandomSig, saveRandomSigPreset } from "@/services/crew/crewGames";
import {
  RANDOM_SIG_DIGIT_MAX,
  RANDOM_SIG_DIGIT_UNITS,
  RANDOM_SIG_MODES,
  RANDOM_SIG_MULTIPLIER_MAX,
  RANDOM_SIG_PRESETS_MAX,
  RANDOM_SIG_PRESET_NAME_MAX,
  RANDOM_SIG_TIERS_MAX,
  RANDOM_SIG_TITLE_DEFAULT,
  digitMultiplier,
  type GamesView,
  type RandomSigMode,
  type RandomSigPreset,
  type RandomSigSettings
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, OverlayAddress, PresetField, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
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
/** `RANDOM_SIG_MODES` and `RANDOM_SIG_DIGIT_UNITS` labels as message keys. */
const MODE_KEY: Record<RandomSigMode, { label: MessageKey; note: MessageKey }> = {
  BONUS: { label: "crewGameRandomSig.modeBonus", note: "crewGameRandomSig.modeBonusNote" },
  REPLACE: { label: "crewGameRandomSig.modeReplace", note: "crewGameRandomSig.modeReplaceNote" }
};
const DIGIT_UNIT_KEY: Record<number, MessageKey> = {
  1_000: "crewGameRandomSig.digit1000",
  10_000: "crewGameRandomSig.digit10000",
  100_000: "crewGameRandomSig.digit100000",
  1_000_000: "crewGameRandomSig.digit1000000"
};

/**
 * 랜덤시그 — code-first (no Figma frame; StreamDonate 랜덤시그 참고), inside `/creator/crew/games`. 발동 구간 (발동 금액 → 시그
 * 금액 범위), 제외 시그, 기여도 방식 (기본 · 랜덤 결과), 기본 배수 or 앞자리 배수, and 설정 프리셋 (saved by name, loaded into the
 * card — 설정 저장 applies them). A 일반 후원 of exactly a 발동 금액 plays a drawn
 * signature as its alert; while live, one sent to a member also records a run. There is no 수동 run.
 */
export function RandomSigPanel({
  settings,
  presets,
  signatures,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: RandomSigSettings;
  presets: RandomSigPreset[];
  signatures: GamesView["signatures"];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const name = t("crewGame.nameRandomSig");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  // 불러오기 fills the card (켜짐 · 제목 · 대기 화면 stay); 설정 저장 applies it. A deleted signature drops out of 제외.
  const load = (p: RandomSigPreset) => {
    const d = toDraft({ ...settings, ...p.settings });
    edit({ tiers: d.tiers, mode: d.mode, multiplier: d.multiplier, digit: d.digit, digitUnit: d.digitUnit, excluded: d.excluded.filter((id) => known.has(id)) });
  };
  const modeLabel = (p: RandomSigPreset) =>
    p.settings.mode === "REPLACE"
      ? t("crewGameRandomSig.modeReplace")
      : p.settings.digit
        ? t("crewGameRandomSig.modeBonusDigit")
        : t("crewGameRandomSig.modeBonusTimes", { multiplier: p.settings.multiplier });
  const known = new Set(signatures.map((s) => s.id));
  const setTier = (i: number, patch: Partial<EditTier>) => edit({ tiers: draft.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  // What a tier would draw from, and a 금액 일치 signature that takes its 발동 금액 first.
  const candidates = (t: EditTier) => signatures.filter((s) => s.active && !draft.excluded.includes(s.id) && s.price >= Number(t.min) && s.price <= Number(t.max)).length;
  // 앞자리 배수 (기본 모드): the 배수 a tier's cheapest and dearest signature would get.
  const digitOn = draft.mode === "BONUS" && draft.digit;
  const digitUnit = RANDOM_SIG_DIGIT_UNITS.find((u) => u.unit === draft.digitUnit);
  const digitLabel = digitUnit ? (DIGIT_UNIT_KEY[digitUnit.unit] ? t(DIGIT_UNIT_KEY[digitUnit.unit]) : digitUnit.label) : "";
  const digitSpan = (tier: EditTier) => {
    const [lo, hi] = [digitMultiplier(Number(tier.min), draft.digitUnit), digitMultiplier(Number(tier.max), draft.digitUnit)];
    return tier.min && tier.max && lo >= 1 && hi >= lo
      ? ` · ${hi > lo ? t("crewGameRandomSig.digitSpanRange", { lo, hi }) : t("crewGameRandomSig.digitSpan", { lo })}`
      : "";
  };
  const takenBy = (t: EditTier) => signatures.find((s) => s.active && s.match === "AMOUNT" && Number(t.trigger) >= (s.rangeMin ?? s.price) && Number(t.trigger) <= s.price);

  return (
    <section id="game-randomsig" className={styles.card} aria-labelledby="game-randomsig-title">
      <h2 id="game-randomsig-title" className={styles.cardTitle}>
        🔀 {name}
      </h2>
      <p className={styles.note}>{t("crewGameRandomSig.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveRandomSig({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={RANDOM_SIG_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />

        <PresetField
          game={name}
          presets={presets}
          max={RANDOM_SIG_PRESETS_MAX}
          nameMax={RANDOM_SIG_PRESET_NAME_MAX}
          summary={(p) =>
            `${t("crewGame.tierCount", { n: p.settings.tiers.length })} · ${modeLabel(p)}${p.settings.excluded.length > 0 ? ` · ${t("crewGame.excludedCount", { n: p.settings.excluded.length })}` : ""}`
          }
          note={t("crewGameRandomSig.presetNote")}
          dirty={dirty}
          pending={pending}
          onLoad={load}
          onDelete={(p) => run(() => deleteRandomSigPreset({ id: p.id }), t("crewGame.presetDeleted", { name: p.name }))}
          onSave={(presetName) => {
            const next = fromDraft(draft);
            run(
              () => saveRandomSigPreset({ name: presetName, settings: { ...next, excluded: next.excluded.filter((id) => known.has(id)) } }),
              t("crewGame.presetSaved", { name: presetName })
            );
          }}
        />

        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameRandomSig.tiers", { count: draft.tiers.length, max: RANDOM_SIG_TIERS_MAX })}</span>
          {draft.tiers.length > 0 && (
            <ul className={games.tiers}>
              {draft.tiers.map((tier, i) => {
                const taken = tier.trigger ? takenBy(tier) : undefined;
                return (
                  <li key={tier.id}>
                    <span className={games.tierRow}>
                      <span className={styles.muted}>{t("crewGameRandomSig.trigger")}</span>
                      <input
                        className={styles.inputSmall}
                        type="number"
                        inputMode="numeric"
                        aria-label={t("crewGameRandomSig.triggerAria", { n: i + 1 })}
                        placeholder={t("crewGame.triggerAmountLabel")}
                        value={tier.trigger}
                        onChange={(e) => setTier(i, { trigger: e.target.value })}
                      />
                      <span className={styles.muted}>{t("crewGameRandomSig.fnToSig")}</span>
                      <input
                        className={styles.inputSmall}
                        type="number"
                        inputMode="numeric"
                        aria-label={t("crewGameRandomSig.sigMinAria", { n: i + 1 })}
                        placeholder={t("crewGame.min")}
                        value={tier.min}
                        onChange={(e) => setTier(i, { min: e.target.value })}
                      />
                      <span className={styles.muted}>~</span>
                      <input
                        className={styles.inputSmall}
                        type="number"
                        inputMode="numeric"
                        aria-label={t("crewGameRandomSig.sigMaxAria", { n: i + 1 })}
                        placeholder={t("crewGame.max")}
                        value={tier.max}
                        onChange={(e) => setTier(i, { max: e.target.value })}
                      />
                      <span className={styles.muted}>
                        {t("crewGameRandomSig.candidates", { n: candidates(tier) })}
                        {digitOn && digitSpan(tier)}
                      </span>
                      <button type="button" className={styles.ghost} onClick={() => edit({ tiers: draft.tiers.filter((_, j) => j !== i) })}>
                        {t("crewGame.delete")}
                      </button>
                    </span>
                    {taken && (
                      <span className={styles.error} role="alert">
                        {t("crewGameRandomSig.taken", { name: taken.name })}
                      </span>
                    )}
                    {digitOn && tier.min !== "" && Number(tier.min) < draft.digitUnit && (
                      <span className={styles.error} role="alert">
                        {t("crewGameRandomSig.digitMinError", { min: formatNumber(draft.digitUnit) })}
                      </span>
                    )}
                    {digitOn && digitMultiplier(Number(tier.max), draft.digitUnit) > RANDOM_SIG_DIGIT_MAX && (
                      <span className={styles.error} role="alert">
                        {t("crewGameRandomSig.digitMaxError", { max: RANDOM_SIG_DIGIT_MAX })}
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
              {t("crewGame.addTier")}
            </button>
          </span>
          <span className={styles.note}>{t("crewGameRandomSig.tiersNote")}</span>
        </div>

        <div className={prize.field} role="group" aria-label={t("crewGameRandomSig.mode")}>
          <span className={styles.muted}>{t("crewGameRandomSig.mode")}</span>
          <span className={games.rules}>
            {RANDOM_SIG_MODES.map((m) => (
              <button key={m.key} type="button" className={games.rule} aria-pressed={draft.mode === m.key} onClick={() => edit({ mode: m.key })}>
                <strong>{t(MODE_KEY[m.key].label)}</strong>
                <span>{t(MODE_KEY[m.key].note)}</span>
              </button>
            ))}
          </span>
        </div>
        {draft.mode === "BONUS" && (
          <div className={prize.field} role="group" aria-label={t("crewGameRandomSig.digit")}>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.digit} onChange={(e) => edit({ digit: e.target.checked })} />
              {t("crewGameRandomSig.digitCheck")}
            </label>
            {draft.digit && (
              <>
                <label className={games.unit}>
                  <select className={styles.select} aria-label={t("crewGameRandomSig.digitUnitAria")} value={draft.digitUnit} onChange={(e) => edit({ digitUnit: Number(e.target.value) })}>
                    {RANDOM_SIG_DIGIT_UNITS.map((u) => (
                      <option key={u.unit} value={u.unit}>
                        {DIGIT_UNIT_KEY[u.unit] ? t(DIGIT_UNIT_KEY[u.unit]) : u.label} ({formatNumber(u.unit)} FN)
                      </option>
                    ))}
                  </select>
                  <span className={styles.muted}>{t("crewGameRandomSig.perUnit")}</span>
                </label>
                <span className={styles.note}>
                  {t("crewGameRandomSig.digitNote", {
                    unit: digitLabel,
                    from: formatNumber(draft.digitUnit * 2),
                    to: formatNumber(draft.digitUnit * 3 - 1),
                    next: formatNumber(draft.digitUnit * 3),
                    min: formatNumber(draft.digitUnit),
                    max: RANDOM_SIG_DIGIT_MAX
                  })}
                </span>
              </>
            )}
          </div>
        )}
        {draft.mode === "BONUS" && !draft.digit && (
          <label className={games.unit}>
            <span className={styles.muted}>{t("crewGameRandomSig.baseMultiplier")}</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="decimal"
              aria-label={t("crewGameRandomSig.baseMultiplier")}
              step={0.01}
              min={1.01}
              max={RANDOM_SIG_MULTIPLIER_MAX}
              value={draft.multiplier}
              onChange={(e) => edit({ multiplier: e.target.value })}
            />
            <span className={styles.muted}>{t("crewGameRandomSig.baseMultiplierNote")}</span>
          </label>
        )}

        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.alertRoll} onChange={(e) => edit({ alertRoll: e.target.checked })} />
          {t("crewGameRandomSig.alertRoll")}
        </label>

        <AutoFields
          name={name}
          verb={t("crewGame.spin")}
          copy={{
            auto: t("crewGameRandomSig.autoCopy"),
            excluded: t("crewGameRandomSig.excludedCopy"),
            note: t("crewGameRandomSig.noteCopy")
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
          {dirty && <p className={styles.note}>{t("crewGameRandomSig.unsaved")}</p>}
          <p className={styles.note}>{t("crewGameRandomSig.liveNote")}</p>
          <RunList name={name} runs={live.randomSig.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="randomsig" label={name} />
    </section>
  );
}
