"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { generateBanners } from "@/services/creator/aiBanner";
import {
  AI_HEADLINE_MAX,
  AI_PROMPT_MAX,
  AI_QUALITIES,
  AI_RATIOS,
  AI_STYLES,
  AI_SUBLINE_MAX,
  type AiBannerImage,
  type AiQuality,
  type AiRatio,
  type AiStyle
} from "@/services/creator/aiBannerTypes";
import { uploadAsset } from "@/services/creator/assets";
import { ASSET_LIMITS } from "@/services/creator/assetTypes";
import styles from "../../crew/crew.module.css";
import prize from "../../crew/prize.module.css";
import local from "./aiBanner.module.css";

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
/** Style, ratio and quality labels by key (the service's AI_STYLES · AI_RATIOS · AI_QUALITIES stay as written, 2026-11-01). */
const STYLE_KEY: Record<AiStyle, MessageKey> = {
  NEON: "studioToolsLibrary.aiStyleNeon",
  PASTEL: "studioToolsLibrary.aiStylePastel",
  RETRO: "studioToolsLibrary.aiStyleRetro",
  MINIMAL: "studioToolsLibrary.aiStyleMinimal",
  COMIC: "studioToolsLibrary.aiStyleComic",
  SPACE: "studioToolsLibrary.aiStyleSpace"
};
const RATIO_KEY: Record<AiRatio, MessageKey> = {
  WIDE: "studioToolsLibrary.aiRatioWide",
  STRIP: "studioToolsLibrary.aiRatioStrip",
  SQUARE: "studioToolsLibrary.aiRatioSquare",
  TALL: "studioToolsLibrary.aiRatioTall"
};
const QUALITY_KEY: Record<AiQuality, MessageKey> = { STANDARD: "studioToolsLibrary.aiQualityStandard", HIGH: "studioToolsLibrary.aiQualityHigh" };

/** The banner as an image file: PNG, or JPEG when the PNG would not fit the library's image limit. */
async function toImageFile(img: AiBannerImage, name: string): Promise<File> {
  const url = URL.createObjectURL(new Blob([img.svg], { type: "image/svg+xml" }));
  try {
    const el = new Image();
    el.src = url;
    await el.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d")!.drawImage(el, 0, 0, img.width, img.height);
    const blob = (type: string, q?: number) => new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), type, q));
    const png = await blob("image/png");
    if (png.size <= ASSET_LIMITS.bytes.IMAGE) return new File([png], `${name}.png`, { type: "image/png" });
    return new File([await blob("image/jpeg", 0.9)], `${name}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * AI 배너 — code-first (no Figma frame; StreamDonate "배너 제작" 참고, P3). Route `/creator/widgets/banner/ai`. 설명 · 배너
 * 문구 · 작은 문구 · 스타일 6종 · 비율 · 화질 → 만들기 (4장) → 고른 한 장을 PNG로 이미지·사운드 라이브러리에 저장, 배너
 * 슬라이드쇼에서 써요. The AI provider is TBD: a sample generator draws the banners meanwhile.
 */
export function AiBannerScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [headline, setHeadline] = useState("");
  const [subline, setSubline] = useState("");
  const [style, setStyle] = useState<AiStyle>("NEON");
  const [ratio, setRatio] = useState<AiRatio>("WIDE");
  const [quality, setQuality] = useState<AiQuality>("HIGH");
  const [images, setImages] = useState<AiBannerImage[]>([]);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const generate = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await generateBanners({ prompt, headline, subline, style, ratio, quality, seed: Math.floor(Math.random() * 1_000_000_000) });
        if (res.status === "OK") {
          setImages(res.images);
          setSaved({});
        } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/banner/ai");
        else setMessage({ tone: "error", text: res.message });
      } catch {
        setMessage({ tone: "error", text: t("studioToolsLibrary.aiFailed") });
      }
    });
  };

  const save = async (img: AiBannerImage, n: number) => {
    setMessage(null);
    setSaving(img.id);
    const name = (headline.trim() || "AI 배너").slice(0, ASSET_LIMITS.nameMax - 3) + ` ${n}`;
    try {
      const form = new FormData();
      form.set("requestId", `aibanner-${img.id}-${crypto.randomUUID().slice(0, 8)}`);
      form.set("name", name);
      form.set("file", await toImageFile(img, name));
      const res = await uploadAsset(form);
      if (res.status === "SAVED") {
        setSaved((s) => ({ ...s, [img.id]: res.asset.name }));
        setMessage({ tone: "ok", text: t("studioToolsLibrary.aiSaved", { name: res.asset.name }) });
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/banner/ai");
      else setMessage({ tone: "error", text: res.status === "INVALID" ? res.message : t("studioTools.saveFailed") });
    } catch {
      setMessage({ tone: "error", text: t("studioToolsLibrary.aiConvertFailed") });
    } finally {
      setSaving(null);
    }
  };

  const size = AI_RATIOS.find((r) => r.key === ratio)!;
  const scale = AI_QUALITIES.find((q) => q.key === quality)!.scale;

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("studioToolsLibrary.aiTitle")}</h1>
        <p className={styles.subtitle}>{t("studioToolsLibrary.aiSubtitle")}</p>
        <p className={styles.note}>
          <Link href="/creator/widgets/banner">{t("studioToolsLibrary.backBanner")}</Link>
          {t("studioToolsLibrary.aiHeadBefore")}
          <Link href="/creator/widgets/assets">{t("studioTools.assetsLink")}</Link>
          {t("studioToolsLibrary.aiHeadAfter")}
        </p>
      </header>
      <p className={local.notice} role="note">
        {t("studioToolsLibrary.aiNoticeBefore")}
        <b>{t("studioToolsLibrary.aiNoticeBold")}</b>
        {t("studioToolsLibrary.aiNoticeAfter")}
      </p>

      {message && (
        <p className={message.tone === "ok" ? styles.ok : styles.error} role={message.tone === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      <section className={styles.card} aria-labelledby="ai-form-title">
        <h2 id="ai-form-title" className={styles.cardTitle}>
          {t("studioToolsLibrary.aiMakeTitle")}
        </h2>
        <form
          className={prize.form}
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <label className={prize.field}>
            <span className={styles.muted}>{t("studioToolsLibrary.aiDescription")}</span>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              aria-label={t("studioToolsLibrary.aiDescriptionAria")}
              rows={3}
              maxLength={AI_PROMPT_MAX}
              placeholder={t("studioToolsLibrary.aiDescriptionPlaceholder")}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <div className={local.texts}>
            <label className={prize.field}>
              <span className={styles.muted}>{t("studioToolsLibrary.aiHeadline")}</span>
              <input
                className={styles.input}
                aria-label={t("studioToolsLibrary.aiHeadline")}
                maxLength={AI_HEADLINE_MAX}
                placeholder={t("studioToolsLibrary.aiHeadlinePlaceholder")}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
              />
            </label>
            <label className={prize.field}>
              <span className={styles.muted}>{t("studioToolsLibrary.aiSubline")}</span>
              <input
                className={styles.input}
                aria-label={t("studioToolsLibrary.aiSubline")}
                maxLength={AI_SUBLINE_MAX}
                placeholder={t("studioToolsLibrary.aiSublinePlaceholder")}
                value={subline}
                onChange={(e) => setSubline(e.target.value)}
              />
            </label>
          </div>
          <div className={prize.field} role="group" aria-label={t("studioToolsLibrary.aiStyle")}>
            <span className={styles.muted}>{t("studioToolsLibrary.aiStyle")}</span>
            <span className={`${styles.segment} ${local.choices}`}>
              {AI_STYLES.map((s) => (
                <button key={s.key} type="button" aria-pressed={style === s.key} onClick={() => setStyle(s.key)}>
                  {s.emoji} {t(STYLE_KEY[s.key])}
                </button>
              ))}
            </span>
          </div>
          <div className={local.row}>
            <div className={prize.field} role="group" aria-label={t("studioToolsLibrary.aiRatio")}>
              <span className={styles.muted}>{t("studioToolsLibrary.aiRatio")}</span>
              <span className={`${styles.segment} ${local.choices}`}>
                {AI_RATIOS.map((r) => (
                  <button key={r.key} type="button" aria-pressed={ratio === r.key} onClick={() => setRatio(r.key)}>
                    {t(RATIO_KEY[r.key])}
                  </button>
                ))}
              </span>
            </div>
            <div className={prize.field} role="group" aria-label={t("studioToolsLibrary.aiQuality")}>
              <span className={styles.muted}>{t("studioToolsLibrary.aiQuality")}</span>
              <span className={`${styles.segment} ${local.choices}`}>
                {AI_QUALITIES.map((q) => (
                  <button key={q.key} type="button" aria-pressed={quality === q.key} onClick={() => setQuality(q.key)}>
                    {t(QUALITY_KEY[q.key])}
                  </button>
                ))}
              </span>
            </div>
          </div>
          <p className={styles.note}>
            {t("studioToolsLibrary.aiSizeNote", {
              width: Math.round(size.width * scale),
              height: Math.round(size.height * scale),
              prompt: AI_PROMPT_MAX,
              headline: AI_HEADLINE_MAX,
              subline: AI_SUBLINE_MAX
            })}
          </p>
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={pending || (!prompt.trim() && !headline.trim())}>
              {pending ? t("studioToolsLibrary.aiCreating") : images.length ? t("studioToolsLibrary.aiRemake") : t("studioToolsLibrary.aiMake")}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="ai-results-title">
        <h2 id="ai-results-title" className={styles.cardTitle}>
          {t("studioToolsLibrary.aiResults")}
        </h2>
        {images.length === 0 ? (
          <p className={styles.empty}>{t("studioToolsLibrary.aiResultsEmpty")}</p>
        ) : (
          <ul className={local.grid} data-ratio={ratio}>
            {images.map((img, i) => (
              <li key={img.id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a generated SVG shown as is */}
                <img src={svgUrl(img.svg)} alt={t("studioToolsLibrary.aiBannerAlt", { n: i + 1 })} className={local.preview} />
                <div className={local.cardRow}>
                  <span className={styles.muted}>
                    {img.width} × {img.height}
                  </span>
                  {saved[img.id] ? (
                    <Link href="/creator/widgets/banner" className={styles.ghost}>
                      {t("studioToolsLibrary.aiSavedUse")}
                    </Link>
                  ) : (
                    <button type="button" className={styles.primary} disabled={saving !== null} onClick={() => void save(img, i + 1)}>
                      {saving === img.id ? t("studioTools.savingLong") : t("studioToolsLibrary.aiSaveToLibrary")}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
