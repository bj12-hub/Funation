"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CloseIcon, HeartLineIcon, VideoCameraIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import styles from "./RoleChooser.module.css";

const ROLES = [
  { key: "creator", tag: "LIVE", question: "auth.creatorQuestion", name: "auth.creatorName", Icon: VideoCameraIcon, tone: styles.creator },
  { key: "donator", tag: "DONATE", question: "auth.donatorQuestion", name: "auth.donatorName", Icon: HeartLineIcon, tone: styles.donator }
] as const;

/**
 * Figma 280:2 로그인/회원가입 — the header "로그인" button opens a role chooser.
 * Both roles use the same login page (a creator-specific sign-up is not designed yet; `?role=` is passed along,
 * TBD). After signing in, 크리에이터 goes to the creator dashboard and 도네이터 back to the current page.
 */
export function RoleChooser({ className }: { className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const next = pathname.startsWith("/login") || pathname.startsWith("/signup") ? null : pathname;
  const href = (role: string) => {
    const params = new URLSearchParams({ role });
    const target = role === "creator" ? "/creator" : next;
    if (target && target !== "/") params.set("next", target);
    return `/login?${params.toString()}`;
  };

  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {t("auth.login")}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t("auth.roleTitle")}
        width={560}
        className={styles.dialog}
        customHeader={
          <header className={styles.header}>
            <div>
              <h2>{t("auth.roleTitle")}</h2>
              <p>{t("auth.roleSubtitle")}</p>
            </div>
            <button type="button" className={styles.close} aria-label={t("auth.close")} onClick={() => setOpen(false)}>
              <CloseIcon />
            </button>
          </header>
        }
      >
        <ul className={styles.cards}>
          {ROLES.map(({ key, tag, question, name, Icon, tone }) => (
            <li key={key}>
              <Link href={href(key)} className={styles.card} onClick={() => setOpen(false)}>
                <span className={styles.icon} aria-hidden="true">
                  <Icon />
                </span>
                <span className={styles.labels}>
                  <span className={`${styles.tag} ${tone}`}>{tag}</span>
                  <span className={styles.question}>{t(question)}</span>
                  <strong className={styles.name}>{t(name)}</strong>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
