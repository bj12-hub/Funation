"use client";

import { OverlayLookPicker } from "@/features/overlayTheme/OverlayLookPicker";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatKst, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { adjustScore, endBroadcast, setRankUpOverlay, startBroadcast } from "@/services/crew/crewBroadcast";
import { BROADCAST_TITLE_MAX, PROJECT_NAME_MAX, type BroadcastResult, type BroadcastView, type TeamKey } from "@/services/crew/crewTypes";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { BattlePanel } from "./BattlePanel";
import { BroadcastFeed } from "./BroadcastFeed";
import { ContributionPanel } from "./ContributionPanel";
import { FanNotesPanel } from "./FanNotesPanel";
import { PrizeBoardPanel } from "./PrizeBoardPanel";
import { TeamPrizePanel } from "./TeamPrizePanel";
import { BroadcastCsvButton, ContributionExportBar } from "./ContributionExport";
import { CumulativePanel } from "./CumulativePanel";
import { GaugePanel } from "./GaugePanel";
import { WindowGaugePanel } from "./WindowGaugePanel";
import { ScenarioPanel } from "./ScenarioPanel";
import { MinusPanel } from "./MinusPanel";
import { SigCountPanel } from "./SigCountPanel";
import { MomentsContext } from "./StartPointPicker";
import { StealPanel } from "./StealPanel";
import { CrewTabs } from "./CrewTabs";
import { SubBoards } from "./SubBoards";
import { shownOverlayAddress } from "./overlayAddress";
import styles from "./crew.module.css";

const elapsed = (from: string, now: number) => {
  const s = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const time = (iso: string) => formatKst(iso, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const signed = (n: number) => `${n > 0 ? "+" : ""}${formatNumber(n)}`;

/**
 * 크루 방송 운영 — code-first (no Figma frame). Route `/creator/crew/broadcast`. Start a broadcast
 * (optional 팀 배틀; with a project, optional 기여도 공유 — 2026-10-28), watch the scoreboard (server scores), apply 보정 from
 * the remote, end it and review the history. Scores refresh from the server every few seconds while live.
 */
export function BroadcastScreen({ view, switches }: { view: BroadcastView; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [teamMode, setTeamMode] = useState(false);
  const [carry, setCarry] = useState(view.carryDefault);
  const [teams, setTeams] = useState<Record<string, TeamKey | "">>({});
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const startId = useRef<string | null>(null);
  // null until mounted so the server and client render the same markup (the clock is client-only).
  const [now, setNow] = useState<number | null>(null);
  const live = view.live;
  const active = view.members.filter((m) => m.active);

  // Live clock + periodic server refresh (new donations, other remotes).
  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => router.refresh(), 5000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [live, router]);

  const run = (action: () => Promise<BroadcastResult>, ok?: string) => {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (res.status === "SAVED") {
        if (ok) setMessage({ tone: "ok", text: ok });
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/crew/broadcast");
      else setMessage({ tone: "error", text: res.message });
    });
  };

  const adjust = (memberId: string, points: number) => {
    if (!live) return;
    run(() => adjustScore({ broadcastId: live.id, memberId, points, reason, adjustmentId: crypto.randomUUID() }));
  };

  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const overlayUrl = `${origin}${view.overlayPath}`;
  const maxScore = Math.max(1, ...(live?.rows.map((r) => Math.max(0, r.score)) ?? [1]));
  const teamTotal = live ? live.teams.reduce((s, t) => s + Math.max(0, t.score), 0) : 0;

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("crewOps.title")}</h1>
        <p className={styles.subtitle}>{t("crewOpsBroadcast.subtitle")}</p>
      </header>
      <OverlayOffNotice targets={["crew"]} switches={switches} />
      <CrewTabs active="broadcast" />

      {message && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      {!live ? (
        <section className={styles.card} aria-labelledby="bc-start">
          <h2 id="bc-start" className={styles.cardTitle}>
            {t("crewOpsBroadcast.startTitle")}
          </h2>
          <form
            className={styles.startForm}
            onSubmit={(e) => {
              e.preventDefault();
              const assigned = Object.fromEntries(Object.entries(teams).filter(([, t]) => t));
              // One request id per intended start: a double click or retry never starts a second broadcast.
              startId.current ??= crypto.randomUUID();
              const requestId = startId.current;
              run(async () => {
                const res = await startBroadcast({ requestId, title, project, teamMode, teams: assigned, carry: !!project.trim() && carry });
                if (res.status === "SAVED") startId.current = null;
                return res;
              }, t("crewOpsBroadcast.started"));
            }}
          >
            <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("crewOpsBroadcast.titlePlaceholder")} maxLength={BROADCAST_TITLE_MAX} aria-label={t("crewOpsBroadcast.titleAria")} />
            <input
              className={styles.input}
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder={t("crewOpsBroadcast.projectPlaceholder")}
              maxLength={PROJECT_NAME_MAX}
              aria-label={t("crewOpsBroadcast.projectAria")}
              list="bc-projects"
            />
            <datalist id="bc-projects">
              {view.projects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            {project.trim() && (
              <div>
                <label className={styles.checkRow}>
                  <input type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} />
                  {t("crewOpsBroadcast.carry")}
                </label>
                <p className={styles.note}>{t("crewOpsBroadcast.carryNote", { project: project.trim() })}</p>
              </div>
            )}
            <label className={styles.checkRow}>
              <input type="checkbox" checked={teamMode} onChange={(e) => setTeamMode(e.target.checked)} />
              {t("crewOpsBroadcast.teamMode")}
            </label>
            {teamMode && (
              <ul className={styles.teamPick}>
                {active.map((m) => (
                  <li key={m.id}>
                    <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />
                    <span className={styles.teamName}>{m.name}</span>
                    <span className={styles.segment} role="group" aria-label={t("crewOpsBroadcast.memberTeamAria", { name: m.name })}>
                      {(["", "A", "B"] as const).map((team) => (
                        <button key={team || "none"} type="button" aria-pressed={(teams[m.id] ?? "") === team} onClick={() => setTeams((prev) => ({ ...prev, [m.id]: team }))}>
                          {team ? t("crewOpsBroadcast.team", { team }) : t("crewOpsBroadcast.noTeam")}
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.actions}>
              <button type="submit" className={styles.primary} disabled={pending || !title.trim()}>
                {t("crewOpsBroadcast.start")}
              </button>
            </div>
          </form>
          {active.length === 0 && <p className={styles.note}>{t("crewOpsBroadcast.noActive")}</p>}
        </section>
      ) : (
        <section className={styles.card} aria-labelledby="bc-live">
          <div className={styles.cardHead}>
            <h2 id="bc-live" className={styles.cardTitle}>
              <span className={styles.liveDot} aria-hidden="true" /> {live.title}
              {live.project && (
                <span className={styles.chip}>
                  {t("crewOpsBroadcast.roundChip", { project: live.project, round: live.round ?? "" })}
                </span>
              )}
              {live.carry && <span className={styles.chip}>{t("crewOpsBroadcast.carryChip")}</span>}
            </h2>
            <span className={styles.clock} aria-label={t("crewOpsBroadcast.elapsedAria")}>
              {now === null ? "--:--:--" : elapsed(live.startedAt, now)}
            </span>
          </div>

          {live.teamMode && (
            <div className={styles.teamGauge} aria-label={t("crewOpsBroadcast.teamScoresAria")}>
              {live.teams.map((tm) => (
                <span key={tm.key} data-team={tm.key} style={{ flexGrow: teamTotal ? Math.max(0.05, Math.max(0, tm.score) / teamTotal) : 1 }}>
                  {t("crewOpsBroadcast.teamScore", { team: tm.key, score: formatNumber(tm.score) })}
                </span>
              ))}
            </div>
          )}

          <div className={styles.remoteBar}>
            <input className={styles.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("crewOpsBroadcast.reasonPlaceholder")} maxLength={40} aria-label={t("crewOpsBroadcast.reasonAria")} />
            <input
              className={styles.inputSmall}
              inputMode="numeric"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^\d-]/g, "").slice(0, 9))}
              placeholder={t("crewOpsBroadcast.customPlaceholder")}
              aria-label={t("crewOpsBroadcast.customAria")}
            />
          </div>

          <ol className={styles.board}>
            {live.rows.map((r, i) => (
              <li key={r.memberId}>
                <span className={styles.rankNo}>{i + 1}</span>
                <span className={styles.boardName}>
                  <span className={styles.dot} style={{ background: r.color }} aria-hidden="true" />
                  {r.name}
                  {r.team && <span className={styles.chip}>{t("crewOpsBroadcast.team", { team: r.team })}</span>}
                </span>
                <span className={styles.rankBar} aria-hidden="true">
                  <span style={{ width: `${(Math.max(0, r.score) / maxScore) * 100}%` }} />
                </span>
                <span className={styles.boardScore}>
                  <strong>{formatNumber(r.score)}</strong>
                  <span className={styles.muted}>
                    {t("crewOpsBroadcast.rowParts", { donated: formatNumber(r.donated + r.feed), adjust: signed(r.adjust) })}
                    {r.stolen !== 0 && t("crewOpsBroadcast.partSteal", { n: signed(r.stolen) })}
                    {r.battle !== 0 && t("crewOpsBroadcast.partBattle", { n: signed(r.battle) })}
                    {r.grade !== 0 && t("crewOpsBroadcast.partGrade", { n: signed(r.grade) })}
                    {r.game !== 0 && t("crewOpsBroadcast.partGame", { n: signed(r.game) })}
                    {r.carried !== 0 && t("crewOpsBroadcast.partCarried", { n: signed(r.carried) })}
                  </span>
                </span>
                <span className={styles.boardButtons}>
                  {[-1_000, 1_000, 10_000].map((p) => (
                    <button key={p} type="button" className={styles.ghost} disabled={pending} onClick={() => adjust(r.memberId, p)}>
                      {signed(p)}
                    </button>
                  ))}
                  <button type="button" className={styles.ghost} disabled={pending || !Number(custom)} onClick={() => adjust(r.memberId, Number(custom))}>
                    {t("crewOpsBroadcast.apply")}
                  </button>
                </span>
              </li>
            ))}
          </ol>

          {/* 랭크업 (code-first, 2026-10-06): the closest overtake on the board. */}
          <div className={styles.rankUp} role="status" aria-label={t("crewOpsBroadcast.rankUpAria")}>
            <span>
              {t("crewOpsBroadcast.rankUp")}{" "}
              {live.rankUp ? (
                <>
                  <strong>{live.rankUp.lower.name}</strong>{t("crewOpsBroadcast.rankPos", { rank: live.rankUp.lower.rank })} → <strong>{live.rankUp.upper.name}</strong>{t("crewOpsBroadcast.rankPos", { rank: live.rankUp.upper.rank })}{" "}
                  {live.rankUp.gap === 0 ? t("crewOpsBroadcast.tied") : t("crewOpsBroadcast.gap", { gap: formatNumber(live.rankUp.gap) })}
                </>
              ) : (
                <span className={styles.muted}>{t("crewOpsBroadcast.rankUpEmpty")}</span>
              )}
            </span>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={live.showRankUp} disabled={pending} onChange={(e) => run(() => setRankUpOverlay({ broadcastId: live.id, on: e.target.checked }), e.target.checked ? t("crewOpsBroadcast.rankUpShown") : t("crewOpsBroadcast.rankUpHidden"))} />
              {t("crewOpsBroadcast.rankUpToggle")}
            </label>
          </div>

          {live.logs.length > 0 && (
            <details className={styles.logs}>
              <summary>{t("crewOpsBroadcast.logs", { count: live.logs.length })}</summary>
              <ul>
                {live.logs.map((l) => (
                  <li key={l.id}>
                    <span className={styles.muted}>{time(l.at)}</span> {l.memberName} <strong>{signed(l.points)}</strong> · {l.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className={styles.actions}>
            <button type="button" className={styles.danger} disabled={pending} onClick={() => run(() => endBroadcast(live.id), t("crewOpsBroadcast.ended"))}>
              {t("crewOpsBroadcast.end")}
            </button>
          </div>
        </section>
      )}

      <ScenarioPanel plan={view.scenario} live={live ? { broadcastId: live.id, scenario: live.scenario, serverNow: live.serverNow } : null} overlayPath={view.overlayPath} pending={pending} run={run} />
      {live && (
        <BattlePanel
          broadcastId={live.id}
          teamMode={live.teamMode}
          members={view.members}
          battles={live.battles}
          rules={view.battleRules}
          overlayPath={view.overlayPath}
          pending={pending}
          run={run}
        />
      )}
      {live && (
        <StealPanel
          broadcastId={live.id}
          members={view.members}
          slots={view.stealSlots}
          rules={view.stealRules}
          records={live.steals}
          battle={live.battles.find((b) => b.running)}
          overlayPath={view.overlayPath}
          pending={pending}
          run={run}
        />
      )}
      {live && view.feed && <BroadcastFeed broadcastId={live.id} members={view.members} view={view.feed} merges={view.donorMerges} pending={pending} run={run} />}
      {live && <ContributionPanel broadcastId={live.id} version={live.rows.map((r) => `${r.memberId}:${r.score}`).join(",")} />}
      {live && <FanNotesPanel broadcastId={live.id} members={view.members} view={live.fanNotes} pending={pending} run={run} />}
      {live && <SubBoards broadcastId={live.id} boards={live.subBoards} overlayPath={view.overlayPath} pending={pending} run={run} />}
      <MomentsContext.Provider value={live ? { startedAt: live.startedAt, moments: live.moments } : null}>
      <PrizeBoardPanel
        settings={view.prizeSettings}
        live={live ? { broadcastId: live.id, board: live.prizeBoard } : null}
        members={view.members}
        overlayPath={view.overlayPath}
        pending={pending}
        run={run}
      />
      <TeamPrizePanel
        settings={view.teamPrizeSettings}
        live={live ? { broadcastId: live.id, board: live.teamPrize } : null}
        members={view.members}
        overlayPath={view.overlayPath}
        pending={pending}
        run={run}
      />
      <CumulativePanel
        settings={view.cumulativeSettings}
        live={live ? { broadcastId: live.id, board: live.cumulative } : null}
        overlayPath={view.overlayPath}
        pending={pending}
        run={run}
      />
      <GaugePanel
        members={view.members}
        pledges={view.pledges}
        settings={view.gaugeSettings}
        live={live ? { broadcastId: live.id, board: live.gauge } : null}
        overlayPath={view.overlayPath}
        pending={pending}
        run={run}
      />
      <WindowGaugePanel
        settings={view.windowGaugeSettings}
        live={live ? { broadcastId: live.id, board: live.windowGauge } : null}
        overlayPath={view.overlayPath}
        pending={pending}
        run={run}
      />
      <SigCountPanel
        settings={view.sigCountSettings}
        signatures={view.signatures}
        members={view.members}
        live={live ? { broadcastId: live.id, table: live.sigCount } : null}
        overlayPath={view.overlayPath}
        pending={pending}
        run={run}
      />
      <MinusPanel settings={view.minusSettings} signatures={view.signatures} members={view.members} pending={pending} run={run} />
      </MomentsContext.Provider>

      <section className={styles.card} aria-labelledby="bc-overlay">
        <h2 id="bc-overlay" className={styles.cardTitle}>
          {t("crewOpsBroadcast.overlayTitle")}
        </h2>
        <p className={styles.muted}>{t("crewOpsBroadcast.overlayNote")}</p>
        <div className={styles.addRow}>
          <input className={styles.input} value={shownOverlayAddress(origin, view.overlayPath)} readOnly aria-label={t("crewOpsBroadcast.overlayAddressAria")} onFocus={(e) => e.target.select()} />
          <button type="button" className={styles.ghost} onClick={() => navigator.clipboard?.writeText(overlayUrl).then(() => setMessage({ tone: "ok", text: t("crewOpsBroadcast.copied") }))}>
            {t("crewOpsBroadcast.copy")}
          </button>
        </div>
        <OverlayLookPicker target="crew" />
      </section>

      <section className={styles.card} aria-labelledby="bc-history">
        <h2 id="bc-history" className={styles.cardTitle}>
          {t("crewOpsBroadcast.historyTitle")}
        </h2>
        {(view.history.length > 0 || live) && <ContributionExportBar key={view.projects.join("|")} projects={view.projects} />}
        {view.history.length === 0 ? (
          <p className={styles.empty}>{t("crewOpsBroadcast.historyEmpty")}</p>
        ) : (
          <ul className={styles.list}>
            {view.history.map((h) => (
              <li key={h.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <strong className={styles.rowTitle}>
                    {h.title}
                    {h.project && <span className={styles.chipOff}>{t("crewOpsBroadcast.roundChip", { project: h.project, round: h.round ?? "" })}</span>}
                  </strong>
                  <span className={styles.muted}>
                    {t("crewOpsBroadcast.historyLine", { from: time(h.startedAt), to: time(h.endedAt), total: formatNumber(h.totalScore) })}
                    {h.winner ? t("crewOpsBroadcast.historyWinner", { name: h.winner }) : ""}
                  </span>
                </div>
                <span className={styles.muted}>{h.top.map((top, i) => `${i + 1}. ${top.name} ${formatNumber(top.score)}`).join("  ")}</span>
                <BroadcastCsvButton broadcastId={h.id} title={h.title} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
