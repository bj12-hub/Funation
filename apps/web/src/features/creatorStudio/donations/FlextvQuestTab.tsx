import Link from "next/link";
import { QuestDecide } from "@/features/donations/QuestDecide";
import { formatNumber, kstIsoString } from "@/lib/format";
import { decideReceivedQuest } from "@/services/creator/donationManagement";
import { QUEST_STATUSES } from "@/services/creator/donationManagementTypes";
import type { FlextvQuestPage } from "@/services/creator/flextvBroadcastGames";
import { questExtendedLabel } from "@/services/donations/questTypes";
import { PageLink } from "./DonationListTab";
import styles from "./donations.module.css";

const STATUS_CLASS = { SUCCESS: styles.badgeSuccess, IN_PROGRESS: styles.badgeProgress, FAILED: styles.badgeFailed, CANCELED: styles.badgeFailed } as const;
const WINDOW = 5;
/** "2026.10.25 15:04" in Korea time. */
const formatAt = (iso: string) => kstIsoString(iso).slice(0, 16).replaceAll("-", ".").replace("T", " ");
const href = (params: Record<string, string | number>) => `/creator/donations?${new URLSearchParams({ tab: "list", kind: "quest", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) })}`;

/** 받은 후원 · 퀘스트 (the FLEXTV page's two lists). */
export function FlextvKindNav({ kind }: { kind: "all" | "quest" }) {
  return (
    <nav className={styles.segment} aria-label="받은 후원 종류">
      <Link href="/creator/donations?tab=list" className={kind === "all" ? styles.segmentOn : undefined} aria-current={kind === "all" ? "page" : undefined}>
        받은 후원
      </Link>
      <Link href="/creator/donations?tab=list&kind=quest" className={kind === "quest" ? styles.segmentOn : undefined} aria-current={kind === "quest" ? "page" : undefined}>
        퀘스트
      </Link>
    </nav>
  );
}

/**
 * 받은 후원 › 퀘스트 with FLEXTV (phase 6; the 후원 리스트 539:156 quest layout). The quests sent to the channel, decided
 * here as in the mock (성공 · 실패 with 크리에이터 성공 결정, 취소 always); FLEXTV holds the 렉스 until 성공.
 */
export function FlextvQuestTab({ data }: { data: FlextvQuestPage }) {
  const { status, page, totalPages, total, items, held } = data;
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), totalPages - WINDOW + 1));
  const pages = Array.from({ length: Math.min(WINDOW, totalPages) }, (_, i) => start + i);
  const base: Record<string, string> = status === "ALL" ? {} : { status };

  return (
    <div className={styles.stack}>
      <FlextvKindNav kind="quest" />
      <nav className={styles.chipsRow} aria-label="상태">
        {[{ key: "ALL", label: "전체" }, ...QUEST_STATUSES].map((s) => (
          <Link key={s.key} href={href(s.key === "ALL" ? {} : { status: s.key })} className={`${styles.chip} ${status === s.key ? styles.chipOn : ""}`} aria-current={status === s.key ? "true" : undefined}>
            {s.label}
          </Link>
        ))}
      </nav>
      <dl className={styles.listStats} aria-label="진행 중인 퀘스트">
        <div>
          <dt>진행 중 퀘스트</dt>
          <dd className={styles.teal}>
            {formatNumber(held.amount)} FN <span className={styles.listStatsCount}>· {formatNumber(held.count)}건</span>
          </dd>
        </div>
      </dl>
      <p className={styles.listStatsNote}>퀘스트 후원은 성공하면 받은 후원이 되고, 실패 · 취소되면 시청자에게 전액 돌아가요. 시간이 지나도 결과를 정할 때까지 진행 중으로 남아요.</p>

      <div className={styles.table}>
        <table>
          <caption className={styles.srOnly}>퀘스트 후원 목록</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 176 }}>
                시간
              </th>
              <th scope="col" style={{ width: 180 }}>
                후원자 닉네임
              </th>
              <th scope="col" style={{ width: 120 }}>
                성공 보상
              </th>
              <th scope="col">퀘스트</th>
              <th scope="col" className={styles.right} style={{ width: 250 }}>
                결과
              </th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.empty}>
                  받은 퀘스트 후원이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((q) => (
                <tr key={q.id}>
                  <td className={`${styles.muted} ${styles.nowrap}`}>{formatAt(q.createdAt)}</td>
                  <td className={styles.strong}>
                    <span className={styles.ellipsis}>{q.donorNickname}</span>
                  </td>
                  <td className={styles.amount}>{formatNumber(q.amount)} FN</td>
                  <td>
                    <span className={styles.ellipsis}>{q.title}</span>
                  </td>
                  <td className={styles.right}>
                    {q.actions.length > 0 ? (
                      <>
                        <QuestDecide id={q.id} decide={decideReceivedQuest} actions={q.actions} />
                        <span className={styles.questDeadline}>
                          마감 {formatAt(q.endsAt)}
                          {q.extendedMin ? ` · ${questExtendedLabel(q.extendedMin)}` : ""}
                        </span>
                      </>
                    ) : (
                      <span className={`${styles.badge} ${STATUS_CLASS[q.status]}`}>{QUEST_STATUSES.find((s) => s.key === q.status)?.label}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <div className={styles.footer}>
          <span className={styles.muted}>전체 {formatNumber(total)}건</span>
          <nav className={styles.pagination} aria-label="페이지">
            <PageLink to={href({ ...base, page: 1 })} disabled={page === 1} label="첫 페이지" text="|<" />
            <PageLink to={href({ ...base, page: page - 1 })} disabled={page === 1} label="이전 페이지" text="<" />
            {pages.map((p) =>
              p === page ? (
                <span key={p} className={`${styles.pageButton} ${styles.pageCurrent}`} aria-current="page">
                  {p}
                </span>
              ) : (
                <Link key={p} href={href({ ...base, page: p })} className={styles.pageButton}>
                  {p}
                </Link>
              )
            )}
            <PageLink to={href({ ...base, page: page + 1 })} disabled={page === totalPages} label="다음 페이지" text=">" />
            <PageLink to={href({ ...base, page: totalPages })} disabled={page === totalPages} label="마지막 페이지" text=">|" />
          </nav>
        </div>
      </div>
    </div>
  );
}
