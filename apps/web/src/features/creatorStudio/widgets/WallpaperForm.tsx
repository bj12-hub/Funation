"use client";

import { useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { PROFILE_PHOTO_TYPES } from "@/lib/validation";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import { deleteWallpaperImage, uploadWallpaperImage } from "@/services/creator/widgetSettings";
import { WALLPAPER_IMAGES_MAX, WALLPAPER_LAYOUTS, type WallpaperImage } from "@/services/creator/widgetSettingsTypes";
import { ColorField, ColorFontFields, Radios, Row, SwitchText } from "./fields";
import { WallpaperView } from "./GameViews";
import type { FormProps } from "./forms";
import { translatedOptions } from "./widgetFormLabels";
import styles from "./widgets.module.css";

/** Upload results as message keys (LIMIT takes `{max}`). */
const UPLOAD_ERRORS = {
  UNSUPPORTED: "widgetFormWallpaper.uploadUnsupported",
  TOO_LARGE: "widgetFormWallpaper.uploadTooLarge",
  LIMIT: "widgetFormWallpaper.uploadLimit",
  FAILED: "widgetFormWallpaper.uploadFailed",
  UNAUTHORIZED: "widgetForm.loginRequired"
} as const satisfies Record<string, MessageKey>;

function Fold({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className={styles.fold} open>
      <summary>{title}</summary>
      <div className={styles.foldBody}>{children}</div>
    </details>
  );
}

/**
 * 벽지 위젯 설정 — Figma 395:145. Images upload and delete immediately; the footer saves the rest.
 * The design's OBS/XSplit screenshots are placeholders, so the setup steps are shown as text.
 */
export function WallpaperForm({ value: v, onChange, live }: FormProps<"WALLPAPER">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const [images, setImages] = useState<WallpaperImage[]>(v.images);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const current = images[Math.min(index, images.length - 1)] ?? null;
  const { t } = useI18n();
  const uploadError = (key: keyof typeof UPLOAD_ERRORS) => t(UPLOAD_ERRORS[key], { max: WALLPAPER_IMAGES_MAX });
  const layoutOptions = translatedOptions(WALLPAPER_LAYOUTS, t);

  const upload = async (file: File) => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const fd = new FormData();
    fd.set("image", file);
    try {
      const r = await uploadWallpaperImage(fd);
      if (r.status === "UPLOADED") {
        setImages((list) => {
          setIndex(list.length);
          return [...list, r.image];
        });
      } else setMessage(uploadError(r.status));
    } catch {
      setMessage(uploadError("FAILED"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const r = await deleteWallpaperImage(current.id);
      if (r.status === "DELETED") {
        setImages((list) => list.filter((i) => i.id !== current.id));
        setIndex((i) => Math.max(0, i - 1));
      } else setMessage(uploadError("UNAUTHORIZED"));
    } catch {
      setMessage(t("widgetFormWallpaper.deleteFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.wallpaperPreview}>
        <div className={styles.wpTabs} role="tablist" aria-label={t("widgetFormWallpaper.previewTabs")}>
          {layoutOptions.map((l) => (
            <button key={l.key} type="button" role="tab" aria-selected={v.layout === l.key} onClick={() => set("layout", l.key)}>
              {l.label}
            </button>
          ))}
        </div>
        <PreviewStage width={900} minHeight={340} label={t("widgetFormWallpaper.previewAria")}>
          <WallpaperView
            settings={v}
            images={current ? [current.url] : []}
            stickers={[
              { id: "s1", x: 60, y: 40, rotate: -6, image: current ? 0 : null, imageUrl: null, nickname: "하루봄", amount: "1,000 FN", test: false },
              { id: "s2", x: 350, y: 70, rotate: 4, image: current ? 0 : null, imageUrl: null, nickname: "도도쭈", amount: "5,000 FN", test: false },
              { id: "s3", x: 640, y: 30, rotate: -3, image: current ? 0 : null, imageUrl: null, nickname: "밤톨게임", amount: "10,000 FN", test: true }
            ]}
            theme={resolveTheme(live.appearance, v.theme)}
            width={900}
            height={340}
          />
        </PreviewStage>
      </div>

      <Fold title={t("widgetForm.theme")}>
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Fold>

      <Fold title={t("widgetFormWallpaper.setup")}>
        <p className={styles.noticePink}>{t("widgetFormWallpaper.important")}</p>
        <div className={styles.grid2}>
          <div className={styles.setupCard}>
            <strong>{t("widgetFormWallpaper.obs")}</strong>
            <span className={styles.screenFrame} aria-hidden="true">
              1920 × 1080
            </span>
            <p className={styles.notice}>{t("widgetFormWallpaper.obsNote")}</p>
          </div>
          <div className={styles.setupCard}>
            <strong>{t("widgetFormWallpaper.xsplit")}</strong>
            <span className={styles.screenFrame} aria-hidden="true">
              1920 × 1080
            </span>
            <p className={styles.notice}>{t("widgetFormWallpaper.xsplitNote")}</p>
          </div>
        </div>
      </Fold>

      <Fold title={t("widgetFormWallpaper.design")}>
        <div className={styles.rows}>
          <p className={styles.subTitle}>{t("widgetForm.basic")}</p>
          <Row label={t("widgetFormWallpaper.layout")}>
            <Radios name="wp-layout" label={t("widgetFormWallpaper.layout")} options={layoutOptions} value={v.layout} onChange={(x) => set("layout", x)} />
          </Row>
          <Row label={t("widgetFormWallpaper.fnFont")}>
            <ColorFontFields label="FN" value={v.fnFont} onChange={(x) => set("fnFont", x)} />
          </Row>
          <Row label={t("widgetFormWallpaper.fnOutline")}>
            <ColorField label={t("widgetFormWallpaper.fnOutline")} value={v.fnOutline} onChange={(x) => set("fnOutline", x)} />
          </Row>

          <p className={styles.subTitle}>{t("widgetFormWallpaper.images")}</p>
          <Row label={t("widgetFormWallpaper.prefer")}>
            <SwitchText
              label={t("widgetFormWallpaper.prefer")}
              checked={v.preferDonationImage}
              onChange={(x) => set("preferDonationImage", x)}
              text={t("widgetFormWallpaper.preferHint")}
            />
          </Row>
          <Row label={t("widgetFormWallpaper.upload")}>
            <div className={styles.filterBox}>
              <div className={styles.inline} aria-busy={busy}>
                <input
                  ref={fileRef}
                  type="file"
                  accept={PROFILE_PHOTO_TYPES.join(",")}
                  className={styles.srOnly}
                  aria-label={t("widgetFormWallpaper.file")}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                  }}
                />
                <button
                  type="button"
                  className={styles.addTile}
                  aria-label={t("widgetFormWallpaper.add")}
                  disabled={busy || images.length >= WALLPAPER_IMAGES_MAX}
                  onClick={() => fileRef.current?.click()}
                >
                  +
                </button>
                <button type="button" className={styles.roundNav} aria-label={t("widgetFormWallpaper.prev")} disabled={index <= 0} onClick={() => setIndex((i) => i - 1)}>
                  ‹
                </button>
                {current ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded images are data URLs in the mock
                  <img src={current.url} alt={t("widgetFormWallpaper.imageAlt", { n: index + 1 })} className={styles.wpThumb} />
                ) : (
                  <span className={styles.wpThumbEmpty}>{t("widgetForm.none")}</span>
                )}
                <button
                  type="button"
                  className={styles.roundNav}
                  aria-label={t("widgetFormWallpaper.next")}
                  disabled={index >= images.length - 1}
                  onClick={() => setIndex((i) => i + 1)}
                >
                  ›
                </button>
                {current && (
                  <button type="button" className={styles.dangerIcon} aria-label={t("widgetFormWallpaper.deleteCurrent")} disabled={busy} onClick={remove}>
                    🗑️
                  </button>
                )}
                <span className={styles.suffix}>
                  {images.length === 0 ? 0 : Math.min(index, images.length - 1) + 1} / {images.length}
                </span>
              </div>
              {message && (
                <p className={styles.error} role="alert">
                  {message}
                </p>
              )}
            </div>
          </Row>

          <p className={styles.subTitle}>{t("widgetFormWallpaper.nickname")}</p>
          <Row label={t("widgetFormWallpaper.nickFont")}>
            <ColorFontFields label={t("widgetFormWallpaper.nickLabel")} value={v.nicknameFont} onChange={(x) => set("nicknameFont", x)} />
          </Row>
          <Row label={t("widgetForm.nicknameColor")}>
            <ColorField label={t("widgetForm.nicknameColor")} value={v.nicknameColor} onChange={(x) => set("nicknameColor", x)} />
          </Row>
          <Row label={t("widgetFormWallpaper.textBox")}>
            <ColorField label={t("widgetFormWallpaper.textBox")} value={v.textBoxColor} onChange={(x) => set("textBoxColor", x)} />
          </Row>
        </div>
      </Fold>
    </>
  );
}
