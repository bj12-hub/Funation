import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { type AdminRefund, type DonationsView, type PaymentsView, CHARGE_STATUS_LABEL, DONATION_STATUS_LABEL, type DonationStatus } from "@/types/adminApi";
import styles from "../admin.module.css";
import { WithdrawnBadge } from "../WithdrawnBadge";
import { RefundDecision } from "./RefundDecision";

const REFUND_LABEL = { REQUESTED: "심사 대기", APPROVED: "승인", REJECTED: "거절" } as const;
const when = (s: string) => s.slice(0, 16).replace("T", " ");

/** A waiting request of an account that has since withdrawn: 처리 불가(탈퇴), outside 처리 대기 (2026-10-08 결정). */
const isBlocked = (r: AdminRefund) => r.status === "REQUESTED" && r.memberWithdrawn;

function RefundItem({ r }: { r: AdminRefund }) {
  const chip = isBlocked(r) ? { className: styles.chipNeutral, label: "처리 불가(탈퇴)" } : { className: r.status === "REQUESTED" ? styles.chipWarn : r.status === "APPROVED" ? styles.chipOk : styles.chipBad, label: REFUND_LABEL[r.status] };
  return (
    <li className={styles.refundItem}>
      <div className={styles.refundHead}>
        <strong>{r.charge ? `${formatNumber(r.charge.fnAmount)} FN · ${formatNumber(r.charge.paidAmount)}원` : r.chargeId}</strong>
        <span className={chip.className}>{chip.label}</span>
      </div>
      <p className={styles.muted}>
        {r.memberName}
        <WithdrawnBadge withdrawn={r.memberWithdrawn} /> · 충전 {r.charge ? when(r.charge.chargedAt) : "—"} · {r.charge?.methodLabel ?? "—"} · 요청 {when(r.requestedAt)}
      </p>
      <p className={styles.quote}>사유: {r.reason || "(없음)"}</p>
      {r.decision ? (
        <p className={styles.muted}>
          {when(r.decision.at)} · {r.decision.by} · {r.decision.note}
        </p>
      ) : isBlocked(r) ? null : (
        <RefundDecision chargeId={r.chargeId} />
      )}
    </li>
  );
}

/** 결제 · 환불 — code-first. Route `/payments` (`?tab=charges|refunds`). */
export function PaymentsScreen({ view, tab }: { view: PaymentsView; tab: "charges" | "refunds" }) {
  const blocked = view.refunds.filter(isBlocked);
  const listed = view.refunds.filter((r) => !isBlocked(r));
  // 처리 대기: what an operator can decide now.
  const waiting = listed.filter((r) => r.status === "REQUESTED").length;
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>결제 · 환불</h1>
        <p className={styles.muted}>충전 거래와 환불 요청을 봐요. 결제대행사 연동 · 결제 취소(원화 환불) 처리는 TBD라, 승인 시 FN 회수만 반영돼요.</p>
      </header>
      <nav className={styles.tabs} aria-label="결제 운영">
        <Link href="/payments" className={styles.tab} aria-current={tab === "charges" ? "page" : undefined}>
          충전 내역 {view.charges.length}
        </Link>
        <Link href="/payments?tab=refunds" className={styles.tab} aria-current={tab === "refunds" ? "page" : undefined}>
          환불 요청 {waiting > 0 ? <span className={styles.warn}>{waiting}</span> : 0}
        </Link>
      </nav>

      {tab === "charges" ? (
        <section className={styles.card}>
          {view.charges.length === 0 ? (
            <p className={styles.empty}>충전 내역이 없어요.</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">일시</th>
                  <th scope="col">회원</th>
                  <th scope="col">충전 FN</th>
                  <th scope="col">결제 금액</th>
                  <th scope="col">수단</th>
                  <th scope="col">상태</th>
                  <th scope="col">거래 번호</th>
                </tr>
              </thead>
              <tbody>
                {view.charges.map((c) => (
                  <tr key={c.id}>
                    <td>{when(c.chargedAt)}</td>
                    <td>
                      <Link href={`/members/${c.memberId}`} className={styles.rowLink}>
                        {c.memberName}
                      </Link>
                      <WithdrawnBadge withdrawn={c.memberWithdrawn} />
                    </td>
                    <td>{formatNumber(c.fnAmount)} FN</td>
                    <td>{formatNumber(c.paidAmount)}원</td>
                    <td>{c.methodLabel}</td>
                    <td>
                      {CHARGE_STATUS_LABEL[c.status]}
                      {c.refund && <span className={styles.muted}> · 환불 {REFUND_LABEL[c.refund.status]}</span>}
                    </td>
                    <td>{c.transactionId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : (
        <section className={styles.card}>
          <p className={styles.muted}>회원 보유 FN: {formatNumber(view.balance)} FN · 승인하면 충전 FN이 보유 FN에서 회수돼요. 처리는 되돌릴 수 없어요.</p>
          {view.refunds.length === 0 ? (
            <p className={styles.empty}>환불 요청이 없어요. 회원은 FN 충전내역의 상세에서 요청할 수 있어요.</p>
          ) : (
            <>
              {listed.length > 0 && (
                <ul className={styles.refundList}>
                  {listed.map((r) => (
                    <RefundItem key={r.chargeId} r={r} />
                  ))}
                </ul>
              )}
              {blocked.length > 0 && (
                <section aria-labelledby="refunds-blocked">
                  <h2 id="refunds-blocked" className={styles.subTitle}>
                    처리 불가(탈퇴) {blocked.length}
                  </h2>
                  <p className={styles.muted}>탈퇴한 회원의 요청이라 승인 · 거절할 수 없어서 처리 대기에 넣지 않아요. 처리 중인 환불이 있으면 탈퇴할 수 없으니(2026-10-06 결정) 탈퇴와 거의 같은 때 들어온 요청만 여기에 남아요.</p>
                  <ul className={styles.refundList}>
                    {blocked.map((r) => (
                      <RefundItem key={r.chargeId} r={r} />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

const STATUSES: DonationStatus[] = ["COMPLETED", "PROCESSING", "FAILED", "REFUNDING", "REFUNDED"];

/** 후원 운영 — code-first. Route `/donations` (`?status=`). Read-only; donation refunds are TBD. */
export function DonationsAdminScreen({ view, status }: { view: DonationsView; status: DonationStatus | null }) {
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>후원 운영</h1>
        <p className={styles.muted}>후원 주문을 상태 · 유형별로 봐요. 후원 취소 · 환불 처리 규칙은 TBD라 조회만 돼요.</p>
      </header>
      <section className={styles.tiles} aria-label="상태별 합계">
        {STATUSES.map((s) => (
          <Link key={s} href={status === s ? "/donations" : `/donations?status=${s}`} className={styles.tile} aria-current={status === s ? "true" : undefined}>
            <span className={styles.muted}>{DONATION_STATUS_LABEL[s]}</span>
            <strong className={styles.tileValue}>{formatNumber(view.byStatus[s].count)}건</strong>
            <span className={styles.muted}>{formatNumber(view.byStatus[s].fn)} FN</span>
          </Link>
        ))}
      </section>
      <div className={styles.split}>
        <section className={styles.card} aria-labelledby="dn-types">
          <h2 id="dn-types" className={styles.cardTitle}>
            유형별 (완료)
          </h2>
          {view.byType.length === 0 ? (
            <p className={styles.empty}>완료된 후원이 없어요.</p>
          ) : (
            <ul className={styles.queue}>
              {view.byType.map((t) => (
                <li key={t.typeLabel}>
                  <span>{t.typeLabel}</span>
                  <strong>{formatNumber(t.fn)} FN</strong>
                  <span className={styles.muted}>{formatNumber(t.count)}건</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={styles.card} aria-labelledby="dn-list">
          <h2 id="dn-list" className={styles.cardTitle}>
            후원 내역 {status ? `· ${DONATION_STATUS_LABEL[status]}` : ""} ({formatNumber(view.rows.length)})
          </h2>
          {view.rows.length === 0 ? (
            <p className={styles.empty}>{status ? "해당하는 후원이 없어요." : "후원 내역이 없어요."}</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">일시</th>
                  <th scope="col">후원자 → 크리에이터</th>
                  <th scope="col">유형</th>
                  <th scope="col">FN</th>
                  <th scope="col">상태</th>
                </tr>
              </thead>
              <tbody>
                {view.rows.map((d) => (
                  <tr key={d.id}>
                    <td>{when(d.donatedAt)}</td>
                    <td>
                      {d.memberName}
                      <WithdrawnBadge withdrawn={d.memberWithdrawn} /> → {d.creatorName}
                    </td>
                    <td>{d.typeLabel}</td>
                    <td>{formatNumber(d.fnAmount)}</td>
                    <td>{DONATION_STATUS_LABEL[d.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
