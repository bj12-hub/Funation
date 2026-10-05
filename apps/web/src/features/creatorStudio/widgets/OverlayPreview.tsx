"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { sendTestAlert } from "@/services/creator/alertRemote";
import styles from "../crew/crew.module.css";
import local from "./overlayPreview.module.css";

const BACKGROUNDS = [
  { key: "checker", label: "체크무늬" },
  { key: "dark", label: "어두운 화면" },
  { key: "light", label: "밝은 화면" }
] as const;
type Background = (typeof BACKGROUNDS)[number]["key"];

export type OverlayPreviewProps = {
  title: string;
  description: string;
  /** "800 × 600" — the recommended OBS source size the frame is drawn at. */
  size: string;
  /** Overlay path with the real key (creator-only page; never shown as text). */
  src: string;
  manage: string;
  on: boolean;
  /** Overlays that react to a 테스트 후원 (alerts, effects, 벽지). */
  testable: boolean;
};

/**
 * 오버레이 미리보기 — code-first (funnation `preview=true`, 2026-10-06 결정). Overlays are transparent pages, so
 * opening one in a tab shows nothing useful; this draws it at its OBS size, scaled to fit, on a chosen backdrop,
 * and can send a display-only 테스트 후원 to see an alert arrive.
 */
export function OverlayPreview({ title, description, size, src, manage, on, testable }: OverlayPreviewProps) {
  const [bg, setBg] = useState<Background>("checker");
  const [scale, setScale] = useState(1);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [reload, setReload] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const [w, h] = (size.match(/(\d+)\s*×\s*(\d+)/)?.slice(1).map(Number) ?? [1920, 1080]) as [number, number];

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / w));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);

  const test = () => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await sendTestAlert({ requestId: crypto.randomUUID(), amount: 10_000, donor: "미리보기", message: "오버레이 미리보기 테스트예요" });
        setNote(res.status === "SAVED" ? { tone: "ok", text: "테스트 후원을 보냈어요. 잠시 뒤 오버레이에 나타나요." } : { tone: "error", text: res.status === "INVALID" ? res.message : "로그인이 필요합니다." });
      } catch {
        setNote({ tone: "error", text: "보내지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{title} 미리보기</h1>
        <p className={styles.subtitle}>
          {description} OBS 권장 크기 {size}.
        </p>
        <p className={styles.note}>
          <Link href="/creator/widgets/overlays">← 오버레이 주소</Link>
        </p>
      </header>

      {!on && (
        <p className={styles.note} role="status">
          리모컨 기능 제어에서 꺼져 있어 아무것도 보이지 않아요. <Link href="/creator/remote">리모컨</Link>에서 켜면 보여요.
        </p>
      )}

      <div className={local.toolbar}>
        <div className={`${styles.tabs} ${local.backgrounds}`} role="radiogroup" aria-label="미리보기 배경">
          {BACKGROUNDS.map((b) => (
            <button key={b.key} type="button" role="radio" aria-checked={bg === b.key} className={styles.tab} onClick={() => setBg(b.key)}>
              {b.label}
            </button>
          ))}
        </div>
        <div className={styles.rowActions}>
          {testable && (
            <button type="button" className={styles.primary} disabled={pending} onClick={test}>
              {pending ? "보내는 중…" : "테스트 후원 보내기"}
            </button>
          )}
          <button type="button" className={styles.ghost} onClick={() => setReload((n) => n + 1)}>
            새로고침
          </button>
          <a href={src} target="_blank" rel="noopener noreferrer" className={styles.ghost}>
            새 탭에서 열기
          </a>
          <Link href={manage} className={styles.ghost}>
            설정
          </Link>
        </div>
      </div>

      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}

      {/* The wrapper measures the room; the canvas is the overlay's OBS size times the fitted scale. */}
      <div ref={stage} className={local.fit}>
        <div className={local.stage} data-bg={bg} style={{ width: Math.round(w * scale), height: Math.round(h * scale) }}>
          <iframe
            key={reload}
            src={src}
            title={`${title} 오버레이`}
            className={local.frame}
            style={{ width: w, height: h, transform: `scale(${scale})` }}
          />
        </div>
      </div>
      <p className={styles.note}>
        {Math.round(scale * 100)}% 크기로 보여요. 테스트 후원은 화면에만 표시되고 FN은 움직이지 않아요.
      </p>
    </div>
  );
}
