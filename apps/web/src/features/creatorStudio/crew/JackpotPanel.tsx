"use client";

import { useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { resetJackpot, saveJackpot, setJackpotTurnOf } from "@/services/crew/crewGames";
import {
  JACKPOT_PERCENT_MAX,
  JACKPOT_SHOW_SEC_MAX,
  JACKPOT_TARGET_MAX,
  JACKPOT_TARGET_MIN,
  JACKPOT_TITLE_DEFAULT,
  JACKPOT_TURN_MAX,
  jackpotRange,
  type GamesView,
  type JackpotSettings
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps numbers as typed. */
type Draft = Omit<JackpotSettings, "percent" | "target" | "showSec"> & { percent: string; target: string; showSec: string };
const toDraft = (s: JackpotSettings): Draft => ({ ...s, percent: String(s.percent), target: String(s.target), showSec: String(s.showSec) });
const fromDraft = (d: Draft) => ({ ...d, percent: Number(d.percent), target: Number(d.target), showSec: Number(d.showSec) });

/**
 * 시그니처 잭팟 — code-first (no Figma frame; StreamDonate 시그니처 잭팟 복주머니 모드 참고, as a 점수 풀 — 2026-11-01), inside
 * `/creator/crew/games`. 적립 비율, 목표 개수 (당첨 순번 범위), 당첨 문구 표시 시간, 자동 · 제외 시그; while live the 풀 (순번 ·
 * 당첨 순번 · 점수), 풀 새로 시작, 당첨 순번 수기, the 당첨 기록 and the runs. OBS: `?jackpot`.
 */
export function JackpotPanel({
  settings,
  signatures,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: JackpotSettings;
  signatures: GamesView["signatures"];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const name = t("crewGame.nameJackpot");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const known = new Set(signatures.map((s) => s.id));
  const jackpot = live?.jackpot;
  const [turn, setTurn] = useState("");
  const target = Number(draft.target);
  const range = Number.isInteger(target) && target >= JACKPOT_TARGET_MIN && target <= JACKPOT_TARGET_MAX ? jackpotRange(target) : null;

  return (
    <section id="game-jackpot" className={styles.card} aria-labelledby="game-jackpot-title">
      <h2 id="game-jackpot-title" className={styles.cardTitle}>
        🧧 {name}
      </h2>
      <p className={styles.note}>{t("crewGameJackpot.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveJackpot({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={JACKPOT_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <label className={games.unit}>
          <span className={styles.muted}>{t("crewGameJackpot.percent")}</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            min={1}
            max={JACKPOT_PERCENT_MAX}
            value={draft.percent}
            onChange={(e) => edit({ percent: e.target.value })}
          />
          <span className={styles.muted}>{t("crewGameJackpot.percentNote")}</span>
        </label>
        <label className={games.unit}>
          <span className={styles.muted}>{t("crewGameJackpot.target")}</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            min={JACKPOT_TARGET_MIN}
            max={JACKPOT_TARGET_MAX}
            value={draft.target}
            onChange={(e) => edit({ target: e.target.value })}
          />
          <span className={styles.muted}>
            {range ? t("crewGameJackpot.targetNoteRange", { from: formatNumber(range[0]), to: formatNumber(range[1]) }) : t("crewGameJackpot.targetNote")}
          </span>
        </label>
        <label className={games.unit}>
          <span className={styles.muted}>{t("crewGameJackpot.showSec")}</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            min={1}
            max={JACKPOT_SHOW_SEC_MAX}
            value={draft.showSec}
            onChange={(e) => edit({ showSec: e.target.value })}
          />
          <span className={styles.muted}>{t("crewGameJackpot.showSecNote", { max: JACKPOT_SHOW_SEC_MAX })}</span>
        </label>
        <AutoFields
          name={name}
          verb={t("crewGameJackpot.verb")}
          copy={{
            auto: t("crewGameJackpot.autoCopy"),
            excluded: t("crewGameJackpot.excludedCopy"),
            note: t("crewGameJackpot.noteCopy")
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && jackpot && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameJackpot.unsaved")}</p>}
          <div className={prize.window}>
            <span className={styles.muted}>
              {t("crewGameJackpot.status", {
                count: formatNumber(jackpot.count),
                turn: jackpot.turn ? t("crewGameJackpot.turnNth", { n: formatNumber(jackpot.turn) }) : t("crewGameJackpot.turnLater"),
                pool: formatNumber(jackpot.pool)
              })}
              {jackpot.startedAt && ` · ${t("crewGameJackpot.since", { time: formatKstTime(jackpot.startedAt, { hour: "2-digit", minute: "2-digit" }) })}`}
            </span>
            <button
              type="button"
              className={styles.ghost}
              disabled={pending || (jackpot.count === 0 && jackpot.pool === 0)}
              onClick={() => {
                if (!window.confirm(t("crewGameJackpot.resetConfirm"))) return;
                run(() => resetJackpot({ broadcastId: live.id }), t("crewGameJackpot.resetDone"));
              }}
            >
              {t("crewGameJackpot.reset")}
            </button>
          </div>
          <span className={games.unit} role="group" aria-label={t("crewGameJackpot.turnManual")}>
            <span className={styles.muted}>{t("crewGameJackpot.turnManual")}</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameJackpot.turnAria")}
              min={jackpot.count + 1}
              max={JACKPOT_TURN_MAX}
              placeholder={jackpot.turn ? String(jackpot.turn) : ""}
              value={turn}
              onChange={(e) => setTurn(e.target.value)}
            />
            <span className={styles.muted}>{t("crewGameJackpot.nth")}</span>
            <button
              type="button"
              className={styles.ghost}
              disabled={pending || !turn}
              onClick={() =>
                run(async () => {
                  const res = await setJackpotTurnOf({ broadcastId: live.id, turn: Number(turn) });
                  if (res.status === "SAVED") setTurn("");
                  return res;
                }, t("crewGameJackpot.turnChanged"))
              }
            >
              {t("crewGameJackpot.setManual")}
            </button>
          </span>
          <p className={styles.note}>{t("crewGameJackpot.turnNote")}</p>
          {jackpot.wins.length > 0 && (
            <ol className={games.lanes} aria-label={t("crewGameJackpot.winsAria")}>
              {jackpot.wins.map((w) => (
                <li key={`${w.at}-${w.memberId}`}>
                  <span className={styles.boardName}>
                    {w.color && <span className={styles.dot} style={{ background: w.color }} aria-hidden="true" />}
                    {w.name}
                  </span>
                  <span>+{t("crewGame.points", { n: formatNumber(w.points) })}</span>
                  <span className={styles.muted}>
                    {t("crewGameJackpot.winAt", { n: formatNumber(w.count), time: formatKstTime(w.at, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) })}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <RunList name={name} runs={jackpot.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="jackpot" label={name} />
    </section>
  );
}
