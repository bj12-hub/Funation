"use client";

import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { CircleXLargeIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./LoginForm.module.css";

/**
 * Figma: 로그인 제한 안내 718:213
 * `supportLink`: link 고객센터 (`/support`). Off on the 도우미 domain, which does not serve it: the line names the site's
 * 고객센터 in plain text instead (the site's domain is TBD, so no cross-host link).
 */
export function LoginLocked({ supportLink = true }: { supportLink?: boolean }) {
  const { t } = useI18n();
  return (
    <AuthCard title={t("auth.lockedTitle")} description={t("auth.lockedDescription", { count: 5 })}>
      <div className={styles.notice} role="alert">
        <CircleXLargeIcon />
        <p>
          {t("auth.lockedNotice")}
          <br />
          {t("auth.lockedNoticeAfter")}
        </p>
      </div>
      <Link href="/password-reset" className={styles.primaryButton}>
        {t("auth.toPasswordReset")}
      </Link>
      <p className={styles.help}>
        {t("auth.needHelp")} {supportLink ? <Link href="/support">{t("auth.contactSupport")}</Link> : t("auth.contactSupportSite")}
      </p>
    </AuthCard>
  );
}
