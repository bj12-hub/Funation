"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
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

const OVERLAYS: { widget: string; label: MessageKey; size: string }[] = [
  { widget: "roulette", label: "flextvRemote.overlayRoulette", size: "800 × 600" },
  { widget: "gacha", label: "flextvRemote.overlayGacha", size: "800 × 600" },
  { widget: "gacha-board", label: "flextvRemote.overlayGachaBoard", size: "1920 × 80" },
  { widget: "quest", label: "flextvRemote.overlayQuest", size: "600 × 400" },
  { widget: "mini", label: "flextvRemote.overlayMini", size: "1920 × 200" }
];

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
  const { t } = useI18n();
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
        setNotice({ tone: "error", text: t("flextvRemote.requestFailed") });
      }
    });
  };

  const reissue = () =>
    startTransition(async () => {
      const r = await reissueFlextvOverlayKey();
      setConfirmReissue(false);
      if (r.status === "UNAUTHORIZED") return router.push("/login?role=creator&next=/creator/remote");
      setNotice(r.status === "SAVED" ? { tone: "ok", text: t("flextvRemote.reissued") } : { tone: "error", text: t("flextvRemote.reissueFailed") });
      router.refresh();
    });

  return (
    <div className={styles.content}>
      <header className={remote.head}>
        <div className={styles.header}>
          <h1 className={styles.title}>{t("flextvRemote.title")}</h1>
          <p className={styles.subtitle}>{t("flextvRemote.subtitle")}</p>
        </div>
        {variant === "page" && (
          <button
            type="button"
            className={styles.ghost}
            title={t("flextvRemote.openWindowTitle")}
            onClick={() => {
              if (!openRemoteWindow()) setNotice({ tone: "error", text: t("flextvRemote.popupBlocked") });
            }}
          >
            {t("flextvRemote.openWindow")}
          </button>
        )}
      </header>

      <section className={styles.card} aria-labelledby="flextv-overlays">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="flextv-overlays">
            {t("flextvRemote.overlaysTitle")}
          </h2>
          <button type="button" className={styles.ghost} disabled={pending} onClick={() => setConfirmReissue(true)}>
            {t("flextvRemote.reissue")}
          </button>
        </div>
        <ul className={remote.overlayList}>
          {OVERLAYS.map((o) => (
            <li key={o.widget}>
              <span>
                {t(o.label)} <span className={styles.note}>· {t("flextvRemote.recommended", { size: o.size })}</span>
              </span>
              <CopyButton value={`${origin}/overlay/widget/${o.widget}/${overlayKey}`} label={t("flextvRemote.copyAddress")} className={styles.ghost} />
            </li>
          ))}
        </ul>
        <p className={styles.note}>{t("flextvRemote.overlayNote")}</p>
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
        title={t("flextvRemote.reissueTitle")}
        description={t("flextvRemote.reissueDescription")}
        footer={
          <>
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => setConfirmReissue(false)}>
              {t("flextvRemote.cancel")}
            </button>
            <button type="button" className={styles.primary} disabled={pending} onClick={reissue}>
              {t("flextvRemote.reissueConfirm")}
            </button>
          </>
        }
      />
    </div>
  );
}
