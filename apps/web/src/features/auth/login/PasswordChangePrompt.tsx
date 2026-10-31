"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { ShieldCheckIcon } from "@/components/icons";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./LoginForm.module.css";

/**
 * Figma: 비밀번호 변경 권유 718:335 — shown right after a successful login when the server flags an
 * old password. The member is already signed in; "다음에 변경" continues to `next`.
 * TBD: whether "later" should be remembered (snooze) is a backend policy.
 */
export function PasswordChangePrompt({ next }: { next: string }) {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <AuthCard title={t("auth.changeTitle")} description={t("auth.changeDescription", { months: 6 })}>
      <div className={styles.recommend}>
        <span className={styles.recommendIcon} aria-hidden="true">
          <ShieldCheckIcon />
        </span>
        <p>{t("auth.changeRecommend")}</p>
      </div>
      <div className={styles.buttons}>
        <Link href="/password-reset" className={styles.primaryButton}>
          {t("auth.resetPassword")}
        </Link>
        <button
          type="button"
          className={styles.laterButton}
          onClick={() => {
            router.replace(next);
            router.refresh();
          }}
        >
          {t("auth.changeLater")}
        </button>
      </div>
      <p className={styles.help}>{t("auth.changeHelp")}</p>
    </AuthCard>
  );
}
