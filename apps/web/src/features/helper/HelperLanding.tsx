import Link from "next/link";
import type { ReactNode } from "react";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { logout } from "@/services/auth/logout";
import { HelperBrand } from "./HelperShell";
import { helperTitle } from "./helperText";
import styles from "./helper.module.css";

const FEATURES: { emoji: string; title: MessageKey; text: MessageKey }[] = [
  { emoji: "🔔", title: "helper.featureAlertsTitle", text: "helper.featureAlertsText" },
  { emoji: "🎛️", title: "helper.featureRemoteTitle", text: "helper.featureRemoteText" },
  { emoji: "👥", title: "helper.featureCrewTitle", text: "helper.featureCrewText" }
];

/** Plain top bar for the account pages the helper domain shares with the site (sign-in, sign-up, 채널 만들기, terms). */
export async function HelperFrame({ children }: { children: ReactNode }) {
  const t = await getT();
  return (
    <div data-theme="dark" className={styles.scope}>
      <header className={styles.frameBar}>
        <HelperBrand />
        <Link href="/" className={styles.frameLink}>
          {t("helper.helperHome")}
        </Link>
      </header>
      {children}
    </div>
  );
}

/** Signed out on the helper domain — code-first (no Figma frame). */
export async function HelperLanding({ next }: { next: string }) {
  const t = await getT();
  const login = next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
  return (
    <div data-theme="dark" className={styles.scope}>
      <main className={styles.landing}>
        <HelperBrand />
        <div>
          <h1 className={styles.landingTitle}>{t("helper.landingTitle")}</h1>
          <p className={styles.landingText}>{t("helper.landingText", { title: helperTitle(t) })}</p>
        </div>
        <div className={styles.landingActions}>
          <Link href={login} className={styles.primary}>
            {t("helper.login")}
          </Link>
          <Link href="/signup" className={styles.secondary}>
            {t("helper.signup")}
          </Link>
        </div>
        <ul className={styles.featureGrid}>
          {FEATURES.map((f) => (
            <li key={f.title} className={styles.feature}>
              <span className={styles.featureEmoji} aria-hidden="true">
                {f.emoji}
              </span>
              <strong>{t(f.title)}</strong>
              <span>{t(f.text)}</span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

/** Signed in without a channel: the Creator role comes from 채널 만들기 (approval TBD, as on the site). */
export async function HelperNeedsChannel({ nickname }: { nickname: string }) {
  const t = await getT();
  return (
    <HelperFrame>
      <main className={styles.landing}>
        <div>
          <h1 className={styles.landingTitle}>{t("helper.needsChannelTitle")}</h1>
          <p className={styles.landingText}>{t("helper.needsChannelText", { name: nickname, title: helperTitle(t) })}</p>
        </div>
        <div className={styles.landingActions}>
          <Link href="/channel/new" className={styles.primary}>
            {t("helper.createChannel")}
          </Link>
          <form action={logout}>
            <button type="submit" className={styles.secondary}>
              {t("helper.otherAccount")}
            </button>
          </form>
        </div>
      </main>
    </HelperFrame>
  );
}
