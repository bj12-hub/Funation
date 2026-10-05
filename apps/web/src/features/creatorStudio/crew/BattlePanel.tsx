"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { adjustBattleTime, setBattleRules, startBattle, stopBattle } from "@/services/crew/crewBattle";
import {
  BATTLE_PENALTY_MAX,
  BATTLE_TIME_STEPS,
  BATTLE_TITLE_MAX,
  PLATFORM_BATTLE_RULES,
  type Battle,
  type BattleRules,
  type BroadcastResult,
  type CrewMember
} from "@/services/crew/crewTypes";
import { CopyButton } from "../settings/SettingsCards";
import styles from "./crew.module.css";
import battle from "./battle.module.css";

const PRESETS = [3, 5, 10];
const clock = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
const signedSec = (s: number) => `${s > 0 ? "+" : "−"}${Math.abs(s) >= 60 ? `${Math.abs(s) / 60}분` : `${Math.abs(s)}초`}`;

/** Seconds left, counting down locally between server refreshes (the server decides when it ends). */
export function useCountdown(b: Battle | undefined) {
  const [left, setLeft] = useState(b?.remainingSec ?? 0);
  useEffect(() => {
    if (!b?.running) return setLeft(0);
    const from = Date.now();
    setLeft(b.remainingSec);
    const t = setInterval(() => setLeft(Math.max(0, b.remainingSec - Math.floor((Date.now() - from) / 1000))), 250);
    return () => clearInterval(t);
  }, [b?.running, b?.remainingSec, b?.no]);
  return left;
}

/**
 * 실시간 배틀 — code-first (no Figma frame), inside `/creator/crew/broadcast` while live. BJ 1:1 (or
 * A팀 vs B팀 in team mode) with a battle timer; scores are the server's points since the start × 배수.
 * 배수 · 벌칙 (2026-10-05 결정): the form starts from the channel's defaults (platform: 1배 · 벌칙 없음), the
 * creator can change them per battle and keep them as the channel's defaults.
 */
export function BattlePanel({
  broadcastId,
  teamMode,
  members,
  battles,
  rules,
  overlayPath,
  pending,
  run
}: {
  broadcastId: string;
  teamMode: boolean;
  members: CrewMember[];
  battles: Battle[];
  rules: BattleRules;
  overlayPath: string;
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const active = members.filter((m) => m.active);
  const current = battles.find((x) => x.running);
  const last = battles.at(-1);
  const left = useCountdown(current);
  const [mode, setMode] = useState<"MEMBERS" | "TEAMS">("MEMBERS");
  const [memberA, setMemberA] = useState("");
  const [memberB, setMemberB] = useState("");
  const [minutes, setMinutes] = useState("5");
  const [title, setTitle] = useState("");
  const [multiplier, setMultiplier] = useState(String(rules.multiplier));
  const [penalty, setPenalty] = useState(rules.penalty);
  // A change of the saved defaults (here or in another tab) refills the form.
  useEffect(() => {
    setMultiplier(String(rules.multiplier));
    setPenalty(rules.penalty);
  }, [rules.multiplier, rules.penalty]);
  const multiplierValue = Number(multiplier);
  const isPlatform = rules.multiplier === PLATFORM_BATTLE_RULES.multiplier && rules.penalty === PLATFORM_BATTLE_RULES.penalty;
  const startId = useRef<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const overlayUrl = `${origin}${overlayPath}?battle`;

  const start = () => {
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(async () => {
      const res = await startBattle({ broadcastId, requestId, mode, memberA, memberB, durationSec: Math.round(Number(minutes) * 60), title, multiplier: multiplierValue, penalty });
      if (res.status === "SAVED") {
        startId.current = null;
        setTitle("");
      }
      return res;
    }, "배틀을 시작했어요.");
  };
  const canStart = (mode === "TEAMS" ? teamMode : !!memberA && !!memberB && memberA !== memberB) && multiplierValue > 0;

  return (
    <section className={styles.card} aria-labelledby="bc-battle">
      <div className={styles.cardHead}>
        <h2 id="bc-battle" className={styles.cardTitle}>
          실시간 배틀
        </h2>
        {current && <span className={battle.timer}>{clock(left)}</span>}
      </div>
      <p className={styles.note}>BJ 두 명(팀 배틀 방송이면 A팀 vs B팀)이 정한 시간 동안 받은 후원 점수 × 배수로 겨뤄요. 보정 점수는 들어가지 않고, 배틀 중 받은 점수는 메인 점수판에도 배수만큼 들어가요. 진 쪽이 벌칙을 해요.</p>

      {current ? (
        <>
          <BattleBoard battle={current} />
          <div className={styles.actions}>
            {BATTLE_TIME_STEPS.map((s) => (
              <button
                key={s}
                type="button"
                className={styles.ghost}
                disabled={pending}
                onClick={() => run(() => adjustBattleTime({ broadcastId, no: current.no, deltaSec: s, requestId: crypto.randomUUID() }))}
              >
                {signedSec(s)}
              </button>
            ))}
            <button type="button" className={styles.danger} disabled={pending} onClick={() => run(() => stopBattle({ broadcastId, no: current.no }), "배틀을 끝냈어요.")}>
              지금 끝내기
            </button>
          </div>
        </>
      ) : (
        <>
          {last && <BattleBoard battle={last} />}
          <div className={styles.startForm}>
            <span className={styles.segment} role="group" aria-label="배틀 방식">
              <button type="button" aria-pressed={mode === "MEMBERS"} onClick={() => setMode("MEMBERS")}>
                BJ 1:1
              </button>
              <button type="button" aria-pressed={mode === "TEAMS"} disabled={!teamMode} onClick={() => setMode("TEAMS")}>
                A팀 vs B팀
              </button>
            </span>
            {mode === "MEMBERS" && (
              <div className={styles.addRow}>
                {(
                  [
                    ["BJ 1", memberA, setMemberA],
                    ["BJ 2", memberB, setMemberB]
                  ] as const
                ).map(([label, value, set]) => (
                  <select key={label} className={styles.select} aria-label={label} value={value} onChange={(e) => set(e.target.value)}>
                    <option value="">{label} 선택</option>
                    {active.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            )}
            <div className={styles.addRow}>
              <input className={styles.inputSmall} inputMode="decimal" aria-label="배틀 시간(분)" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} />
              <span className={styles.muted}>분</span>
              {PRESETS.map((p) => (
                <button key={p} type="button" className={styles.ghost} aria-pressed={minutes === String(p)} onClick={() => setMinutes(String(p))}>
                  {p}분
                </button>
              ))}
            </div>
            <div className={styles.addRow}>
              <input
                className={styles.inputSmall}
                inputMode="decimal"
                aria-label="배틀 배수"
                value={multiplier}
                onChange={(e) => setMultiplier(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
              />
              <span className={styles.muted}>배</span>
              <input className={styles.input} value={penalty} onChange={(e) => setPenalty(e.target.value)} placeholder="벌칙 (비우면 벌칙 없음)" maxLength={BATTLE_PENALTY_MAX} aria-label="벌칙" />
            </div>
            <div className={battle.rulesRow}>
              <span className={styles.muted}>
                기본값 ×{rules.multiplier} · 벌칙 {rules.penalty || "없음"}
                {isPlatform ? " (플랫폼 기본값)" : ""}
              </span>
              <button
                type="button"
                className={styles.ghost}
                disabled={pending || !(multiplierValue > 0) || (multiplierValue === rules.multiplier && penalty.trim() === rules.penalty)}
                onClick={() => run(() => setBattleRules({ multiplier: multiplierValue, penalty }), "배수 · 벌칙을 기본값으로 저장했어요.")}
              >
                기본값으로 저장
              </button>
              {!isPlatform && (
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => setBattleRules({ reset: true }), "플랫폼 기본값(1배 · 벌칙 없음)으로 되돌렸어요.")}>
                  플랫폼 기본값으로
                </button>
              )}
            </div>
            <div className={styles.addRow}>
              <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`배틀 이름 (비우면 배틀 ${battles.length + 1})`} maxLength={BATTLE_TITLE_MAX} aria-label="배틀 이름" />
              <button type="button" className={styles.primary} disabled={pending || !canStart || !Number(minutes)} onClick={start}>
                배틀 시작
              </button>
            </div>
          </div>
        </>
      )}

      {battles.length > 1 && (
        <details className={styles.logs}>
          <summary>배틀 기록 {battles.length}건</summary>
          <ul>
            {[...battles].reverse().map((x) => (
              <li key={x.no}>
                {x.title}
                {x.multiplier !== 1 && ` ×${x.multiplier}`} · {x.sides[0].label} {formatNumber(x.sides[0].score)} : {formatNumber(x.sides[1].score)} {x.sides[1].label} · {resultText(x)}
                {penaltyText(x) && ` · ${penaltyText(x)}`}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className={styles.addRow}>
        <input className={styles.input} value={overlayUrl} readOnly aria-label="배틀 오버레이 주소" onFocus={(e) => e.target.select()} />
        <CopyButton value={overlayUrl} label="복사" className={styles.ghost} />
      </div>
    </section>
  );
}

export function resultText(x: Battle) {
  const name = (k: "A" | "B") => x.sides.find((s) => s.key === k)!.label;
  if (x.running) return x.leader === "A" || x.leader === "B" ? `${name(x.leader)} 앞서는 중` : x.leader === "DRAW" ? "동점" : "진행 중";
  return x.leader === "A" || x.leader === "B" ? `${name(x.leader)} 승리` : "무승부";
}

/** 벌칙 line: during the battle what is at stake, after it who does it (a draw names no one). */
export function penaltyText(x: Battle) {
  if (!x.penalty) return null;
  if (x.running || (x.leader !== "A" && x.leader !== "B")) return `벌칙 · ${x.penalty}`;
  const loser = x.sides.find((s) => s.key !== x.leader)!;
  return `${loser.label} 벌칙 · ${x.penalty}`;
}

/** Two sides with a tug-of-war gauge (shared by the studio and the OBS overlay). */
export function BattleBoard({ battle: x, big = false }: { battle: Battle; big?: boolean }) {
  const [a, b] = x.sides;
  const total = Math.max(0, a.score) + Math.max(0, b.score);
  const share = total ? (Math.max(0, a.score) / total) * 100 : 50;
  return (
    <div className={battle.board} data-big={big ? "" : undefined}>
      <div className={battle.head}>
        <strong>
          {x.title}
          {x.multiplier !== 1 && <span className={battle.multiplier}>×{x.multiplier}</span>}
        </strong>
        <span className={battle.result} data-ended={x.running ? undefined : ""}>
          {resultText(x)}
        </span>
      </div>
      <div className={battle.sides}>
        {x.sides.map((s) => (
          <span key={s.key} className={battle.side} data-win={!x.running && x.leader === s.key ? "" : undefined}>
            <span className={battle.name}>
              <span className={styles.dot} style={{ background: s.color }} aria-hidden="true" /> {s.label}
            </span>
            <strong className={battle.score}>{formatNumber(s.score)}</strong>
          </span>
        ))}
      </div>
      {penaltyText(x) && <p className={battle.penalty}>{penaltyText(x)}</p>}
      <span className={battle.gauge} role="img" aria-label={`${a.label} ${Math.round(share)}% · ${b.label} ${100 - Math.round(share)}%`}>
        <span style={{ width: `${share}%`, background: a.color }} />
        <span style={{ width: `${100 - share}%`, background: b.color }} />
      </span>
    </div>
  );
}
