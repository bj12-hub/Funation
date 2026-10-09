import Link from "next/link";
import { formatNumber, kstIsoString } from "@/lib/format";
import type { AdminSettlementView, SettlementFilter, SettlementStatus } from "@/types/adminApi";
import styles from "../admin.module.css";
import { HoldControl } from "../HoldControl";
import { HoldChip, HoldInfo } from "../HoldInfo";
import { WithdrawnBadge } from "../WithdrawnBadge";
import { SettlementDecision } from "./SettlementDecision";
import { SettlementPayment } from "./SettlementPayment";

const LABEL: Record<SettlementStatus, string> = { PENDING: "심사 대기", APPROVED: "승인", PAID: "지급 완료", REJECTED: "반려", FORFEITED: "탈퇴 소멸" };
const CHIP: Record<SettlementStatus, string> = { PENDING: styles.chipWarn, APPROVED: styles.chipOk, PAID: styles.chipOk, REJECTED: styles.chipBad, FORFEITED: styles.chipNeutral };
/** "2026-10-08 15:04" in Korea time. */
const when = (iso: string) => kstIsoString(iso).slice(0, 16).replace("T", " ");

/**
 * 정산 심사 — code-first. Route `/settlements` (`?status=`, `HELD` = 보류). 승인 → 지급 완료 (2026-10-08 결정), also for a
 * creator who withdrew after the approval. 보류 (2026-10-08 결정): a held request is counted in the 보류 tab only, keeps
 * its status chip next to a "보류" chip, and offers 보류 해제 instead of 승인 · 반려 · 지급 완료.
 */
export function SettlementReviewScreen({ view, status }: { view: AdminSettlementView; status: SettlementFilter | null }) {
  const reg = view.registration;
  const c = view.counts;
  const tabs: { key: SettlementFilter | null; label: string; count: number }[] = [
    { key: null, label: "전체", count: c.PENDING + c.APPROVED + c.PAID + c.REJECTED + c.FORFEITED + view.held },
    { key: "PENDING", label: "심사 대기", count: c.PENDING },
    { key: "APPROVED", label: "승인", count: c.APPROVED },
    { key: "PAID", label: "지급 완료", count: c.PAID },
    { key: "REJECTED", label: "반려", count: c.REJECTED },
    { key: "FORFEITED", label: "탈퇴 소멸", count: c.FORFEITED },
    { key: "HELD", label: "보류", count: view.held }
  ];
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>정산 심사</h1>
        <p className={styles.muted}>수수료 · 실지급액은 정산 서비스가 계산한 mock 값이에요 (수수료율 · 환율 · 최소 금액 · 지급 일정은 TBD). 반려하면 신청 금액이 크리에이터의 신청 가능 금액으로 돌아가요. 승인한 신청은 이체 후 이체 참조번호로 지급 완료 처리해요 (지급 수단 · 이체 연동은 TBD).</p>
        <p className={styles.muted}>확인이 더 필요한 신청은 메모를 남겨 보류해요. 보류를 해제할 때까지 승인 · 반려 · 지급 완료를 할 수 없고, 크리에이터 화면은 그대로예요. 크리에이터가 이용 정지 중이어도 심사 · 지급은 평소대로 해요.</p>
      </header>
      <section className={styles.card} aria-labelledby="st-reg">
        <h2 id="st-reg" className={styles.cardTitle}>
          현재 정산 등록 정보
        </h2>
        <p className={styles.muted}>심사 · 지급은 신청마다 신청 시점의 정산 정보로 진행돼요. 신청 후 정보를 변경해도 이미 신청한 건에는 반영되지 않아요.</p>
        {reg ? (
          <dl className={styles.facts}>
            {[
              ["회원 유형", reg.memberType],
              ["등록자", reg.registrant],
              ["예금주", reg.holder],
              ["계좌", `${reg.bankName} ${reg.accountMasked}`],
              ["정산 코드", reg.code],
              ["등록일", kstIsoString(reg.submittedAt).slice(0, 10)]
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
          <Link key={String(t.key)} href={t.key ? `/settlements?status=${t.key}` : "/settlements"} className={styles.tab} aria-current={status === t.key ? "page" : undefined}>
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
                    {r.creatorName}
                    <WithdrawnBadge withdrawn={r.creatorWithdrawn} /> · {formatNumber(r.amountFn)} FN
                  </strong>
                  <span>
                    <HoldChip hold={r.hold} /> <span className={CHIP[r.status]}>{LABEL[r.status]}</span>
                  </span>
                </div>
                <p className={styles.muted}>
                  신청 {r.requestedAt} · 정산 기간 {r.periodFrom} ~ {r.periodTo} · 수수료 {formatNumber(r.feeFn)} FN · 실지급 {formatNumber(r.netKrw)}원 · 지급(예정) {r.payoutDate ?? "—"}
                </p>
                {r.registrationAtRequest ? (
                  <p className={styles.muted}>
                    신청 시점 정산 정보 · {r.registrationAtRequest.memberType} · 등록자 {r.registrationAtRequest.registrant} · 예금주 {r.registrationAtRequest.holder} · {r.registrationAtRequest.bankName}{" "}
                    {r.registrationAtRequest.accountMasked} · 정산 코드 {r.registrationAtRequest.code}
                  </p>
                ) : r.status === "PENDING" ? (
                  <p className={styles.error}>신청 시점의 정산 정보가 없어 승인할 수 없어요. 반려만 할 수 있어요.</p>
                ) : (
                  <p className={styles.muted}>신청 시점 정산 정보 없음</p>
                )}
                {r.review ? (
                  <p className={styles.muted}>
                    {when(r.review.at)} · {r.review.by} · {r.review.note}
                  </p>
                ) : r.status === "PENDING" ? (
                  !r.hold && <SettlementDecision id={r.id} canApprove={r.registrationAtRequest !== null} />
                ) : (
                  <p className={styles.muted}>기존 처리 건 (처리 기록 없음 · mock 시드)</p>
                )}
                {r.payment ? (
                  <p className={styles.muted}>
                    지급 완료 {when(r.payment.at)} · {r.payment.by} · 이체 참조 {r.payment.reference}
                  </p>
                ) : r.status === "APPROVED" && !r.hold ? (
                  <SettlementPayment id={r.id} />
                ) : null}
                {r.hold && <HoldInfo hold={r.hold} stops={r.status === "PENDING" ? "승인 · 반려를" : "지급 완료를"} />}
                {(r.status === "PENDING" || r.status === "APPROVED") && <HoldControl target={{ kind: "settlement", id: r.id }} held={r.hold !== null} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
