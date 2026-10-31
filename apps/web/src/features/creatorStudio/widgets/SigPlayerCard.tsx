"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { saveSigPlayerSettings } from "@/services/creator/sigPlayer";
import { SIG_PLAYER_MODES, SIG_PLAYER_WAIT_MAX, type SigPlayerSettings } from "@/services/creator/sigPlayerTypes";
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";

/**
 * 시그니처 플레이어 — code-first (no Figma frame; StreamDonate 시그니처 플레이어 참고, 2026-10-25), in
 * `/creator/widgets/signatures`: 보여 줄 방식 (BJ 매치 / 메시지), 노래 전 대기, 소리, and the OBS address (copied whole).
 */
export function SigPlayerCard({ initial, overlayPath }: { initial: SigPlayerSettings; overlayPath: string }) {
  const [s, setS] = useState(initial);
  const [wait, setWait] = useState(String(initial.waitSec));
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const dirty = s.mode !== initial.mode || s.sound !== initial.sound || wait !== String(initial.waitSec);

  const save = () => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await saveSigPlayerSettings({ ...s, waitSec: Number(wait) });
        setNote(res.status === "SAVED" ? { tone: "ok", text: "시그니처 플레이어 설정을 저장했어요." } : { tone: "error", text: res.status === "INVALID" ? res.message : "로그인이 필요합니다." });
      } catch {
        setNote({ tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  return (
    <section className={styles.card} aria-labelledby="sig-player">
      <h2 className={styles.cardTitle} id="sig-player">
        🎵 시그니처 플레이어
      </h2>
      <p className={styles.note}>
        시그니처 후원(금액 일치 포함)이 알림으로 나갈 때, 이 오버레이가 먼저 배너를 보여 주고 이어서 시그니처 이미지를 크게 보여 줘요. 알림 표시 시간이 끝나면 함께 사라져요.{" "}
        <Link href="/creator/remote">리모컨</Link>의 테스트 후원에서 시그니처를 골라 확인할 수 있어요.
      </p>
      <div className={styles.segment} role="group" aria-label="보여 줄 방식">
        {SIG_PLAYER_MODES.map((m) => (
          <button key={m.key} type="button" aria-pressed={s.mode === m.key} onClick={() => setS({ ...s, mode: m.key })}>
            {m.label}
          </button>
        ))}
      </div>
      <p className={styles.note}>{SIG_PLAYER_MODES.find((m) => m.key === s.mode)!.note}</p>
      <div className={styles.addRow}>
        <input className={styles.input} type="number" min={0} max={SIG_PLAYER_WAIT_MAX} aria-label="노래 전 대기(초)" value={wait} onChange={(e) => setWait(e.target.value)} />
        <span className={styles.muted}>초 노래 전 대기 (0이면 바로 이미지)</span>
      </div>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={s.sound} onChange={(e) => setS({ ...s, sound: e.target.checked })} />
        이 오버레이에서 시그니처 소리 내기
      </label>
      <p className={styles.note}>후원 알림 오버레이도 시그니처 소리를 내요. 두 오버레이를 함께 쓰면 소리는 한쪽에서만 나오게 해 주세요.</p>
      <div className={styles.addRow}>
        <input className={styles.input} readOnly aria-label="시그니처 플레이어 오버레이 주소" value={`${origin}${overlayPath.replace(/[^/]+$/, (k) => `${k.slice(0, 4)}-····-····-····`)}`} />
        <CopyButton value={`${origin}${overlayPath}`} label="복사" className={styles.ghost} />
      </div>
      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={pending || !dirty} onClick={save}>
          {pending ? "저장 중…" : "설정 저장"}
        </button>
      </div>
    </section>
  );
}
