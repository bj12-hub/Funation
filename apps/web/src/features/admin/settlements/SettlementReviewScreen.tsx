import Link from "next/link";
import { formatNumber } from "@/lib/format";
import type { AdminSettlementView } from "@/services/admin/settlementTypes";
import type { SettlementStatus } from "@/services/creator/settlementTypes";
import styles from "../admin.module.css";
import { SettlementDecision } from "./SettlementDecision";

const LABEL: Record<SettlementStatus, string> = { PENDING: "심사 대기", APPROVED: "승인", REJECTED: "반려" };
const CHIP: Record<SettlementStatus, string> = { PENDING: styles.chipWarn, APPROVED: styles.chipOk, REJECTED: styles.chipBad };

/** 정산 심사 — code-first. Route `/admin/settlements` (`?status=`). */
export function SettlementReviewScreen({ view, status }: { view: AdminSettlementView; status: SettlementStatus | null }) {
  const reg = view.registration;
  const tabs: { key: SettlementStatus | null; label: string; count: number }[] = [
    { key: null, label: "전체", count: view.counts.PENDING + view.counts.APPROVED + view.counts.REJECTED },
    { key: "PENDING", label: "심사 대기", count: view.counts.PENDING },
    { key: "APPROVED", label: "승인", count: view.counts.APPROVED },
    { key: "REJECTED", label: "반려", count: view.counts.REJECTED }
  ];
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>정산 심사</h1>
        <p className={styles.muted}>수수료 · 실지급액은 정산 서비스가 계산한 mock 값이에요 (수수료율 · 환율 · 최소 금액 · 지급 일정은 TBD). 반려하면 신청 금액이 크리에이터의 신청 가능 금액으로 돌아가요.</p>
      </header>
      <section className={styles.card} aria-labelledby="st-reg">
        <h2 id="st-reg" className={styles.cardTitle}>
          정산 등록 정보
        </h2>
        {reg ? (
          <dl className={styles.facts}>
            {[
              ["회원 유형", reg.memberType],
              ["등록자", reg.registrant],
              ["예금주", reg.holder],
              ["계좌", `${reg.bankName} ${reg.accountMasked}`],
              ["정산 코드", reg.code],
              ["등록일", reg.submittedAt.slice(0, 10)]
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className={styles.muted}>아직 정산 등록을 하지 않았어요. 등록 서류 심사(본인 · 사업자 확인)는 TBD예요.</p>
        )}
        <p className={styles.muted}>신청 가능 금액: {formatNumber(view.availableFn)} FN · 신분증 · 계좌 전체 번호는 표시하지 않아요.</p>
      </section>
      <nav className={styles.tabs} aria-label="정산 상태">
        {tabs.map((t) => (
          <Link key={String(t.key)} href={t.key ? `/admin/settlements?status=${t.key}` : "/admin/settlements"} className={styles.tab} aria-current={status === t.key ? "page" : undefined}>
            {t.label} {t.count}
          </Link>
        ))}
      </nav>
      <section className={styles.card}>
        {view.rows.length === 0 ? (
          <p className={styles.empty}>해당하는 정산 신청이 없어요.</p>
        ) : (
          <ul className={styles.refundList}>
            {view.rows.map((r) => (
              <li key={r.id} className={styles.refundItem}>
                <div className={styles.refundHead}>
                  <strong>
                    {r.creatorName} · {formatNumber(r.amountFn)} FN
                  </strong>
                  <span className={CHIP[r.status]}>{LABEL[r.status]}</span>
                </div>
                <p className={styles.muted}>
                  신청 {r.requestedAt} · 정산 기간 {r.periodFrom} ~ {r.periodTo} · 수수료 {formatNumber(r.feeFn)} FN · 실지급 {formatNumber(r.netKrw)}원 · 지급(예정) {r.payoutDate ?? "—"}
                </p>
                {r.review ? (
                  <p className={styles.muted}>
                    {r.review.at.slice(0, 16).replace("T", " ")} · {r.review.by} · {r.review.note}
                  </p>
                ) : r.status === "PENDING" ? (
                  <SettlementDecision id={r.id} />
                ) : (
                  <p className={styles.muted}>기존 처리 건 (처리 기록 없음 · mock 시드)</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
