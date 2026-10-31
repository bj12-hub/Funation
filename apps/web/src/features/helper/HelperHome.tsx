import Link from "next/link";
import type { MessageKey } from "@/lib/i18n/translate";
import { getT } from "@/lib/i18n/server";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import { OverlayOffNotice } from "@/features/creatorStudio/remote/OverlayOffNotice";
import { HELPER_NAV, HELPER_REMOTE_GUIDE } from "./helperNav";
import { helperGroupTitle, helperNavText, helperTitle } from "./helperText";
import styles from "./helper.module.css";

const STEPS: { title: MessageKey; text: MessageKey; href: string; link: MessageKey }[] = [
  { title: "helper.stepWidgetsTitle", text: "helper.stepWidgetsText", href: "/alert", link: "helper.stepWidgetsLink" },
  { title: "helper.stepObsTitle", text: "helper.stepObsText", href: "/overlays", link: "helperNav.overlays" },
  { title: "helper.stepRemoteTitle", text: "helper.stepRemoteText", href: HELPER_REMOTE_GUIDE, link: "helper.remoteGuide" }
];

/** 시작하기 — the helper home, code-first (no Figma frame). OBS connection steps and every helper feature. */
export async function HelperHome({ nickname, switches }: { nickname: string; switches: Record<OverlayTarget, boolean> }) {
  const t = await getT();
  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <h1>{t("helper.homeTitle", { name: nickname })}</h1>
        <p>{t("helper.homeIntro", { title: helperTitle(t) })}</p>
      </header>
      <OverlayOffNotice targets={Object.keys(switches) as OverlayTarget[]} switches={switches} />
      <section className={styles.section} aria-labelledby="helper-steps">
        <h2 id="helper-steps" className={styles.sectionTitle}>
          {t("helper.stepsTitle")}
        </h2>
        <ol className={styles.steps}>
          {STEPS.map((s) => (
            <li key={s.title} className={styles.step}>
              <strong>{t(s.title)}</strong>
              <p>{t(s.text)}</p>
              <Link href={s.href} className={styles.stepLink}>
                {t(s.link)} →
              </Link>
            </li>
          ))}
        </ol>
      </section>
      {HELPER_NAV.filter((g) => g.title).map((g) => (
        <section key={g.title} className={styles.section} aria-label={g.title ? helperGroupTitle(g.title, t) : undefined}>
          <h2 className={styles.sectionTitle}>{g.title && helperGroupTitle(g.title, t)}</h2>
          <ul className={styles.cards}>
            {g.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={styles.card}>
                  <span className={styles.cardEmoji} aria-hidden="true">
                    {item.emoji}
                  </span>
                  <span className={styles.cardText}>
                    <strong>{helperNavText(item, t).label}</strong>
                    <span>{helperNavText(item, t).description}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
