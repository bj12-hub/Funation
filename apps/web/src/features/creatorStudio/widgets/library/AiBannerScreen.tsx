"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
        setMessage({ tone: "error", text: "배너를 만들지 못했어요. 잠시 후 다시 시도해 주세요." });
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
        setMessage({ tone: "ok", text: `'${res.asset.name}' 이미지를 라이브러리에 저장했어요. 배너 슬라이드쇼에 넣어 보세요.` });
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/banner/ai");
      else setMessage({ tone: "error", text: res.status === "INVALID" ? res.message : "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
    } catch {
      setMessage({ tone: "error", text: "이미지로 바꾸지 못했어요. 잠시 후 다시 시도해 주세요." });
    } finally {
      setSaving(null);
    }
  };

  const size = AI_RATIOS.find((r) => r.key === ratio)!;
  const scale = AI_QUALITIES.find((q) => q.key === quality)!.scale;

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>AI 배너</h1>
        <p className={styles.subtitle}>설명과 문구를 넣으면 배너 이미지를 4장 만들어 줘요. 마음에 드는 걸 라이브러리에 저장해 배너 슬라이드쇼에 써요.</p>
        <p className={styles.note}>
          <Link href="/creator/widgets/banner">← 배너</Link> · 저장한 이미지는 <Link href="/creator/widgets/assets">이미지·사운드</Link>에 들어가요.
        </p>
      </header>
      <p className={local.notice} role="note">
        🧪 지금은 AI 제공자를 연결하기 전이라 <b>샘플 생성기</b>로 만들어요. 실제 AI 결과와는 달라요 (제공자 · 비용 · 이용 한도는 아직 정하지 않았어요).
      </p>

      {message && (
        <p className={message.tone === "ok" ? styles.ok : styles.error} role={message.tone === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      <section className={styles.card} aria-labelledby="ai-form-title">
        <h2 id="ai-form-title" className={styles.cardTitle}>
          ✨ 만들기
        </h2>
        <form
          className={prize.form}
          onSubmit={(e) => {
            e.preventDefault();
            generate();
          }}
        >
          <label className={prize.field}>
            <span className={styles.muted}>설명</span>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              aria-label="배너 설명"
              rows={3}
              maxLength={AI_PROMPT_MAX}
              placeholder="예: 보라색 우주 배경에 고양이, 밤에 하는 게임 방송"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <div className={local.texts}>
            <label className={prize.field}>
              <span className={styles.muted}>배너 문구</span>
              <input className={styles.input} aria-label="배너 문구" maxLength={AI_HEADLINE_MAX} placeholder="예: 오늘도 달린다" value={headline} onChange={(e) => setHeadline(e.target.value)} />
            </label>
            <label className={prize.field}>
              <span className={styles.muted}>작은 문구</span>
              <input className={styles.input} aria-label="작은 문구" maxLength={AI_SUBLINE_MAX} placeholder="예: 매일 밤 9시" value={subline} onChange={(e) => setSubline(e.target.value)} />
            </label>
          </div>
          <div className={prize.field} role="group" aria-label="스타일">
            <span className={styles.muted}>스타일</span>
            <span className={`${styles.segment} ${local.choices}`}>
              {AI_STYLES.map((s) => (
                <button key={s.key} type="button" aria-pressed={style === s.key} onClick={() => setStyle(s.key)}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </span>
          </div>
          <div className={local.row}>
            <div className={prize.field} role="group" aria-label="비율">
              <span className={styles.muted}>비율</span>
              <span className={`${styles.segment} ${local.choices}`}>
                {AI_RATIOS.map((r) => (
                  <button key={r.key} type="button" aria-pressed={ratio === r.key} onClick={() => setRatio(r.key)}>
                    {r.label}
                  </button>
                ))}
              </span>
            </div>
            <div className={prize.field} role="group" aria-label="화질">
              <span className={styles.muted}>화질</span>
              <span className={`${styles.segment} ${local.choices}`}>
                {AI_QUALITIES.map((q) => (
                  <button key={q.key} type="button" aria-pressed={quality === q.key} onClick={() => setQuality(q.key)}>
                    {q.label}
                  </button>
                ))}
              </span>
            </div>
          </div>
          <p className={styles.note}>
            저장 크기 {Math.round(size.width * scale)} × {Math.round(size.height * scale)} · 설명은 {AI_PROMPT_MAX}자, 배너 문구 {AI_HEADLINE_MAX}자, 작은 문구 {AI_SUBLINE_MAX}자까지. 설명이나 배너
            문구 중 하나는 넣어 주세요.
          </p>
          <div className={styles.actions}>
            <button type="submit" className={styles.primary} disabled={pending || (!prompt.trim() && !headline.trim())}>
              {pending ? "만드는 중…" : images.length ? "다시 만들기" : "만들기"}
            </button>
          </div>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="ai-results-title">
        <h2 id="ai-results-title" className={styles.cardTitle}>
          결과
        </h2>
        {images.length === 0 ? (
          <p className={styles.empty}>아직 만든 배너가 없어요. 위에서 설명과 문구를 넣고 만들어 보세요.</p>
        ) : (
          <ul className={local.grid} data-ratio={ratio}>
            {images.map((img, i) => (
              <li key={img.id}>
                {/* eslint-disable-next-line @next/next/no-img-element -- a generated SVG shown as is */}
                <img src={svgUrl(img.svg)} alt={`만든 배너 ${i + 1}`} className={local.preview} />
                <div className={local.cardRow}>
                  <span className={styles.muted}>
                    {img.width} × {img.height}
                  </span>
                  {saved[img.id] ? (
                    <Link href="/creator/widgets/banner" className={styles.ghost}>
                      저장됨 · 배너에서 쓰기
                    </Link>
                  ) : (
                    <button type="button" className={styles.primary} disabled={saving !== null} onClick={() => void save(img, i + 1)}>
                      {saving === img.id ? "저장하는 중…" : "라이브러리에 저장"}
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
