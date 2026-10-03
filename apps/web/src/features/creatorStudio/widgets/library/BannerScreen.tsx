"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { saveBannerSettings } from "@/services/creator/banner";
import { BANNER_LIMITS, BANNER_POSITIONS, type BannerPosition, type BannerSettings } from "@/services/creator/bannerTypes";
import type { Asset } from "@/services/creator/assetTypes";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import styles from "../../crew/crew.module.css";
import { OverlayOffNotice } from "../../remote/OverlayOffNotice";
import { CopyButton } from "../../settings/SettingsCards";
import local from "./library.module.css";

/**
 * 배너 위젯 — code-first (no Figma frame). Route `/creator/widgets/banner`.
 * Pick library images as slides; the OBS banner overlay cycles them at the chosen position.
 */
export function BannerScreen({ initial, library, overlayPath, switches }: { initial: BannerSettings; library: Asset[]; overlayPath: string; switches: Record<OverlayTarget, boolean> }) {
  const [s, setS] = useState<BannerSettings>(initial);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const byId = new Map(library.map((a) => [a.id, a]));
  const toggle = (id: string) =>
    setS((p) => (p.slides.includes(id) ? { ...p, slides: p.slides.filter((x) => x !== id) } : p.slides.length >= BANNER_LIMITS.slidesMax ? p : { ...p, slides: [...p.slides, id] }));
  const move = (i: number, d: -1 | 1) =>
    setS((p) => {
      const slides = [...p.slides];
      [slides[i], slides[i + d]] = [slides[i + d], slides[i]];
      return { ...p, slides };
    });

  const save = () => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await saveBannerSettings(s);
        setNote(res.status === "SAVED" ? { tone: "ok", text: "배너 설정을 저장했어요." } : { tone: "error", text: res.status === "INVALID" ? res.message : "로그인이 필요합니다." });
      } catch {
        setNote({ tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>배너</h1>
        <p className={styles.subtitle}>라이브러리 이미지로 슬라이드쇼 배너를 만들어 방송 화면 상단 · 중앙 · 하단에 띄워요.</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">← 위젯</Link> · 이미지는 <Link href="/creator/widgets/assets">이미지·사운드</Link>에서 올려요.
        </p>
      </header>
      <OverlayOffNotice targets={["banner"]} switches={switches} />

      <section className={styles.card} aria-labelledby="bn-overlay">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="bn-overlay">
            🖼️ 배너 오버레이
          </h2>
          <CopyButton value={`${origin}${overlayPath}`} label="오버레이 URL 복사" className={styles.ghost} />
        </div>
        <p className={styles.note}>OBS 브라우저 소스 권장 크기 1920 × 1080 (화면 전체에 두고 위치는 여기서 정해요). 주소에는 연동 키가 들어 있으니 공유하지 마세요.</p>
      </section>

      <section className={styles.card} aria-labelledby="bn-settings">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="bn-settings">
            ⚙️ 설정
          </h2>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
            사용
          </label>
        </div>
        <div className={styles.addRow}>
          <select className={styles.select} aria-label="위치" value={s.position} onChange={(e) => setS({ ...s, position: e.target.value as BannerPosition })}>
            {BANNER_POSITIONS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <input
            className={styles.inputSmall}
            type="number"
            aria-label="넘김 간격(초)"
            min={BANNER_LIMITS.intervalMin}
            max={BANNER_LIMITS.intervalMax}
            value={s.intervalSec}
            onChange={(e) => setS({ ...s, intervalSec: Math.floor(Number(e.target.value) || 0) })}
          />
          <span className={styles.muted}>초마다 다음 슬라이드</span>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="bn-slides">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="bn-slides">
            🎞️ 슬라이드 {s.slides.length}/{BANNER_LIMITS.slidesMax}
          </h2>
        </div>
        {s.slides.length === 0 ? (
          <p className={styles.empty}>아래 라이브러리에서 이미지를 골라 주세요.</p>
        ) : (
          <ol className={styles.list}>
            {s.slides.map((id, i) => {
              const a = byId.get(id);
              return (
                <li key={id} className={styles.row}>
                  <span className={styles.muted}>{i + 1}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a && <img className={local.slideThumb} src={a.url} alt="" />}
                  <span className={styles.rowMain}>{a?.name ?? "삭제된 이미지"}</span>
                  <div className={styles.rowActions}>
                    <button type="button" className={styles.ghost} aria-label={`${i + 1}번 위로`} disabled={i === 0} onClick={() => move(i, -1)}>
                      ↑
                    </button>
                    <button type="button" className={styles.ghost} aria-label={`${i + 1}번 아래로`} disabled={i === s.slides.length - 1} onClick={() => move(i, 1)}>
                      ↓
                    </button>
                    <button type="button" className={styles.danger} onClick={() => toggle(id)}>
                      빼기
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        <h3 className={local.subhead}>라이브러리 이미지</h3>
        {library.length === 0 ? (
          <p className={styles.empty}>
            라이브러리에 이미지가 없어요. <Link href="/creator/widgets/assets">이미지·사운드</Link>에서 먼저 올려 주세요.
          </p>
        ) : (
          <div className={local.picker} role="group" aria-label="슬라이드로 쓸 이미지">
            {library.map((a) => (
              <button key={a.id} type="button" className={local.pick} aria-pressed={s.slides.includes(a.id)} aria-label={a.name} onClick={() => toggle(a.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="" />
              </button>
            ))}
          </div>
        )}
      </section>

      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={pending} onClick={save}>
          {pending ? "저장 중…" : "설정 저장"}
        </button>
      </div>
    </div>
  );
}
