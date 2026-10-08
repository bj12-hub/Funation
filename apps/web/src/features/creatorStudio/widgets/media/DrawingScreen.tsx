"use client";

import { OverlayLookPicker } from "@/features/overlayTheme/OverlayLookPicker";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { addTestDrawing, deleteDrawing, saveDrawingSettings, setDrawingShowing } from "@/services/creator/media";
import { MEDIA_LIMITS, type DrawingView, type MediaResult } from "@/services/creator/mediaTypes";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import styles from "../../crew/crew.module.css";
import { OverlayOffNotice } from "../../remote/OverlayOffNotice";
import { CopyButton } from "../../settings/SettingsCards";
import local from "./media.module.css";

/**
 * 그림후원 위젯 — code-first (no Figma frame). Route `/creator/widgets/drawing`.
 * Drawings go on the OBS drawing overlay one after another for the 전시 시간 each (2026-10-07 결정: 대기열);
 * the creator can show any drawing now, or take the current one down so the next goes up.
 */
export function DrawingScreen({ view, overlayPath, switches }: { view: DrawingView; overlayPath: string; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const [displaySec, setDisplaySec] = useState(view.settings.displaySec);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  const requestId = useRef<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    const poll = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(poll);
  }, [router]);

  const run = (action: () => Promise<MediaResult>, okText: string, after?: () => void) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "OK") {
          setNote({ tone: "ok", text: okText });
          after?.();
          router.refresh();
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : "로그인이 필요합니다." });
      } catch {
        setNote({ tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };
  const sendTest = () => {
    requestId.current ??= crypto.randomUUID();
    run(() => addTestDrawing({ requestId: requestId.current }), view.showing ? "테스트 그림을 대기열에 넣었어요." : "테스트 그림을 전시했어요.", () => (requestId.current = null));
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>그림후원</h1>
        <p className={styles.subtitle}>받은 그림 후원을 방송 화면에 전시해요. 새 그림은 받은 순서대로 하나씩 전시 시간 동안 뜨고, 지난 그림도 다시 띄울 수 있어요.</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">← 위젯</Link>
        </p>
      </header>
      <OverlayOffNotice targets={["drawing"]} switches={switches} />

      <section className={styles.card} aria-labelledby="drw-overlay">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="drw-overlay">
            🖼️ 그림 오버레이
          </h2>
          <CopyButton value={`${origin}${overlayPath}`} label="오버레이 URL 복사" className={styles.ghost} />
        </div>
        <p className={styles.note}>OBS 브라우저 소스 권장 크기 800 × 700. 주소에는 연동 키가 들어 있으니 공유하지 마세요.</p>
        <OverlayLookPicker target="drawing" />
        <div className={styles.addRow}>
          <span className={styles.muted}>전시 시간</span>
          <input
            className={styles.inputSmall}
            type="number"
            aria-label="전시 시간(초)"
            min={MEDIA_LIMITS.displaySecMin}
            max={MEDIA_LIMITS.displaySecMax}
            value={displaySec}
            onChange={(e) => setDisplaySec(Math.floor(Number(e.target.value) || 0))}
          />
          <span className={styles.muted}>초</span>
          <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => saveDrawingSettings({ displaySec }), "설정을 저장했어요.")}>
            저장
          </button>
          <button type="button" className={styles.ghost} disabled={pending} onClick={sendTest}>
            테스트 그림
          </button>
          {view.showing && (
            <button
              type="button"
              className={styles.danger}
              disabled={pending}
              onClick={() => run(() => setDrawingShowing({ id: null }), view.queue.length ? "화면에서 내리고 다음 그림을 전시했어요." : "화면에서 내렸어요.")}
            >
              {view.queue.length ? "내리고 다음 그림" : "화면에서 내리기"}
            </button>
          )}
        </div>
      </section>

      <section className={styles.card} aria-labelledby="drw-list">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="drw-list">
            🎨 받은 그림 {view.drawings.length}
          </h2>
          {view.queue.length > 0 && <span className={styles.muted}>대기 {view.queue.length}개</span>}
        </div>
        {view.drawings.length === 0 ? (
          <p className={styles.empty}>아직 받은 그림이 없어요. 테스트 그림으로 오버레이를 확인해 보세요.</p>
        ) : (
          <ul className={local.gallery}>
            {view.drawings.map((d) => (
              <li key={d.id} className={local.drawing} data-showing={view.showing?.id === d.id ? "" : undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={d.image} alt={d.title} />
                <div className={local.drawingInfo}>
                  <strong>{d.title}</strong>
                  <span className={styles.muted}>
                    {d.kind === "TEST" ? "테스트 요청" : `${d.donor} · ${formatNumber(d.fnAmount)} FN`}
                    {view.showing?.id === d.id ? " · 전시 중" : ""}
                    {view.queue.includes(d.id) ? ` · 대기 ${view.queue.indexOf(d.id) + 1}번째` : ""}
                  </span>
                </div>
                <div className={styles.rowActions}>
                  <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => setDrawingShowing({ id: d.id }), "다시 전시했어요.")}>
                    전시
                  </button>
                  <button
                    type="button"
                    className={styles.danger}
                    disabled={pending}
                    onClick={() => window.confirm(`'${d.title}' 그림을 목록에서 지울까요?`) && run(() => deleteDrawing(d.id), "그림을 지웠어요.")}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.note}>최근 {MEDIA_LIMITS.drawingsMax}개까지 보관해요 (보관 기간 TBD).</p>
      </section>

      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </div>
  );
}
