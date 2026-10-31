import Link from "next/link";
import { kstIsoString } from "@/lib/format";
import { FLEXTV_EVENTS_PAGE, type FlextvEventDetail, type FlextvEventListView } from "@/services/events/flextvEvents";
import styles from "./events.module.css";

/** "2026.10.03 ~ 2026.10.22" in Korean days; either end may be unset on FLEXTV. */
const period = (startsAt: string | null, endsAt: string | null) => {
  const day = (iso: string | null) => (iso ? kstIsoString(iso).slice(0, 10).replace(/-/g, ".") : "");
  return startsAt || endsAt ? `${day(startsAt)} ~ ${day(endsAt)}` : "";
};

/**
 * 이벤트 with FLEXTV (phase 9; code-first, no Figma frame — FLEXTV's 이벤트 board is the reference). Route `/events`
 * (`?filter=ended`, `?show=`): FLEXTV's 진행 중 and 종료 events.
 */
export function FlextvEventsScreen({ view }: { view: FlextvEventListView }) {
  const base = view.ended ? "/events?filter=ended" : "/events";
  return (
    <div className={styles.content}>
      <header>
        <h1 className={styles.title}>이벤트</h1>
        <p className={styles.subtitle}>FLEXTV에서 진행 중인 이벤트와 지난 이벤트예요. 참여는 FLEXTV에서 해요.</p>
      </header>
      <nav className={styles.tabs} aria-label="이벤트 분류">
        <Link href="/events" className={styles.tab} aria-current={!view.ended ? "page" : undefined}>
          진행 중
        </Link>
        <Link href="/events?filter=ended" className={styles.tab} aria-current={view.ended ? "page" : undefined}>
          종료
        </Link>
      </nav>
      {view.items.length === 0 ? (
        <div className={styles.empty}>
          <strong>이벤트가 없어요</strong>
          <span>{view.ended ? "지난 이벤트가 없어요." : "곧 새로운 이벤트가 시작돼요."}</span>
        </div>
      ) : (
        <ul className={styles.grid}>
          {view.items.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className={styles.card} data-phase={view.ended ? "ended" : "ongoing"}>
                <span className={styles.cardImage} aria-hidden="true">
                  {e.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- FLEXTV's CDN, not one of the image optimizer's hosts
                    <img src={e.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <span className={styles.emoji}>🎉</span>
                  )}
                </span>
                <span className={styles.badges}>
                  <span className={styles.phase} data-phase={view.ended ? "ended" : "ongoing"}>
                    {view.ended ? "종료" : "진행 중"}
                  </span>
                </span>
                <strong className={styles.cardTitle}>{e.title || "이벤트"}</strong>
                {period(e.startsAt, e.endsAt) && <span className={styles.meta}>{period(e.startsAt, e.endsAt)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {view.hasMore && (
        <Link href={`${base}${view.ended ? "&" : "?"}show=${view.show + FLEXTV_EVENTS_PAGE}`} className={styles.back} scroll={false}>
          더 보기 ({view.items.length}/{view.total})
        </Link>
      )}
    </div>
  );
}

/**
 * 이벤트 상세 with FLEXTV (phase 9). Route `/events/[id]`. FLEXTV's text as paragraphs and its pictures; an event that is
 * a page of FLEXTV's site (or anything to join) opens on FLEXTV.
 */
export function FlextvEventDetailScreen({ event }: { event: FlextvEventDetail }) {
  const when = period(event.startsAt, event.endsAt);
  return (
    <div className={styles.content}>
      <Link href={event.ongoing ? "/events" : "/events?filter=ended"} className={styles.back}>
        ← 이벤트 목록
      </Link>
      <article className={styles.detail}>
        <span className={styles.phase} data-phase={event.ongoing ? "ongoing" : "ended"}>
          {event.ongoing ? "진행 중" : "종료"}
        </span>
        <h1 className={styles.title}>{event.title || "이벤트"}</h1>
        {when && <p className={styles.meta}>{when}</p>}
        {event.blocks.length === 0 ? (
          <p className={styles.body}>이 이벤트는 FLEXTV에서 확인하고 참여할 수 있어요.</p>
        ) : (
          <div className={styles.blocks}>
            {event.blocks.map((b, i) =>
              b.kind === "text" ? (
                <p key={i} className={styles.body}>
                  {b.text}
                </p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- FLEXTV's CDN, not one of the image optimizer's hosts
                <img key={i} src={b.src} alt="" loading="lazy" className={styles.blockImage} />
              )
            )}
          </div>
        )}
        <a href={event.flextvUrl} target="_blank" rel="noopener noreferrer" className={`${styles.primary} ${styles.flextvLink}`}>
          FLEXTV에서 보기
        </a>
      </article>
      {(event.prev || event.next) && (
        <nav className={styles.near} aria-label="다른 이벤트">
          {event.prev && (
            <Link href={`/events/${event.prev.id}`} className={styles.back}>
              ← {event.prev.title || "이전 이벤트"}
            </Link>
          )}
          {event.next && (
            <Link href={`/events/${event.next.id}`} className={styles.back}>
              {event.next.title || "다음 이벤트"} →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
