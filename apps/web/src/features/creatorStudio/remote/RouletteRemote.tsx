"use client";

import Link from "next/link";
import { formatKstTime, formatNumber } from "@/lib/format";
import { finishRouletteSpin, revealRouletteSpin, setRouletteHidden, setRoulettePaused, setRouletteSwitch, startNextSpin } from "@/services/creator/rouletteRemote";
import { ROULETTE_STATUS_LABEL, isBlankPrize, type RouletteControlResult, type RouletteRemoteRow, type RouletteRemoteView } from "@/services/donations/rouletteTypes";
import styles from "../crew/crew.module.css";
import remote from "./remote.module.css";

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const resultText = (name: string) => (isBlankPrize(name) ? "꽝" : `${name} 당첨`);

/**
 * 리모컨 "룰렛" card — code-first (펀페이 1009:355 Web Remote 룰렛 제어). ▶ 시작 spins the oldest waiting
 * participation, Ⅱ 일시정지 holds 자동 시작, ✓ 결과 공개 shows a stopped wheel's result (결과 자동 노출 off),
 * ✓ 완료 takes a shown result off the screen, and the switches mirror 위젯 › 룰렛. Results are drawn by
 * the server at payment; the card shows a result only after the spin. Items and odds live on /creator/widgets.
 */
export function RouletteRemote({
  view,
  pending,
  run
}: {
  view: RouletteRemoteView;
  pending: boolean;
  run: (action: () => Promise<RouletteControlResult>, ok?: string) => void;
}) {
  const s = view.stage;
  const limit = (r: { nth: number }) => (view.dailyLimit > 0 ? `오늘 ${r.nth}/${view.dailyLimit}회` : `오늘 ${r.nth}회째`);
  return (
    <section className={styles.card} aria-labelledby="roulette-remote">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="roulette-remote">
          🎡 룰렛
        </h2>
        <Link href="/creator/widgets" className={styles.ghost}>
          항목 · 확률 설정
        </Link>
      </div>
      <p className={styles.note}>당첨 항목은 크리에이터 상품이에요 (FN 지급 없음). 결과는 후원 시점에 서버가 정하고, 룰렛 오버레이에서 돌아간 뒤 공개돼요.</p>

      <div className={remote.status}>
        <span>
          대기 {view.queue.length}회 · 오늘 참가자 {view.participantsToday}명{view.autoStart && view.paused ? " · 자동 시작 일시정지" : ""}
        </span>
        <span>{view.items.map((it) => `${it.name} ${it.percent}%`).join(" · ")}</span>
      </div>

      {/* 펀페이 1009:355: 후원 받기 · 룰렛 자동시작 · 결과 자동노출 · 위젯 화면 숨기기 */}
      <div className={remote.buttons} role="group" aria-label="룰렛 설정 스위치">
        {(
          [
            ["enabled", "후원 받기", view.enabled],
            ["autoStart", "룰렛 자동 시작", view.autoStart],
            ["autoReveal", "결과 자동 노출", view.autoReveal]
          ] as const
        ).map(([key, label, on]) => (
          <button
            key={key}
            type="button"
            className={on ? styles.chip : styles.chipOff}
            aria-pressed={on}
            disabled={pending}
            onClick={() => run(() => setRouletteSwitch({ key, on: !on }), `${label}을(를) ${on ? "껐어요" : "켰어요"}.`)}
          >
            {label} {on ? "ON" : "OFF"}
          </button>
        ))}
        <button
          type="button"
          className={view.hidden ? styles.chip : styles.chipOff}
          aria-pressed={view.hidden}
          disabled={pending}
          onClick={() => run(() => setRouletteHidden({ hidden: !view.hidden }), view.hidden ? "룰렛 위젯을 다시 보여 줘요." : "룰렛 위젯을 방송 화면에서 숨겼어요.")}
        >
          {view.hidden ? "위젯 화면 숨김" : "위젯 화면 보임"}
        </button>
      </div>

      {s && (
        <div className={remote.rouletteStage} data-status={s.status}>
          <strong>
            {s.status === "SPINNING" && <span className={styles.liveDot} aria-hidden="true" />}
            {s.status === "SPINNING" ? "회전 중" : s.status === "WAITING" ? "결과 대기" : resultText(s.result ?? "")} · {s.donor}
          </strong>
          <span className={styles.muted}>
            {formatNumber(s.amount)} FN · {s.no}
          </span>
          {s.status === "WAITING" && (
            <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => revealRouletteSpin({ spinId: s.id }), "결과를 공개했어요.")}>
              ✓ 결과 공개
            </button>
          )}
          {s.status === "RESULT" && (
            <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => finishRouletteSpin({ spinId: s.id }), "결과를 방송 화면에서 내렸어요.")}>
              ✓ 완료
            </button>
          )}
        </div>
      )}

      <div className={remote.buttons}>
        <button type="button" className={styles.primary} disabled={pending || s !== null || view.queue.length === 0} onClick={() => run(startNextSpin, "룰렛을 돌렸어요.")}>
          ▶ 시작
        </button>
        {view.autoStart && (
          <button
            type="button"
            className={view.paused ? styles.primary : styles.ghost}
            aria-pressed={view.paused}
            disabled={pending}
            onClick={() => run(() => setRoulettePaused({ paused: !view.paused }), view.paused ? "자동 시작을 다시 켰어요." : "자동 시작을 멈췄어요.")}
          >
            {view.paused ? "▶ 자동 시작 재개" : "Ⅱ 일시정지"}
          </button>
        )}
      </div>

      {view.queue.length === 0 && view.recent.length === 0 ? (
        <p className={styles.empty}>아직 룰렛 참여가 없어요.</p>
      ) : (
        <ul className={styles.list}>
          {view.queue.map((r, i) => (
            <Row key={r.id} row={r} meta={`${i + 1}번째 · ${limit(r)} · 등록 ${time(r.createdAt)}`} />
          ))}
          {view.recent.map((r) => (
            <Row key={r.id} row={r} meta={`${limit(r)} · ${r.result ? resultText(r.result) : ""}`} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ row, meta }: { row: RouletteRemoteRow; meta: string }) {
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>
          {row.donor} · {formatNumber(row.amount)} FN
        </span>
        <span className={styles.muted}>
          {row.no} · {meta}
        </span>
      </div>
      <span className={remote.statusTag} data-status={row.status === "QUEUED" ? "QUEUED" : "DONE"}>
        {ROULETTE_STATUS_LABEL[row.status]}
      </span>
    </li>
  );
}
