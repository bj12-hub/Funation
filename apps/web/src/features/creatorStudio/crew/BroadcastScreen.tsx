"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { adjustScore, endBroadcast, startBroadcast } from "@/services/crew/crewBroadcast";
import { BROADCAST_TITLE_MAX, PROJECT_NAME_MAX, type BroadcastResult, type BroadcastView, type TeamKey } from "@/services/crew/crewTypes";
import { BroadcastFeed } from "./BroadcastFeed";
import { CrewTabs } from "./CrewTabs";
import styles from "./crew.module.css";

const elapsed = (from: string, now: number) => {
  const s = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const time = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
const signed = (n: number) => `${n > 0 ? "+" : ""}${formatNumber(n)}`;

/**
 * 크루 방송 운영 — code-first (no Figma frame). Route `/creator/crew/broadcast`. Start a broadcast
 * (optional 팀 배틀), watch the scoreboard (server scores), apply 보정 from the remote, end it and
 * review the history. Scores refresh from the server every few seconds while live.
 */
export function BroadcastScreen({ view }: { view: BroadcastView }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [teamMode, setTeamMode] = useState(false);
  const [teams, setTeams] = useState<Record<string, TeamKey | "">>({});
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
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
        <h1 className={styles.title}>크루 관리</h1>
        <p className={styles.subtitle}>방송 회차를 시작하고 점수판을 운영하세요. 멤버 점수 = 방송 중 그 멤버에게 들어온 후원 FN + 보정 점수예요.</p>
      </header>
      <CrewTabs active="broadcast" />

      {message && (
        <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}

      {!live ? (
        <section className={styles.card} aria-labelledby="bc-start">
          <h2 id="bc-start" className={styles.cardTitle}>
            새 방송 시작
          </h2>
          <form
            className={styles.startForm}
            onSubmit={(e) => {
              e.preventDefault();
              const assigned = Object.fromEntries(Object.entries(teams).filter(([, t]) => t));
              run(() => startBroadcast({ title, project, teamMode, teams: assigned }), "방송을 시작했어요.");
            }}
          >
            <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="방송 제목 (예: 시즌1 3회차)" maxLength={BROADCAST_TITLE_MAX} aria-label="방송 제목" />
            <input
              className={styles.input}
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="프로젝트 (선택) — 같은 프로젝트로 시작하면 회차가 자동으로 붙어요"
              maxLength={PROJECT_NAME_MAX}
              aria-label="프로젝트"
              list="bc-projects"
            />
            <datalist id="bc-projects">
              {view.projects.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={teamMode} onChange={(e) => setTeamMode(e.target.checked)} />
              팀 배틀 (A팀 vs B팀)
            </label>
            {teamMode && (
              <ul className={styles.teamPick}>
                {active.map((m) => (
                  <li key={m.id}>
                    <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />
                    <span className={styles.teamName}>{m.name}</span>
                    <span className={styles.segment} role="group" aria-label={`${m.name} 팀`}>
                      {(["", "A", "B"] as const).map((t) => (
                        <button key={t || "none"} type="button" aria-pressed={(teams[m.id] ?? "") === t} onClick={() => setTeams((prev) => ({ ...prev, [m.id]: t }))}>
                          {t ? `${t}팀` : "없음"}
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.actions}>
              <button type="submit" className={styles.primary} disabled={pending || !title.trim()}>
                방송 시작
              </button>
            </div>
          </form>
          {active.length === 0 && <p className={styles.note}>활동 중인 멤버가 없어요. 멤버 탭에서 먼저 추가해 주세요.</p>}
        </section>
      ) : (
        <section className={styles.card} aria-labelledby="bc-live">
          <div className={styles.cardHead}>
            <h2 id="bc-live" className={styles.cardTitle}>
              <span className={styles.liveDot} aria-hidden="true" /> {live.title}
              {live.project && (
                <span className={styles.chip}>
                  {live.project} · {live.round}회차
                </span>
              )}
            </h2>
            <span className={styles.clock} aria-label="진행 시간">
              {now === null ? "--:--:--" : elapsed(live.startedAt, now)}
            </span>
          </div>

          {live.teamMode && (
            <div className={styles.teamGauge} aria-label="팀 점수">
              {live.teams.map((t) => (
                <span key={t.key} data-team={t.key} style={{ flexGrow: teamTotal ? Math.max(0.05, Math.max(0, t.score) / teamTotal) : 1 }}>
                  {t.key}팀 {formatNumber(t.score)}
                </span>
              ))}
            </div>
          )}

          <div className={styles.remoteBar}>
            <input className={styles.input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="보정 사유 (선택)" maxLength={40} aria-label="보정 사유" />
            <input
              className={styles.inputSmall}
              inputMode="numeric"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^\d-]/g, "").slice(0, 9))}
              placeholder="직접 입력"
              aria-label="보정 점수 직접 입력"
            />
          </div>

          <ol className={styles.board}>
            {live.rows.map((r, i) => (
              <li key={r.memberId}>
                <span className={styles.rankNo}>{i + 1}</span>
                <span className={styles.boardName}>
                  <span className={styles.dot} style={{ background: r.color }} aria-hidden="true" />
                  {r.name}
                  {r.team && <span className={styles.chip}>{r.team}팀</span>}
                </span>
                <span className={styles.rankBar} aria-hidden="true">
                  <span style={{ width: `${(Math.max(0, r.score) / maxScore) * 100}%` }} />
                </span>
                <span className={styles.boardScore}>
                  <strong>{formatNumber(r.score)}</strong>
                  <span className={styles.muted}>
                    후원 {formatNumber(r.donatedFn + r.feedFn)} · 보정 {signed(r.adjust)}
                  </span>
                </span>
                <span className={styles.boardButtons}>
                  {[-1_000, 1_000, 10_000].map((p) => (
                    <button key={p} type="button" className={styles.ghost} disabled={pending} onClick={() => adjust(r.memberId, p)}>
                      {signed(p)}
                    </button>
                  ))}
                  <button type="button" className={styles.ghost} disabled={pending || !Number(custom)} onClick={() => adjust(r.memberId, Number(custom))}>
                    적용
                  </button>
                </span>
              </li>
            ))}
          </ol>

          {live.logs.length > 0 && (
            <details className={styles.logs}>
              <summary>보정 로그 {live.logs.length}건</summary>
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
            <button type="button" className={styles.danger} disabled={pending} onClick={() => run(() => endBroadcast(live.id), "방송을 종료했어요. 결과가 이력에 저장됐어요.")}>
              방송 종료
            </button>
          </div>
        </section>
      )}

      {live && view.feed && <BroadcastFeed broadcastId={live.id} members={view.members} view={view.feed} pending={pending} run={run} />}

      <section className={styles.card} aria-labelledby="bc-overlay">
        <h2 id="bc-overlay" className={styles.cardTitle}>
          OBS 점수판 오버레이
        </h2>
        <p className={styles.muted}>OBS 브라우저 소스에 아래 주소를 넣으면 진행 중인 방송의 점수판이 표시돼요. 주소에 연동키가 들어 있으니 공유하지 마세요 — 계정설정에서 연동키를 재발급하면 이전 주소는 막혀요.</p>
        <div className={styles.addRow}>
          <input className={styles.input} value={overlayUrl} readOnly aria-label="오버레이 주소" onFocus={(e) => e.target.select()} />
          <button type="button" className={styles.ghost} onClick={() => navigator.clipboard?.writeText(overlayUrl).then(() => setMessage({ tone: "ok", text: "주소를 복사했어요." }))}>
            복사
          </button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="bc-history">
        <h2 id="bc-history" className={styles.cardTitle}>
          방송 이력
        </h2>
        {view.history.length === 0 ? (
          <p className={styles.empty}>종료된 방송이 아직 없어요.</p>
        ) : (
          <ul className={styles.list}>
            {view.history.map((h) => (
              <li key={h.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <strong className={styles.rowTitle}>
                    {h.title}
                    {h.project && <span className={styles.chipOff}>{h.project} · {h.round}회차</span>}
                  </strong>
                  <span className={styles.muted}>
                    {time(h.startedAt)} ~ {time(h.endedAt)} · 총 {formatNumber(h.totalScore)}점{h.winner ? ` · 1위 ${h.winner}` : ""}
                  </span>
                </div>
                <span className={styles.muted}>{h.top.map((t, i) => `${i + 1}. ${t.name} ${formatNumber(t.score)}`).join("  ")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
