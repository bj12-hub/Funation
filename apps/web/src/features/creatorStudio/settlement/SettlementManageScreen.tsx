import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import type { SettlementManageView } from "@/services/creator/settlementTypes";
import { ChangeInfoButton, ManageFilter, SettlementCsvButton } from "./ManageControls";
import { SettlementTabs } from "./SettlementTabs";
import { MEMBER_TYPE_KEY, SETTLEMENT_STATUS_KEY } from "./settlementLabels";
import applyStyles from "./apply.module.css";
import styles from "./manage.module.css";

const fn = (n: number) => n.toLocaleString("ko-KR");
const short = (iso: string) => iso.slice(5);

/** Figma 478:2 · 479:144 — 정산 관리 (route `/creator/settlement/manage`). */
export async function SettlementManageScreen({ view }: { view: SettlementManageView }) {
  const t = await getT();
  const qs = (page: number) => {
    const p = new URLSearchParams({ period: view.period, page: String(page) });
    if (view.period === "custom") {
      p.set("from", view.from);
      p.set("to", view.to);
    }
    return `/creator/settlement/manage?${p}`;
  };

  return (
    <div className={applyStyles.content}>
      <SettlementTabs active="manage" />
      <h1 className={applyStyles.pageTitle}>{t("studioSettlementApply.manageTitle")}</h1>

      <section className={styles.infoCard} aria-label={t("studioSettlementApply.registrationAria")}>
        <dl className={styles.info}>
          <div>
            <dt>{t("studioSettlementApply.registrant")}</dt>
            <dd>{view.registrant}</dd>
          </div>
          <div>
            <dt>{t("studioSettlementApply.payoutAccountLabel")}</dt>
            <dd>
              {view.bankName} {view.accountMasked}
            </dd>
          </div>
          <div>
            <dt>{t("studioSettlementApply.memberType")}</dt>
            <dd>{t(MEMBER_TYPE_KEY[view.memberType])}</dd>
          </div>
        </dl>
        <ChangeInfoButton />
      </section>

      <ManageFilter key={`${view.period}-${view.from}-${view.to}`} period={view.period} from={view.from} to={view.to} />
      <SettlementCsvButton key={`csv-${view.period}-${view.from}-${view.to}`} period={view.period} from={view.from} to={view.to} />

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t("studioSettlementApply.colStatus")}</th>
              <th scope="col">{t("studioSettlementApply.colRequested")}</th>
              <th scope="col">{t("studioSettlementApply.colPeriod")}</th>
              <th scope="col">{t("studioSettlementApply.colAmount")}</th>
              <th scope="col">{t("studioSettlementApply.colFee")}</th>
              <th scope="col">{t("studioSettlementApply.colNet")}</th>
              <th scope="col">{t("studioSettlementApply.colPayoutDate")}</th>
            </tr>
          </thead>
          <tbody>
            {view.items.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.empty}>
                  {t("studioSettlementApply.empty")}
                </td>
              </tr>
            ) : (
              view.items.map((r) => {
                const rejected = r.status === "REJECTED" || r.status === "FORFEITED";
                return (
                  <tr key={r.id}>
                    <td>
                      <span className={applyStyles.badge} data-status={r.status}>
                        {t(SETTLEMENT_STATUS_KEY[r.status])}
                      </span>
                      {r.reviewNote && <p className={styles.reviewNote}>{t("studioSettlementApply.reason", { note: r.reviewNote })}</p>}
                    </td>
                    <td>{r.requestedAt}</td>
                    <td>
                      {r.periodFrom} ~ {short(r.periodTo)}
                    </td>
                    <td>{fn(r.amountFn)} FN</td>
                    <td className={rejected ? undefined : styles.fee}>{rejected ? "-" : `-${fn(r.feeFn)}`}</td>
                    <td className={styles.net}>{rejected ? "-" : `${fn(r.netKrw)} 원`}</td>
                    {/* 지급 완료: the day the transfer was recorded; otherwise the scheduled payout. */}
                    <td>{r.paidAt ?? r.payoutDate ?? "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <nav className={styles.pagination} aria-label={t("studioSettlementApply.pages")}>
        {view.page > 1 ? (
          <Link href={qs(view.page - 1)} className={styles.pageButton} aria-label={t("studioSettlementApply.prevPage")}>
            ‹
          </Link>
        ) : (
          <span className={styles.pageButton} aria-disabled="true">
            ‹
          </span>
        )}
        {Array.from({ length: view.totalPages }, (_, i) => i + 1).map((n) => (
          <Link key={n} href={qs(n)} className={styles.pageButton} aria-current={n === view.page ? "page" : undefined}>
            {n}
          </Link>
        ))}
        {view.page < view.totalPages ? (
          <Link href={qs(view.page + 1)} className={styles.pageButton} aria-label={t("studioSettlementApply.nextPage")}>
            ›
          </Link>
        ) : (
          <span className={styles.pageButton} aria-disabled="true">
            ›
          </span>
        )}
      </nav>
    </div>
  );
}
