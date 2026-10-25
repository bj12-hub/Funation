import Link from "next/link";
import { FLEXTV_WEB_URL } from "@/lib/flextv/mode";
import { formatNumber } from "@/lib/format";
import { exchangeStatusLabel, type ExchangeHistoryView, type ExchangeRow, type FlextvSettlementView } from "@/services/creator/flextvSettlementTypes";
import { FlextvCancelButton } from "./FlextvCancelButton";
import { FlextvExchangeForm } from "./FlextvExchangeForm";
import { SettlementTabs } from "./SettlementTabs";
import styles from "./flextv.module.css";

/**
 * 정산 with FLEXTV (phase 5; code-first, no Figma frame — FLEXTV's 환전 page is the reference): 정산 현황
 * (`/creator/settlement`), 정산 계좌 (`/register`), 정산 신청 (`/apply`) and 정산 관리 (`/manage`). The account is
 * registered on FLEXTV's site, where its review runs; every ₩ figure is FLEXTV's.
 */

export const FLEXTV_EXCHANGE_URL = `${FLEXTV_WEB_URL}/my/exchange`;
const IDENTITY_URL = `${FLEXTV_WEB_URL}/my/personal-auth`;
const won = (n: number) => `${formatNumber(n)}원`;
/** "2026.10.25 15:04" (FLEXTV's KST). */
const formatAt = (at: string) => at.slice(0, 16).replaceAll("-", ".");

function Tiles({ view }: { view: FlextvSettlementView }) {
  return (
    <div className={styles.tiles}>
      <div className={styles.tile}>
        <span>정산 가능</span>
        <strong>{formatNumber(view.exchangeable)} FN</strong>
      </div>
      <div className={styles.tile}>
        <span>정산 진행 중</span>
        <strong>{formatNumber(view.exchanging)} FN</strong>
      </div>
      <div className={styles.tile}>
        <span>정산 완료</span>
        <strong>{formatNumber(view.exchanged)} FN</strong>
      </div>
    </div>
  );
}

export function FlextvSettlementHome({ view }: { view: FlextvSettlementView }) {
  const steps = [
    { label: "본인인증", done: view.identityVerified, status: view.identityVerified ? "완료" : "FLEXTV에서 본인인증이 필요해요", href: IDENTITY_URL, action: "본인인증하기", external: true },
    {
      label: "정산 계좌",
      done: view.account !== null,
      status: view.account ? `${view.account.bankName} ${view.account.accountMasked}` : "FLEXTV에 정산 계좌를 등록해 주세요",
      href: "/creator/settlement/register",
      action: "계좌 등록 안내",
      external: false
    },
    { label: "정산 신청 시간", done: view.open, status: view.open ? "지금 신청할 수 있어요" : "매일 0시 1분부터 오후 2시 전까지 신청할 수 있어요", href: null, action: null, external: false }
  ];
  const ready = view.identityVerified && view.account !== null;
  return (
    <div className={styles.content}>
      <SettlementTabs active="register" />
      <h1 className={styles.pageTitle}>정산 현황</h1>
      <Tiles view={view} />
      <section className={styles.card} aria-labelledby="fx-steps">
        <h2 id="fx-steps" className={styles.cardTitle}>
          정산 준비
        </h2>
        <ol className={styles.steps}>
          {steps.map((s, i) => (
            <li key={s.label} className={styles.step} data-done={s.done || undefined}>
              <span className={styles.mark} aria-hidden="true">
                {s.done ? "✓" : i + 1}
              </span>
              <span className={styles.stepText}>
                <strong>{s.label}</strong>
                <span>{s.status}</span>
              </span>
              {!s.done &&
                s.href &&
                (s.external ? (
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className={styles.linkButton}>
                    {s.action}
                  </a>
                ) : (
                  <Link href={s.href} className={styles.linkButton}>
                    {s.action}
                  </Link>
                ))}
            </li>
          ))}
        </ol>
        <div className={styles.actions}>
          {ready ? (
            <Link href="/creator/settlement/apply" className={styles.primaryButton}>
              정산 신청하기
            </Link>
          ) : (
            <span className={styles.primaryButton} aria-disabled="true">
              정산 신청하기
            </span>
          )}
          <Link href="/creator/settlement/manage" className={styles.secondaryButton}>
            정산 내역
          </Link>
        </div>
        <p className={styles.note}>정산은 FLEXTV의 환전으로 처리돼요. 지급액은 FLEXTV가 계약 요율과 세금(원천징수)을 적용해 정해요.</p>
      </section>
      <History title="최근 정산 신청" items={view.recent} />
    </div>
  );
}

export function FlextvAccountScreen({ view }: { view: FlextvSettlementView }) {
  return (
    <div className={styles.content}>
      <SettlementTabs active="register" />
      <h1 className={styles.pageTitle}>정산 계좌</h1>
      <section className={styles.card} aria-labelledby="fx-account">
        <h2 id="fx-account" className={styles.cardTitle}>
          등록된 계좌
        </h2>
        {view.account ? (
          <dl className={styles.account}>
            <dt>은행</dt>
            <dd>{view.account.bankName}</dd>
            <dt>계좌번호</dt>
            <dd>{view.account.accountMasked}</dd>
            <dt>예금주</dt>
            <dd>{view.account.holder}</dd>
          </dl>
        ) : (
          <p className={styles.help}>아직 등록된 정산 계좌가 없어요.</p>
        )}
        <p className={styles.help}>정산 계좌는 FLEXTV의 환전 정보 등록에서 등록하고 바꿀 수 있어요. FLEXTV가 제출한 서류를 확인한 뒤 계좌가 반영돼요.</p>
        <ul className={styles.list}>
          <li>개인: 신분증 사본, 통장 사본</li>
          <li>사업자: 신분증 사본, 통장 사본, 사업자등록증</li>
        </ul>
        <div className={styles.actions}>
          <a href={FLEXTV_EXCHANGE_URL} target="_blank" rel="noopener noreferrer" className={styles.primaryButton}>
            FLEXTV에서 {view.account ? "계좌 변경하기" : "계좌 등록하기"}
          </a>
          {!view.identityVerified && (
            <a href={IDENTITY_URL} target="_blank" rel="noopener noreferrer" className={styles.secondaryButton}>
              FLEXTV에서 본인인증하기
            </a>
          )}
        </div>
      </section>
    </div>
  );
}

export function FlextvApplyScreen({ view }: { view: FlextvSettlementView }) {
  return (
    <div className={styles.content}>
      <SettlementTabs active="apply" />
      <h1 className={styles.pageTitle}>정산 신청</h1>
      <Tiles view={view} />
      <FlextvExchangeForm view={view} />
      <History title="최근 정산 신청" items={view.recent} />
    </div>
  );
}

export function FlextvManageScreen({ view }: { view: ExchangeHistoryView }) {
  const pages = Array.from({ length: view.totalPages }, (_, i) => i + 1).filter((p) => Math.abs(p - view.page) <= 2 || p === 1 || p === view.totalPages);
  return (
    <div className={styles.content}>
      <SettlementTabs active="manage" />
      <h1 className={styles.pageTitle}>정산 관리</h1>
      <History title={`정산 신청 내역 (${formatNumber(view.total)}건)`} items={view.items} cancel />
      {view.totalPages > 1 && (
        <nav className={styles.pagination} aria-label="페이지">
          {pages.map((p) =>
            p === view.page ? (
              <span key={p} aria-current="page">
                {p}
              </span>
            ) : (
              <Link key={p} href={`/creator/settlement/manage?page=${p}`}>
                {p}
              </Link>
            )
          )}
        </nav>
      )}
      <p className={styles.note}>신청 상태일 때만 취소할 수 있어요. 수요일과 목요일에는 취소할 수 없어요. 신청 금액은 계약 요율을 적용한 금액이고, 실수령액은 원천징수 후 금액이에요.</p>
    </div>
  );
}

function History({ title, items, cancel = false }: { title: string; items: ExchangeRow[]; cancel?: boolean }) {
  return (
    <section className={styles.card} aria-label={title}>
      <h2 className={styles.cardTitle}>{title}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">신청 일시</th>
              <th scope="col" className={styles.right}>
                신청 렉스
              </th>
              <th scope="col" className={styles.right}>
                신청 금액
              </th>
              <th scope="col" className={styles.right}>
                원천징수
              </th>
              <th scope="col" className={styles.right}>
                실수령액
              </th>
              <th scope="col">상태</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  정산 신청 내역이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((w) => (
                <tr key={w.id}>
                  <td>{formatAt(w.at)}</td>
                  <td className={styles.right}>{formatNumber(w.rex)} FN</td>
                  <td className={styles.right}>{won(w.grossKrw)}</td>
                  <td className={styles.right}>{won(w.taxKrw)}</td>
                  <td className={styles.right}>{won(w.netKrw)}</td>
                  <td>
                    <span className={styles.status} data-tone={w.status === 9 ? "done" : w.status === 7 || w.status === 8 ? "stop" : undefined}>
                      {exchangeStatusLabel(w.status)}
                    </span>
                    {cancel && w.cancelable && <FlextvCancelButton id={w.id} />}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
