"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { adjustGoStop, resetGoStop, resetGoStopRank, saveGoStop } from "@/services/crew/crewGames";
import {
  GOSTOP_BANDS_MAX,
  GOSTOP_MULTIPLIER_MAX,
  GOSTOP_POOL_MAX,
  GOSTOP_POOL_PERCENT_MAX,
  GOSTOP_RATE_MAX,
  GOSTOP_REASON_MAX,
  GOSTOP_TITLE_DEFAULT,
  goStopRanking,
  type CrewMember,
  type GamesView,
  type GoStopSettings
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, ManualPlay, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps numbers as typed. */
type EditBand = { id: string; min: string; color: string };
type Draft = Omit<GoStopSettings, "poolPercent" | "basePool" | "stopRate" | "stopMax" | "multiplier" | "bands"> & {
  poolPercent: string;
  basePool: string;
  stopRate: string;
  stopMax: string;
  multiplier: string;
  bands: EditBand[];
};

const toDraft = (s: GoStopSettings): Draft => ({
  ...s,
  poolPercent: String(s.poolPercent),
  basePool: String(s.basePool),
  stopRate: String(s.stopRate),
  stopMax: String(s.stopMax),
  multiplier: String(s.multiplier),
  bands: s.bands.map((b) => ({ id: b.id, min: String(b.min), color: b.color }))
});
const fromDraft = (d: Draft) => ({
  ...d,
  poolPercent: Number(d.poolPercent),
  basePool: Number(d.basePool || 0),
  stopRate: Number(d.stopRate),
  stopMax: Number(d.stopMax),
  multiplier: Number(d.multiplier),
  bands: d.bands.map((b) => ({ id: b.id, min: Number(b.min), color: b.color }))
});
const newId = () => `new-${crypto.randomUUID().slice(0, 8)}`;

/**
 * 고스톱 — code-first (no Figma frame; StreamDonate 고스톱 참고), inside `/creator/crew/games`. 적립률, STOP 확률 (1,000점당 ·
 * 최대), STOP 배수, 색 구간, 제외 BJ, 자동 (제외 시그); while live the 풀, 풀 비우기, a 수동 roll on a 기준 후원, the STOP
 * 랭킹 and the runs. OBS: `?gostop` (the 풀 · results · 랭킹) and `?gostopticker` (진행 자막).
 */
export function GoStopPanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: GoStopSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const name = t("crewGame.nameGoStop");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const setBand = (i: number, patch: Partial<EditBand>) => edit({ bands: draft.bands.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const known = new Set(signatures.map((s) => s.id));
  const memberIds = new Set(members.map((m) => m.id));
  const gostop = live?.gostop;
  // 풀 수동 조정 (2026-10-28): one request id per intended adjustment, so a double click adjusts once.
  const [adjust, setAdjust] = useState({ points: "", reason: "", requestId: "" });
  const rate = Number(draft.stopRate);
  const max = Number(draft.stopMax);
  const example = 10_000;
  const exampleChance = rate > 0 && max > 0 ? Math.min(max, (example / 1000) * rate) : null;

  return (
    <section id="game-gostop" className={styles.card} aria-labelledby="game-gostop-title">
      <h2 id="game-gostop-title" className={styles.cardTitle}>
        🎴 {name}
      </h2>
      <p className={styles.note}>{t("crewGameGoStop.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(
            () => saveGoStop({ ...next, excluded: next.excluded.filter((id) => known.has(id)), excludedMembers: next.excludedMembers.filter((id) => memberIds.has(id)) }),
            t("crewGame.saved", { name })
          );
        }}
      >
        <TitleField name={name} placeholder={GOSTOP_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <label className={games.unit}>
          <span className={styles.muted}>{t("crewGameGoStop.basePool")}</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            aria-label={t("crewGameGoStop.basePool")}
            min={0}
            max={GOSTOP_POOL_MAX}
            value={draft.basePool}
            onChange={(e) => edit({ basePool: e.target.value })}
          />
          <span className={styles.muted}>{t("crewGameGoStop.basePoolNote")}</span>
        </label>
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameGoStop.poolStop")}</span>
          <span className={games.tierRow}>
            <span className={styles.muted}>{t("crewGameGoStop.poolPercent")}</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameGoStop.poolPercent")}
              min={1}
              max={GOSTOP_POOL_PERCENT_MAX}
              value={draft.poolPercent}
              onChange={(e) => edit({ poolPercent: e.target.value })}
            />
            <span className={styles.muted}>{t("crewGameGoStop.perThousand")}</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="decimal"
              aria-label={t("crewGameGoStop.stopRateAria")}
              step={0.01}
              min={0.01}
              max={GOSTOP_RATE_MAX}
              value={draft.stopRate}
              onChange={(e) => edit({ stopRate: e.target.value })}
            />
            <span className={styles.muted}>{t("crewGameGoStop.percentMax")}</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameGoStop.stopMaxAria")}
              min={1}
              max={100}
              value={draft.stopMax}
              onChange={(e) => edit({ stopMax: e.target.value })}
            />
            <span className={styles.muted}>{t("crewGameGoStop.percentTimes")}</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="decimal"
              aria-label={t("crewGameGoStop.multiplierAria")}
              step={0.01}
              min={1}
              max={GOSTOP_MULTIPLIER_MAX}
              value={draft.multiplier}
              onChange={(e) => edit({ multiplier: e.target.value })}
            />
          </span>
          <span className={styles.note}>
            {exampleChance === null
              ? t("crewGameGoStop.needRate")
              : t("crewGameGoStop.example", {
                  amount: formatNumber(example),
                  pool: formatNumber(Math.round((example * Number(draft.poolPercent || 0)) / 100)),
                  chance: Math.round(exampleChance * 100) / 100
                })}
          </span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameGoStop.bands", { count: draft.bands.length, max: GOSTOP_BANDS_MAX })}</span>
          {draft.bands.length > 0 && (
            <ul className={games.tiers}>
              {draft.bands.map((b, i) => (
                <li key={b.id}>
                  <span className={games.tierRow}>
                    <span className={styles.muted}>{t("crewGameGoStop.pool")}</span>
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={t("crewGameGoStop.bandMinAria", { n: i + 1 })}
                      min={0}
                      value={b.min}
                      onChange={(e) => setBand(i, { min: e.target.value })}
                    />
                    <span className={styles.muted}>{t("crewGameGoStop.pointsFrom")}</span>
                    <input className={games.color} type="color" aria-label={t("crewGameGoStop.bandColorAria", { n: i + 1 })} value={b.color} onChange={(e) => setBand(i, { color: e.target.value })} />
                    <button type="button" className={styles.ghost} onClick={() => edit({ bands: draft.bands.filter((_, j) => j !== i) })}>
                      {t("crewGame.delete")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.bands.length >= GOSTOP_BANDS_MAX}
              onClick={() => edit({ bands: [...draft.bands, { id: newId(), min: draft.bands.length ? "" : "0", color: "#22c55e" }] })}
            >
              {t("crewGameGoStop.addBand")}
            </button>
          </span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameGoStop.excludedMembers")}</span>
          <span className={prize.chips}>
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                className={prize.chip}
                aria-pressed={draft.excludedMembers.includes(m.id)}
                onClick={() =>
                  edit({ excludedMembers: draft.excludedMembers.includes(m.id) ? draft.excludedMembers.filter((x) => x !== m.id) : [...draft.excludedMembers, m.id] })
                }
              >
                {m.name}
                {!m.active && <span className={styles.muted}>{t("crewGameGoStop.resting")}</span>}
              </button>
            ))}
          </span>
        </div>
        <AutoFields
          name={name}
          verb={t("crewGame.roll")}
          copy={{
            auto: t("crewGameGoStop.autoCopy"),
            excluded: t("crewGame.excludedDefault"),
            note: t("crewGameGoStop.noteCopy")
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && gostop && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameGoStop.unsaved")}</p>}
          <div className={prize.window}>
            <span className={styles.muted}>{t("crewGameGoStop.poolNow", { pool: formatNumber(gostop.pool), go: gostop.go })}</span>
            <button
              type="button"
              className={styles.ghost}
              disabled={pending || (gostop.pool === 0 && gostop.go === 0)}
              onClick={() => run(() => resetGoStop({ broadcastId: live.id }), t("crewGameGoStop.poolCleared"))}
            >
              {t("crewGameGoStop.clearPool")}
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={pending || gostop.wins.length === 0}
              onClick={() => run(() => resetGoStopRank({ broadcastId: live.id }), t("crewGameGoStop.rankReset"))}
            >
              {t("crewGameGoStop.resetRank")}
            </button>
          </div>
          <span className={games.unit} role="group" aria-label={t("crewGameGoStop.adjustLabel")}>
            <span className={styles.muted}>{t("crewGameGoStop.adjustLabel")}</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameGoStop.adjustPointsAria")}
              placeholder={t("crewGameGoStop.adjustPlaceholder")}
              value={adjust.points}
              onChange={(e) => setAdjust({ ...adjust, points: e.target.value, requestId: "" })}
            />
            <span className={styles.muted}>{t("crewGameGoStop.pointsUnit")}</span>
            <input
              className={styles.input}
              aria-label={t("crewGameGoStop.reasonAria")}
              placeholder={t("crewGameGoStop.reasonPlaceholder")}
              maxLength={GOSTOP_REASON_MAX}
              value={adjust.reason}
              onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
            />
            <button
              type="button"
              className={styles.ghost}
              disabled={pending || !Number(adjust.points)}
              onClick={() => {
                const requestId = adjust.requestId || crypto.randomUUID();
                setAdjust({ ...adjust, requestId });
                run(async () => {
                  const res = await adjustGoStop({ broadcastId: live.id, requestId, points: Number(adjust.points), reason: adjust.reason });
                  if (res.status === "SAVED") setAdjust({ points: "", reason: "", requestId: "" });
                  return res;
                }, t("crewGameGoStop.adjusted"));
              }}
            >
              {t("crewGameGoStop.adjust")}
            </button>
          </span>
          {gostop.adjustments.length > 0 && (
            <ul className={games.lanes} aria-label={t("crewGameGoStop.adjustmentsAria")}>
              {gostop.adjustments.map((a, i) => (
                <li key={`${a.at}-${i}`}>
                  <span>
                    {a.points > 0 ? "+" : ""}
                    {t("crewGame.points", { n: formatNumber(a.points) })}
                  </span>
                  <span className={styles.muted}>{a.reason || t("crewGameGoStop.noReason")}</span>
                </li>
              ))}
            </ul>
          )}
          {gostop.rankingSince && <p className={styles.note}>{t("crewGameGoStop.rankingNote")}</p>}
          <ManualPlay game="GOSTOP" name={name} verb="GO · STOP" live={live} members={members} pending={pending} run={run} />
          <p className={styles.note}>{t("crewGameGoStop.manualNote")}</p>
          {gostop.wins.length > 0 && (
            <ol className={games.lanes} aria-label={t("crewGameGoStop.rankingAria")}>
              {goStopRanking(gostop.wins).map((r, i) => (
                <li key={r.memberId}>
                  <span className={styles.boardName}>
                    {i + 1}. {r.color && <span className={styles.dot} style={{ background: r.color }} aria-hidden="true" />}
                    {r.name}
                  </span>
                  <span>{t("crewGame.points", { n: formatNumber(r.points) })}</span>
                  <span className={styles.muted}>{t("crewGameGoStop.rankStats", { count: r.count, best: formatNumber(r.best) })}</span>
                </li>
              ))}
            </ol>
          )}
          <RunList name={name} runs={gostop.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="gostop" label={name} />
      <p className={styles.note}>{t("crewGameGoStop.tickerNote")}</p>
      <OverlayAddress overlayPath={overlayPath} param="gostopticker" label={t("crewGameGoStop.tickerLabel", { name })} />
      <p className={styles.note}>{t("crewGameGoStop.rankNote")}</p>
      <OverlayAddress overlayPath={overlayPath} param="gostoprank" label={t("crewGameGoStop.rankLabel", { name })} />
    </section>
  );
}
