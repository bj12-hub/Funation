"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setOverlaySwitch } from "@/services/creator/alertRemote";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";
import { OVERLAYS } from "./overlayCatalog";
import local from "./overlayUrls.module.css";

const mask = (key: string) => `${key.slice(0, 4)}-····-····-····`;

/**
 * 오버레이 주소 — code-first (no Figma frame). Route `/creator/widgets/overlays`. Lists every OBS
 * overlay with its recommended size; the key is masked on screen and only copied in full.
 * 후원 위젯 with an overlay (목표 · 누적 · 랭킹 · 최근알림 · 이벤트 · QR) are listed; the other widget popups
 * (미니후원, 커스텀 사운드 …) have no overlay of their own. Overlays switched OFF in
 * the 리모컨 기능 제어 are marked, with a one-click 켜기.
 */
export function OverlayUrlsScreen({ overlayKey, switches }: { overlayKey: string; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const off = OVERLAYS.filter((o) => !switches[o.target]);
  const turnOn = (target: OverlayTarget) =>
    startTransition(async () => {
      setError(null);
      const res = await setOverlaySwitch({ target, on: true });
      if (res.status === "SAVED") router.refresh();
      else setError(res.status === "INVALID" ? res.message : "다시 로그인해 주세요.");
    });
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
      {off.length > 0 && (
        <p className={local.offSummary} role="status">
          꺼진 오버레이 {off.length}개 · {off.map((o) => o.title).join(", ")} — 방송 화면에 나오지 않아요. <Link href="/creator/remote">리모컨 기능 제어</Link>에서 켜고 끌 수 있어요.
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
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
                <li key={o.id} className={styles.row} data-off={switches[o.target] ? undefined : ""}>
                  <div className={`${styles.rowMain} ${local.main}`}>
                    <span className={styles.rowTitle}>
                      {o.title} <span className={local.size}>OBS {o.size}</span>
                      {!switches[o.target] && <span className={local.off}>OFF</span>}
                    </span>
                    <span className={styles.muted}>{switches[o.target] ? o.description : "리모컨 기능 제어에서 꺼져 있어요. OBS 소스는 그대로지만 화면 · 소리가 나오지 않아요."}</span>
                    <code className={local.url}>{`${origin}${o.path(mask(overlayKey))}`}</code>
                  </div>
                  <div className={styles.rowActions}>
                    {!switches[o.target] && (
                      <button type="button" className={styles.primary} disabled={pending} onClick={() => turnOn(o.target)}>
                        켜기
                      </button>
                    )}
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
