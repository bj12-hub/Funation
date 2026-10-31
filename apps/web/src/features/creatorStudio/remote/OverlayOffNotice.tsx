"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { setOverlaySwitch } from "@/services/creator/alertRemote";
import { offOverlayTargets, type OverlayTarget } from "@/services/creator/alertTypes";
import styles from "../crew/crew.module.css";
import local from "./overlayOffNotice.module.css";

/** The 기능 제어 names (`OVERLAY_TARGETS` labels) as message keys, so the studio shows them in the viewer's language (2026-11-01). */
const TARGET_KEY: Record<OverlayTarget, MessageKey> = {
  alert: "studioRemote.targetAlert",
  effects: "studioRemote.targetEffects",
  sigplayer: "studioRemote.targetSigplayer",
  video: "studioRemote.targetVideo",
  drawing: "studioRemote.targetDrawing",
  banner: "studioRemote.targetBanner",
  subtitle: "studioRemote.targetSubtitle",
  marquee: "studioRemote.targetMarquee",
  timer: "studioRemote.targetTimer",
  credits: "studioRemote.targetCredits",
  bingo: "studioRemote.targetBingo",
  wheel: "studioRemote.targetWheel",
  widgets: "studioRemote.targetWidgets",
  chat: "studioRemote.targetChat",
  crew: "studioRemote.targetCrew",
  play: "studioRemote.targetPlay",
  custom: "studioRemote.targetCustom",
  bridge: "studioRemote.targetBridge"
};

export const overlayTargetLabel = (target: OverlayTarget, t: (key: MessageKey) => string) => t(TARGET_KEY[target]);

/**
 * Shown above a studio page whose OBS overlay is switched OFF in the 리모컨 기능 제어 (code-first): the
 * creator sees at once why nothing appears on stream, and can switch it back on here. Nothing renders
 * while every listed overlay is ON.
 */
export function OverlayOffNotice({ targets, switches }: { targets: OverlayTarget[]; switches: Record<OverlayTarget, boolean> }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const off = offOverlayTargets(switches, targets);
  if (off.length === 0) return null;

  const turnOn = () =>
    startTransition(async () => {
      setError(null);
      for (const target of off) {
        const res = await setOverlaySwitch({ target: target.key, on: true });
        if (res.status !== "SAVED") {
          setError(res.status === "INVALID" ? res.message : t("studioRemote.signInAgain"));
          return;
        }
      }
      router.refresh();
    });

  return (
    <div className={local.wrap}>
      <div className={local.box} role="status">
        <span>
          <strong>{off.map((target) => overlayTargetLabel(target.key, t)).join(", ")}</strong>
          {t("studioRemote.offNoticeText")} <Link href="/creator/remote#switch-title">{t("studioRemote.offNoticeLink")}</Link>
        </span>
        <button type="button" className={styles.primary} disabled={pending} onClick={turnOn}>
          {t("studioRemote.turnOn")}
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
