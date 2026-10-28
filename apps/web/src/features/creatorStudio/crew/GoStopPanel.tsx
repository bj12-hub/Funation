"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";
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
        🎴 고스톱
      </h2>
      <p className={styles.note}>
        멤버에게 시그니처 후원이 들어올 때마다 크루 풀에 점수가 쌓이고 GO · STOP을 굴려요. 후원 점수가 클수록 STOP 확률이 높아요. STOP이 나오면 그 멤버가 풀 × 배수를 가져가고 풀은 다시
        시작해요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(
            () => saveGoStop({ ...next, excluded: next.excluded.filter((id) => known.has(id)), excludedMembers: next.excludedMembers.filter((id) => memberIds.has(id)) }),
            "고스톱 설정을 저장했어요."
          );
        }}
      >
        <TitleField name="고스톱" placeholder={GOSTOP_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <label className={games.unit}>
          <span className={styles.muted}>기본 풀</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            aria-label="기본 풀"
            min={0}
            max={GOSTOP_POOL_MAX}
            value={draft.basePool}
            onChange={(e) => edit({ basePool: e.target.value })}
          />
          <span className={styles.muted}>점 — STOP이나 풀 비우기 뒤에 풀이 이 점수부터 다시 쌓여요</span>
        </label>
        <div className={prize.field}>
          <span className={styles.muted}>풀 · STOP</span>
          <span className={games.tierRow}>
            <span className={styles.muted}>적립률</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="numeric"
              aria-label="적립률"
              min={1}
              max={GOSTOP_POOL_PERCENT_MAX}
              value={draft.poolPercent}
              onChange={(e) => edit({ poolPercent: e.target.value })}
            />
            <span className={styles.muted}>% · STOP 1,000점당</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="decimal"
              aria-label="1,000점당 STOP 확률"
              step={0.01}
              min={0.01}
              max={GOSTOP_RATE_MAX}
              value={draft.stopRate}
              onChange={(e) => edit({ stopRate: e.target.value })}
            />
            <span className={styles.muted}>% · 최대</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="numeric"
              aria-label="최대 STOP 확률"
              min={1}
              max={100}
              value={draft.stopMax}
              onChange={(e) => edit({ stopMax: e.target.value })}
            />
            <span className={styles.muted}>% · 배수 ×</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="decimal"
              aria-label="STOP 배수"
              step={0.01}
              min={1}
              max={GOSTOP_MULTIPLIER_MAX}
              value={draft.multiplier}
              onChange={(e) => edit({ multiplier: e.target.value })}
            />
          </span>
          <span className={styles.note}>
            {exampleChance === null
              ? "STOP 확률과 최대를 정해 주세요."
              : `예: ${formatNumber(example)}점 후원이면 풀에 ${formatNumber(Math.round((example * Number(draft.poolPercent || 0)) / 100))}점이 쌓이고 STOP 확률 ${Math.round(exampleChance * 100) / 100}%예요.`}
          </span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>
            색 구간 ({draft.bands.length}/{GOSTOP_BANDS_MAX}) — 풀이 이만큼 쌓이면 이 색으로 보여요
          </span>
          {draft.bands.length > 0 && (
            <ul className={games.tiers}>
              {draft.bands.map((b, i) => (
                <li key={b.id}>
                  <span className={games.tierRow}>
                    <span className={styles.muted}>풀</span>
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={`색 구간 ${i + 1} 최소 풀`}
                      min={0}
                      value={b.min}
                      onChange={(e) => setBand(i, { min: e.target.value })}
                    />
                    <span className={styles.muted}>점부터</span>
                    <input className={games.color} type="color" aria-label={`색 구간 ${i + 1} 색`} value={b.color} onChange={(e) => setBand(i, { color: e.target.value })} />
                    <button type="button" className={styles.ghost} onClick={() => edit({ bands: draft.bands.filter((_, j) => j !== i) })}>
                      삭제
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
              + 색 구간 추가
            </button>
          </span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>제외 BJ (누르면 제외 — 그 멤버에게 온 후원은 풀에 넣지도 굴리지도 않아요)</span>
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
                {!m.active && <span className={styles.muted}>휴식</span>}
              </button>
            ))}
          </span>
        </div>
        <AutoFields
          name="고스톱"
          verb="굴리기"
          copy={{
            auto: "멤버에게 시그니처 후원이 들어오면 자동으로 풀에 넣고 GO · STOP 굴리기",
            excluded: "자동으로 하지 않을 시그니처 (누르면 제외)",
            note: "후원자가 멤버를 고른 시그니처 후원(금액 일치 · 금액범위 · 랜덤시그 포함)마다 한 번, 그 후원 점수로 풀과 STOP 확률을 정해요. 멤버를 고르지 않은 후원은 수동으로 해 주세요."
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
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. GO · STOP은 저장한 설정으로 굴러가요.</p>}
          <div className={prize.window}>
            <span className={styles.muted}>
              지금 풀 {formatNumber(gostop.pool)}점 · {gostop.go} GO
            </span>
            <button type="button" className={styles.ghost} disabled={pending || (gostop.pool === 0 && gostop.go === 0)} onClick={() => run(() => resetGoStop({ broadcastId: live.id }), "풀을 비웠어요.")}>
              풀 비우기
            </button>
            <button type="button" className={styles.ghost} disabled={pending || gostop.wins.length === 0} onClick={() => run(() => resetGoStopRank({ broadcastId: live.id }), "STOP 랭킹을 새로 시작했어요.")}>
              랭킹 리셋
            </button>
          </div>
          <span className={games.unit} role="group" aria-label="풀 수동 조정">
            <span className={styles.muted}>풀 수동 조정</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label="조정 점수"
              placeholder="+50 또는 -10"
              value={adjust.points}
              onChange={(e) => setAdjust({ ...adjust, points: e.target.value, requestId: "" })}
            />
            <span className={styles.muted}>점</span>
            <input
              className={styles.input}
              aria-label="조정 사유"
              placeholder="사유 (선택)"
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
                }, "풀을 조정했어요.");
              }}
            >
              조정
            </button>
          </span>
          {gostop.adjustments.length > 0 && (
            <ul className={games.lanes} aria-label="풀 수동 조정 기록">
              {gostop.adjustments.map((a, i) => (
                <li key={`${a.at}-${i}`}>
                  <span>
                    {a.points > 0 ? "+" : ""}
                    {formatNumber(a.points)}점
                  </span>
                  <span className={styles.muted}>{a.reason || "사유 없음"}</span>
                </li>
              ))}
            </ul>
          )}
          {gostop.rankingSince && <p className={styles.note}>STOP 랭킹은 랭킹 리셋 뒤의 STOP만 세요. 그 전에 받은 점수는 점수판에 그대로 있어요.</p>}
          <ManualPlay game="GOSTOP" name="고스톱" verb="GO · STOP" live={live} members={members} pending={pending} run={run} />
          <p className={styles.note}>수동은 고른 기준 후원의 점수로 풀과 STOP 확률을 정해요. 기준 후원 없이 굴리면 풀은 그대로이고 항상 GO예요.</p>
          {gostop.wins.length > 0 && (
            <ol className={games.lanes} aria-label="STOP 랭킹">
              {goStopRanking(gostop.wins).map((r, i) => (
                <li key={r.memberId}>
                  <span className={styles.boardName}>
                    {i + 1}. {r.color && <span className={styles.dot} style={{ background: r.color }} aria-hidden="true" />}
                    {r.name}
                  </span>
                  <span>{formatNumber(r.points)}점</span>
                  <span className={styles.muted}>
                    STOP {r.count}회 · 최고 풀 {formatNumber(r.best)}점
                  </span>
                </li>
              ))}
            </ol>
          )}
          <RunList name="고스톱" runs={gostop.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="gostop" label="고스톱" />
      <p className={styles.note}>진행 자막 (풀 · GO · 최근 STOP을 한 줄로)</p>
      <OverlayAddress overlayPath={overlayPath} param="gostopticker" label="고스톱 진행 자막" />
    </section>
  );
}
