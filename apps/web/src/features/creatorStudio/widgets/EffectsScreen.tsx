"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { saveEffectSettings } from "@/services/creator/effects";
import { EFFECT_LIMITS, EMOJI_PRESETS, LAYER_EFFECTS, type EffectSettings, type LayerEffect } from "@/services/creator/effectsTypes";
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";
import local from "./effects.module.css";

/**
 * 이모지 리액션 · 레이어 효과 설정 — code-first (no Figma frame). Route `/creator/widgets/effects`.
 * Effects play with each donation alert on the OBS effects overlay; triggers are channel settings.
 */
export function EffectsScreen({ initial, overlayPath }: { initial: EffectSettings; overlayPath: string }) {
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
  const setTier = (i: number, patch: Partial<{ minFn: number; effect: LayerEffect }>) => setS((p) => ({ ...p, layer: { ...p.layer, tiers: p.layer.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) } }));

  const save = () => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await saveEffectSettings(s);
        setNote(res.status === "SAVED" ? { tone: "ok", text: "이펙트 설정을 저장했어요." } : { tone: "error", text: res.status === "INVALID" ? res.message : "로그인이 필요합니다." });
      } catch {
        setNote({ tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>이펙트 · 효과</h1>
        <p className={styles.subtitle}>후원 알림이 뜰 때 방송 화면에 이모지와 전체 화면 효과를 함께 띄워요. 조건은 채널에서 직접 정해요.</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">← 위젯</Link> · 테스트는 <Link href="/creator/remote">리모컨</Link>의 테스트 후원으로 해 보세요.
        </p>
      </header>

      <section className={styles.card} aria-labelledby="fx-overlay">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="fx-overlay">
            ✨ 이펙트 오버레이
          </h2>
          <CopyButton value={`${origin}${overlayPath}`} label="오버레이 URL 복사" className={styles.ghost} />
        </div>
        <p className={styles.note}>OBS 브라우저 소스 권장 크기 1920 × 1080 (알림 오버레이 위에 배치). 주소에는 연동 키가 들어 있으니 공유하지 마세요.</p>
      </section>

      <section className={styles.card} aria-labelledby="fx-emoji">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="fx-emoji">
            😍 이모지 리액션
          </h2>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={s.emoji.enabled} onChange={(e) => setEmoji({ enabled: e.target.checked })} />
            사용
          </label>
        </div>
        <div className={styles.addRow}>
          <input className={styles.inputSmall} type="number" min={0} aria-label="이모지 최소 금액(FN)" value={s.emoji.minFn} onChange={(e) => setEmoji({ minFn: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
          <span className={styles.muted}>FN 이상 후원 시</span>
          <input
            className={styles.inputSmall}
            type="number"
            min={EFFECT_LIMITS.countMin}
            max={EFFECT_LIMITS.countMax}
            aria-label="이모지 개수"
            value={s.emoji.count}
            onChange={(e) => setEmoji({ count: Math.floor(Number(e.target.value) || 0) })}
          />
          <span className={styles.muted}>개</span>
        </div>
        <div className={local.emojis} role="group" aria-label={`이모지 선택 (최대 ${EFFECT_LIMITS.emojisMax}개)`}>
          {EMOJI_PRESETS.map((e) => (
            <button key={e} type="button" className={local.emoji} aria-pressed={s.emoji.emojis.includes(e)} onClick={() => toggleEmoji(e)}>
              {e}
            </button>
          ))}
        </div>
        <p className={styles.note}>1~{EFFECT_LIMITS.emojisMax}개를 고를 수 있어요.</p>
      </section>

      <section className={styles.card} aria-labelledby="fx-layer">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="fx-layer">
            🎆 레이어 효과
          </h2>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={s.layer.enabled} onChange={(e) => setLayer({ enabled: e.target.checked })} />
            사용
          </label>
        </div>
        <p className={styles.note}>금액 구간마다 효과를 정해요. 후원 금액에 맞는 가장 높은 구간의 효과가 재생돼요.</p>
        <ul className={styles.list}>
          {s.layer.tiers.map((t, i) => (
            <li key={i} className={styles.row}>
              <input className={styles.inputSmall} type="number" min={0} aria-label={`구간 ${i + 1} 최소 금액(FN)`} value={t.minFn} onChange={(e) => setTier(i, { minFn: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
              <span className={styles.muted}>FN 이상 →</span>
              <select className={styles.select} aria-label={`구간 ${i + 1} 효과`} value={t.effect} onChange={(e) => setTier(i, { effect: e.target.value as LayerEffect })}>
                {LAYER_EFFECTS.map((l) => (
                  <option key={l.key} value={l.key}>
                    {l.emoji} {l.label}
                  </option>
                ))}
              </select>
              {s.layer.tiers.length > 1 && (
                <button type="button" className={styles.ghost} onClick={() => setLayer({ tiers: s.layer.tiers.filter((_, j) => j !== i) })}>
                  삭제
                </button>
              )}
            </li>
          ))}
        </ul>
        {s.layer.tiers.length < EFFECT_LIMITS.tiersMax && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => setLayer({ tiers: [...s.layer.tiers, { minFn: (s.layer.tiers.at(-1)?.minFn ?? 0) * 2 || 10_000, effect: "HEARTS" }] })}
          >
            + 구간 추가
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
          {pending ? "저장 중…" : "설정 저장"}
        </button>
      </div>
    </div>
  );
}
