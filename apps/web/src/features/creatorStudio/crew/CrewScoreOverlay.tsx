"use client";

import { useRouter } from "next/navigation";
import { useEffect, type CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { useServerClock } from "@/hooks/useServerClock";
import { formatNumber } from "@/lib/format";
import type { ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import {
  OVERLAY_BOARD_ROWS,
  PRIZE_TITLE_DEFAULT,
  SIG_COUNT_TITLE_DEFAULT,
  TEAM_PRIZE_TITLE_DEFAULT,
  type Battle,
  type BattleMatch,
  type OverlayScenario,
  type OverlayScoreboard,
  type PrizeBoardLive,
  type SigCountLive,
  type StealRecord,
  type SubBoard,
  type TeamPrizeLive
} from "@/services/crew/crewTypes";
import { penaltyText, ranked, resultText, useCountdown } from "./BattlePanel";
import { partName, usePartElapsed } from "./ScenarioPanel";
import { stealText } from "./StealPanel";
import { useReloadSignal } from "../remote/useReloadSignal";
import styles from "./overlay.module.css";

/**
 * OBS overlay (code-first). Transparent page that re-reads the live scoreboard from the server every
 * 3 seconds. Shows nothing while no broadcast is running. Every crew view draws in the 크루 점수판 오버레이 테마
 * (2026-10-08), chosen on the 방송 운영 screen.
 */
export function CrewScoreOverlay({ data, reloadSeq, theme }: { data: OverlayScoreboard | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);

  if (!data) return null;
  return <MainBoard data={data} theme={theme} />;
}

/** Transparent page + 3-second server refresh + 기능별 새로고침, shared by every crew overlay. */
export function useOverlayPage(reloadSeq: number) {
  const router = useRouter();
  useReloadSignal(reloadSeq);
  useEffect(() => {
    // OBS keys out transparent pixels, so both <html> and <body> must drop the page background.
    const root = document.documentElement;
    const prev = [root.style.background, document.body.style.background];
    root.style.background = "transparent";
    document.body.style.background = "transparent";
    const poll = setInterval(() => router.refresh(), 3000);
    return () => {
      clearInterval(poll);
      [root.style.background, document.body.style.background] = prev;
    };
  }, [router]);
}

/** Member rows: rank badge (1 · 2 · 3 medals), name, a bar in the member's color, score. */
function Rows({ rows }: { rows: { memberId: string; name: string; score: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(0, r.score)));
  return (
    <ol className={styles.rows}>
      {rows.slice(0, OVERLAY_BOARD_ROWS).map((r, i) => (
        <li key={r.memberId} data-rank={i < 3 ? i + 1 : undefined}>
          <span className={`${ov.display} ${styles.rank}`}>{i + 1}</span>
          <span className={`${ov.label} ${styles.name}`}>{r.name}</span>
          <span className={`${ov.track} ${styles.bar}`}>
            <span className={ov.fill} style={{ width: `${(Math.max(0, r.score) / max) * 100}%`, "--ov-accent": r.color } as CSSProperties} />
          </span>
          <span className={`${ov.display} ${styles.score}`}>{formatNumber(r.score)}</span>
        </li>
      ))}
    </ol>
  );
}

function MainBoard({ data, theme }: { data: OverlayScoreboard; theme: ResolvedTheme }) {
  return (
    <OverlayThemeRoot theme={theme} className={styles.pad}>
      <div className={`${ov.card} ${styles.board}`}>
        <h1 className={`${ov.label} ${styles.title}`}>{data.title}</h1>
        {data.oneshotPot !== null && <p className={`${ov.chip} ${ov.chipAccent} ${styles.banner}`}>한방 모으는 중 · {formatNumber(data.oneshotPot)}점</p>}
        {data.showRankUp && data.rankUp && (
          <p className={`${ov.chip} ${styles.banner}`}>
            🔥 랭크업 · {data.rankUp.lower.name} → {data.rankUp.upper.name} {data.rankUp.gap === 0 ? "동점!" : `${formatNumber(data.rankUp.gap)}점 차`}
          </p>
        )}
        {data.teamMode && (
          <div className={styles.teams}>
            {data.teams.map((t) => (
              <span key={t.key} data-team={t.key} className={ov.label}>
                {t.key}팀 <b className={ov.display}>{formatNumber(t.score)}</b>
              </span>
            ))}
          </div>
        )}
        <Rows rows={data.rows} />
      </div>
    </OverlayThemeRoot>
  );
}

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * 실시간 배틀 overlay (`?battle`): the running battle (or the last result) with its timer — a tug of war for two sides,
 * ranked bars for 다수 팀, a grid of small tugs for 1:1 여러 쌍 (as many columns as the source is wide).
 */
export function BattleOverlay({ battle: x, reloadSeq, theme }: { battle: Battle | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const left = useCountdown(x ?? undefined);
  if (!x) return null;
  const penalty = penaltyText(x);
  const many = x.matches[0].sides.length > 2;
  return (
    <OverlayThemeRoot theme={theme} className={styles.pad}>
      <div className={`${ov.card} ${styles.battle}`} data-wide={x.mode === "PAIRS" && x.matches.length > 1 ? "" : undefined}>
        <div className={styles.battleHead}>
          <span className={`${ov.chip} ${ov.chipAccent}`}>
            {x.title}
            {x.multiplier !== 1 && ` ×${x.multiplier}`}
          </span>
          {x.running ? <span className={`${ov.chip} ${ov.display} ${styles.timer}`}>{mmss(left)}</span> : <span className={ov.chip}>{resultText(x)}</span>}
        </div>
        {x.mode === "PAIRS" ? (
          <ol className={styles.pairGrid}>
            {x.matches.map((m, i) => (
              <li key={i}>
                <Tug match={m} running={x.running} small />
              </li>
            ))}
          </ol>
        ) : many ? (
          <TeamBars match={x.matches[0]} running={x.running} />
        ) : (
          <Tug match={x.matches[0]} running={x.running} />
        )}
        {x.running && x.mode !== "PAIRS" && <span className={ov.muted}>{resultText(x)}</span>}
        {penalty && <p className={`${ov.chip} ${styles.penalty}`}>{penalty}</p>}
      </div>
    </OverlayThemeRoot>
  );
}

/** Two sides and the tug-of-war bar between them. */
function Tug({ match: m, running, small = false }: { match: BattleMatch; running: boolean; small?: boolean }) {
  const [a, b] = m.sides;
  const total = Math.max(0, a.score) + Math.max(0, b.score);
  const share = total ? (Math.max(0, a.score) / total) * 100 : 50;
  return (
    <div className={styles.tugBox} data-small={small ? "" : undefined}>
      <div className={styles.sides}>
        {m.sides.map((s) => (
          <span key={s.key} className={styles.side} data-win={!running && m.leader === s.key ? "" : undefined}>
            <span className={ov.label}>
              <i className={styles.dot} style={{ background: s.color }} aria-hidden="true" /> {s.label}
            </span>
            <strong className={`${ov.display} ${styles.sideScore}`}>{formatNumber(s.score)}</strong>
          </span>
        ))}
      </div>
      <span className={`${ov.track} ${styles.tug}`} role="img" aria-label={`${a.label} ${Math.round(share)}% · ${b.label} ${100 - Math.round(share)}%`}>
        <span style={{ width: `${share}%`, background: a.color }} />
        <span style={{ width: `${100 - share}%`, background: b.color }} />
      </span>
    </div>
  );
}

/** 다수 팀: every team best first, its bar against the leader, and its members under the name. */
function TeamBars({ match: m, running }: { match: BattleMatch; running: boolean }) {
  const max = Math.max(1, ...m.sides.map((s) => Math.max(0, s.score)));
  return (
    <ol className={styles.teamBars}>
      {ranked(m).map((s, i) => (
        <li key={s.key} data-win={!running && m.leader === s.key ? "" : undefined}>
          <span className={`${ov.display} ${styles.rank}`}>{i + 1}</span>
          <span className={styles.teamLabel}>
            <span className={`${ov.label} ${styles.name}`}>
              <i className={styles.dot} style={{ background: s.color }} aria-hidden="true" /> {s.label}
            </span>
            <span className={`${ov.muted} ${styles.teamMembers}`}>{s.memberNames.join(" · ")}</span>
          </span>
          <span className={`${ov.track} ${styles.bar}`}>
            <span className={ov.fill} style={{ width: `${(Math.max(0, s.score) / max) * 100}%`, "--ov-accent": s.color } as CSSProperties} />
          </span>
          <span className={`${ov.display} ${styles.score}`}>{formatNumber(s.score)}</span>
        </li>
      ))}
    </ol>
  );
}

/** 콘텐츠 시나리오 overlay (`?scenario`): the running part, its time and what comes next. */
export function ScenarioOverlay({ scenario, serverNow, reloadSeq, theme }: { scenario: OverlayScenario | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const elapsed = usePartElapsed(scenario, serverNow);
  if (!scenario || scenario.current === null) return null;
  const i = scenario.current;
  const part = scenario.parts[i];
  const next = scenario.parts[i + 1];
  const over = elapsed !== null && !!part.minutes && elapsed > part.minutes * 60;
  return (
    <OverlayThemeRoot theme={theme} className={styles.pad}>
      <div className={`${theme.theme === "BOLD" ? ov.accentCard : ov.card} ${ov.pill} ${styles.scenario}`}>
        <span className={`${ov.chip} ${styles.partNo}`}>{i + 1}부</span>
        <strong className={ov.label}>{part.title || partName(i, part)}</strong>
        {elapsed !== null && (
          <span className={`${ov.display} ${styles.elapsed}`} data-over={over || undefined}>
            {mmss(elapsed)}
            {part.minutes ? <small> / {part.minutes}분</small> : null}
          </span>
        )}
        {next && <span className={`${ov.muted} ${styles.next}`}>다음 · {partName(i + 1, next)}</span>}
      </div>
    </OverlayThemeRoot>
  );
}

const STEAL_SHOW_MS = 15_000;

/**
 * 기여도 강탈 overlay (`?steal`): the latest spin for 15 seconds, then nothing until the next one. Timed on the server
 * clock (`at` is server time; the OBS PC's clock may be off).
 */
export function StealOverlay({ latest, serverNow, reloadSeq, theme }: { latest: StealRecord | null; serverNow: string | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  const now = useServerClock(serverNow);
  if (!latest || now === null || now - new Date(latest.at).getTime() > STEAL_SHOW_MS) return null;
  const hit = latest.points > 0;
  return (
    <OverlayThemeRoot theme={theme} className={styles.pad}>
      <div key={latest.id} className={`${ov.enter} ${ov.card} ${styles.steal}`} data-motion="ZOOM" role="status">
        <span className={`${ov.chip} ${ov.chipAccent}`}>기여도 강탈 · {latest.slotLabel}</span>
        <strong className={`${ov.display} ${styles.stealMain} ${hit ? "" : styles.stealBlank}`}>
          {hit ? `${latest.thiefName} ← ${latest.targetName} ${formatNumber(latest.points)}점` : "꽝!"}
        </strong>
        <span className={ov.muted}>{stealText(latest)}</span>
      </div>
    </OverlayThemeRoot>
  );
}

/**
 * 상품 순위표 overlay (`?prize`): every listed member with the rank's 상품 · 벌칙 line, in 1 ~ 3 columns read top to
 * bottom. Shown only while 방송 운영 has OBS에 표시 on, and on the 구간 basis once 시작 was pressed (마감 after 정지).
 */
export function PrizeBoardOverlay({ board, reloadSeq, theme }: { board: PrizeBoardLive | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  if (!board || !board.visible || (board.settings.basis === "WINDOW" && !board.window)) return null;
  const s = board.settings;
  return (
    <OverlayThemeRoot theme={theme} className={styles.pad}>
      <div className={`${ov.card} ${styles.board} ${styles.prize}`} data-placement={s.placement} data-cols={s.columns}>
        <h1 className={`${ov.label} ${styles.title}`}>
          {s.title || PRIZE_TITLE_DEFAULT}
          {board.window?.stoppedAt && <span className={`${ov.chip} ${styles.closed}`}>마감</span>}
        </h1>
        <ol className={styles.prizeRows} style={{ "--prize-rows": Math.ceil(board.rows.length / s.columns) } as CSSProperties}>
          {board.rows.map((r) => (
            <li key={r.memberId} data-rank={r.rank !== null && r.rank <= 3 ? r.rank : undefined} data-noscore={s.showScore ? undefined : ""}>
              <span className={`${ov.display} ${styles.rank}`}>{r.rank ?? "★"}</span>
              <span className={`${ov.label} ${styles.name}`}>
                <i className={styles.dot} style={{ background: r.color }} aria-hidden="true" /> {r.name}
              </span>
              <span className={styles.prizeText} style={r.prize?.color ? { color: r.prize.color } : undefined}>
                {r.prize?.text}
              </span>
              {s.showScore && <span className={`${ov.display} ${styles.score}`}>{formatNumber(r.score)}</span>}
            </li>
          ))}
        </ol>
        {s.showTotal && (
          <p className={`${ov.muted} ${styles.prizeTotal}`}>
            합계 <b className={ov.display}>{formatNumber(board.total)}</b>
          </p>
        )}
      </div>
    </OverlayThemeRoot>
  );
}

/**
 * 팀 순위표 overlay (`?teamprize`): every team with the rank's 상품 · 벌칙 line and (팀원 점수순) its members under it, in
 * 1 ~ 3 columns read top to bottom. Shown only while 방송 운영 has OBS에 표시 on and the source gives teams, and on the
 * 구간 basis once 시작 was pressed (마감 after 정지).
 */
export function TeamPrizeOverlay({ board, reloadSeq, theme }: { board: TeamPrizeLive | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  if (!board || !board.visible || !board.rows.length || (board.settings.basis === "WINDOW" && !board.window)) return null;
  const s = board.settings;
  return (
    <OverlayThemeRoot theme={theme} className={styles.pad}>
      <div className={`${ov.card} ${styles.board} ${styles.prize}`} data-placement={s.placement} data-cols={s.columns}>
        <h1 className={`${ov.label} ${styles.title}`}>
          {s.title || TEAM_PRIZE_TITLE_DEFAULT}
          {board.window?.stoppedAt && <span className={`${ov.chip} ${styles.closed}`}>마감</span>}
        </h1>
        <ol className={styles.prizeRows} style={{ "--prize-rows": Math.ceil(board.rows.length / s.columns) } as CSSProperties}>
          {board.rows.map((r) => (
            <li key={r.key} data-rank={r.rank <= 3 ? r.rank : undefined} data-noscore={s.showScore ? undefined : ""}>
              <span className={`${ov.display} ${styles.rank}`}>{r.rank}</span>
              <span className={`${ov.label} ${styles.name}`}>
                <i className={styles.dot} style={{ background: r.color }} aria-hidden="true" /> {r.name}
              </span>
              <span className={styles.prizeText} style={r.prize?.color ? { color: r.prize.color } : undefined}>
                {r.prize?.text}
              </span>
              {s.showScore && <span className={`${ov.display} ${styles.score}`}>{formatNumber(r.score)}</span>}
              {s.members === "SCORE" && r.members.length > 0 && (
                <span className={`${ov.muted} ${styles.teamMembers}`}>
                  {r.members.map((m) => (
                    <span key={m.memberId}>
                      {m.name}
                      {s.showScore && <b className={ov.display}> {formatNumber(m.score)}</b>}
                    </span>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ol>
        {s.showTotal && (
          <p className={`${ov.muted} ${styles.prizeTotal}`}>
            합계 <b className={ov.display}>{formatNumber(board.total)}</b>
          </p>
        )}
      </div>
    </OverlayThemeRoot>
  );
}

/**
 * 시그 카운트 overlay (`?sigcount`): members × the chosen signatures, with each member's 합계 and (optionally) the
 * 하단 합계 row. Shown only while 방송 운영 has OBS에 표시 on and at least one signature is counted.
 */
export function SigCountOverlay({ table, reloadSeq, theme }: { table: SigCountLive | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  if (!table || !table.visible || table.columns.length === 0) return null;
  const s = table.settings;
  const count = (n: number) => <span className={n === 0 ? styles.sigZero : ov.display}>{formatNumber(n)}</span>;
  return (
    <OverlayThemeRoot theme={theme} className={styles.pad}>
      <div className={`${ov.card} ${styles.board} ${styles.sigCount}`}>
        <h1 className={`${ov.label} ${styles.title}`}>{s.title || SIG_COUNT_TITLE_DEFAULT}</h1>
        <table className={styles.sigTable}>
          <thead>
            <tr>
              <th scope="col" aria-label="멤버" />
              {table.columns.map((c) => (
                <th key={c.id} scope="col">
                  <span className={styles.sigHead}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- signature images are uploaded files (data URLs in the mock) */}
                    {c.imageUrl && <img src={c.imageUrl} alt="" />}
                    <span className={ov.muted}>{c.name}</span>
                  </span>
                </th>
              ))}
              {table.columns.length > 1 && (
                <th scope="col">
                  <span className={`${ov.muted} ${styles.sigHead}`}>합계</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {table.rows.length === 0 && (
              <tr>
                <td colSpan={table.columns.length + 2} className={ov.muted}>
                  아직 받은 시그니처가 없어요
                </td>
              </tr>
            )}
            {table.rows.map((r) => (
              <tr key={r.memberId ?? "none"}>
                <th scope="row" className={`${ov.label} ${styles.name}`}>
                  {r.color && <i className={styles.dot} style={{ background: r.color }} aria-hidden="true" />} {r.name}
                </th>
                {r.counts.map((n, i) => (
                  <td key={table.columns[i].id}>{count(n)}</td>
                ))}
                {table.columns.length > 1 && <td>{count(r.total)}</td>}
              </tr>
            ))}
          </tbody>
          {s.showTotal && table.rows.length > 0 && (
            <tfoot>
              <tr>
                <th scope="row" className={ov.muted}>
                  합계
                </th>
                {table.totals.map((n, i) => (
                  <td key={table.columns[i].id}>{count(n)}</td>
                ))}
                {table.columns.length > 1 && <td>{count(table.totals.reduce((sum, n) => sum + n, 0))}</td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </OverlayThemeRoot>
  );
}

/** 서브 점수판 overlay (`?board=번호`): same polling and transparency as the main board. */
export function SubBoardOverlay({ board, reloadSeq, theme }: { board: SubBoard | null; reloadSeq: number; theme: ResolvedTheme }) {
  useOverlayPage(reloadSeq);
  if (!board) return null;
  return (
    <OverlayThemeRoot theme={theme} className={styles.pad}>
      <div className={`${ov.card} ${styles.board}`}>
        <h1 className={`${ov.label} ${styles.title}`}>
          {board.title}
          {board.closedAt && <span className={`${ov.chip} ${styles.closed}`}>마감</span>}
        </h1>
        <Rows rows={board.rows} />
      </div>
    </OverlayThemeRoot>
  );
}
