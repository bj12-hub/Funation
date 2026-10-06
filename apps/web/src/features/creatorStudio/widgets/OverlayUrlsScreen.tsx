"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setOverlaySwitch } from "@/services/creator/alertRemote";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";
import { obsFileName, obsSceneCollection, OBS_COLLECTION_NAME } from "./obsScenes";
import { OVERLAYS } from "./overlayCatalog";
import local from "./overlayUrls.module.css";

const mask = (key: string) => `${key.slice(0, 4)}-····-····-····`;

/**
 * 오버레이 주소 — code-first (no Figma frame). Route `/creator/widgets/overlays`. Lists every OBS
 * overlay with its recommended size; the key is masked on screen and only copied in full.
 * 후원 위젯 with an overlay (목표 · 누적 · 랭킹 · 최근알림 · 이벤트 · QR) are listed; the other widget popups
 * (미니후원, 커스텀 사운드 …) have no overlay of their own. Overlays switched OFF in
 * the 리모컨 기능 제어 are marked, with a one-click 켜기. "OBS 씬 파일 내려받기" saves every overlay as an OBS scene
 * collection (built in the browser; the file holds the key).
 */
export function OverlayUrlsScreen({ overlayKey, switches }: { overlayKey: string; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
  const downloadObs = () => {
    setError(null);
    try {
      const json = JSON.stringify(obsSceneCollection(OVERLAYS, window.location.origin, overlayKey), null, 2);
      const href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = href;
      a.download = obsFileName();
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setSaved(true);
    } catch {
      setError("파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

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
        <CopyButton value={all} label={`목록 전체 복사 (${OVERLAYS.length})`} className={styles.ghost} />
        <button type="button" className={styles.primary} onClick={downloadObs}>
          OBS 씬 파일 내려받기
        </button>
      </div>
      <section className={styles.card} aria-labelledby="obs-import">
        <h2 className={styles.cardTitle} id="obs-import">
          🎬 OBS에 한 번에 넣기
        </h2>
        <ol className={local.steps}>
          <li>위의 &lsquo;OBS 씬 파일 내려받기&rsquo;로 파일을 받아요.</li>
          <li>OBS 메뉴 장면 모음(Scene Collection) → 가져오기(Import)에서 받은 파일을 골라 가져와요.</li>
          <li>
            장면 모음에서 &lsquo;{OBS_COLLECTION_NAME}&rsquo;를 고르면 분류별 장면 {groups.length}개와 브라우저 소스 {OVERLAYS.length}개가 권장 크기로 들어 있어요. 쓰던 장면 모음은 그대로예요.
          </li>
        </ol>
        <p className={styles.note}>파일에 연동 키가 들어 있으니 다른 사람에게 보내지 마세요. 연동 키를 재발급하면 파일을 다시 받아야 해요.</p>
        {saved && (
          <p className={styles.ok} role="status">
            파일을 내려받았어요. OBS에서 가져오기로 불러오세요.
          </p>
        )}
      </section>
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
                    <Link href={`/creator/widgets/overlays/preview/${o.id}`} className={styles.ghost}>
                      미리보기
                    </Link>
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
