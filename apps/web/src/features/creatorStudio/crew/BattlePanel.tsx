"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { adjustBattleTime, setBattleDisplay, setBattleRules, startBattle, stopBattle } from "@/services/crew/crewBattle";
import {
  BATTLE_MODES,
  BATTLE_PAIRS_MAX,
  BATTLE_PENALTY_MAX,
  BATTLE_TEAM_NAME_MAX,
  BATTLE_TIME_STEPS,
  BATTLE_TITLE_MAX,
  BATTLE_DISPLAYS,
  MULTI_TEAMS_MAX,
  MULTI_TEAMS_MIN,
  type BattleDisplay,
  MULTI_TEAM_COLORS,
  MULTI_TEAM_KEYS,
  PLATFORM_BATTLE_RULES,
  type Battle,
  type BattleMatch,
  type BattleMode,
  type BattleRules,
  type BroadcastResult,
  type CrewMember
} from "@/services/crew/crewTypes";
import { CopyButton } from "../settings/SettingsCards";
import { shownOverlayAddress } from "./overlayAddress";
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
 * 실시간 배틀 — code-first (no Figma frame), inside `/creator/crew/broadcast` while live. BJ 1:1, A팀 vs B팀 (team mode),
 * 다수 팀 (2 ~ 8 teams named and filled for this battle) or 1:1 여러 쌍 (up to 12 pairs at once, 2026-10-23 — StreamDonate
 * 다수 팀 VS 참고) with a battle timer; scores are the server's points since the start × 배수.
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
  const [mode, setMode] = useState<BattleMode>("MEMBERS");
  const [memberA, setMemberA] = useState("");
  const [memberB, setMemberB] = useState("");
  // 다수 팀: team count, names (blank = "A팀" …) and each member's team index (missing = 없음).
  const [teamCount, setTeamCount] = useState(3);
  const [teamNames, setTeamNames] = useState<string[]>(() => Array(MULTI_TEAMS_MAX).fill(""));
  const [teamOf, setTeamOf] = useState<Record<string, number>>({});
  const [display, setDisplay] = useState<BattleDisplay>("BARS");
  // 1:1 여러 쌍: the pairs being set up ("" = not chosen).
  const [pairSlots, setPairs] = useState<[string, string][]>([["", ""]]);
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

  const teams = Array.from({ length: teamCount }, (_, i) => ({ name: teamNames[i], memberIds: active.filter((m) => teamOf[m.id] === i).map((m) => m.id) }));
  // No more pairs than the active members can fill (a member set to 휴식 since shrinks the list).
  const maxPairs = Math.max(1, Math.min(BATTLE_PAIRS_MAX, Math.floor(active.length / 2)));
  const pairs = pairSlots.slice(0, maxPairs);
  const pairIds = pairs.flat().filter(Boolean);
  const pairsReady = pairs.every(([p, q]) => p && q && p !== q) && new Set(pairIds).size === pairIds.length;

  const start = () => {
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(async () => {
      const res = await startBattle({ broadcastId, requestId, mode, memberA, memberB, teams, pairs, display, durationSec: Math.round(Number(minutes) * 60), title, multiplier: multiplierValue, penalty });
      if (res.status === "SAVED") {
        startId.current = null;
        setTitle("");
      }
      return res;
    }, "배틀을 시작했어요.");
  };
  const ready = { MEMBERS: !!memberA && !!memberB && memberA !== memberB, TEAMS: teamMode, MULTI_TEAMS: teams.every((t) => t.memberIds.length > 0), PAIRS: pairsReady }[mode];
  const canStart = ready && multiplierValue > 0;

  return (
    <section className={styles.card} aria-labelledby="bc-battle">
      <div className={styles.cardHead}>
        <h2 id="bc-battle" className={styles.cardTitle}>
          실시간 배틀
        </h2>
        {current && <span className={battle.timer}>{clock(left)}</span>}
      </div>
      <p className={styles.note}>
        BJ 1:1, A팀 vs B팀(팀 배틀 방송), 다수 팀(2~8팀) 또는 1:1 여러 쌍(최대 12쌍)이 정한 시간 동안 받은 후원 점수 × 배수로 겨뤄요. 보정 점수는 들어가지 않고, 배틀 중 받은 점수는
        메인 점수판에도 배수만큼 들어가요. 진 쪽(다수 팀은 꼴찌 팀, 여러 쌍은 쌍마다 진 BJ)이 벌칙을 해요.
      </p>

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
          {current.mode === "MULTI_TEAMS" && (
            <div className={styles.addRow}>
              <span className={styles.muted}>OBS 표시</span>
              <span className={styles.segment} role="group" aria-label="다수 팀 표시 방식">
                {BATTLE_DISPLAYS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    aria-pressed={current.display === d.key}
                    disabled={pending}
                    onClick={() => run(() => setBattleDisplay({ broadcastId, no: current.no, display: d.key }), `OBS에 ${d.label}로 보여 줘요.`)}
                  >
                    {d.label}
                  </button>
                ))}
              </span>
            </div>
          )}
        </>
      ) : (
        <>
          {last && <BattleBoard battle={last} />}
          <div className={styles.startForm}>
            <span className={styles.segment} role="group" aria-label="배틀 방식">
              {BATTLE_MODES.map((m) => (
                <button key={m.key} type="button" aria-pressed={mode === m.key} disabled={m.key === "TEAMS" && !teamMode} onClick={() => setMode(m.key)}>
                  {m.label}
                </button>
              ))}
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
            {mode === "MULTI_TEAMS" && (
              <div className={battle.setup}>
                <div className={styles.addRow}>
                  <span className={styles.muted}>OBS 표시</span>
                  <span className={styles.segment} role="group" aria-label="다수 팀 표시 방식">
                    {BATTLE_DISPLAYS.map((d) => (
                      <button key={d.key} type="button" aria-pressed={display === d.key} onClick={() => setDisplay(d.key)}>
                        {d.label}
                      </button>
                    ))}
                  </span>
                </div>
                <label className={styles.addRow}>
                  <span className={styles.muted}>팀 수</span>
                  <select className={styles.select} aria-label="팀 수" value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))}>
                    {Array.from({ length: MULTI_TEAMS_MAX - MULTI_TEAMS_MIN + 1 }, (_, i) => i + MULTI_TEAMS_MIN).map((n) => (
                      <option key={n} value={n}>
                        {n}팀
                      </option>
                    ))}
                  </select>
                </label>
                <div className={battle.teamNames}>
                  {teams.map((t, i) => (
                    <input
                      key={i}
                      className={styles.input}
                      style={{ borderLeftColor: MULTI_TEAM_COLORS[i] }}
                      aria-label={`${i + 1}번 팀 이름`}
                      placeholder={`${MULTI_TEAM_KEYS[i]}팀`}
                      maxLength={BATTLE_TEAM_NAME_MAX}
                      value={teamNames[i]}
                      onChange={(e) => setTeamNames(teamNames.map((n, j) => (j === i ? e.target.value : n)))}
                    />
                  ))}
                </div>
                <ul className={styles.teamPick}>
                  {active.map((m) => (
                    <li key={m.id}>
                      <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />
                      <span className={styles.teamName}>{m.name}</span>
                      <select
                        className={styles.select}
                        aria-label={`${m.name} 팀`}
                        value={teamOf[m.id] !== undefined && teamOf[m.id] < teamCount ? teamOf[m.id] : ""}
                        onChange={(e) => setTeamOf((prev) => ({ ...prev, [m.id]: e.target.value === "" ? -1 : Number(e.target.value) }))}
                      >
                        <option value="">없음</option>
                        {teams.map((t, i) => (
                          <option key={i} value={i}>
                            {t.name.trim() || `${MULTI_TEAM_KEYS[i]}팀`}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
                </ul>
                {!ready && <p className={styles.note}>팀마다 멤버를 한 명 이상 배정해 주세요. 한 멤버는 한 팀에만 들어가요.</p>}
              </div>
            )}
            {mode === "PAIRS" && (
              <div className={battle.setup}>
                <label className={styles.addRow}>
                  <span className={styles.muted}>쌍 수</span>
                  <select
                    className={styles.select}
                    aria-label="쌍 수"
                    value={pairs.length}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setPairs(Array.from({ length: n }, (_, i) => pairs[i] ?? ["", ""]));
                    }}
                  >
                    {Array.from({ length: maxPairs }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}쌍
                      </option>
                    ))}
                  </select>
                </label>
                <ol className={battle.pairSetup}>
                  {pairs.map((pair, i) => (
                    <li key={i}>
                      <span className={battle.pairNo}>{i + 1}</span>
                      {pair.map((value, side) => (
                        <span key={side} className={battle.pairPick}>
                          {side === 1 && <span className={styles.muted}>vs</span>}
                          <select
                            className={styles.select}
                            aria-label={`${i + 1}번 쌍 BJ ${side + 1}`}
                            value={value}
                            onChange={(e) => setPairs(pairs.map((p, j) => (j === i ? (side === 0 ? [e.target.value, p[1]] : [p[0], e.target.value]) : p)))}
                          >
                            <option value="">BJ 선택</option>
                            {active.map((m) => (
                              // A BJ already in another slot cannot be picked twice.
                              <option key={m.id} value={m.id} disabled={m.id !== value && pairIds.includes(m.id)}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </span>
                      ))}
                    </li>
                  ))}
                </ol>
                {active.length < 2 && <p className={styles.note}>활동 중인 멤버가 두 명 이상 있어야 해요.</p>}
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
                {x.multiplier !== 1 && ` ×${x.multiplier}`} · {scoreLine(x)} · {resultText(x)}
                {penaltyText(x) && ` · ${penaltyText(x)}`}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className={styles.addRow}>
        <input className={styles.input} value={shownOverlayAddress(origin, overlayPath, "?battle")} readOnly aria-label="배틀 오버레이 주소" onFocus={(e) => e.target.select()} />
        <CopyButton value={overlayUrl} label="복사" className={styles.ghost} />
      </div>
    </section>
  );
}

const labelOf = (m: BattleMatch, key: string) => m.sides.find((s) => s.key === key)!.label;
/** Sides best first (ties keep the set-up order). */
export const ranked = (m: BattleMatch) => [...m.sides].sort((a, b) => b.score - a.score);

/** One match's state: who leads (or won), a tie, or no points yet. 다수 팀 says 공동 1위 for a shared top. */
export function matchResult(running: boolean, m: BattleMatch) {
  const lead = m.leader && m.leader !== "DRAW" ? labelOf(m, m.leader) : null;
  const many = m.sides.length > 2;
  if (running) return lead ? `${lead} 앞서는 중` : m.leader === "DRAW" ? (many ? "공동 선두" : "동점") : "진행 중";
  return lead ? `${lead} 승리` : m.leader === "DRAW" && many ? "공동 1위" : "무승부";
}

export function resultText(x: Battle) {
  if (x.mode === "PAIRS") return `1:1 ${x.matches.length}쌍 ${x.running ? "진행 중" : "종료"}`;
  return matchResult(x.running, x.matches[0]);
}

/** Scores in one line for the battle log. */
function scoreLine(x: Battle) {
  if (x.mode === "PAIRS") return x.matches.map((m) => `${m.sides[0].label} ${formatNumber(m.sides[0].score)} : ${formatNumber(m.sides[1].score)} ${m.sides[1].label}`).join(" / ");
  const [a, b, ...more] = x.matches[0].sides;
  if (!more.length) return `${a.label} ${formatNumber(a.score)} : ${formatNumber(b.score)} ${b.label}`;
  return ranked(x.matches[0])
    .map((s) => `${s.label} ${formatNumber(s.score)}`)
    .join(" · ");
}

/**
 * 벌칙 line: during the battle what is at stake (and who gets it: 다수 팀 the last team, 여러 쌍 each pair's loser), after it
 * who does it. A shared last place or a draw names no one.
 */
export function penaltyText(x: Battle) {
  if (!x.penalty) return null;
  if (x.running) return `${x.mode === "MULTI_TEAMS" ? "꼴찌 팀 " : x.mode === "PAIRS" ? "쌍마다 진 BJ " : ""}벌칙 · ${x.penalty}`;
  const losers = x.matches.flatMap((m) => (m.loser ? [labelOf(m, m.loser)] : []));
  return losers.length ? `${losers.join(" · ")} 벌칙 · ${x.penalty}` : `벌칙 · ${x.penalty}`;
}

/** A battle as the studio shows it: two sides with a tug-of-war gauge, ranked teams, or a list of pairs. */
export function BattleBoard({ battle: x }: { battle: Battle }) {
  return (
    <div className={battle.board}>
      <div className={battle.head}>
        <strong>
          {x.title}
          {x.multiplier !== 1 && <span className={battle.multiplier}>×{x.multiplier}</span>}
        </strong>
        <span className={battle.result} data-ended={x.running ? undefined : ""}>
          {resultText(x)}
        </span>
      </div>
      {x.mode === "PAIRS" ? (
        <ol className={battle.pairs}>
          {x.matches.map((m, i) => (
            <li key={i}>
              <span className={battle.pairNo}>{i + 1}</span>
              <TwoSides match={m} running={x.running} small />
              <span className={battle.pairResult}>{matchResult(x.running, m)}</span>
            </li>
          ))}
        </ol>
      ) : x.matches[0].sides.length > 2 ? (
        <TeamRanks match={x.matches[0]} running={x.running} />
      ) : (
        <TwoSides match={x.matches[0]} running={x.running} />
      )}
      {penaltyText(x) && <p className={battle.penalty}>{penaltyText(x)}</p>}
    </div>
  );
}

function TwoSides({ match: m, running, small = false }: { match: BattleMatch; running: boolean; small?: boolean }) {
  const [a, b] = m.sides;
  const total = Math.max(0, a.score) + Math.max(0, b.score);
  const share = total ? (Math.max(0, a.score) / total) * 100 : 50;
  return (
    <div className={battle.two} data-small={small ? "" : undefined}>
      <div className={battle.sides}>
        {m.sides.map((s) => (
          <span key={s.key} className={battle.side} data-win={!running && m.leader === s.key ? "" : undefined}>
            <span className={battle.name}>
              <span className={styles.dot} style={{ background: s.color }} aria-hidden="true" /> {s.label}
            </span>
            <strong className={battle.score}>{formatNumber(s.score)}</strong>
          </span>
        ))}
      </div>
      <span className={battle.gauge} role="img" aria-label={`${a.label} ${Math.round(share)}% · ${b.label} ${100 - Math.round(share)}%`}>
        <span style={{ width: `${share}%`, background: a.color }} />
        <span style={{ width: `${100 - share}%`, background: b.color }} />
      </span>
    </div>
  );
}

/** 다수 팀: the share of every team in one bar, then the teams best first with their members. */
function TeamRanks({ match: m, running }: { match: BattleMatch; running: boolean }) {
  const total = m.sides.reduce((s, x) => s + Math.max(0, x.score), 0);
  return (
    <>
      <span className={battle.gauge} role="img" aria-label={m.sides.map((s) => `${s.label} ${total ? Math.round((Math.max(0, s.score) / total) * 100) : 0}%`).join(" · ")}>
        {m.sides.map((s) => (
          <span key={s.key} style={{ width: `${total ? (Math.max(0, s.score) / total) * 100 : 100 / m.sides.length}%`, background: s.color }} />
        ))}
      </span>
      <ol className={battle.teams}>
        {ranked(m).map((s, i) => (
          <li key={s.key} data-win={!running && m.leader === s.key ? "" : undefined} data-lose={!running && m.loser === s.key ? "" : undefined}>
            <span className={styles.rankNo}>{i + 1}</span>
            <span className={battle.name}>
              <span className={styles.dot} style={{ background: s.color }} aria-hidden="true" /> {s.label}
              <span className={battle.members}>{s.memberNames.join(" · ")}</span>
            </span>
            <strong className={battle.teamScore}>{formatNumber(s.score)}</strong>
          </li>
        ))}
      </ol>
    </>
  );
}
