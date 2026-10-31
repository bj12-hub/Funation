import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { EVENT_FILTERS, eventPeriodLabel, type EventListView } from "@/services/events/eventTypes";
import { FILTER_KEY, PHASE_KEY } from "./labels";
import styles from "./events.module.css";

/** 이벤트 목록 — code-first (no Figma frame). Route `/events` (`?filter=`). */
export async function EventsScreen({ view }: { view: EventListView }) {
  const t = await getT();
  return (
    <div className={styles.content}>
      <header>
        <h1 className={styles.title}>{t("events.title")}</h1>
        <p className={styles.subtitle}>{t("events.subtitle")}</p>
      </header>
      <nav className={styles.tabs} aria-label={t("events.filters")}>
        {EVENT_FILTERS.filter((f) => f.key !== "mine" || view.signedIn).map((f) => (
          <Link key={f.key} href={f.key === "all" ? "/events" : `/events?filter=${f.key}`} className={styles.tab} aria-current={view.filter === f.key ? "page" : undefined}>
            {t(FILTER_KEY[f.key])}
          </Link>
        ))}
      </nav>
      {view.items.length === 0 ? (
        <div className={styles.empty}>
          <strong>{t("events.emptyTitle")}</strong>
          <span>{view.filter === "mine" ? t("events.emptyMine") : t("events.emptySoon")}</span>
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
                    {t(PHASE_KEY[e.phase])}
                  </span>
                  {e.joined && <span className={styles.joined}>{t("events.joined")}</span>}
                </span>
                <strong className={styles.cardTitle}>{e.title}</strong>
                <span className={styles.muted}>{e.summary}</span>
                <span className={styles.meta}>
                  {eventPeriodLabel(e.startsAt, e.endsAt)} · {t("events.participants", { count: e.participants.toLocaleString("ko-KR") })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
