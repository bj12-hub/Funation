"use client";

import Image from "next/image";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { CopyButton } from "./SettingsCards";
import styles from "./setupGuides.module.css";

/** Every text is a message key (2026-11-01): the guides are UI help and follow the viewer's language. */
type GuideStep = {
  title: MessageKey;
  /** Plain lines under the title. */
  lines?: MessageKey[];
  /** Grey card of "Step ①" lines (simulcast 328:1558). */
  card?: MessageKey[];
  download?: { label: MessageKey; href: string };
  showUrl?: boolean;
  images?: { src: string; alt: MessageKey; width: number; height: number }[];
};

type Guide = { key: string; tile: MessageKey; title: MessageKey; steps: GuideStep[]; warning?: { title: MessageKey; lines: MessageKey[] } };

/**
 * Figma 328:581 (OBS) · 328:927 (Xsplit) · 328:1266 (2가지 플랫폼 동시송출) — broadcast setup guides.
 * Download targets are the vendors' official pages (the design leaves them unspecified).
 * The simulcast badges read ❺–❽ in the design (leftover numbering); they are shown as 1–4.
 */
const GUIDES: Guide[] = [
  {
    key: "obs",
    tile: "studioSettings.obsTile",
    title: "studioSettings.obsTitle",
    steps: [
      { title: "studioSettings.obsInstall", lines: ["studioSettings.obsInstallLine"], download: { label: "studioSettings.obsDownload", href: "https://obsproject.com/download" } },
      {
        title: "studioSettings.obsName",
        lines: ["studioSettings.obsNameStep1", "studioSettings.obsNameStep2"],
        images: [
          { src: "/mock/creator/guides/obs-1.png", alt: "studioSettings.obsImage1", width: 1184, height: 876 },
          { src: "/mock/creator/guides/obs-2.png", alt: "studioSettings.obsImage2", width: 1184, height: 876 }
        ]
      },
      {
        title: "studioSettings.obsUrl",
        lines: ["studioSettings.obsUrlLine"],
        showUrl: true,
        images: [{ src: "/mock/creator/guides/obs-3.png", alt: "studioSettings.obsImage3", width: 1184, height: 876 }]
      },
      {
        title: "studioSettings.widgetSetup",
        lines: ["studioSettings.widgetSetupLine"],
        images: [{ src: "/mock/creator/guides/obs-4.png", alt: "studioSettings.obsImage4", width: 1184, height: 876 }]
      }
    ]
  },
  {
    key: "xsplit",
    tile: "studioSettings.xsplitTile",
    title: "studioSettings.xsplitTitle",
    steps: [
      {
        title: "studioSettings.xsplitInstall",
        lines: ["studioSettings.xsplitInstallLine"],
        download: { label: "studioSettings.xsplitDownload", href: "https://www.xsplit.com/broadcaster" }
      },
      {
        title: "studioSettings.xsplitUrl",
        lines: ["studioSettings.xsplitUrlStep1", "studioSettings.xsplitUrlStep2"],
        showUrl: true,
        images: [
          { src: "/mock/creator/guides/xsplit-1.png", alt: "studioSettings.xsplitImage1", width: 1048, height: 876 },
          { src: "/mock/creator/guides/xsplit-2.png", alt: "studioSettings.xsplitImage2", width: 1048, height: 876 }
        ]
      },
      {
        title: "studioSettings.widgetSetup",
        lines: ["studioSettings.widgetSetupLine"],
        images: [{ src: "/mock/creator/guides/xsplit-3.png", alt: "studioSettings.xsplitImage3", width: 911, height: 738 }]
      }
    ]
  },
  {
    key: "simulcast",
    tile: "studioSettings.simulcastTile",
    title: "studioSettings.simulcastTitle",
    steps: [
      {
        title: "studioSettings.simulcastSetup",
        lines: ["studioSettings.simulcastSetupLine"],
        card: ["studioSettings.simulcastSetupStep1", "studioSettings.simulcastSetupStep2", "studioSettings.simulcastSetupStep3"]
      },
      {
        title: "studioSettings.simulcastFirst",
        lines: ["studioSettings.simulcastFirstLine"],
        card: ["studioSettings.simulcastAddStep", "studioSettings.simulcastFirstStep2", "studioSettings.simulcastSaveStep"]
      },
      {
        title: "studioSettings.simulcastSecond",
        lines: ["studioSettings.simulcastSecondLine"],
        card: ["studioSettings.simulcastAddStep", "studioSettings.simulcastSecondStep2", "studioSettings.simulcastSaveStep"]
      },
      {
        title: "studioSettings.simulcastStart",
        lines: ["studioSettings.simulcastStartLine"],
        card: ["studioSettings.simulcastStartStep1", "studioSettings.simulcastStartStep2", "studioSettings.simulcastStartStep3"]
      }
    ],
    warning: {
      title: "studioSettings.simulcastNoticeTitle",
      lines: ["studioSettings.simulcastNotice1", "studioSettings.simulcastNotice2", "studioSettings.simulcastNotice3"]
    }
  }
];

/** Tiles on 315:528 that open the guides. */
export function SetupGuides({ channelName, widgetUrl }: { channelName: string; widgetUrl: string }) {
  const { t } = useI18n();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const guide = GUIDES.find((g) => g.key === openKey) ?? null;

  return (
    <>
      <ul className={styles.tiles}>
        {GUIDES.map((g) => (
          <li key={g.key}>
            <button type="button" className={styles.tile} aria-haspopup="dialog" onClick={() => setOpenKey(g.key)}>
              {t(g.tile)}
            </button>
          </li>
        ))}
      </ul>
      <Modal open={guide !== null} onClose={() => setOpenKey(null)} title={guide ? t(guide.title) : t("studioSettings.guideFallback")} width={680} className={styles.dialog}>
        {guide && (
          <div className={styles.body}>
            {guide.steps.map((s, i) => (
              <section key={s.title} className={styles.step} aria-labelledby={`guide-${guide.key}-${i}`}>
                <h3 id={`guide-${guide.key}-${i}`} className={styles.stepTitle}>
                  <span className={styles.badge} aria-hidden="true">
                    {i + 1}
                  </span>
                  {t(s.title)}
                </h3>
                {s.lines?.map((l) => (
                  <p key={l} className={styles.text}>
                    {t(l)}
                  </p>
                ))}
                {s.card && (
                  <ul className={styles.card}>
                    {s.card.map((l) => (
                      <li key={l}>{t(l)}</li>
                    ))}
                  </ul>
                )}
                {s.download && (
                  <div className={styles.download}>
                    <a href={s.download.href} target="_blank" rel="noopener noreferrer" className={styles.downloadButton}>
                      {t(s.download.label)}
                    </a>
                  </div>
                )}
                {s.showUrl && (
                  <div className={styles.urlBox}>
                    <span className={styles.urlLabel}>{t("studioSettings.guideUrlLabel", { name: channelName })}</span>
                    <div className={styles.urlRow}>
                      <span className={styles.urlField}>{widgetUrl}</span>
                      <CopyButton value={widgetUrl} label={t("studioSettings.copyUrl")} className={styles.copyButton} />
                      <a href={widgetUrl} target="_blank" rel="noopener noreferrer" className={styles.openButton}>
                        {t("studioSettings.open")}
                      </a>
                    </div>
                  </div>
                )}
                {s.images && (
                  <div className={s.images.length > 1 ? styles.imagesTwo : styles.images}>
                    {s.images.map((img) => (
                      <Image key={img.src} src={img.src} alt={t(img.alt)} width={img.width} height={img.height} className={styles.image} />
                    ))}
                  </div>
                )}
              </section>
            ))}
            {guide.warning && (
              <div className={styles.warning}>
                <strong>{t(guide.warning.title)}</strong>
                {guide.warning.lines.map((l) => (
                  <p key={l}>{t(l)}</p>
                ))}
              </div>
            )}
            <button type="button" className={styles.close} onClick={() => setOpenKey(null)}>
              {t("studioSettings.close")}
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
