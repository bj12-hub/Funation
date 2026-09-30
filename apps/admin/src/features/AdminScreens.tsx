import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { AUDIT_ACTION_LABEL, AUDIT_PAGE, type AdminDashboard, type AuditEntry, type AuditPage } from "@/types/adminApi";
import styles from "./admin.module.css";

const at = (iso: string) => new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "medium" });

/** 관리자 대시보드 — code-first. Route `/`. Numbers come from the server (mock data). */
export function AdminDashboardScreen({ data }: { data: AdminDashboard }) {
  const tiles = [
    { label: "크리에이터", value: `${formatNumber(data.creators.total)}명`, sub: `방송 중 ${formatNumber(data.creators.live)}명` },
    { label: "이번 달 충전", value: `${formatNumber(data.charges.monthFn)} FN`, sub: `${formatNumber(data.charges.monthCount)}건 · 결제 ${formatNumber(data.charges.monthPaidKrw)}원` },
    { label: "이번 달 후원", value: `${formatNumber(data.donations.monthFn)} FN`, sub: `${formatNumber(data.donations.monthCount)}건` },
    { label: "처리 중 충전", value: `${formatNumber(data.charges.processing)}건`, sub: "결제 확인 대기" }
  ];
  const queues = [
    { label: "환불 요청", count: data.pending.refunds, note: "결제 · 환불 › 환불 요청에서 심사" },
    { label: "정산 신청", count: data.pending.settlements, note: "정산 심사에서 처리" },
    { label: "신고", count: data.pending.reports, note: "신고 기능 준비 중" }
  ];
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>운영 대시보드</h1>
        <p className={styles.muted}>mock 데이터 기준이에요. 집계 기준(기간 · 시간대 · 취소 반영)은 TBD예요.</p>
      </header>
      <section className={styles.tiles} aria-label="주요 지표">
        {tiles.map((t) => (
          <div key={t.label} className={styles.tile}>
            <span className={styles.muted}>{t.label}</span>
            <strong className={styles.tileValue}>{t.value}</strong>
            <span className={styles.muted}>{t.sub}</span>
          </div>
        ))}
      </section>
      <div className={styles.split}>
        <section className={styles.card} aria-labelledby="adm-queues">
          <h2 id="adm-queues" className={styles.cardTitle}>
            처리 대기
          </h2>
          <ul className={styles.queue}>
            {queues.map((q) => (
              <li key={q.label}>
                <span>{q.label}</span>
                <strong className={q.count ? styles.warn : undefined}>{q.count === null ? "—" : `${formatNumber(q.count)}건`}</strong>
                <span className={styles.muted}>{q.note}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={styles.card} aria-labelledby="adm-audit">
          <div className={styles.cardHead}>
            <h2 id="adm-audit" className={styles.cardTitle}>
              최근 관리 작업
            </h2>
            <Link href="/audit" className={styles.link}>
              감사 로그 ›
            </Link>
          </div>
          <AuditList items={data.recentAudit} compact />
        </section>
      </div>
    </div>
  );
}

/** 감사 로그 — code-first. Route `/audit`. Append-only record of admin actions. */
export function AuditLogScreen({ page, show }: { page: AuditPage; show: number }) {
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>감사 로그</h1>
        <p className={styles.muted}>관리자 작업은 수정 · 삭제할 수 없는 기록으로 남아요. 보관 기간과 열람 권한은 TBD예요.</p>
      </header>
      <section className={styles.card}>
        <AuditList items={page.items} />
        {page.hasMore && (
          <Link href={`/audit?show=${show + AUDIT_PAGE}`} className={styles.link} scroll={false}>
            더 보기 ({page.items.length}/{page.total})
          </Link>
        )}
      </section>
    </div>
  );
}

function AuditList({ items, compact = false }: { items: AuditEntry[]; compact?: boolean }) {
  if (items.length === 0) return <p className={styles.empty}>아직 기록이 없어요.</p>;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">시각</th>
          <th scope="col">작업</th>
          {!compact && <th scope="col">대상</th>}
          {!compact && <th scope="col">사유</th>}
          <th scope="col">관리자</th>
        </tr>
      </thead>
      <tbody>
        {items.map((e) => (
          <tr key={e.id}>
            <td>{at(e.at)}</td>
            <td>{AUDIT_ACTION_LABEL[e.action]}</td>
            {!compact && <td>{e.target ?? "—"}</td>}
            {!compact && <td>{e.reason ?? "—"}</td>}
            <td>{e.actorName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
