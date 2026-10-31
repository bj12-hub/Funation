"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveEffectSettings } from "@/services/creator/effects";
import type { Asset } from "@/services/creator/assetTypes";
import { EFFECT_LIMITS, EMOJI_PRESETS, LAYER_EFFECTS, type EffectSettings, type EffectTier, type LayerEffect } from "@/services/creator/effectsTypes";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import styles from "../crew/crew.module.css";
import { OverlayOffNotice } from "../remote/OverlayOffNotice";
import { CopyButton } from "../settings/SettingsCards";
import local from "./effects.module.css";

/** Layer effect labels by key (the service's LAYER_EFFECTS stay as written, 2026-11-01). */
const EFFECT_KEY: Record<LayerEffect, MessageKey> = {
  CONFETTI: "studioToolsEffects.effectConfetti",
  HEARTS: "studioToolsEffects.effectHearts",
  STARS: "studioToolsEffects.effectStars",
  FIREWORKS: "studioToolsEffects.effectFireworks"
};

/**
 * 이모지 리액션 · 레이어 효과 설정 — code-first (no Figma frame). Route `/creator/widgets/effects`.
 * Effects play with each donation alert on the OBS effects overlay; triggers are channel settings. A 레이어 효과 구간 can also
 * play a 영상 from the library (`videos`, 2026-10-25 — StreamDonate 후원 이펙트 "금액 계단별 영상").
 */
export function EffectsScreen({
  initial,
  videos,
  overlayPath,
  switches
}: {
  initial: EffectSettings;
  videos: Asset[];
  overlayPath: string;
  switches: Record<OverlayTarget, boolean>;
}) {
  const { t } = useI18n();
  const [s, setS] = useState<EffectSettings>(initial);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const setEmoji = (patch: Partial<EffectSettings["emoji"]>) => setS((p) => ({ ...p, emoji: { ...p.emoji, ...patch } }));
  const setLayer = (patch: Partial<EffectSettings["layer"]>) => setS((p) => ({ ...p, layer: { ...p.layer, ...patch } }));
  const toggleEmoji = (e: string) =>
    setS((p) => {
      const has = p.emoji.emojis.includes(e);
      const next = has ? p.emoji.emojis.filter((x) => x !== e) : [...p.emoji.emojis, e];
      return next.length === 0 || next.length > EFFECT_LIMITS.emojisMax ? p : { ...p, emoji: { ...p.emoji, emojis: next } };
    });
  const setTier = (i: number, patch: Partial<EffectTier>) => setS((p) => ({ ...p, layer: { ...p.layer, tiers: p.layer.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) } }));

  const save = () => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await saveEffectSettings(s);
        setNote(
          res.status === "SAVED"
            ? { tone: "ok", text: t("studioToolsEffects.saved") }
            : { tone: "error", text: res.status === "INVALID" ? res.message : t("studioTools.loginRequired") }
        );
      } catch {
        setNote({ tone: "error", text: t("studioTools.saveFailed") });
      }
    });
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioToolsEffects.title")}</h1>
        <p className={styles.subtitle}>{t("studioToolsEffects.subtitle")}</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">{t("studioTools.backWidgets")}</Link>
          {t("studioToolsEffects.headBefore")}
          <Link href="/creator/remote">{t("studioTools.remote")}</Link>
          {t("studioToolsEffects.headAfter")}
        </p>
      </header>
      <OverlayOffNotice targets={["effects"]} switches={switches} />

      <section className={styles.card} aria-labelledby="fx-overlay">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="fx-overlay">
            {t("studioToolsEffects.overlayTitle")}
          </h2>
          <CopyButton value={`${origin}${overlayPath}`} label={t("studioTools.copyOverlayUrl")} className={styles.ghost} />
        </div>
        <p className={styles.note}>{t("studioToolsEffects.overlayNote")}</p>
      </section>

      <section className={styles.card} aria-labelledby="fx-emoji">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="fx-emoji">
            {t("studioToolsEffects.emojiTitle")}
          </h2>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={s.emoji.enabled} onChange={(e) => setEmoji({ enabled: e.target.checked })} />
            {t("studioTools.on")}
          </label>
        </div>
        <div className={styles.addRow}>
          <input
            className={styles.inputSmall}
            type="number"
            min={0}
            aria-label={t("studioToolsEffects.emojiMinAria")}
            value={s.emoji.minFn}
            onChange={(e) => setEmoji({ minFn: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
          />
          <span className={styles.muted}>{t("studioToolsEffects.fnOrMore")}</span>
          <input
            className={styles.inputSmall}
            type="number"
            min={EFFECT_LIMITS.countMin}
            max={EFFECT_LIMITS.countMax}
            aria-label={t("studioToolsEffects.emojiCountAria")}
            value={s.emoji.count}
            onChange={(e) => setEmoji({ count: Math.floor(Number(e.target.value) || 0) })}
          />
          <span className={styles.muted}>{t("studioToolsEffects.countUnit")}</span>
        </div>
        <div className={local.emojis} role="group" aria-label={t("studioToolsEffects.emojiPickAria", { max: EFFECT_LIMITS.emojisMax })}>
          {EMOJI_PRESETS.map((e) => (
            <button key={e} type="button" className={local.emoji} aria-pressed={s.emoji.emojis.includes(e)} onClick={() => toggleEmoji(e)}>
              {e}
            </button>
          ))}
        </div>
        <p className={styles.note}>{t("studioToolsEffects.emojiNote", { max: EFFECT_LIMITS.emojisMax })}</p>
      </section>

      <section className={styles.card} aria-labelledby="fx-layer">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="fx-layer">
            {t("studioToolsEffects.layerTitle")}
          </h2>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={s.layer.enabled} onChange={(e) => setLayer({ enabled: e.target.checked })} />
            {t("studioTools.on")}
          </label>
        </div>
        <p className={styles.note}>
          {t("studioToolsEffects.layerNoteBefore")}
          <Link href="/creator/widgets/assets">{t("studioTools.assetsLink")}</Link>
          {t("studioToolsEffects.layerNoteAfter")}
        </p>
        <ul className={styles.list}>
          {s.layer.tiers.map((tier, i) => (
            <li key={i} className={styles.row}>
              <input
                className={styles.inputSmall}
                type="number"
                min={0}
                aria-label={t("studioToolsEffects.tierMinAria", { n: i + 1 })}
                value={tier.minFn}
                onChange={(e) => setTier(i, { minFn: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              />
              <span className={styles.muted}>{t("studioToolsEffects.fnOrMoreArrow")}</span>
              <select className={styles.select} aria-label={t("studioToolsEffects.tierEffectAria", { n: i + 1 })} value={tier.effect} onChange={(e) => setTier(i, { effect: e.target.value as LayerEffect })}>
                {LAYER_EFFECTS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.emoji} {t(EFFECT_KEY[l.key])}
                  </option>
                ))}
              </select>
              <select
                className={styles.select}
                aria-label={t("studioToolsEffects.tierVideoAria", { n: i + 1 })}
                value={tier.videoUrl && videos.some((v) => v.url === tier.videoUrl) ? tier.videoUrl : ""}
                onChange={(e) => setTier(i, { videoUrl: e.target.value || null })}
              >
                <option value="">{t("studioToolsEffects.noVideo")}</option>
                {videos.map((v) => (
                  <option key={v.id} value={v.url}>
                    🎬 {v.name}
                  </option>
                ))}
              </select>
              {s.layer.tiers.length > 1 && (
                <button type="button" className={styles.ghost} onClick={() => setLayer({ tiers: s.layer.tiers.filter((_, j) => j !== i) })}>
                  {t("studioTools.delete")}
                </button>
              )}
            </li>
          ))}
        </ul>
        {s.layer.tiers.length < EFFECT_LIMITS.tiersMax && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => setLayer({ tiers: [...s.layer.tiers, { minFn: (s.layer.tiers.at(-1)?.minFn ?? 0) * 2 || 10_000, effect: "HEARTS", videoUrl: null }] })}
          >
            {t("studioToolsEffects.addTier")}
          </button>
        )}
      </section>

      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={pending} onClick={save}>
          {pending ? t("studioTools.saving") : t("studioTools.saveSettings")}
        </button>
      </div>
    </div>
  );
}
