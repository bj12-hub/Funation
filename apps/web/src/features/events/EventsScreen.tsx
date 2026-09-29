import Link from "next/link";
import { EVENT_FILTERS, PHASE_LABEL, type EventListView } from "@/services/events/eventTypes";
import styles from "./events.module.css";

const period = (a: string, b: string) => `${new Date(a).toLocaleDateString("ko-KR")} ~ ${new Date(b).toLocaleDateString("ko-KR")}`;

/** 이벤트 목록 — code-first (no Figma frame). Route `/events` (`?filter=`). */
export function EventsScreen({ view }: { view: EventListView }) {
  return (
    <div className={styles.content}>
      <header>
        <h1 className={styles.title}>이벤트</h1>
        <p className={styles.subtitle}>진행 중인 이벤트와 지난 이벤트를 확인하세요.</p>
      </header>
      <nav className={styles.tabs} aria-label="이벤트 분류">
        {EVENT_FILTERS.filter((f) => f.key !== "mine" || view.signedIn).map((f) => (
          <Link key={f.key} href={f.key === "all" ? "/events" : `/events?filter=${f.key}`} className={styles.tab} aria-current={view.filter === f.key ? "page" : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>
      {view.items.length === 0 ? (
        <div className={styles.empty}>
          <strong>이벤트가 없어요</strong>
          <span>{view.filter === "mine" ? "참여한 이벤트가 아직 없어요." : "곧 새로운 이벤트가 시작돼요."}</span>
        </div>
      ) : (
        <ul className={styles.grid}>
          {view.items.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className={styles.card} data-phase={e.phase}>
                <span className={styles.emoji} aria-hidden="true">
                  {e.emoji}
                </span>
                <span className={styles.badges}>
                  <span className={styles.phase} data-phase={e.phase}>
                    {PHASE_LABEL[e.phase]}
                  </span>
                  {e.joined && <span className={styles.joined}>참여함</span>}
                </span>
                <strong className={styles.cardTitle}>{e.title}</strong>
                <span className={styles.muted}>{e.summary}</span>
                <span className={styles.meta}>
                  {period(e.startsAt, e.endsAt)} · 참여 {e.participants.toLocaleString("ko-KR")}명
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
