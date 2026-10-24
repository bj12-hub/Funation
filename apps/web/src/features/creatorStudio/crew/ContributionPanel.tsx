"use client";

import { useEffect, useRef, useState } from "react";
import { toCsv } from "@/lib/csv";
import { formatKstTime, formatNumber } from "@/lib/format";
import { getContributionHistory } from "@/services/crew/crewHistory";
import { CONTRIBUTION_KINDS, type ContributionHistory, type ContributionKind } from "@/services/crew/crewTypes";
import styles from "./crew.module.css";
import history from "./history.module.css";

const KIND_LABEL = Object.fromEntries(CONTRIBUTION_KINDS.map((k) => [k.key, k.label])) as Record<ContributionKind, string>;
const time = (iso: string | null) => (iso ? formatKstTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "방송 전체");
const signed = (n: number) => `${n > 0 ? "+" : ""}${formatNumber(n)}`;

/**
 * 기여도 내역 — code-first (no Figma frame; StreamDonate 후원 및 통합 관리 "기여도 내역" 참고, 2026-10-25), inside
 * `/creator/crew/broadcast` while live. Every line of the scoreboard (후원 · 후원 리스트 · 보정 · 강탈 · 배틀 배수 · 직급 배수
 * · 점수 게임) with 기능별 and 멤버 filters and a CSV of what is shown. Read from the server when opened and again whenever the
 * scoreboard changes (`version`), not with every board refresh.
 */
export function ContributionPanel({ broadcastId, version }: { broadcastId: string; version: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ContributionHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<ContributionKind | "ALL">("ALL");
  const [member, setMember] = useState("");
  const loading = useRef(false);

  const load = async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const res = await getContributionHistory({ broadcastId });
      if (res.status === "OK") {
        setData(res.history);
        setError(null);
      } else setError(res.status === "UNAUTHORIZED" ? "로그인이 필요해요." : res.message);
    } catch {
      setError("기여도 내역을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      loading.current = false;
    }
  };
  useEffect(() => {
    if (open) void load();
    // `load` reads only `broadcastId`; it reruns when the panel opens or the scoreboard moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, broadcastId, version]);

  const lines = data?.lines ?? [];
  const members = [...new Map(lines.map((l) => [l.memberId, { id: l.memberId, name: l.memberName, color: l.color }])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const byMember = member ? lines.filter((l) => l.memberId === member) : lines;
  const shown = kind === "ALL" ? byMember : byMember.filter((l) => l.kind === kind);
  const total = shown.reduce((s, l) => s + l.points, 0);

  const download = () => {
    const csv = toCsv(
      ["시각", "멤버", "종류", "내용", "상세", "점수"],
      shown.map((l) => [l.at ? formatKstTime(l.at, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "방송 전체", l.memberName, KIND_LABEL[l.kind], l.label, l.detail, l.points])
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `기여도내역-${data?.title ?? "방송"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <details className={`${styles.card} ${history.card}`} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={history.summary}>
        <h2 className={styles.cardTitle}>기여도 내역</h2>
        <span className={styles.muted}>점수판 점수가 어디서 왔는지 한 줄씩 보여 줘요</span>
      </summary>
      <p className={styles.note}>멤버마다 더하면 점수판 점수와 같아요. 직급 배수는 방송 전체에 한 줄, 점수 게임은 OBS에 결과가 나온 뒤에 들어와요.</p>

      <div className={history.filters}>
        <div className={`${styles.tabs} ${history.kinds}`} role="group" aria-label="기여도 내역 종류">
          {[{ key: "ALL" as const, label: "전체" }, ...CONTRIBUTION_KINDS].map((k) => {
            const count = k.key === "ALL" ? byMember.length : byMember.filter((l) => l.kind === k.key).length;
            if (k.key !== "ALL" && !count) return null;
            return (
              <button key={k.key} type="button" className={styles.tab} aria-current={kind === k.key ? "page" : undefined} onClick={() => setKind(k.key)}>
                {k.label} {count}
              </button>
            );
          })}
        </div>
        <span className={history.tools}>
          <select className={styles.select} aria-label="기여도 내역 멤버" value={member} onChange={(e) => setMember(e.target.value)}>
            <option value="">모든 멤버</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="button" className={styles.ghost} onClick={() => void load()}>
            새로고침
          </button>
          <button type="button" className={styles.ghost} disabled={!shown.length} onClick={download}>
            CSV 다운로드
          </button>
        </span>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {!data && !error ? (
        <p className={styles.note}>불러오는 중…</p>
      ) : shown.length === 0 ? (
        <p className={styles.empty}>{lines.length ? "조건에 맞는 내역이 없어요." : "아직 점수가 움직이지 않았어요."}</p>
      ) : (
        <>
          <p className={styles.muted}>
            {formatNumber(shown.length)}건 · 합계 <strong>{signed(total)}점</strong>
          </p>
          <ol className={history.lines} aria-label="기여도 내역">
            {shown.map((l) => (
              <li key={l.id}>
                <span className={history.when}>{time(l.at)}</span>
                <span className={history.kind}>{KIND_LABEL[l.kind]}</span>
                <span className={history.what}>
                  <span className={styles.boardName}>
                    <span className={styles.dot} style={{ background: l.color }} aria-hidden="true" />
                    {l.memberName}
                  </span>
                  <span>{l.label}</span>
                  <span className={styles.muted}>{l.detail}</span>
                </span>
                <strong className={history.points} data-negative={l.points < 0 ? "" : undefined}>
                  {signed(l.points)}
                </strong>
              </li>
            ))}
          </ol>
        </>
      )}
    </details>
  );
}
