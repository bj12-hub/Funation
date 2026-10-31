"use client";

import { useRef } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { playMedley, saveMedley } from "@/services/crew/crewGames";
import {
  MEDLEY_SIGNATURES_MAX,
  MEDLEY_TITLE_DEFAULT,
  MEDLEY_TRIGGER_PRESETS,
  type GamesView,
  type MedleySettings,
  type RandomSigSettings
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps the 발동 금액 as typed ("" = none). */
type Draft = Omit<MedleySettings, "trigger"> & { trigger: string };
const toDraft = (s: MedleySettings): Draft => ({ ...s, trigger: s.trigger === null ? "" : String(s.trigger) });
const fromDraft = (d: Draft) => ({ ...d, trigger: d.trigger.trim() === "" ? null : Number(d.trigger) });

/**
 * 시그니처 메들리 — code-first (no Figma frame; StreamDonate 메들리 참고), inside `/creator/crew/games`. 발동 금액 and 등록
 * 시그니처: a 일반 후원 of exactly that amount plays one of them as its alert; while live each one also rolls on OBS, and
 * the operator can roll one by hand (no alert, no points).
 */
export function MedleyPanel({
  settings,
  randomSig,
  signatures,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: MedleySettings;
  /** For the warning when 랜덤시그 uses the same 발동 금액. */
  randomSig: RandomSigSettings;
  signatures: GamesView["signatures"];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const name = t("crewGameMedley.name");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const playId = useRef<string | null>(null);
  const known = new Set(signatures.map((s) => s.id));
  const picked = draft.signatureIds;
  const amount = Number(draft.trigger);
  // What would keep the 발동 금액 from firing: a 금액 일치 signature, or 랜덤시그 using it.
  const takenBy = draft.trigger
    ? (signatures.find((s) => s.active && s.match === "AMOUNT" && amount >= (s.rangeMin ?? s.price) && amount <= s.price)?.name ??
      (randomSig.auto && randomSig.tiers.some((tier) => tier.trigger === amount) ? t("crewGameMedley.randomSigTier") : null))
    : null;
  const toggle = (id: string) => edit({ signatureIds: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] });

  const roll = () => {
    if (!live) return;
    playId.current ??= crypto.randomUUID();
    const requestId = playId.current;
    run(async () => {
      const res = await playMedley({ broadcastId: live.id, requestId });
      if (res.status !== "PLAYED") return res;
      playId.current = null;
      return { status: "SAVED" };
    }, t("crewGameMedley.rolled"));
  };

  return (
    <section id="game-medley" className={styles.card} aria-labelledby="game-medley-title">
      <h2 id="game-medley-title" className={styles.cardTitle}>
        🎶 {t("crewGame.nameMedley")}
      </h2>
      <p className={styles.note}>{t("crewGameMedley.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          // A signature deleted since may still be registered: drop it instead of failing the save.
          run(() => saveMedley({ ...next, signatureIds: next.signatureIds.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={MEDLEY_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGame.triggerAmountLabel")}</span>
          <span className={games.unit}>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameMedley.triggerAria")}
              placeholder={t("crewGame.triggerAmountLabel")}
              value={draft.trigger}
              onChange={(e) => edit({ trigger: e.target.value })}
            />
            <span className={styles.muted}>FN</span>
            {MEDLEY_TRIGGER_PRESETS.map((p) => (
              <button key={p} type="button" className={games.pick} aria-pressed={amount === p} onClick={() => edit({ trigger: String(p) })}>
                {formatNumber(p)}
              </button>
            ))}
          </span>
          {takenBy && (
            <span className={styles.error} role="alert">
              {t("crewGameMedley.taken", { name: takenBy })}
            </span>
          )}
        </div>
        <div className={prize.field} role="group" aria-label={t("crewGameMedley.sigsAria")}>
          <span className={styles.muted}>{t("crewGameMedley.sigsLabel", { count: picked.length, max: MEDLEY_SIGNATURES_MAX })}</span>
          <span className={prize.chips}>
            {signatures.length === 0 && <span className={styles.note}>{t("crewGame.noSignatures")}</span>}
            {signatures.map((s) => (
              <button key={s.id} type="button" className={games.pick} aria-pressed={picked.includes(s.id)} disabled={!picked.includes(s.id) && picked.length >= MEDLEY_SIGNATURES_MAX} onClick={() => toggle(s.id)}>
                {s.name}
                {!s.active && <span className={styles.muted}>{t("crewGame.hidden")}</span>}
              </button>
            ))}
          </span>
          <span className={prize.inline}>
            <button type="button" className={styles.ghost} onClick={() => edit({ signatureIds: signatures.filter((s) => s.active).slice(0, MEDLEY_SIGNATURES_MAX).map((s) => s.id) })}>
              {t("crewGameMedley.registerAll")}
            </button>
            <button type="button" className={styles.ghost} disabled={!picked.length} onClick={() => edit({ signatureIds: [] })}>
              {t("crewGameMedley.clearAll")}
            </button>
          </span>
          <span className={styles.note}>{t("crewGameMedley.hiddenNote")}</span>
        </div>
        <AutoFields
          name={name}
          verb={t("crewGame.spin")}
          copy={{ auto: t("crewGameMedley.autoCopy"), excluded: "", note: "" }}
          withExcluded={false}
          auto={draft.auto}
          excluded={[]}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameMedley.unsaved")}</p>}
          <div className={prize.window}>
            <span className={styles.muted}>{t("crewGameMedley.liveNote")}</span>
            <button type="button" className={styles.ghost} disabled={pending || !settings.signatureIds.length} onClick={roll}>
              {t("crewGameMedley.rollOnce")}
            </button>
          </div>
          <RunList name={name} runs={live.medley.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="medley" label={name} />
    </section>
  );
}
