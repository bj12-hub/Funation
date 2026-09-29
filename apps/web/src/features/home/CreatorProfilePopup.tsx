"use client";

import Image from "next/image";
import Link from "next/link";
import { HeartIcon, VerifiedCheckIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import type { PopularCreator } from "@/services/home/homeFeed";
import { PLATFORM_LABEL } from "@/types/platform";
import styles from "./creatorProfile.module.css";

/**
 * Figma 688:646 크리에이터 프로필 (opened from the home "LIVE 인기 크리에이터" row, 709:2).
 * "후원하기" opens the creator room with the donation tab selected.
 */
export function CreatorProfilePopup({ creator, onClose }: { creator: PopularCreator | null; onClose: () => void }) {
  return (
    <Modal
      open={creator !== null}
      onClose={onClose}
      title="크리에이터 프로필"
      width={800}
      className={styles.dialog}
      customHeader={<h2 className={styles.title}>크리에이터 프로필</h2>}
    >
      {creator && (
        <>
          <div className={styles.body}>
            <Image src={creator.avatarUrl} alt="" width={176} height={176} className={styles.avatar} />
            <div className={styles.details}>
              <div className={styles.nameRow}>
                <strong className={styles.name}>{creator.name}</strong>
                {creator.profile.verified && (
                  <span className={styles.verified} role="img" aria-label="인증된 크리에이터">
                    <VerifiedCheckIcon width={12} height={12} />
                  </span>
                )}
              </div>
              {creator.profile.status && <p className={styles.status}>{creator.profile.status}</p>}
              {creator.profile.tags.length > 0 && (
                <ul className={styles.tags} aria-label="카테고리">
                  {creator.profile.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
              <ul className={styles.channels} aria-label="방송 채널">
                {creator.profile.channels.map((c) => (
                  <li key={c.platform}>
                    <Image src={c.logoUrl} alt="" width={24} height={24} className={styles.logo} />
                    {PLATFORM_LABEL[c.platform]}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <footer className={styles.footer}>
            <Link href={`/creators/${creator.id}?tab=donation`} className={styles.donate} onClick={onClose}>
              <HeartIcon width={17} height={17} aria-hidden="true" />
              후원하기
            </Link>
            <button type="button" className={styles.close} onClick={onClose}>
              닫기
            </button>
          </footer>
        </>
      )}
    </Modal>
  );
}
