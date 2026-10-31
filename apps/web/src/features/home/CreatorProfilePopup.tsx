"use client";

import Image from "next/image";
import Link from "next/link";
import { HeartIcon, VerifiedCheckIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { platformLabel } from "@/lib/i18n/platformLabel";
import type { PopularCreator } from "@/services/home/homeFeed";
import styles from "./creatorProfile.module.css";

/**
 * Figma 688:646 크리에이터 프로필 (opened from the home "LIVE 인기 크리에이터" row, 709:2).
 * "후원하기" opens the creator room with the donation tab selected.
 */
export function CreatorProfilePopup({ creator, onClose }: { creator: PopularCreator | null; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal
      open={creator !== null}
      onClose={onClose}
      title={t("home.profileTitle")}
      width={800}
      className={styles.dialog}
      customHeader={<h2 className={styles.title}>{t("home.profileTitle")}</h2>}
    >
      {creator && (
        <>
          <div className={styles.body}>
            <Image src={creator.avatarUrl} alt="" width={176} height={176} className={styles.avatar} />
            <div className={styles.details}>
              <div className={styles.nameRow}>
                <strong className={styles.name}>{creator.name}</strong>
                {creator.profile.verified && (
                  <span className={styles.verified} role="img" aria-label={t("home.verified")}>
                    <VerifiedCheckIcon width={12} height={12} />
                  </span>
                )}
              </div>
              {creator.profile.status && <p className={styles.status}>{creator.profile.status}</p>}
              {creator.profile.tags.length > 0 && (
                <ul className={styles.tags} aria-label={t("home.categories")}>
                  {creator.profile.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
              <ul className={styles.channels} aria-label={t("home.channels")}>
                {creator.profile.channels.map((c) => (
                  <li key={c.platform}>
                    <Image src={c.logoUrl} alt="" width={24} height={24} className={styles.logo} />
                    {platformLabel(c.platform, t)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <footer className={styles.footer}>
            <Link href={`/creators/${creator.id}?tab=donation`} className={styles.donate} onClick={onClose}>
              <HeartIcon width={17} height={17} aria-hidden="true" />
              {t("home.donate")}
            </Link>
            <button type="button" className={styles.close} onClick={onClose}>
              {t("home.close")}
            </button>
          </footer>
        </>
      )}
    </Modal>
  );
}
