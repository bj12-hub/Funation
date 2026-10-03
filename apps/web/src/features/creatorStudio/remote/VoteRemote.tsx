"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { closeVote, endVote, startVote } from "@/services/creator/voteRemote";
import { rankItems, votePercent, type VoteControlResult, type VoteRemoteView } from "@/services/votes/voteTypes";
import styles from "../crew/crew.module.css";
import remote from "./remote.module.css";

const hms = (sec: number) => [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60].map((n) => String(n).padStart(2, "0")).join(":");

/**
 * 리모컨 "투표" card — code-first. Starts a 투표 위젯 preset, ends it early and takes the result off the
 * screen. Voting is free (2026-10-04 결정): signed-in viewers vote once each in the creator room.
 * Presets (이름 · 시간 · 항목) are edited on /creator/widgets.
 */
export function VoteRemote({
  view,
  pending,
  run
}: {
  view: VoteRemoteView;
  pending: boolean;
  run: (action: () => Promise<VoteControlResult>, ok?: string, after?: () => void) => void;
}) {
  const ready = view.presets.filter((p) => p.ready);
  const [presetId, setPresetId] = useState(ready[0]?.id ?? "");
  const selected = ready.some((p) => p.id === presetId) ? presetId : (ready[0]?.id ?? "");
  // One id per intended start: a double click or retry reuses it, so the vote starts once.
  const requestId = useRef<string | null>(null);
  const b = view.board;
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const left = b && now !== null ? Math.max(0, Math.floor((Date.parse(b.endsAt) - now) / 1000)) : null;
  const running = b !== null && !b.ended && left !== 0;

  const start = () => {
    requestId.current ??= crypto.randomUUID();
    const id = requestId.current;
    run(() => startVote({ presetId: selected, requestId: id }), "투표를 시작했어요.", () => {
      requestId.current = null;
    });
  };

  return (
    <section className={styles.card} aria-labelledby="vote-remote">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="vote-remote">
          📊 투표
        </h2>
        <Link href="/creator/widgets" className={styles.ghost}>
          프리셋 설정
        </Link>
      </div>
      <p className={styles.note}>무료 투표예요. 로그인한 시청자가 방송 방에서 한 번씩 투표하고, 결과는 투표 오버레이에 나와요.</p>
      {!view.widgetEnabled && <p className={styles.muted}>투표 위젯이 꺼져 있어 방송 화면에는 나오지 않아요. 방송 방 투표는 그대로 받아요.</p>}

      {b && (
        <div className={remote.voteBoard} style={{ borderColor: b.color }}>
          <div className={remote.voteHead}>
            <strong>
              {running && <span className={styles.liveDot} aria-hidden="true" />}
              {b.name}
            </strong>
            <span className={styles.muted}>
              {running ? `남은 시간 ${left === null ? "--:--:--" : hms(left)}` : "투표 종료"} · 총 {formatNumber(b.total)}표
            </span>
          </div>
          <ol className={remote.voteItems}>
            {rankItems(b).map((it) => (
              <li key={it.index}>
                <span className={remote.voteFill} style={{ width: `${votePercent(it.count, b.total)}%`, background: b.color }} aria-hidden="true" />
                <span>{it.rank}등</span>
                <span>{it.label}</span>
                <span>
                  {formatNumber(it.count)}표 · {votePercent(it.count, b.total)}%
                </span>
              </li>
            ))}
          </ol>
          <div className={remote.buttons}>
            {running ? (
              <button type="button" className={styles.danger} disabled={pending} onClick={() => run(() => endVote({ voteId: b.id }), "투표를 종료했어요.")}>
                ■ 지금 종료
              </button>
            ) : (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => closeVote({ voteId: b.id }), "결과를 방송 화면에서 내렸어요.")}>
                결과 내리기
              </button>
            )}
          </div>
        </div>
      )}

      {!running &&
        (ready.length === 0 ? (
          <p className={styles.empty}>시작할 수 있는 프리셋이 없어요. 위젯 › 투표에서 항목을 2개 이상 입력해 주세요.</p>
        ) : (
          <>
            <div className={styles.addRow}>
              <select className={styles.input} aria-label="투표 프리셋" value={selected} onChange={(e) => setPresetId(e.target.value)}>
                {ready.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} · 항목 {p.items.length}개 · {hms(p.durationSec)}
                  </option>
                ))}
              </select>
              <button type="button" className={styles.primary} disabled={pending || !selected} onClick={start}>
                {b ? "새 투표 시작" : "투표 시작"}
              </button>
            </div>
            {b && <p className={styles.muted}>새 투표를 시작하면 지난 결과는 방송 화면에서 내려가요.</p>}
          </>
        ))}
    </section>
  );
}
