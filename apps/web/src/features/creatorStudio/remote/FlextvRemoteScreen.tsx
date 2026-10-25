"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { reissueFlextvOverlayKey } from "@/services/creator/flextvRemote";
import type { GachaControlResult, GachaRemoteView } from "@/services/donations/gachaTypes";
import type { QuestRemoteView } from "@/services/donations/questTypes";
import type { RouletteControlResult, RouletteRemoteView } from "@/services/donations/rouletteTypes";
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";
import { GachaRemote } from "./GachaRemote";
import { QuestRemote } from "./QuestRemote";
import { RouletteRemote } from "./RouletteRemote";
import remote from "./remote.module.css";
import { openRemoteWindow } from "./remoteWindow";

const OVERLAYS = [
  { widget: "roulette", label: "🎡 룰렛", size: "800 × 600" },
  { widget: "gacha", label: "🎰 뽑기", size: "800 × 600" },
  { widget: "gacha-board", label: "📜 뽑기 당첨 리스트", size: "1920 × 80" },
  { widget: "quest", label: "🎯 퀘스트", size: "600 × 400" },
  { widget: "mini", label: "⚡ 미니 후원", size: "1920 × 200" }
] as const;

/**
 * 리모컨 with FLEXTV (phase 6; code-first). Route `/creator/remote` (and `/popout/remote`) when FLEXTV's Ssumnation
 * endpoints are on: the 퀘스트 · 룰렛 · 뽑기 panels of the mock 리모컨, acting on FLEXTV's broadcast state through the
 * same server actions, and the OBS overlay addresses for them. The 후원 알림 is FLEXTV's 도우미's, so it is not here.
 */
export function FlextvRemoteScreen({
  quest,
  roulette,
  gacha,
  overlayKey,
  variant = "page"
}: {
  quest: QuestRemoteView;
  roulette: RouletteRemoteView;
  gacha: GachaRemoteView;
  overlayKey: string;
  variant?: "page" | "window";
}) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  const [confirmReissue, setConfirmReissue] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    const poll = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(poll);
  }, [router]);

  const run = (action: () => Promise<RouletteControlResult | GachaControlResult>, ok?: string) => {
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "SAVED") {
          if (ok) setNotice({ tone: "ok", text: ok });
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/remote");
        else setNotice({ tone: "error", text: res.message });
      } catch {
        setNotice({ tone: "error", text: "요청하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  const reissue = () =>
    startTransition(async () => {
      const r = await reissueFlextvOverlayKey();
      setConfirmReissue(false);
      if (r.status === "UNAUTHORIZED") return router.push("/login?role=creator&next=/creator/remote");
      setNotice(r.status === "SAVED" ? { tone: "ok", text: "새 오버레이 주소를 만들었어요. OBS의 브라우저 소스 주소를 모두 바꿔 주세요." } : { tone: "error", text: "주소를 새로 만들지 못했어요. 잠시 후 다시 시도해 주세요." });
      router.refresh();
    });

  return (
    <div className={styles.content}>
      <header className={remote.head}>
        <div className={styles.header}>
          <h1 className={styles.title}>리모컨</h1>
          <p className={styles.subtitle}>방송 중 퀘스트 · 룰렛 · 뽑기를 한 화면에서 진행하세요. 후원 알림은 FLEXTV 도우미에서 나와요.</p>
        </div>
        {variant === "page" && (
          <button
            type="button"
            className={styles.ghost}
            title="방송 중 옆에 띄워 두는 작은 창 (1000 × 800)"
            onClick={() => {
              if (!openRemoteWindow()) setNotice({ tone: "error", text: "브라우저가 새 창을 막았어요. 팝업을 허용한 뒤 다시 눌러 주세요." });
            }}
          >
            ↗ 작은 창으로 열기
          </button>
        )}
      </header>

      <section className={styles.card} aria-labelledby="flextv-overlays">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="flextv-overlays">
            OBS 오버레이 주소
          </h2>
          <button type="button" className={styles.ghost} disabled={pending} onClick={() => setConfirmReissue(true)}>
            주소 새로 만들기
          </button>
        </div>
        <ul className={remote.overlayList}>
          {OVERLAYS.map((o) => (
            <li key={o.widget}>
              <span>
                {o.label} <span className={styles.note}>· 권장 {o.size}</span>
              </span>
              <CopyButton value={`${origin}/overlay/widget/${o.widget}/${overlayKey}`} label="주소 복사" className={styles.ghost} />
            </li>
          ))}
        </ul>
        <p className={styles.note}>OBS의 브라우저 소스에 붙여 넣어요. 주소에는 오버레이 키가 들어 있으니 공유하지 마세요.</p>
      </section>

      {notice && (
        <p className={notice.tone === "error" ? styles.error : styles.ok} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      )}

      <QuestRemote view={quest} />
      <RouletteRemote view={roulette} pending={pending} run={run} />
      <GachaRemote view={gacha} pending={pending} run={run} />

      <Modal
        open={confirmReissue}
        onClose={() => !pending && setConfirmReissue(false)}
        title="오버레이 주소를 새로 만들까요?"
        description="지금 쓰는 주소는 바로 멈춰요. OBS에 넣은 오버레이 주소를 모두 새 주소로 바꿔야 해요."
        footer={
          <>
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => setConfirmReissue(false)}>
              취소
            </button>
            <button type="button" className={styles.primary} disabled={pending} onClick={reissue}>
              새로 만들기
            </button>
          </>
        }
      />
    </div>
  );
}
