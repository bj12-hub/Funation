import Link from "next/link";
import { SITE_URL } from "@/lib/siteUrl";
import { REPORT_REASON_LABEL, REPORT_TARGET_LABEL, type AdminReportView, type Report, type ReportStatus } from "@/types/adminApi";
import styles from "../admin.module.css";
import { ReportDecision } from "./ReportDecision";

const TABS: { key: ReportStatus; label: string }[] = [
  { key: "OPEN", label: "처리 대기" },
  { key: "ACTIONED", label: "숨김 처리" },
  { key: "DISMISSED", label: "기각" }
];
const at = (iso: string) => iso.slice(0, 16).replace("T", " ");

/** Where the reported content lives on the site (hidden content may no longer open). */
function siteHref(r: Pick<Report, "target">) {
  switch (r.target.type) {
    case "POST":
      return `${SITE_URL}/community/${r.target.id}`;
    case "COMMENT":
      return `${SITE_URL}/community/${r.target.parentId}`;
    case "CREATOR":
      return `${SITE_URL}/creators/${r.target.id}`;
    default:
      return null;
  }
}

/** 신고 처리 — code-first. Route `/reports` (`?status=`). */
export function ReportsScreen({ view, status }: { view: AdminReportView; status: ReportStatus }) {
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>신고 처리</h1>
        <p className={styles.muted}>회원이 신고한 글 · 댓글 · 쪽지 · 채널이에요. 숨김은 사이트에서 콘텐츠를 내리고, 같은 콘텐츠의 다른 신고도 함께 닫혀요. 작성자 제재는 회원 관리에서 해요. 처리 기준은 운영 정책에 따라요 (TBD).</p>
      </header>
      <nav className={styles.tabs} aria-label="신고 상태">
        {TABS.map((t) => (
          <Link key={t.key} href={t.key === "OPEN" ? "/reports" : `/reports?status=${t.key}`} className={styles.tab} aria-current={status === t.key ? "page" : undefined}>
            {t.label} {view.counts[t.key]}
          </Link>
        ))}
      </nav>
      <section className={styles.card}>
        {view.rows.length === 0 ? (
          <p className={styles.empty}>{status === "OPEN" ? "처리할 신고가 없어요." : "해당하는 신고가 없어요."}</p>
        ) : (
          <ul className={styles.refundList}>
            {view.rows.map((r) => {
              const href = siteHref(r);
              return (
                <li key={r.id} className={styles.refundItem}>
                  <div className={styles.refundHead}>
                    <strong>
                      {REPORT_TARGET_LABEL[r.target.type]} · {REPORT_REASON_LABEL[r.reason]}
                    </strong>
                    <span className={r.status === "OPEN" ? styles.chipWarn : r.status === "ACTIONED" ? styles.chipBad : styles.chipOk}>{TABS.find((t) => t.key === r.status)?.label}</span>
                  </div>
                  <p className={styles.muted}>
                    작성자 {r.authorName} · 신고자 {r.reporterName} · {at(r.createdAt)}
                    {r.authorIsMember ? (
                      <>
                        {" "}
                        ·{" "}
                        <Link href={`/members/${r.authorId}`} className={styles.link}>
                          작성자 회원 상세
                        </Link>
                      </>
                    ) : null}
                    {href && (
                      <>
                        {" "}
                        ·{" "}
                        <a href={href} className={styles.link} target="_blank" rel="noreferrer">
                          사이트에서 보기
                        </a>
                      </>
                    )}
                  </p>
                  <p className={styles.quote}>신고 당시 내용: {r.snapshot}</p>
                  {r.detail && <p className={styles.quote}>신고 상세: {r.detail}</p>}
                  {r.resolution ? (
                    <p className={styles.muted}>
                      {at(r.resolution.at)} · {r.resolution.by} · {r.resolution.action === "HIDE" ? "숨김" : "기각"} · {r.resolution.note}
                    </p>
                  ) : (
                    <ReportDecision id={r.id} canHide={r.target.type !== "CREATOR"} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
