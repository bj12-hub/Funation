"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveSpinMachine } from "@/services/crew/crewGames";
import {
  SPIN_EXAMPLE_ITEMS,
  SPIN_ITEMS_MAX,
  SPIN_KINDS,
  SPIN_LABEL_MAX,
  SPIN_MULTIPLIER_MAX,
  SPIN_TITLE_DEFAULT,
  SPIN_WEIGHT_MAX,
  type CrewMember,
  type GamesView,
  type SpinKind,
  type SpinSettings
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, ManualPlay, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps numbers as typed ("1." while typing 1.5); they are converted when saved. */
type EditItem = { id: string; label: string; kind: SpinKind; value: string; weight: string };
type Draft = Omit<SpinSettings, "items"> & { items: EditItem[] };

const valued = (kind: SpinKind) => kind === "MULTIPLY" || kind === "ADD";
const toDraft = (s: SpinSettings): Draft => ({ ...s, items: s.items.map((i) => ({ ...i, value: valued(i.kind) ? String(i.value) : "", weight: String(i.weight) })) });
const fromDraft = (d: Draft) => ({ ...d, items: d.items.map((i) => ({ ...i, label: i.label.trim(), value: valued(i.kind) ? Number(i.value) : 0, weight: Number(i.weight) })) });
const newId = () => `new-${crypto.randomUUID().slice(0, 8)}`;
const KIND_KEY: Record<SpinKind, MessageKey> = {
  MULTIPLY: "crewGameSpin.kindMultiply",
  ADD: "crewGameSpin.kindAdd",
  TEXT: "crewGameSpin.kindText",
  MISS: "crewGameSpin.kindMiss"
};

/**
 * 스핀머신 — code-first (no Figma frame; StreamDonate 스핀머신 · BJ별 집계 참고), inside `/creator/crew/games`. The reel's
 * items (배수 · 점수 더하기 · 문구 · 꽝 with 가중치), 자동 on 시그니처 후원 (제외 시그니처), and while live a 수동 spin with
 * an optional 기준 후원, the runs (result hidden until the OBS reel stops) and the 문구 tally.
 */
export function SpinMachinePanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: SpinSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const name = t("crewGame.nameSpin");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const setItem = (i: number, patch: Partial<EditItem>) => edit({ items: draft.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const totalWeight = draft.items.reduce((s, i) => s + (Number.isInteger(Number(i.weight)) && Number(i.weight) > 0 ? Number(i.weight) : 0), 0);
  const known = new Set(signatures.map((s) => s.id));
  const tally = live?.spin.tally;

  return (
    <section id="game-spin" className={styles.card} aria-labelledby="game-spin-title">
      <h2 id="game-spin-title" className={styles.cardTitle}>
        🎰 {name}
      </h2>
      <p className={styles.note}>{t("crewGameSpin.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          // A signature deleted since may still be excluded: drop it instead of failing the save.
          const next = fromDraft(draft);
          run(() => saveSpinMachine({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={SPIN_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />

        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameSpin.items", { count: draft.items.length, max: SPIN_ITEMS_MAX })}</span>
          {draft.items.length > 0 && (
            <ul className={games.items}>
              {draft.items.map((item, i) => {
                const weight = Number(item.weight);
                return (
                  <li key={item.id}>
                    <input
                      className={styles.inputSmall}
                      aria-label={t("crewGameSpin.itemNameAria", { n: i + 1 })}
                      placeholder={t("crewGameSpin.namePlaceholder")}
                      maxLength={SPIN_LABEL_MAX}
                      value={item.label}
                      onChange={(e) => setItem(i, { label: e.target.value })}
                    />
                    <select
                      className={styles.select}
                      aria-label={t("crewGameSpin.itemKindAria", { n: i + 1 })}
                      value={item.kind}
                      onChange={(e) => setItem(i, { kind: e.target.value as SpinKind, value: "" })}
                    >
                      {SPIN_KINDS.map((k) => (
                        <option key={k.key} value={k.key}>
                          {t(KIND_KEY[k.key])}
                        </option>
                      ))}
                    </select>
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="decimal"
                      aria-label={t(item.kind === "MULTIPLY" ? "crewGameSpin.itemMultiplierAria" : "crewGameSpin.itemPointsAria", { n: i + 1 })}
                      placeholder={
                        item.kind === "MULTIPLY" ? t("crewGameSpin.multiplierPlaceholder", { max: SPIN_MULTIPLIER_MAX }) : item.kind === "ADD" ? t("crewGameSpin.pointsPlaceholder") : "—"
                      }
                      step={item.kind === "MULTIPLY" ? 0.01 : 1}
                      min={item.kind === "MULTIPLY" ? 1.01 : 1}
                      disabled={!valued(item.kind)}
                      value={item.value}
                      onChange={(e) => setItem(i, { value: e.target.value })}
                    />
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={t("crewGameSpin.weightAria", { n: i + 1 })}
                      placeholder={t("crewGameSpin.weightPlaceholder")}
                      min={1}
                      max={SPIN_WEIGHT_MAX}
                      value={item.weight}
                      onChange={(e) => setItem(i, { weight: e.target.value })}
                    />
                    <span className={styles.muted}>{weight > 0 && totalWeight ? `${Math.round((weight / totalWeight) * 1000) / 10}%` : "-"}</span>
                    <button type="button" className={styles.ghost} onClick={() => edit({ items: draft.items.filter((_, j) => j !== i) })}>
                      {t("crewGame.delete")}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.items.length >= SPIN_ITEMS_MAX}
              onClick={() => edit({ items: [...draft.items, { id: newId(), label: "", kind: "MULTIPLY", value: "", weight: "10" }] })}
            >
              {t("crewGameSpin.addItem")}
            </button>
            {draft.items.length === 0 && (
              <button
                type="button"
                className={styles.ghost}
                onClick={() => edit({ items: SPIN_EXAMPLE_ITEMS.map((x) => ({ ...x, id: newId(), value: valued(x.kind) ? String(x.value) : "", weight: String(x.weight) })) })}
              >
                {t("crewGame.fillExample")}
              </button>
            )}
          </span>
          <span className={styles.note}>{t("crewGameSpin.itemsNote")}</span>
        </div>

        <AutoFields name={name} verb={t("crewGame.spin")} auto={draft.auto} excluded={draft.excluded} showIdle={draft.showIdle} signatures={signatures} onChange={edit} />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameSpin.unsaved")}</p>}
          <ManualPlay game="SPIN" name={name} verb={t("crewGame.spin")} live={live} members={members} disabled={!settings.items.length} pending={pending} run={run} />
          {!settings.items.length && <p className={styles.note}>{t("crewGameSpin.needItems")}</p>}
          <RunList name={name} runs={live.spin.runs} now={now} />
          {tally && tally.rows.length > 0 && (
            <div className={games.tally}>
              <span className={styles.muted}>{t("crewGameSpin.tallyLabel")}</span>
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t("crewGame.member")}</th>
                    {tally.columns.map((c) => (
                      <th key={c} scope="col">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tally.rows.map((r) => (
                    <tr key={r.memberId}>
                      <th scope="row">{r.name}</th>
                      {r.counts.map((n, i) => (
                        <td key={tally.columns[i]} data-zero={n === 0 || undefined}>
                          {n}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="spin" label={name} />
      <OverlayAddress overlayPath={overlayPath} param="spintally" label={t("crewGameSpin.tallyName")} />
    </section>
  );
}
