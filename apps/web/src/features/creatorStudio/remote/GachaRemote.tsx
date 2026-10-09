"use client";

import Link from "next/link";
import { formatKstTime, formatNumber } from "@/lib/format";
import { finishGachaDraw, setGachaClaimed, setGachaHidden } from "@/services/creator/gachaRemote";
import { GACHA_STATUS_LABEL, type GachaControlResult, type GachaRemoteView, type GachaRow } from "@/services/donations/gachaTypes";
import styles from "../crew/crew.module.css";
import remote from "./remote.module.css";

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * 리모컨 "뽑기" card — code-first (펀페이 1009:6549 실행 대기 · 1009:6768 결과 확인). Draws play in order on
 * the 뽑기 overlay; ✓ 완료 takes a shown result down early and 수령 처리 marks a prize as handed over.
 * Prizes and odds live in the 뽑기 위젯 settings.
 */
export function GachaRemote({
  view,
  pending,
  run
}: {
  view: GachaRemoteView;
  pending: boolean;
  run: (action: () => Promise<GachaControlResult>, ok?: string) => void;
}) {
  const s = view.stage;
  return (
    <section className={styles.card} aria-labelledby="gacha-remote">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="gacha-remote">
          🧸 뽑기
        </h2>
        <Link href="/creator/widgets" className={styles.ghost}>
          상품 · 확률 설정
        </Link>
      </div>
      <p className={styles.note}>당첨 상품은 크리에이터가 직접 지급해요 (FN 지급 없음). 결과는 후원 시점에 서버가 정하고, 뽑기 오버레이에서 순서대로 공개돼요.</p>
      <div className={remote.status}>
        <span>
          실행 대기 {view.queue.length}건 · 미수령 상품 {view.unclaimed}건
        </span>
        <button
          type="button"
          className={view.hidden ? styles.chip : styles.chipOff}
          aria-pressed={view.hidden}
          disabled={pending}
          onClick={() => run(() => setGachaHidden({ hidden: !view.hidden }), view.hidden ? "뽑기 위젯을 다시 보여 줘요." : "뽑기 위젯을 방송 화면에서 숨겼어요.")}
        >
          {view.hidden ? "화면 숨김" : "화면 보임"}
        </button>
      </div>

      {s && (
        <div className={remote.rouletteStage} data-status={s.status}>
          <strong>
            {s.status === "SPINNING" && <span className={styles.liveDot} aria-hidden="true" />}
            {s.prize === null ? "뽑는 중" : s.blank ? "꽝" : `${s.prize} 당첨`} · {s.donor}
          </strong>
          <span className={styles.muted}>
            {s.gachaName} · {formatNumber(s.amount)} FN · {s.no}
          </span>
          {s.status === "RESULT" && (
            <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => finishGachaDraw({ drawId: s.id }), "결과를 방송 화면에서 내렸어요.")}>
              ✓ 완료
            </button>
          )}
        </div>
      )}

      {view.queue.length === 0 && view.recent.length === 0 ? (
        <p className={styles.empty}>아직 뽑기 요청이 없어요.</p>
      ) : (
        <ul className={styles.list}>
          {view.queue.map((r, i) => (
            <Row key={r.id} row={r} meta={`${i + 1}번째 · 등록 ${time(r.createdAt)}`} pending={pending} run={run} />
          ))}
          {view.recent.map((r) => (
            <Row key={r.id} row={r} meta={r.blank ? "꽝" : `${r.prize} 당첨`} pending={pending} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
}

function Row({ row, meta, pending, run }: { row: GachaRow; meta: string; pending: boolean; run: (action: () => Promise<GachaControlResult>, ok?: string) => void }) {
  return (
    <li className={styles.row}>
      <div className={styles.rowMain}>
        <span className={styles.rowTitle}>
          {row.donor} · {row.gachaName} · {formatNumber(row.amount)} FN
        </span>
        <span className={styles.muted}>
          {row.no} · {meta}
        </span>
      </div>
      <span className={remote.statusTag} data-status={row.status === "QUEUED" ? "QUEUED" : "DONE"}>
        {GACHA_STATUS_LABEL[row.status]}
      </span>
      {row.claimed !== null && (
        <button
          type="button"
          className={row.claimed ? styles.ghost : styles.primary}
          aria-pressed={row.claimed}
          disabled={pending}
          onClick={() => run(() => setGachaClaimed({ drawId: row.id, claimed: !row.claimed }), row.claimed ? "미수령으로 바꿨어요." : "수령 처리했어요.")}
        >
          {row.claimed ? "수령 완료" : "수령 처리"}
        </button>
      )}
    </li>
  );
}
