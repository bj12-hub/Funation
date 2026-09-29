"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";
import { OVERLAYS } from "./overlayCatalog";
import local from "./overlayUrls.module.css";

const mask = (key: string) => `${key.slice(0, 4)}-····-····-····`;

/**
 * 오버레이 주소 — code-first (no Figma frame). Route `/creator/widgets/overlays`. Lists every OBS
 * overlay with its recommended size; the key is masked on screen and only copied in full.
 * Widget-popup URLs (채팅, QR, 목표 …) are not listed until those overlays exist.
 */
export function OverlayUrlsScreen({ overlayKey }: { overlayKey: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const groups = [...new Set(OVERLAYS.map((o) => o.group))];
  const all = OVERLAYS.map((o) => `${o.title}\t${origin}${o.path(overlayKey)}`).join("\n");

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>오버레이 주소</h1>
        <p className={styles.subtitle}>OBS 브라우저 소스에 넣을 주소를 한곳에 모았어요. 계정 전용 주소이니 방송 화면이나 채팅에 노출하지 마세요.</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">← 후원위젯/알림설정</Link> · 주소가 노출됐다면 계정설정에서 연동 키를 재발급하세요. 모든 주소가 바뀌어요.
        </p>
      </header>
      <div className={styles.actions}>
        <CopyButton value={all} label={`목록 전체 복사 (${OVERLAYS.length})`} className={styles.primary} />
      </div>
      {groups.map((g) => (
        <section key={g} className={styles.card} aria-label={g}>
          <h2 className={styles.cardTitle}>{g}</h2>
          <ul className={styles.list}>
            {OVERLAYS.filter((o) => o.group === g).map((o) => {
              const url = `${origin}${o.path(overlayKey)}`;
              return (
                <li key={o.id} className={styles.row}>
                  <div className={`${styles.rowMain} ${local.main}`}>
                    <span className={styles.rowTitle}>
                      {o.title} <span className={local.size}>OBS {o.size}</span>
                    </span>
                    <span className={styles.muted}>{o.description}</span>
                    <code className={local.url}>{`${origin}${o.path(mask(overlayKey))}`}</code>
                  </div>
                  <div className={styles.rowActions}>
                    <Link href={o.manage} className={styles.ghost}>
                      설정
                    </Link>
                    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.ghost}>
                      미리보기
                    </a>
                    <CopyButton value={url} label="복사" className={styles.ghost} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
