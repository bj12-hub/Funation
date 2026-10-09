import Link from "next/link";
import { formatNumber } from "@/lib/format";
import type { PendingDonationRow, PendingDonationsView } from "@/types/adminApi";
import styles from "../admin.module.css";
import { WithdrawnBadge } from "../WithdrawnBadge";
import { PendingDonationActions } from "./PendingDonationActions";

const when = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" });

/** The result chip: 확인 필요 while waiting, then 완료 / 실패 · FN 반환 / 실패 · 반환 불가(탈퇴). */
function resultChip(r: PendingDonationRow) {
  const res = r.resolution;
  if (!res) return { className: styles.chipWarn, label: "확인 필요" };
  if (res.outcome === "COMPLETED") return { className: styles.chipOk, label: "완료" };
  return res.fnReturn === "FORFEITED" ? { className: styles.chipNeutral, label: "실패 · 반환 불가(탈퇴)" } : { className: styles.chipBad, label: "실패 · FN 반환" };
}

/** How it was settled: "2026. 10. 9. 오후 3:00 · 운영자 · 메모" or "… · 플랫폼 확인 (다시 확인)". */
function ResolutionLine({ r }: { r: PendingDonationRow }) {
  const res = r.resolution!;
  const effect =
    res.outcome === "COMPLETED" ? "보관 FN 사용 처리" : res.fnReturn === "FORFEITED" ? `탈퇴한 회원이라 ${formatNumber(r.fnAmount)} FN을 돌려주지 않았어요 (소멸)` : `${formatNumber(r.fnAmount)} FN을 회원에게 돌려줬어요`;
  return (
    <>
      <p className={styles.muted}>
        {when(res.at)} · {res.by === "OPERATOR" ? res.operator : "플랫폼 확인 (다시 확인)"} · {effect}
        {res.externalTransactionId && ` · ${r.platformLabel} 거래번호 ${res.externalTransactionId}`}
      </p>
      {res.note && <p className={styles.quote}>처리 메모: {res.note}</p>}
    </>
  );
}

function PendingItem({ r }: { r: PendingDonationRow }) {
  const chip = resultChip(r);
  return (
    <li className={styles.refundItem}>
      <div className={styles.refundHead}>
        <strong>{`${r.platformLabel} · ${r.productLabel} · ${formatNumber(r.fnAmount)} FN`}</strong>
        <span className={chip.className}>{chip.label}</span>
      </div>
      <p className={styles.muted}>
        <Link href={`/members/${encodeURIComponent(r.memberId)}`} className={styles.rowLink}>
          {r.memberName}
        </Link>
        <WithdrawnBadge withdrawn={r.memberWithdrawn} /> → {r.creatorName} · 요청 {when(r.requestedAt)} · 거래번호 {r.transactionId}
      </p>
      {r.resolution ? (
        <ResolutionLine r={r} />
      ) : (
        <>
          <p className={styles.muted}>마지막 확인 {r.lastCheckAt ? when(r.lastCheckAt) : "없음"} · 결과가 정해질 때까지 FN은 보관 중이에요.</p>
          {r.memberWithdrawn && <p className={styles.warn}>탈퇴한 회원의 후원이에요. 실패로 정하면 FN을 돌려주지 않고 소멸돼요(탈퇴한 계정 규칙). 재가입한 새 계정에도 지급하지 않아요.</p>}
          <PendingDonationActions transactionId={r.transactionId} fnAmount={r.fnAmount} withdrawn={r.memberWithdrawn} />
        </>
      )}
    </li>
  );
}

/** 확인 중 후원 — code-first (2026-10-08 결정). Route `/donations/pending`. */
export function PendingDonationsScreen({ view }: { view: PendingDonationsView }) {
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>확인 중 후원</h1>
        <p className={styles.muted}>
          SOOP · FlexTV 후원 중 요청 후 24시간 동안 플랫폼 결과를 확인하지 못한 건이에요. 다시 확인하거나, 플랫폼에서 확인한 뒤 성공 또는 실패로 정해요. 실패로 정하면 보관 중인 FN을 회원에게 돌려줘요.
        </p>
      </header>
      <section className={styles.card} aria-labelledby="pd-waiting">
        <h2 id="pd-waiting" className={styles.cardTitle}>
          확인 필요 {view.waiting.length > 0 ? <span className={styles.warn}>{formatNumber(view.waiting.length)}</span> : 0}
        </h2>
        <p className={styles.muted}>
          자동 확인 중 {formatNumber(view.checking)}건 · 요청 후 24시간 안에는 회원의 후원 내역 · 회원 탈퇴 화면과 이 화면을 열 때마다 플랫폼 결과를 다시 확인해요.
        </p>
        {view.waiting.length === 0 ? (
          <p className={styles.empty}>확인이 필요한 후원이 없어요.</p>
        ) : (
          <ul className={styles.refundList}>
            {view.waiting.map((r) => (
              <PendingItem key={r.transactionId} r={r} />
            ))}
          </ul>
        )}
      </section>
      {view.resolved.length > 0 && (
        <section className={styles.card} aria-labelledby="pd-resolved">
          <h2 id="pd-resolved" className={styles.cardTitle}>
            처리 완료 {formatNumber(view.resolved.length)}
          </h2>
          <ul className={styles.refundList}>
            {view.resolved.map((r) => (
              <PendingItem key={r.transactionId} r={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
