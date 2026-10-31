"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
  const { t } = useI18n();
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
    run(() => startVote({ presetId: selected, requestId: id }), t("studioRemote.voteStarted"), () => {
      requestId.current = null;
    });
  };

  return (
    <section className={styles.card} aria-labelledby="vote-remote">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="vote-remote">
          {t("studioRemote.voteTitle")}
        </h2>
        <Link href="/creator/widgets?open=VOTE" className={styles.ghost}>
          {t("studioRemote.votePresets")}
        </Link>
      </div>
      <p className={styles.note}>{t("studioRemote.voteNote")}</p>
      {!view.widgetEnabled && <p className={styles.muted}>{t("studioRemote.voteWidgetOff")}</p>}

      {b && (
        <div className={remote.voteBoard} style={{ borderColor: b.color }}>
          <div className={remote.voteHead}>
            <strong>
              {running && <span className={styles.liveDot} aria-hidden="true" />}
              {b.name}
            </strong>
            <span className={styles.muted}>
              {running ? t("studioRemote.timeLeft", { time: left === null ? "--:--:--" : hms(left) }) : t("studioRemote.voteEnded")}
              {t("studioRemote.voteTotal", { count: formatNumber(b.total) })}
            </span>
          </div>
          <ol className={remote.voteItems}>
            {rankItems(b).map((it) => (
              <li key={it.index}>
                <span className={remote.voteFill} style={{ width: `${votePercent(it.count, b.total)}%`, background: b.color }} aria-hidden="true" />
                <span>{t("studioRemote.voteRank", { rank: it.rank })}</span>
                <span>{it.label}</span>
                <span>{t("studioRemote.voteCount", { count: formatNumber(it.count), percent: votePercent(it.count, b.total) })}</span>
              </li>
            ))}
          </ol>
          <div className={remote.buttons}>
            {running ? (
              <button type="button" className={styles.danger} disabled={pending} onClick={() => run(() => endVote({ voteId: b.id }), t("studioRemote.voteEndedOk"))}>
                {t("studioRemote.voteEndNow")}
              </button>
            ) : (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => closeVote({ voteId: b.id }), t("studioRemote.resultCleared"))}>
                {t("studioRemote.voteClear")}
              </button>
            )}
          </div>
        </div>
      )}

      {!running &&
        (ready.length === 0 ? (
          <p className={styles.empty}>{t("studioRemote.voteNoPresets")}</p>
        ) : (
          <>
            <div className={styles.addRow}>
              <select className={styles.input} aria-label={t("studioRemote.votePresetAria")} value={selected} onChange={(e) => setPresetId(e.target.value)}>
                {ready.map((p) => (
                  <option key={p.id} value={p.id}>
                    {t("studioRemote.votePresetOption", { label: p.label, count: p.items.length, time: hms(p.durationSec) })}
                  </option>
                ))}
              </select>
              <button type="button" className={styles.primary} disabled={pending || !selected} onClick={start}>
                {b ? t("studioRemote.voteStartNew") : t("studioRemote.voteStart")}
              </button>
            </div>
            {b && <p className={styles.muted}>{t("studioRemote.voteNewNote")}</p>}
          </>
        ))}
    </section>
  );
}
