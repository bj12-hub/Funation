"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveSigPlayerSettings } from "@/services/creator/sigPlayer";
import { SIG_PLAYER_MODES, SIG_PLAYER_WAIT_MAX, type SigPlayerMode, type SigPlayerSettings } from "@/services/creator/sigPlayerTypes";
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";

/** 보여 줄 방식 label and note by key (the service's SIG_PLAYER_MODES stay as written, 2026-11-01). */
const MODE_TEXT: Record<SigPlayerMode, [MessageKey, MessageKey]> = {
  MEMBER: ["studioToolsSignatures.modeMember", "studioToolsSignatures.modeMemberNote"],
  MESSAGE: ["studioToolsSignatures.modeMessage", "studioToolsSignatures.modeMessageNote"]
};

/**
 * 시그니처 플레이어 — code-first (no Figma frame; StreamDonate 시그니처 플레이어 참고, 2026-10-25), in
 * `/creator/widgets/signatures`: 보여 줄 방식 (BJ 매치 / 메시지), 노래 전 대기, 소리, and the OBS address (copied whole).
 */
export function SigPlayerCard({ initial, overlayPath }: { initial: SigPlayerSettings; overlayPath: string }) {
  const { t } = useI18n();
  const [s, setS] = useState(initial);
  const [wait, setWait] = useState(String(initial.waitSec));
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const dirty = s.mode !== initial.mode || s.sound !== initial.sound || wait !== String(initial.waitSec);

  const save = () => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await saveSigPlayerSettings({ ...s, waitSec: Number(wait) });
        setNote(
          res.status === "SAVED"
            ? { tone: "ok", text: t("studioToolsSignatures.playerSaved") }
            : { tone: "error", text: res.status === "INVALID" ? res.message : t("studioTools.loginRequired") }
        );
      } catch {
        setNote({ tone: "error", text: t("studioTools.saveFailed") });
      }
    });
  };

  return (
    <section className={styles.card} aria-labelledby="sig-player">
      <h2 className={styles.cardTitle} id="sig-player">
        {t("studioToolsSignatures.playerTitle")}
      </h2>
      <p className={styles.note}>
        {t("studioToolsSignatures.playerNoteBefore")}
        <Link href="/creator/remote">{t("studioTools.remote")}</Link>
        {t("studioToolsSignatures.playerNoteAfter")}
      </p>
      <div className={styles.segment} role="group" aria-label={t("studioToolsSignatures.modeAria")}>
        {SIG_PLAYER_MODES.map((m) => (
          <button key={m.key} type="button" aria-pressed={s.mode === m.key} onClick={() => setS({ ...s, mode: m.key })}>
            {t(MODE_TEXT[m.key][0])}
          </button>
        ))}
      </div>
      <p className={styles.note}>{t(MODE_TEXT[s.mode][1])}</p>
      <div className={styles.addRow}>
        <input
          className={styles.input}
          type="number"
          min={0}
          max={SIG_PLAYER_WAIT_MAX}
          aria-label={t("studioToolsSignatures.waitAria")}
          value={wait}
          onChange={(e) => setWait(e.target.value)}
        />
        <span className={styles.muted}>{t("studioToolsSignatures.waitUnit")}</span>
      </div>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={s.sound} onChange={(e) => setS({ ...s, sound: e.target.checked })} />
        {t("studioToolsSignatures.playerSound")}
      </label>
      <p className={styles.note}>{t("studioToolsSignatures.playerSoundNote")}</p>
      <div className={styles.addRow}>
        <input
          className={styles.input}
          readOnly
          aria-label={t("studioToolsSignatures.playerAddress")}
          value={`${origin}${overlayPath.replace(/[^/]+$/, (k) => `${k.slice(0, 4)}-····-····-····`)}`}
        />
        <CopyButton value={`${origin}${overlayPath}`} label={t("studioTools.copy")} className={styles.ghost} />
      </div>
      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={pending || !dirty} onClick={save}>
          {pending ? t("studioTools.saving") : t("studioTools.saveSettings")}
        </button>
      </div>
    </section>
  );
}
