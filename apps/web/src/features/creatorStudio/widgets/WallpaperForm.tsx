"use client";

import { useRef, useState, type ReactNode } from "react";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { PROFILE_PHOTO_TYPES } from "@/lib/validation";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import { deleteWallpaperImage, uploadWallpaperImage } from "@/services/creator/widgetSettings";
import { WALLPAPER_IMAGES_MAX, WALLPAPER_LAYOUTS, type WallpaperImage } from "@/services/creator/widgetSettingsTypes";
import { ColorField, ColorFontFields, Radios, Row, SwitchText } from "./fields";
import { WallpaperView } from "./GameViews";
import type { FormProps } from "./forms";
import styles from "./widgets.module.css";

const UPLOAD_ERRORS = {
  UNSUPPORTED: "JPG, PNG, WEBP 이미지만 등록할 수 있어요.",
  TOO_LARGE: "이미지는 5MB 이하만 등록할 수 있어요.",
  LIMIT: `벽지 이미지는 최대 ${WALLPAPER_IMAGES_MAX}개까지 등록할 수 있어요.`,
  FAILED: "이미지를 등록하지 못했습니다.",
  UNAUTHORIZED: "로그인이 필요합니다."
} as const;

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
      } else setMessage(UPLOAD_ERRORS[r.status]);
    } catch {
      setMessage(UPLOAD_ERRORS.FAILED);
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
      } else setMessage(UPLOAD_ERRORS.UNAUTHORIZED);
    } catch {
      setMessage("이미지를 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.wallpaperPreview}>
        <div className={styles.wpTabs} role="tablist" aria-label="벽지 레이아웃 미리보기">
          {WALLPAPER_LAYOUTS.map((l) => (
            <button key={l.key} type="button" role="tab" aria-selected={v.layout === l.key} onClick={() => set("layout", l.key)}>
              {l.label}
            </button>
          ))}
        </div>
        <PreviewStage width={900} minHeight={340} label="벽지 미리보기">
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

      <Fold title="테마">
        <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
      </Fold>

      <Fold title="벽지 위젯 설정">
        <p className={styles.noticePink}>* [중요] 아래 이미지와 같이 오버레이를 전체화면으로 설정해야만 벽지 위젯을 정확히 화면에 남기실 수 있습니다.</p>
        <div className={styles.grid2}>
          <div className={styles.setupCard}>
            <strong>OBS Studio 설정</strong>
            <span className={styles.screenFrame} aria-hidden="true">
              1920 × 1080
            </span>
            <p className={styles.notice}>너비 1920, 높이 1080 전체화면 필수 설정</p>
          </div>
          <div className={styles.setupCard}>
            <strong>XSplit 설정</strong>
            <span className={styles.screenFrame} aria-hidden="true">
              1920 × 1080
            </span>
            <p className={styles.notice}>XSplit 소스 추가 후 1920x1080 수동 맞춤 적용</p>
          </div>
        </div>
      </Fold>

      <Fold title="벽지 디자인 설정">
        <div className={styles.rows}>
          <p className={styles.subTitle}>기본 설정</p>
          <Row label="벽지 레이아웃">
            <Radios name="wp-layout" label="벽지 레이아웃" options={WALLPAPER_LAYOUTS} value={v.layout} onChange={(x) => set("layout", x)} />
          </Row>
          <Row label="FN 폰트 설정">
            <ColorFontFields label="FN" value={v.fnFont} onChange={(x) => set("fnFont", x)} />
          </Row>
          <Row label="FN 폰트 테두리">
            <ColorField label="FN 폰트 테두리" value={v.fnOutline} onChange={(x) => set("fnOutline", x)} />
          </Row>

          <p className={styles.subTitle}>벽지 이미지</p>
          <Row label="후원 이미지 우선">
            <SwitchText
              label="후원 이미지 우선"
              checked={v.preferDonationImage}
              onChange={(x) => set("preferDonationImage", x)}
              text="켜면 시그니처 후원은 시그니처 이미지로, 나머지 후원은 벽지 이미지로 붙어요"
            />
          </Row>
          <Row label="벽지 이미지 등록">
            <div className={styles.filterBox}>
              <div className={styles.inline} aria-busy={busy}>
                <input
                  ref={fileRef}
                  type="file"
                  accept={PROFILE_PHOTO_TYPES.join(",")}
                  className={styles.srOnly}
                  aria-label="벽지 이미지 파일"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                  }}
                />
                <button
                  type="button"
                  className={styles.addTile}
                  aria-label="벽지 이미지 추가"
                  disabled={busy || images.length >= WALLPAPER_IMAGES_MAX}
                  onClick={() => fileRef.current?.click()}
                >
                  +
                </button>
                <button type="button" className={styles.roundNav} aria-label="이전 이미지" disabled={index <= 0} onClick={() => setIndex((i) => i - 1)}>
                  ‹
                </button>
                {current ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded images are data URLs in the mock
                  <img src={current.url} alt={`벽지 이미지 ${index + 1}`} className={styles.wpThumb} />
                ) : (
                  <span className={styles.wpThumbEmpty}>없음</span>
                )}
                <button
                  type="button"
                  className={styles.roundNav}
                  aria-label="다음 이미지"
                  disabled={index >= images.length - 1}
                  onClick={() => setIndex((i) => i + 1)}
                >
                  ›
                </button>
                {current && (
                  <button type="button" className={styles.dangerIcon} aria-label="현재 벽지 이미지 삭제" disabled={busy} onClick={remove}>
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

          <p className={styles.subTitle}>벽지 도네이터 닉네임 설정</p>
          <Row label="닉네임 폰트 설정">
            <ColorFontFields label="닉네임" value={v.nicknameFont} onChange={(x) => set("nicknameFont", x)} />
          </Row>
          <Row label="닉네임 컬러">
            <ColorField label="닉네임 컬러" value={v.nicknameColor} onChange={(x) => set("nicknameColor", x)} />
          </Row>
          <Row label="텍스트 박스 컬러">
            <ColorField label="텍스트 박스 컬러" value={v.textBoxColor} onChange={(x) => set("textBoxColor", x)} />
          </Row>
        </div>
      </Fold>
    </>
  );
}
