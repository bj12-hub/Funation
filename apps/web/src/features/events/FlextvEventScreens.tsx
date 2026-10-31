import Link from "next/link";
import { kstIsoString } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
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
export async function FlextvEventsScreen({ view }: { view: FlextvEventListView }) {
  const t = await getT();
  const base = view.ended ? "/events?filter=ended" : "/events";
  return (
    <div className={styles.content}>
      <header>
        <h1 className={styles.title}>{t("events.title")}</h1>
        <p className={styles.subtitle}>{t("flextvEvents.subtitle")}</p>
      </header>
      <nav className={styles.tabs} aria-label={t("events.filters")}>
        <Link href="/events" className={styles.tab} aria-current={!view.ended ? "page" : undefined}>
          {t("events.ongoing")}
        </Link>
        <Link href="/events?filter=ended" className={styles.tab} aria-current={view.ended ? "page" : undefined}>
          {t("events.ended")}
        </Link>
      </nav>
      {view.items.length === 0 ? (
        <div className={styles.empty}>
          <strong>{t("events.emptyTitle")}</strong>
          <span>{view.ended ? t("flextvEvents.emptyEnded") : t("events.emptySoon")}</span>
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
                    {view.ended ? t("events.ended") : t("events.ongoing")}
                  </span>
                </span>
                <strong className={styles.cardTitle}>{e.title || t("flextvEvents.untitled")}</strong>
                {period(e.startsAt, e.endsAt) && <span className={styles.meta}>{period(e.startsAt, e.endsAt)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {view.hasMore && (
        <Link href={`${base}${view.ended ? "&" : "?"}show=${view.show + FLEXTV_EVENTS_PAGE}`} className={styles.back} scroll={false}>
          {t("flextvEvents.more", { shown: view.items.length, total: view.total })}
        </Link>
      )}
    </div>
  );
}

/**
 * 이벤트 상세 with FLEXTV (phase 9). Route `/events/[id]`. FLEXTV's text as paragraphs and its pictures; an event that is
 * a page of FLEXTV's site (or anything to join) opens on FLEXTV.
 */
export async function FlextvEventDetailScreen({ event }: { event: FlextvEventDetail }) {
  const t = await getT();
  const when = period(event.startsAt, event.endsAt);
  return (
    <div className={styles.content}>
      <Link href={event.ongoing ? "/events" : "/events?filter=ended"} className={styles.back}>
        {t("events.back")}
      </Link>
      <article className={styles.detail}>
        <span className={styles.phase} data-phase={event.ongoing ? "ongoing" : "ended"}>
          {event.ongoing ? t("events.ongoing") : t("events.ended")}
        </span>
        <h1 className={styles.title}>{event.title || t("flextvEvents.untitled")}</h1>
        {when && <p className={styles.meta}>{when}</p>}
        {event.blocks.length === 0 ? (
          <p className={styles.body}>{t("flextvEvents.joinOnFlextv")}</p>
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
          {t("flextvEvents.viewOnFlextv")}
        </a>
      </article>
      {(event.prev || event.next) && (
        <nav className={styles.near} aria-label={t("flextvEvents.near")}>
          {event.prev && (
            <Link href={`/events/${event.prev.id}`} className={styles.back}>
              ← {event.prev.title || t("flextvEvents.prev")}
            </Link>
          )}
          {event.next && (
            <Link href={`/events/${event.next.id}`} className={styles.back}>
              {event.next.title || t("flextvEvents.next")} →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
