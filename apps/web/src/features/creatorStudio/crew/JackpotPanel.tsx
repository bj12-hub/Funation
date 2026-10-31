"use client";

import { useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
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
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const known = new Set(signatures.map((s) => s.id));
  const jackpot = live?.jackpot;
  const [turn, setTurn] = useState("");
  const target = Number(draft.target);
  const range = Number.isInteger(target) && target >= JACKPOT_TARGET_MIN && target <= JACKPOT_TARGET_MAX ? jackpotRange(target) : null;

  return (
    <section id="game-jackpot" className={styles.card} aria-labelledby="game-jackpot-title">
      <h2 id="game-jackpot-title" className={styles.cardTitle}>
        🧧 시그니처 잭팟
      </h2>
      <p className={styles.note}>
        멤버가 받은 시그니처 후원마다 그 후원 점수의 일부가 복주머니(풀)에 쌓이고, 몇 번째 후원인지 세요. 당첨 순번의 후원을 받은 멤버가 풀의 점수를 모두 받고, 풀은 새로 시작해요. 점수만 움직여요 —
        FN · 지갑 · 정산은 바뀌지 않아요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveJackpot({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), "시그니처 잭팟 설정을 저장했어요.");
        }}
      >
        <TitleField name="시그니처 잭팟" placeholder={JACKPOT_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <label className={games.unit}>
          <span className={styles.muted}>적립 비율</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            min={1}
            max={JACKPOT_PERCENT_MAX}
            value={draft.percent}
            onChange={(e) => edit({ percent: e.target.value })}
          />
          <span className={styles.muted}>% — 시그니처 후원 점수의 이만큼이 풀에 쌓여요</span>
        </label>
        <label className={games.unit}>
          <span className={styles.muted}>목표 개수</span>
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
            번째{range ? ` — 당첨 순번은 ${formatNumber(range[0])} ~ ${formatNumber(range[1])}번째 중 랜덤` : ""} (저장하면 진행 중인 풀의 당첨 순번도 다시 뽑아요)
          </span>
        </label>
        <label className={games.unit}>
          <span className={styles.muted}>당첨 문구 표시 시간</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            min={1}
            max={JACKPOT_SHOW_SEC_MAX}
            value={draft.showSec}
            onChange={(e) => edit({ showSec: e.target.value })}
          />
          <span className={styles.muted}>초 (1 ~ {JACKPOT_SHOW_SEC_MAX})</span>
        </label>
        <AutoFields
          name="시그니처 잭팟"
          verb="풀에 넣기"
          copy={{
            auto: "멤버에게 시그니처 후원이 들어오면 자동으로 풀에 넣고 순번 세기",
            excluded: "풀에 넣지 않을 시그니처 (누르면 제외)",
            note: "후원자가 멤버를 고른 시그니처 후원(금액 일치 · 금액범위 · 랜덤시그 포함)마다 한 번이에요. 멤버를 고르지 않은 후원은 쌓이지도, 순번에 세지도 않아요."
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
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 풀은 저장한 설정으로 쌓여요.</p>}
          <div className={prize.window}>
            <span className={styles.muted}>
              이번 풀 {formatNumber(jackpot.count)}번째 · 당첨 순번 {jackpot.turn ? `${formatNumber(jackpot.turn)}번째` : "첫 후원 때 정해요"} · 풀 {formatNumber(jackpot.pool)}점
              {jackpot.startedAt && ` · ${formatKstTime(jackpot.startedAt, { hour: "2-digit", minute: "2-digit" })}부터`}
            </span>
            <button
              type="button"
              className={styles.ghost}
              disabled={pending || (jackpot.count === 0 && jackpot.pool === 0)}
              onClick={() => {
                if (!window.confirm("풀을 비우고 새로 시작할까요? 쌓인 점수는 누구에게도 가지 않아요.")) return;
                run(() => resetJackpot({ broadcastId: live.id }), "풀을 새로 시작했어요.");
              }}
            >
              풀 새로 시작
            </button>
          </div>
          <span className={games.unit} role="group" aria-label="당첨 순번 수기">
            <span className={styles.muted}>당첨 순번 수기</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label="당첨 순번"
              min={jackpot.count + 1}
              max={JACKPOT_TURN_MAX}
              placeholder={jackpot.turn ? String(jackpot.turn) : ""}
              value={turn}
              onChange={(e) => setTurn(e.target.value)}
            />
            <span className={styles.muted}>번째</span>
            <button
              type="button"
              className={styles.ghost}
              disabled={pending || !turn}
              onClick={() =>
                run(async () => {
                  const res = await setJackpotTurnOf({ broadcastId: live.id, turn: Number(turn) });
                  if (res.status === "SAVED") setTurn("");
                  return res;
                }, "당첨 순번을 바꿨어요.")
              }
            >
              수동 설정
            </button>
          </span>
          <p className={styles.note}>당첨 순번은 이 화면에만 보여요. OBS에는 복주머니가 당첨 순번에 가까워질수록 부풀어 올라요.</p>
          {jackpot.wins.length > 0 && (
            <ol className={games.lanes} aria-label="당첨 기록">
              {jackpot.wins.map((w) => (
                <li key={`${w.at}-${w.memberId}`}>
                  <span className={styles.boardName}>
                    {w.color && <span className={styles.dot} style={{ background: w.color }} aria-hidden="true" />}
                    {w.name}
                  </span>
                  <span>+{formatNumber(w.points)}점</span>
                  <span className={styles.muted}>
                    {formatNumber(w.count)}번째 · {formatKstTime(w.at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <RunList name="시그니처 잭팟" runs={jackpot.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="jackpot" label="시그니처 잭팟" />
    </section>
  );
}
