import Link from "next/link";
import { FLEXTV_WEB_URL } from "@/lib/flextv/mode";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import type { ExchangeHistoryView, ExchangeRow, FlextvSettlementView } from "@/services/creator/flextvSettlementTypes";
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
/** "2026.10.25 15:04" (FLEXTV's KST). */
const formatAt = (at: string) => at.slice(0, 16).replaceAll("-", ".");

/** FLEXTV's 환전 status codes (`ExchangeRow.status`); any other code shows as 처리 중. */
const EXCHANGE_STATUS_KEY: Record<number, MessageKey> = {
  0: "flextvSettlement.statusRequested",
  1: "flextvSettlement.statusInReview",
  2: "flextvSettlement.statusReviewed",
  4: "flextvSettlement.statusAwaitingPayout",
  7: "flextvSettlement.statusCanceled",
  8: "flextvSettlement.statusRejected",
  9: "flextvSettlement.statusPaid"
};

async function Tiles({ view }: { view: FlextvSettlementView }) {
  const t = await getT();
  return (
    <div className={styles.tiles}>
      <div className={styles.tile}>
        <span>{t("flextvSettlement.tileAvailable")}</span>
        <strong>{formatNumber(view.exchangeable)} FN</strong>
      </div>
      <div className={styles.tile}>
        <span>{t("flextvSettlement.tileInProgress")}</span>
        <strong>{formatNumber(view.exchanging)} FN</strong>
      </div>
      <div className={styles.tile}>
        <span>{t("flextvSettlement.tileDone")}</span>
        <strong>{formatNumber(view.exchanged)} FN</strong>
      </div>
    </div>
  );
}

export async function FlextvSettlementHome({ view }: { view: FlextvSettlementView }) {
  const t = await getT();
  const steps = [
    {
      label: t("flextvSettlement.stepIdentity"),
      done: view.identityVerified,
      status: view.identityVerified ? t("flextvSettlement.stepDone") : t("flextvSettlement.identityNeeded"),
      href: IDENTITY_URL,
      action: t("flextvSettlement.verifyIdentity"),
      external: true
    },
    {
      label: t("flextvSettlement.payoutAccount"),
      done: view.account !== null,
      status: view.account ? `${view.account.bankName} ${view.account.accountMasked}` : t("flextvSettlement.accountNeeded"),
      href: "/creator/settlement/register",
      action: t("flextvSettlement.accountGuide"),
      external: false
    },
    // The request hours are FLEXTV's schedule (policy wording): Korean in both languages.
    { label: t("flextvSettlement.stepHours"), done: view.open, status: view.open ? t("flextvSettlement.openNow") : "매일 0시 1분부터 오후 2시 전까지 신청할 수 있어요", href: null, action: null, external: false }
  ];
  const ready = view.identityVerified && view.account !== null;
  return (
    <div className={styles.content}>
      <SettlementTabs active="register" />
      <h1 className={styles.pageTitle}>{t("flextvSettlement.homeTitle")}</h1>
      <Tiles view={view} />
      <section className={styles.card} aria-labelledby="fx-steps">
        <h2 id="fx-steps" className={styles.cardTitle}>
          {t("flextvSettlement.setupTitle")}
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
              {t("flextvSettlement.request")}
            </Link>
          ) : (
            <span className={styles.primaryButton} aria-disabled="true">
              {t("flextvSettlement.request")}
            </span>
          )}
          <Link href="/creator/settlement/manage" className={styles.secondaryButton}>
            {t("flextvSettlement.history")}
          </Link>
        </div>
        {/* The payout line (contract rate, withholding tax) is policy wording: Korean in both languages. */}
        <p className={styles.note}>{t("flextvSettlement.homeNote")} 지급액은 FLEXTV가 계약 요율과 세금(원천징수)을 적용해 정해요.</p>
      </section>
      <History title={t("flextvSettlement.recentTitle")} items={view.recent} />
    </div>
  );
}

export async function FlextvAccountScreen({ view }: { view: FlextvSettlementView }) {
  const t = await getT();
  return (
    <div className={styles.content}>
      <SettlementTabs active="register" />
      <h1 className={styles.pageTitle}>{t("flextvSettlement.payoutAccount")}</h1>
      <section className={styles.card} aria-labelledby="fx-account">
        <h2 id="fx-account" className={styles.cardTitle}>
          {t("flextvSettlement.registeredAccount")}
        </h2>
        {view.account ? (
          <dl className={styles.account}>
            <dt>{t("flextvSettlement.bank")}</dt>
            <dd>{view.account.bankName}</dd>
            <dt>{t("flextvSettlement.accountNo")}</dt>
            <dd>{view.account.accountMasked}</dd>
            <dt>{t("flextvSettlement.holder")}</dt>
            <dd>{view.account.holder}</dd>
          </dl>
        ) : (
          <p className={styles.help}>{t("flextvSettlement.noAccount")}</p>
        )}
        {/* The document review and the document lists are account and document requirements: Korean in both languages. */}
        <p className={styles.help}>{t("flextvSettlement.accountWhere")} FLEXTV가 제출한 서류를 확인한 뒤 계좌가 반영돼요.</p>
        <ul className={styles.list}>
          <li>개인: 신분증 사본, 통장 사본</li>
          <li>사업자: 신분증 사본, 통장 사본, 사업자등록증</li>
        </ul>
        <div className={styles.actions}>
          <a href={FLEXTV_EXCHANGE_URL} target="_blank" rel="noopener noreferrer" className={styles.primaryButton}>
            {view.account ? t("flextvSettlement.changeAccount") : t("flextvSettlement.registerAccount")}
          </a>
          {!view.identityVerified && (
            <a href={IDENTITY_URL} target="_blank" rel="noopener noreferrer" className={styles.secondaryButton}>
              {t("flextvSettlement.verifyOnFlextv")}
            </a>
          )}
        </div>
      </section>
    </div>
  );
}

export async function FlextvApplyScreen({ view }: { view: FlextvSettlementView }) {
  const t = await getT();
  return (
    <div className={styles.content}>
      <SettlementTabs active="apply" />
      <h1 className={styles.pageTitle}>{t("flextvSettlement.requestTitle")}</h1>
      <Tiles view={view} />
      <FlextvExchangeForm view={view} />
      <History title={t("flextvSettlement.recentTitle")} items={view.recent} />
    </div>
  );
}

export async function FlextvManageScreen({ view }: { view: ExchangeHistoryView }) {
  const t = await getT();
  const pages = Array.from({ length: view.totalPages }, (_, i) => i + 1).filter((p) => Math.abs(p - view.page) <= 2 || p === 1 || p === view.totalPages);
  return (
    <div className={styles.content}>
      <SettlementTabs active="manage" />
      <h1 className={styles.pageTitle}>{t("flextvSettlement.manageTitle")}</h1>
      <History title={t("flextvSettlement.requestsTitle", { count: formatNumber(view.total) })} items={view.items} cancel />
      {view.totalPages > 1 && (
        <nav className={styles.pagination} aria-label={t("flextvSettlement.pages")}>
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
      {/* The cancel days and the amount lines (contract rate, withholding tax) are policy wording: Korean in both languages. */}
      <p className={styles.note}>{t("flextvSettlement.manageNote")} 수요일과 목요일에는 취소할 수 없어요. 신청 금액은 계약 요율을 적용한 금액이고, 실수령액은 원천징수 후 금액이에요.</p>
    </div>
  );
}

async function History({ title, items, cancel = false }: { title: string; items: ExchangeRow[]; cancel?: boolean }) {
  const t = await getT();
  const won = (n: number) => t("flextvSettlement.won", { amount: formatNumber(n) });
  return (
    <section className={styles.card} aria-label={title}>
      <h2 className={styles.cardTitle}>{title}</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t("flextvSettlement.colAt")}</th>
              <th scope="col" className={styles.right}>
                {t("flextvSettlement.requestedRex")}
              </th>
              <th scope="col" className={styles.right}>
                {t("flextvSettlement.colGross")}
              </th>
              <th scope="col" className={styles.right}>
                {t("flextvSettlement.colTax")}
              </th>
              <th scope="col" className={styles.right}>
                {t("flextvSettlement.colNet")}
              </th>
              <th scope="col">{t("flextvSettlement.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  {t("flextvSettlement.empty")}
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
                      {t(EXCHANGE_STATUS_KEY[w.status] ?? "flextvSettlement.statusProcessing")}
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
