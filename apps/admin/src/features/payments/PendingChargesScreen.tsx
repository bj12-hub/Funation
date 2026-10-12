import Link from "next/link";
import { formatKst, formatNumber } from "@/lib/format";
import type { PendingChargeRow, PendingChargesView } from "@/types/adminApi";
import styles from "../admin.module.css";
import { WithdrawnBadge } from "../WithdrawnBadge";
import { PendingChargeActions } from "./PendingChargeActions";

/** Korea time, short: "26. 10. 12. 오후 2:23" (the site's zone-less charge stamps are Korea time too). */
const when = (value: string) => formatKst(value, { dateStyle: "short", timeStyle: "short" });

/** The result chip: 확인 필요 while waiting, then 완료 · FN 지급 / 완료 · FN 미지급 (탈퇴) / 결제 취소. */
function resultChip(r: PendingChargeRow) {
  const res = r.resolution;
  if (!res) return { className: styles.chipWarn, label: "확인 필요" };
  if (res.result === "CREDITED") return { className: styles.chipOk, label: "완료 · FN 지급" };
  if (res.result === "NOT_CREDITED") return { className: styles.chipNeutral, label: "완료 · FN 미지급 (탈퇴)" };
  return { className: styles.chipBad, label: "결제 취소" };
}

/** How it was decided: "26. 10. 12. 오후 3:00 · 운영자 · 결제 확인 · 10,000 FN을 회원에게 지급했어요" + the memo. */
function ResolutionLine({ r }: { r: PendingChargeRow }) {
  const res = r.resolution!;
  const amount = `${formatNumber(r.fnAmount)} FN`;
  const effect =
    res.result === "CREDITED"
      ? `결제 확인 · ${amount}을 회원에게 지급했어요`
      : res.result === "NOT_CREDITED"
        ? `결제 확인 · 탈퇴한 회원이라 ${amount}을 지급하지 않았어요 (FN 미지급) · 결제 금액의 처리는 정해지지 않았어요 (TBD)`
        : "결제 취소 · FN을 지급하지 않았어요";
  return (
    <>
      <p className={styles.muted}>
        {when(res.at)} · {res.operator} · {effect}
      </p>
      <p className={styles.quote}>처리 메모: {res.note}</p>
    </>
  );
}

function PendingChargeItem({ r }: { r: PendingChargeRow }) {
  const chip = resultChip(r);
  return (
    <li className={styles.refundItem}>
      <div className={styles.refundHead}>
        <strong>{`${r.methodLabel} · ${formatNumber(r.fnAmount)} FN · ${formatNumber(r.paidAmount)}원`}</strong>
        <span className={chip.className}>{chip.label}</span>
      </div>
      <p className={styles.muted}>
        <Link href={`/members/${encodeURIComponent(r.memberId)}`} className={styles.rowLink}>
          {r.memberName}
        </Link>
        <WithdrawnBadge withdrawn={r.memberWithdrawn} /> · 요청 {when(r.chargedAt)} · 거래번호 {r.transactionId ?? "—"}
      </p>
      {r.resolution ? (
        <ResolutionLine r={r} />
      ) : (
        <>
          <p className={styles.muted}>결제 확인 전이라 FN은 아직 지급하지 않았어요.</p>
          {r.memberWithdrawn && (
            <p className={styles.warn}>
              탈퇴한 회원의 충전이에요. 결제 확인으로 정해도 FN을 지급하지 않아요(탈퇴한 계정 규칙). 재가입한 새 계정에도 지급하지 않아요. 결제 금액의 처리(결제 취소 · 환불)는 정해지지 않았어요 (TBD).
            </p>
          )}
          <PendingChargeActions chargeId={r.chargeId} fnAmount={r.fnAmount} withdrawn={r.memberWithdrawn} />
        </>
      )}
    </li>
  );
}

/** 처리 중 충전 — code-first (2026-10-12 결정). Route `/payments/pending`. */
export function PendingChargesScreen({ view }: { view: PendingChargesView }) {
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>처리 중 충전</h1>
        <p className={styles.muted}>
          결제 대행사의 결제 확인이 오지 않은 충전이에요. 결제 대행사에서 확인한 뒤 결제 확인 또는 결제 취소로 정해요. 결제 확인 방식(웹훅 · 상태 조회)은 결제 대행사 연동 후 확정돼요 (TBD).
        </p>
      </header>
      <section className={styles.card} aria-labelledby="pc-waiting">
        <h2 id="pc-waiting" className={styles.cardTitle}>
          확인 필요 {view.waiting.length > 0 ? <span className={styles.warn}>{formatNumber(view.waiting.length)}</span> : 0}
        </h2>
        <p className={styles.muted}>결제 확인은 충전한 FN을 회원에게 지급하고, 결제 취소는 지급하지 않아요. 처리 중인 충전이 있는 회원은 탈퇴할 수 없어요.</p>
        {view.waiting.length === 0 ? (
          <p className={styles.empty}>확인이 필요한 충전이 없어요.</p>
        ) : (
          <ul className={styles.refundList}>
            {view.waiting.map((r) => (
              <PendingChargeItem key={r.chargeId} r={r} />
            ))}
          </ul>
        )}
      </section>
      {view.resolved.length > 0 && (
        <section className={styles.card} aria-labelledby="pc-resolved">
          <h2 id="pc-resolved" className={styles.cardTitle}>
            처리 완료 {formatNumber(view.resolved.length)}
          </h2>
          <ul className={styles.refundList}>
            {view.resolved.map((r) => (
              <PendingChargeItem key={r.chargeId} r={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
