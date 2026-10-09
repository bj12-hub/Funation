import Link from "next/link";
import { formatNumber } from "@/lib/format";
import {
  type AdminRefund,
  type DonationFilter,
  type DonationsView,
  type PaymentsView,
  type RefundAmounts,
  CHARGE_STATUS_LABEL,
  DONATION_FILTERS,
  DONATION_FILTER_LABEL,
  REFUND_TYPE_LABEL,
  donationRowLabel
} from "@/types/adminApi";
import styles from "../admin.module.css";
import { HoldControl } from "../HoldControl";
import { HoldChip, HoldInfo } from "../HoldInfo";
import { WithdrawnBadge } from "../WithdrawnBadge";
import { RefundDecision } from "./RefundDecision";

const REFUND_LABEL = { REQUESTED: "심사 대기", APPROVED: "승인", REJECTED: "거절" } as const;
const when = (s: string) => s.slice(0, 16).replace("T", " ");

/** A waiting request of an account that has since withdrawn: 처리 불가(탈퇴), outside 처리 대기 (2026-10-08 결정). */
const isBlocked = (r: AdminRefund) => r.status === "REQUESTED" && r.memberWithdrawn;
/** A waiting request on 보류 (2026-10-08 결정): outside 처리 대기, listed apart, decided only after 보류 해제. */
const isHeld = (r: AdminRefund) => r.status === "REQUESTED" && !isBlocked(r) && r.hold !== null;

/** "수수료 공제 후 환불 · 회수 5,000 FN · 수수료 500 FN · 환불 4,500 FN · 4,950원" — amounts as the site computed them. */
const refundText = (a: RefundAmounts) =>
  `${REFUND_TYPE_LABEL[a.type]} · 회수 ${formatNumber(a.grossFn)} FN · 수수료 ${formatNumber(a.feeFn)} FN · 환불 ${formatNumber(a.netFn)} FN · ${formatNumber(a.refundKrw)}원`;
const same = (a: RefundAmounts, b: { type: string; grossFn: number; netFn: number }) => a.type === b.type && a.grossFn === b.grossFn && a.netFn === b.netFn;

/**
 * How a refund compares with the request's (2026-10-09 결정): the charge's unused FN (회수 FN, then 환불 FN) went down —
 * FN used since — or up, when FN came back since (퀘스트 실패 · 취소, a failed 플랫폼 후원's FN 반환).
 */
function refundChange(requested: RefundAmounts, now: { type: string; grossFn: number; netFn: number }): "SAME" | "DOWN" | "UP" {
  if (same(requested, now)) return "SAME";
  return now.grossFn > requested.grossFn || (now.grossFn === requested.grossFn && now.netFn > requested.netFn) ? "UP" : "DOWN";
}
/** The note after a refund that differs from the request's, by direction. */
const CHANGED_NOTE = { DOWN: "요청 후 FN 사용으로 줄어듦", UP: "요청 후 FN이 돌아와 늘어남" } as const;
const ChangeNote = ({ requested, now }: { requested: RefundAmounts; now: { type: string; grossFn: number; netFn: number } }) => {
  const change = refundChange(requested, now);
  return change === "SAME" ? null : <span className={styles.warn}> · {CHANGED_NOTE[change]}</span>;
};

/** 환불 유형 · 수수료 · 환불 금액: at the request, now (what 승인 applies), and what approval refunded. */
function RefundAmountsFacts({ r }: { r: AdminRefund }) {
  const current = r.current;
  return (
    <dl className={styles.facts}>
      <div>
        <dt>요청 때 계산</dt>
        <dd>{refundText(r.requested)}</dd>
      </div>
      {r.approved && (
        <div>
          <dt>승인 때 적용</dt>
          <dd>
            {refundText(r.approved)}
            <ChangeNote requested={r.requested} now={r.approved} />
          </dd>
        </div>
      )}
      {current && (
        <div>
          <dt>지금 기준 (승인하면 적용)</dt>
          <dd>
            {current.type === "NOT_REFUNDABLE" ? (
              <span className={styles.warn}>환불 불가 · 요청 후 이 충전의 FN을 모두 사용했어요</span>
            ) : (
              <>
                {refundText({ type: current.type, grossFn: current.grossFn, feeFn: current.feeFn, netFn: current.netFn, refundKrw: current.refundKrw })}
                {same(r.requested, current) ? <span className={styles.muted}> · 요청 때와 같아요</span> : <ChangeNote requested={r.requested} now={current} />}
              </>
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}

function RefundItem({ r }: { r: AdminRefund }) {
  const chip = isBlocked(r) ? { className: styles.chipNeutral, label: "처리 불가(탈퇴)" } : { className: r.status === "REQUESTED" ? styles.chipWarn : r.status === "APPROVED" ? styles.chipOk : styles.chipBad, label: REFUND_LABEL[r.status] };
  const type = r.approved?.type ?? r.requested.type;
  return (
    <li className={styles.refundItem}>
      <div className={styles.refundHead}>
        <strong>{`${r.charge ? `${formatNumber(r.charge.fnAmount)} FN · ${formatNumber(r.charge.paidAmount)}원` : r.chargeId} · ${REFUND_TYPE_LABEL[type]}`}</strong>
        <span>
          <HoldChip hold={r.hold} /> <span className={chip.className}>{chip.label}</span>
        </span>
      </div>
      <p className={styles.muted}>
        {r.memberName}
        <WithdrawnBadge withdrawn={r.memberWithdrawn} /> · 충전 {r.charge ? when(r.charge.chargedAt) : "—"} · {r.charge?.methodLabel ?? "—"} · 요청 {when(r.requestedAt)}
      </p>
      <p className={styles.quote}>사유: {r.reason || "(없음)"}</p>
      <RefundAmountsFacts r={r} />
      {r.decision ? (
        <p className={styles.muted}>
          {when(r.decision.at)} · {r.decision.by} · {r.decision.note}
        </p>
      ) : isBlocked(r) || r.hold ? null : (
        <RefundDecision chargeId={r.chargeId} current={r.current} />
      )}
      {r.hold && <HoldInfo hold={r.hold} stops="승인 · 거절을" />}
      {/* 보류 for a waiting request of the current account; 보류 해제 whenever one is on, so it never stays stuck. */}
      {r.status === "REQUESTED" && (r.hold || !isBlocked(r)) && <HoldControl target={{ kind: "refund", chargeId: r.chargeId }} held={r.hold !== null} />}
    </li>
  );
}

/** 결제 · 환불 — code-first. Route `/payments` (`?tab=charges|refunds`). */
export function PaymentsScreen({ view, tab }: { view: PaymentsView; tab: "charges" | "refunds" }) {
  const blocked = view.refunds.filter(isBlocked);
  const held = view.refunds.filter(isHeld);
  const listed = view.refunds.filter((r) => !isBlocked(r) && !isHeld(r));
  // 처리 대기: what an operator can decide now (not 보류, not 처리 불가(탈퇴)).
  const waiting = listed.filter((r) => r.status === "REQUESTED").length;
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>결제 · 환불</h1>
        <p className={styles.muted}>
          충전 거래와 환불 요청을 봐요. 승인하면 FN을 회수하고 원화 환불 금액을 함께 기록해요. 결제 수단별 환불 방식은 결제 대행사 연동 후 확정이라 실제 결제 취소 · 송금은 아직 하지 않아요 (TBD).
        </p>
      </header>
      <nav className={styles.tabs} aria-label="결제 운영">
        <Link href="/payments" className={styles.tab} aria-current={tab === "charges" ? "page" : undefined}>
          충전 내역 {view.charges.length}
        </Link>
        <Link href="/payments?tab=refunds" className={styles.tab} aria-current={tab === "refunds" ? "page" : undefined}>
          환불 요청 {waiting > 0 ? <span className={styles.warn}>{waiting}</span> : 0}
          {held.length > 0 && ` · 보류 ${held.length}`}
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
          <p className={styles.muted}>회원 보유 FN: {formatNumber(view.balance)} FN · 승인하면 그 충전에서 아직 쓰지 않은 FN만 회수돼요. 처리는 되돌릴 수 없어요.</p>
          <p className={styles.muted}>{`환불 정책 · ${view.refundPolicy.label}: ${view.refundPolicy.summary}`}</p>
          <p className={styles.muted}>확인이 더 필요한 요청은 메모를 남겨 보류해요. 회원이 이용 정지 중이어도 환불 요청은 평소대로 처리해요.</p>
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
              {held.length > 0 && (
                <section aria-labelledby="refunds-held">
                  <h2 id="refunds-held" className={styles.subTitle}>
                    보류 {held.length}
                  </h2>
                  <p className={styles.muted}>보류를 해제할 때까지 승인 · 거절할 수 없어서 처리 대기에 넣지 않아요. 회원 화면에는 그대로 심사 중으로 보여요.</p>
                  <ul className={styles.refundList}>
                    {held.map((r) => (
                      <RefundItem key={r.chargeId} r={r} />
                    ))}
                  </ul>
                </section>
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

/**
 * 후원 운영 — code-first. Route `/donations` (`?status=`). Read-only; donation refunds are TBD. A failed 플랫폼 후원 whose
 * held FN went back reads FN 반환 (its own tile), not 환불완료 (2026-10-09 결정).
 */
export function DonationsAdminScreen({ view, status }: { view: DonationsView; status: DonationFilter | null }) {
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>후원 운영</h1>
        <p className={styles.muted}>후원 주문을 상태 · 유형별로 봐요. 후원 취소 · 환불 처리 규칙은 TBD라 조회만 돼요.</p>
      </header>
      <section className={styles.tiles} aria-label="상태별 합계">
        {DONATION_FILTERS.map((s) => (
          <Link key={s} href={status === s ? "/donations" : `/donations?status=${s}`} className={styles.tile} aria-current={status === s ? "true" : undefined}>
            <span className={styles.muted}>{DONATION_FILTER_LABEL[s]}</span>
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
            후원 내역 {status ? `· ${DONATION_FILTER_LABEL[status]}` : ""} ({formatNumber(view.rows.length)})
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
                    <td>{donationRowLabel(d)}</td>
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
